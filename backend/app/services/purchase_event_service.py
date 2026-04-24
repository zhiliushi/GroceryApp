"""Purchase event service — user's shopping events.

Data model:
  users/{uid}/purchases/{event_id}

Invariants:
  - Every event references an existing catalog entry
  - Creation is transactional: catalog upsert + event create + counter increment
  - Status transitions: active -> used | thrown | transferred (terminal)
  - FIFO use: oldest-expiry active event for a catalog entry is used first
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from firebase_admin import firestore

from app.core.cursor import decode_cursor, encode_cursor
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.feature_flags import is_enabled
from app.core.metadata import apply_create_metadata, apply_update_metadata
from app.schemas.purchase import VALID_STATUSES, VALID_CONSUME_REASONS, VALID_PAYMENT_METHODS
from app.services import catalog_service, country_service, nl_expiry

logger = logging.getLogger(__name__)


def _db():
    return firestore.client()


def _user_purchases_ref(user_id: str):
    return _db().collection("users").document(user_id).collection("purchases")


# ---------------------------------------------------------------------------
# Create (core add-item flow)
# ---------------------------------------------------------------------------


def create_purchase(
    user_id: str,
    name: Optional[str] = None,
    catalog_name_norm: Optional[str] = None,
    barcode: Optional[str] = None,
    quantity: float = 1.0,
    unit: Optional[str] = None,
    expiry_raw: Optional[str] = None,
    expiry_date: Optional[datetime] = None,
    price: Optional[float] = None,
    currency: Optional[str] = None,
    payment_method: Optional[str] = None,
    date_bought: Optional[datetime] = None,
    location: Optional[str] = None,
    household_id: Optional[str] = None,
    source: str = "api",
) -> dict:
    """Create a purchase event. Transactionally upserts catalog entry + increments counters.

    Either `name` OR `catalog_name_norm` must be provided.

    Raises:
        ValidationError: invalid name, quantity <= 0, bad payment method, etc.
        ConflictError: barcode collision on catalog (propagated from catalog_service)
    """
    # --- Resolve catalog entry (either by name or explicit norm) ---
    if not name and not catalog_name_norm:
        raise ValidationError("Either 'name' or 'catalog_name_norm' is required")

    if payment_method is not None and payment_method not in VALID_PAYMENT_METHODS:
        raise ValidationError(f"Invalid payment_method: {payment_method!r}")

    if quantity <= 0:
        raise ValidationError("quantity must be > 0")

    # If caller provided a name, upsert the catalog entry first (outside transaction)
    # — this is idempotent and safe to retry
    if name:
        catalog_entry = catalog_service.upsert_catalog_entry(
            user_id=user_id,
            display_name=name,
            barcode=barcode,
            country_code=(
                country_service.detect_country_by_barcode(barcode)
                if barcode and is_enabled("barcode_country_autodetect")
                else None
            ),
            default_location=location,
            source=source,
            actor_uid=user_id,
        )
        resolved_name_norm = catalog_entry["name_norm"]
        display_name = catalog_entry["display_name"]
        country_code = catalog_entry.get("country_code")
    else:
        # Caller provided explicit catalog_name_norm — look it up
        catalog_entry = catalog_service.get_catalog_entry(user_id, catalog_name_norm)
        if not catalog_entry:
            raise NotFoundError(f"Catalog entry '{catalog_name_norm}' not found")
        resolved_name_norm = catalog_name_norm
        display_name = catalog_entry["display_name"]
        country_code = catalog_entry.get("country_code")
        if barcode and not catalog_entry.get("barcode"):
            # Attach barcode to existing catalog entry
            catalog_service.update_catalog_entry(user_id, resolved_name_norm, {"barcode": barcode})
            country_code = country_code or country_service.detect_country_by_barcode(barcode)

    # --- Parse expiry (natural language overrides raw ISO if both provided) ---
    parsed_expiry = expiry_date
    expiry_source = "user" if expiry_date else None
    if expiry_raw and is_enabled("nl_expiry_parser"):
        nl_dt, nl_tag = nl_expiry.parse_expiry(expiry_raw)
        if nl_tag == "none":
            parsed_expiry = None
            expiry_source = "none"
        elif nl_dt is not None:
            parsed_expiry = nl_dt
            expiry_source = nl_tag

    # --- Build event data ---
    now = datetime.now(timezone.utc)
    event_data = {
        "catalog_name_norm": resolved_name_norm,
        "catalog_display": display_name,
        "barcode": barcode or catalog_entry.get("barcode"),
        "country_code": country_code,
        "quantity": float(quantity),
        "unit": unit,
        "expiry_date": parsed_expiry,
        "expiry_source": expiry_source,
        "expiry_raw": expiry_raw,
        "price": price,
        "currency": currency,
        "payment_method": payment_method,
        "date_bought": date_bought or now,
        "location": location or catalog_entry.get("default_location"),
        "status": "active",
        "consumed_date": None,
        "consumed_reason": None,
        "transferred_to": None,
        "reminder_stage": 0,
        "last_reminded_at": None,
        "household_id": household_id,
        "source_ref": None,
    }

    # --- Create event + increment counters in a transaction ---
    event_ref = _user_purchases_ref(user_id).document()  # pre-allocate ID
    event_id = event_ref.id

    transaction = _db().transaction()

    @firestore.transactional
    def _commit(tx):
        tx.set(event_ref, apply_create_metadata(event_data, uid=user_id, source=source))
        catalog_service.increment_counters_tx(
            tx, user_id, resolved_name_norm, active_delta=1, total_delta=1
        )

    _commit(transaction)

    logger.info(
        "purchase.created user=%s event_id=%s name=%s",
        user_id, event_id, resolved_name_norm,
    )
    return get_purchase(user_id, event_id)


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------


def get_purchase(user_id: str, event_id: str) -> Optional[dict]:
    """Get a single purchase event. Returns None if missing."""
    snap = _user_purchases_ref(user_id).document(event_id).get()
    if not snap.exists:
        return None
    data = snap.to_dict()
    data["id"] = snap.id
    return data


def list_purchases(
    user_id: str,
    status: Optional[str] = None,
    location: Optional[str] = None,
    catalog_name_norm: Optional[str] = None,
    limit: int = 100,
    cursor: Optional[str] = None,
) -> dict:
    """List purchase events for a user with cursor pagination.

    Filters on status/location/catalog. Most recent first (by date_bought desc).

    Returns:
        {"items": [...], "next_cursor": str | None, "count": int}
    """
    q = _user_purchases_ref(user_id)
    if status:
        q = q.where("status", "==", status)
    if location:
        q = q.where("location", "==", location)
    if catalog_name_norm:
        q = q.where("catalog_name_norm", "==", catalog_name_norm)

    # Sort date_bought desc + doc-id tiebreaker for stable cursor pagination
    q = (
        q.order_by("date_bought", direction=firestore.Query.DESCENDING)
        .order_by("__name__")
    )

    if cursor:
        decoded = decode_cursor(cursor)
        if len(decoded) == 2:
            q = q.start_after({"date_bought": decoded[0], "__name__": decoded[1]})

    docs = list(q.limit(limit + 1).stream())
    has_more = len(docs) > limit
    page = docs[:limit]

    results = []
    for doc in page:
        data = doc.to_dict() or {}
        data["id"] = doc.id
        results.append(data)

    next_cursor: Optional[str] = None
    if has_more and page:
        last = page[-1]
        last_data = last.to_dict() or {}
        next_cursor = encode_cursor([last_data.get("date_bought"), last.id])

    return {"items": results, "next_cursor": next_cursor, "count": len(results)}


def find_purchases_by_barcode(user_id: str, barcode: str) -> dict:
    """Find active purchase events matching a barcode (for scanner flows).

    Returns:
        {
          "barcode": str,
          "items": [...],   # active events sorted by expiry asc (FIFO)
          "total_in_stock": int
        }
    """
    q = (
        _user_purchases_ref(user_id)
        .where("status", "==", "active")
        .where("barcode", "==", barcode)
    )
    items = []
    for doc in q.stream():
        data = doc.to_dict()
        data["id"] = doc.id
        items.append(data)

    # Sort by expiry ascending (null expiries last), then by date_bought ascending
    def _sort_key(item):
        exp = item.get("expiry_date")
        # Convert Firestore Timestamp to datetime if needed
        if hasattr(exp, "to_datetime"):
            exp = exp.to_datetime()
        return (exp is None, exp, item.get("date_bought"))

    items.sort(key=_sort_key)
    return {"barcode": barcode, "items": items, "total_in_stock": len(items)}


# ---------------------------------------------------------------------------
# Update — partial edit
# ---------------------------------------------------------------------------


def update_purchase(user_id: str, event_id: str, updates: dict[str, Any]) -> dict:
    """Partial update on a purchase event. Does NOT change status (use update_status).

    Allowed fields: quantity, unit, expiry_raw/expiry_date, price, payment_method, location.
    """
    doc_ref = _user_purchases_ref(user_id).document(event_id)
    snap = doc_ref.get()
    if not snap.exists:
        raise NotFoundError(f"Purchase event '{event_id}' not found")

    allowed = {"quantity", "unit", "expiry_date", "expiry_raw", "price", "payment_method", "location"}
    clean = {k: v for k, v in updates.items() if k in allowed and v is not None}

    if "payment_method" in clean and clean["payment_method"] not in VALID_PAYMENT_METHODS:
        raise ValidationError(f"Invalid payment_method: {clean['payment_method']!r}")

    # Re-parse expiry if expiry_raw provided
    if "expiry_raw" in clean and clean["expiry_raw"] is not None and is_enabled("nl_expiry_parser"):
        nl_dt, nl_tag = nl_expiry.parse_expiry(clean["expiry_raw"])
        if nl_tag == "none":
            clean["expiry_date"] = None
            clean["expiry_source"] = "none"
        elif nl_dt is not None:
            clean["expiry_date"] = nl_dt
            clean["expiry_source"] = nl_tag

    doc_ref.update(apply_update_metadata(clean))
    logger.info("purchase.updated user=%s event_id=%s fields=%s", user_id, event_id, list(clean))
    return get_purchase(user_id, event_id)


# ---------------------------------------------------------------------------
# Status transitions (used / thrown / transferred)
# ---------------------------------------------------------------------------


def validate_status_transition(
    current_status: str,
    new_status: str,
    reason: Optional[str] = None,
    transferred_to: Optional[str] = None,
) -> Optional[str]:
    """Pure validation of a purchase-event status transition.

    Extracted from `update_status` for unit testing without Firestore.
    Returns the normalized `reason` (may be defaulted to "expired" for thrown).

    Raises:
        ValidationError: any rule violation.

    Rules:
      - new_status must be one of {used, thrown, transferred}
      - For thrown: reason must be in VALID_CONSUME_REASONS (defaults to "expired")
      - For transferred: transferred_to is required
      - current_status must be "active" — terminal states can't transition
    """
    if new_status not in ("used", "thrown", "transferred"):
        raise ValidationError(f"Invalid status transition target: {new_status!r}")

    normalized_reason = reason
    if new_status == "thrown":
        normalized_reason = reason or "expired"
        if normalized_reason not in VALID_CONSUME_REASONS:
            raise ValidationError(f"Invalid thrown reason: {normalized_reason!r}")

    if new_status == "transferred" and not transferred_to:
        raise ValidationError("transferred_to required when status=transferred")

    if current_status != "active":
        raise ValidationError(
            f"Cannot change status from '{current_status}' (terminal state)",
            details={"current_status": current_status},
        )

    return normalized_reason


def update_status(
    user_id: str,
    event_id: str,
    status: str,
    reason: Optional[str] = None,
    transferred_to: Optional[str] = None,
) -> dict:
    """Change status. Validates transition + handles catalog counter.

    Valid transitions: active -> used | thrown | transferred.
    Terminal states (used/thrown/transferred) cannot be changed.

    Args:
        status: New status ("used", "thrown", or "transferred")
        reason: Required for "thrown". Optional for "used".
        transferred_to: Required for "transferred" (foodbank_id or recipient uid)

    Raises:
        NotFoundError, ValidationError
    """
    # Pure pre-fetch validation (target + reason + recipient shape)
    reason = validate_status_transition("active", status, reason, transferred_to)

    doc_ref = _user_purchases_ref(user_id).document(event_id)
    snap = doc_ref.get()
    if not snap.exists:
        raise NotFoundError(f"Purchase event '{event_id}' not found")

    data = snap.to_dict() or {}
    current_status = data.get("status", "active")
    # Re-validate now that we know the actual current status (terminal check)
    validate_status_transition(current_status, status, reason, transferred_to)

    catalog_name_norm = data.get("catalog_name_norm")
    if not catalog_name_norm:
        raise ValidationError(f"Event '{event_id}' missing catalog_name_norm (orphan)")

    now = datetime.now(timezone.utc)
    event_updates: dict[str, Any] = {
        "status": status,
        "consumed_date": now,
    }
    if status == "used" and reason is None:
        event_updates["consumed_reason"] = "used_up"
    elif reason:
        event_updates["consumed_reason"] = reason
    if transferred_to:
        event_updates["transferred_to"] = transferred_to

    # Transaction: decrement active_purchases + update event
    transaction = _db().transaction()

    @firestore.transactional
    def _commit(tx):
        tx.update(doc_ref, apply_update_metadata(event_updates))
        catalog_service.increment_counters_tx(
            tx, user_id, catalog_name_norm, active_delta=-1, total_delta=0
        )

    _commit(transaction)

    logger.info(
        "purchase.status user=%s event_id=%s %s->%s reason=%s",
        user_id, event_id, current_status, status, reason,
    )
    return get_purchase(user_id, event_id)


def consume_one_by_catalog(user_id: str, catalog_name_norm: str, quantity: int = 1) -> dict:
    """FIFO consume: find oldest-expiry active event for this catalog entry, mark used.

    If quantity > 1, marks the next N events used (in expiry order).

    Returns:
        {"consumed": [...event ids...], "remaining_active": int, "message": str}

    Raises:
        NotFoundError: if no active events exist
    """
    result = find_purchases_by_barcode(user_id, "")  # not by barcode — filter by catalog
    # Actually query by catalog_name_norm directly
    q = (
        _user_purchases_ref(user_id)
        .where("status", "==", "active")
        .where("catalog_name_norm", "==", catalog_name_norm)
    )
    events = []
    for doc in q.stream():
        data = doc.to_dict()
        data["id"] = doc.id
        events.append(data)

    if not events:
        raise NotFoundError(f"No active purchases found for '{catalog_name_norm}'")

    # Sort FIFO: oldest expiry first (nulls last), then oldest date_bought
    def _sort_key(event):
        exp = event.get("expiry_date")
        if hasattr(exp, "to_datetime"):
            exp = exp.to_datetime()
        return (exp is None, exp, event.get("date_bought"))

    events.sort(key=_sort_key)

    consumed_ids = []
    for event in events[:quantity]:
        update_status(user_id, event["id"], "used", reason="used_up")
        consumed_ids.append(event["id"])

    return {
        "consumed": consumed_ids,
        "remaining_active": len(events) - len(consumed_ids),
        "message": f"Marked {len(consumed_ids)} '{events[0].get('catalog_display', catalog_name_norm)}' as used",
    }


# ---------------------------------------------------------------------------
# Delete — rare, prefer status=thrown for preservable history
# ---------------------------------------------------------------------------


def delete_purchase(user_id: str, event_id: str) -> None:
    """Hard-delete a purchase event. Decrements catalog.active_purchases if was active.

    Prefer update_status() over delete — delete is for data corrections / admin cleanup.
    """
    doc_ref = _user_purchases_ref(user_id).document(event_id)
    snap = doc_ref.get()
    if not snap.exists:
        raise NotFoundError(f"Purchase event '{event_id}' not found")

    data = snap.to_dict() or {}
    catalog_name_norm = data.get("catalog_name_norm")
    was_active = data.get("status") == "active"

    transaction = _db().transaction()

    @firestore.transactional
    def _commit(tx):
        tx.delete(doc_ref)
        if was_active and catalog_name_norm:
            catalog_service.increment_counters_tx(
                tx, user_id, catalog_name_norm,
                active_delta=-1, total_delta=-1,
            )

    _commit(transaction)
    logger.info("purchase.deleted user=%s event_id=%s was_active=%s", user_id, event_id, was_active)


# ---------------------------------------------------------------------------
# Scheduler — flag events past expiry
# ---------------------------------------------------------------------------


def flag_expired_purchases() -> int:
    """Collection-group scan: find active events with expiry in the past and flag them.

    Does NOT change status automatically (user must choose used/thrown). Just ensures
    they surface in urgent-view UI. Sets `expiry_past=True` for easy filtering.

    Returns count of events flagged.
    """
    now = datetime.now(timezone.utc)
    db = _db()
    query = (
        db.collection_group("purchases")
        .where("status", "==", "active")
        .where("expiry_date", "<", now)
    )

    flagged = 0
    batch = db.batch()
    batch_count = 0
    for doc in query.stream():
        data = doc.to_dict() or {}
        if data.get("expiry_past"):
            continue
        batch.update(doc.reference, apply_update_metadata({"expiry_past": True}))
        batch_count += 1
        flagged += 1
        if batch_count >= 400:
            batch.commit()
            batch = db.batch()
            batch_count = 0
    if batch_count:
        batch.commit()

    if flagged:
        logger.info("purchase.flag_expired flagged=%d", flagged)
    return flagged
