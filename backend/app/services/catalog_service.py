"""Catalog service — user's personal name catalog (reusable items).

Data model:
  catalog_entries/{user_id}__{name_norm}

Key invariants:
  - (user_id, name_norm) unique — enforced by doc ID
  - (user_id, barcode) unique when barcode != null — enforced by API transaction
  - Deletion requires active_purchases == 0
  - Merge reparents all purchase events atomically
"""

from __future__ import annotations

import logging
import re
from typing import Any, Optional

from firebase_admin import firestore

from app.core.cursor import decode_cursor, encode_cursor
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.metadata import apply_create_metadata, apply_update_metadata

logger = logging.getLogger(__name__)

_COLLECTION = "catalog_entries"
_MAX_NAME_LEN = 300


def _db():
    return firestore.client()


def _normalize(name: str) -> str:
    """Canonical name normalization used for catalog doc IDs.

    Rules:
    - Lowercase
    - Strip leading/trailing whitespace
    - Collapse internal whitespace to single underscore
    - Remove punctuation except word chars (letters, digits, underscore) and spaces
    - Strip any resulting leading/trailing underscores

    Examples:
        "Milk"       -> "milk"
        "MILK"       -> "milk"
        " milk "     -> "milk"
        "Milk 1L"    -> "milk_1l"
        "Dr. Pepper" -> "dr_pepper"
        "100% Juice" -> "100_juice"
        "!!!"        -> ""  (rejected)
    """
    if name is None:
        return ""
    stripped = name.strip().lower()
    # Remove everything except word chars and whitespace
    cleaned = re.sub(r"[^\w\s]", "", stripped)
    # Collapse whitespace to single underscore, strip edge underscores
    return re.sub(r"\s+", "_", cleaned).strip("_")


def _doc_id(user_id: str, name_norm: str) -> str:
    """Compose catalog doc ID from user_id + normalized name."""
    return f"{user_id}__{name_norm}"


def _validate_name_norm(name_norm: str) -> None:
    """Validate normalized name for Firestore storage."""
    if not name_norm:
        raise ValidationError("Name cannot be empty after normalization")
    if len(name_norm) > _MAX_NAME_LEN:
        raise ValidationError(
            f"Name too long ({len(name_norm)} chars after normalization, max {_MAX_NAME_LEN})"
        )


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------


def get_catalog_entry(user_id: str, name_norm: str) -> Optional[dict]:
    """Get a single catalog entry. Returns None if missing."""
    doc = _db().collection(_COLLECTION).document(_doc_id(user_id, name_norm)).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    data["id"] = doc.id
    return data


def find_by_barcode(user_id: str, barcode: str) -> Optional[dict]:
    """Find this user's catalog entry with a given barcode. Returns None if no match."""
    if not barcode:
        return None
    query = (
        _db()
        .collection(_COLLECTION)
        .where("user_id", "==", user_id)
        .where("barcode", "==", barcode)
        .limit(1)
    )
    for doc in query.stream():
        data = doc.to_dict()
        data["id"] = doc.id
        return data
    return None


_SORT_FIELDS = {
    "last_purchased_at": ("last_purchased_at", firestore.Query.DESCENDING),
    "total_purchases": ("total_purchases", firestore.Query.DESCENDING),
    "display_name": ("display_name", firestore.Query.ASCENDING),
}


def list_catalog(
    user_id: str,
    query: str = "",
    limit: int = 50,
    sort_by: str = "last_purchased_at",
    cursor: Optional[str] = None,
) -> dict:
    """List catalog entries for a user with opaque cursor pagination.

    Args:
        user_id: user's uid
        query: optional autocomplete substring (matches name_norm prefix)
        limit: max results per page
        sort_by: "last_purchased_at" (default) | "total_purchases" | "display_name"
        cursor: opaque cursor from a previous response's `next_cursor`

    Returns:
        {"items": [...], "next_cursor": str | None, "count": int}
        next_cursor is None when no further pages exist.
    """
    q = _db().collection(_COLLECTION).where("user_id", "==", user_id)

    # Substring prefix match on name_norm
    if query:
        q_norm = _normalize(query)
        if q_norm:
            # Firestore prefix search via range
            q = q.where("name_norm", ">=", q_norm).where("name_norm", "<", q_norm + "")

    # Resolve sort config
    sort_key = sort_by if sort_by in _SORT_FIELDS else "last_purchased_at"
    sort_field, sort_direction = _SORT_FIELDS[sort_key]

    # Primary order + doc-id tiebreaker for stable pagination
    q = q.order_by(sort_field, direction=sort_direction).order_by("__name__")

    # Apply cursor — expected shape: [sort_value, doc_id]
    if cursor:
        decoded = decode_cursor(cursor)
        if len(decoded) == 2:
            q = q.start_after({sort_field: decoded[0], "__name__": decoded[1]})

    # Fetch limit+1 to detect if there's a next page without a count query
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
        next_cursor = encode_cursor([last_data.get(sort_field), last.id])

    return {"items": results, "next_cursor": next_cursor, "count": len(results)}


# ---------------------------------------------------------------------------
# Pure helpers (no Firestore — unit-testable)
# ---------------------------------------------------------------------------


def _compute_upsert_updates(
    existing_data: dict,
    display_name: str,
    barcode: Optional[str] = None,
    default_location: Optional[str] = None,
    default_category: Optional[str] = None,
    image_url: Optional[str] = None,
    country_code: Optional[str] = None,
) -> dict[str, Any]:
    """Pure computation of which fields to update on an existing catalog entry.

    Rules:
      - display_name changes → append old casing to aliases (preserve history)
      - barcode changes → include in updates (uniqueness checked by caller)
      - default_location / default_category / image_url / country_code — set only if missing
    """
    updates: dict[str, Any] = {}

    if existing_data.get("display_name") != display_name:
        aliases = set(existing_data.get("aliases", []))
        if existing_data.get("display_name"):
            aliases.add(existing_data["display_name"])
        if display_name not in aliases:
            aliases.add(display_name)
        updates["aliases"] = sorted(aliases)

    if barcode and existing_data.get("barcode") != barcode:
        updates["barcode"] = barcode

    if default_location and not existing_data.get("default_location"):
        updates["default_location"] = default_location
    if default_category and not existing_data.get("default_category"):
        updates["default_category"] = default_category
    if image_url and not existing_data.get("image_url"):
        updates["image_url"] = image_url
    if country_code and not existing_data.get("country_code"):
        updates["country_code"] = country_code

    return updates


def _compute_merge_updates(src_data: dict, dst_data: dict) -> dict[str, Any]:
    """Pure computation of how to update the destination entry during a merge.

    - Counter totals: dst + src
    - Aliases: union of both, plus src's display_name, minus dst's own name
    - Barcode: dst wins; if dst has none, inherit src's
    - needs_review: OR of both
    """
    new_aliases = set(dst_data.get("aliases", []))
    if src_data.get("display_name"):
        new_aliases.add(src_data["display_name"])
    for a in src_data.get("aliases", []):
        new_aliases.add(a)
    new_aliases.discard(dst_data.get("display_name", ""))

    updates: dict[str, Any] = {
        "total_purchases": int(dst_data.get("total_purchases", 0))
        + int(src_data.get("total_purchases", 0)),
        "active_purchases": int(dst_data.get("active_purchases", 0))
        + int(src_data.get("active_purchases", 0)),
        "aliases": sorted(new_aliases),
    }
    if not dst_data.get("barcode") and src_data.get("barcode"):
        updates["barcode"] = src_data["barcode"]
    if src_data.get("needs_review"):
        updates["needs_review"] = True
    return updates


# ---------------------------------------------------------------------------
# Write — upsert / update / delete
# ---------------------------------------------------------------------------


def upsert_catalog_entry(
    user_id: str,
    display_name: str,
    barcode: Optional[str] = None,
    default_location: Optional[str] = None,
    default_category: Optional[str] = None,
    image_url: Optional[str] = None,
    country_code: Optional[str] = None,
    source: str = "api",
    actor_uid: Optional[str] = None,
) -> dict:
    """Create or update a catalog entry. Does NOT touch purchase counters —
    those are maintained by purchase_event_service transactions.

    If entry exists: merges metadata (updates barcode, adds to aliases, etc.)
    If new: creates with counters at 0.

    Raises:
        ValidationError: if normalized name is empty
        ConflictError: if barcode is already linked to another entry for this user
    """
    name_norm = _normalize(display_name)
    _validate_name_norm(name_norm)

    doc_id = _doc_id(user_id, name_norm)
    doc_ref = _db().collection(_COLLECTION).document(doc_id)
    existing = doc_ref.get()

    if existing.exists:
        existing_data = existing.to_dict() or {}

        update_data = _compute_upsert_updates(
            existing_data=existing_data,
            display_name=display_name,
            barcode=barcode,
            default_location=default_location,
            default_category=default_category,
            image_url=image_url,
            country_code=country_code,
        )

        # Barcode uniqueness — must query Firestore, can't be pure
        if "barcode" in update_data and update_data["barcode"]:
            _check_barcode_not_linked_elsewhere(
                user_id, update_data["barcode"], exclude_doc_id=doc_id
            )

        if update_data:
            doc_ref.update(apply_update_metadata(update_data))

        return get_catalog_entry(user_id, name_norm)

    # New entry — check barcode uniqueness first
    if barcode:
        _check_barcode_not_linked_elsewhere(user_id, barcode)

    new_data = {
        "user_id": user_id,
        "name_norm": name_norm,
        "display_name": display_name,
        "aliases": [],
        "barcode": barcode,
        "country_code": country_code,
        "default_location": default_location,
        "default_category": default_category,
        "image_url": image_url,
        "total_purchases": 0,
        "active_purchases": 0,
        "last_purchased_at": None,
        "needs_review": False,
    }
    doc_ref.set(apply_create_metadata(new_data, uid=actor_uid or user_id, source=source))
    logger.info("catalog.created user=%s name_norm=%s", user_id, name_norm)
    return get_catalog_entry(user_id, name_norm)


def update_catalog_entry(
    user_id: str,
    name_norm: str,
    updates: dict[str, Any],
) -> dict:
    """Partial update on a catalog entry.

    Allowed fields: display_name, barcode, default_location, default_category,
                    image_url, country_code, needs_review

    Raises:
        NotFoundError if entry doesn't exist
        ConflictError if barcode change collides with another entry for this user
    """
    doc_ref = _db().collection(_COLLECTION).document(_doc_id(user_id, name_norm))
    snap = doc_ref.get()
    if not snap.exists:
        raise NotFoundError(f"Catalog entry '{name_norm}' not found")

    allowed = {"display_name", "barcode", "default_location", "default_category",
               "image_url", "country_code", "needs_review"}
    clean_updates = {k: v for k, v in updates.items() if k in allowed and v is not None}

    # Barcode uniqueness check
    if "barcode" in clean_updates and clean_updates["barcode"]:
        _check_barcode_not_linked_elsewhere(
            user_id,
            clean_updates["barcode"],
            exclude_doc_id=_doc_id(user_id, name_norm),
        )

    # Empty-string barcode = unlink
    if clean_updates.get("barcode") == "":
        clean_updates["barcode"] = None

    doc_ref.update(apply_update_metadata(clean_updates))
    logger.info("catalog.updated user=%s name_norm=%s fields=%s", user_id, name_norm, list(clean_updates))
    return get_catalog_entry(user_id, name_norm)


def delete_catalog_entry(user_id: str, name_norm: str, force: bool = False) -> None:
    """Delete a catalog entry. Blocked if active_purchases > 0 unless force=True.

    Raises:
        NotFoundError if entry doesn't exist
        ConflictError if has active purchases and not force
    """
    doc_ref = _db().collection(_COLLECTION).document(_doc_id(user_id, name_norm))
    snap = doc_ref.get()
    if not snap.exists:
        raise NotFoundError(f"Catalog entry '{name_norm}' not found")

    data = snap.to_dict() or {}
    if data.get("active_purchases", 0) > 0 and not force:
        raise ConflictError(
            f"Cannot delete catalog entry '{name_norm}': has {data.get('active_purchases')} active purchases",
            details={"active_purchases": data.get("active_purchases")},
        )

    doc_ref.delete()
    logger.info("catalog.deleted user=%s name_norm=%s force=%s", user_id, name_norm, force)


# ---------------------------------------------------------------------------
# Merge — combine two catalog entries, reparent purchase events
# ---------------------------------------------------------------------------


def merge_catalog(user_id: str, src_name_norm: str, dst_name_norm: str) -> dict:
    """Merge source catalog entry into destination. Reparents all purchase events.

    After merge:
      - dst.total_purchases += src.total_purchases
      - dst.active_purchases += src.active_purchases
      - dst.aliases += src.display_name + src.aliases
      - If dst has no barcode, inherits src's barcode
      - src is deleted

    Raises:
        NotFoundError: if src or dst doesn't exist
        ValidationError: if src == dst
    """
    if src_name_norm == dst_name_norm:
        raise ValidationError("Source and destination must differ")

    src_ref = _db().collection(_COLLECTION).document(_doc_id(user_id, src_name_norm))
    dst_ref = _db().collection(_COLLECTION).document(_doc_id(user_id, dst_name_norm))

    src_snap = src_ref.get()
    dst_snap = dst_ref.get()
    if not src_snap.exists:
        raise NotFoundError(f"Source catalog '{src_name_norm}' not found")
    if not dst_snap.exists:
        raise NotFoundError(f"Destination catalog '{dst_name_norm}' not found")

    src_data = src_snap.to_dict() or {}
    dst_data = dst_snap.to_dict() or {}

    # 1. Reparent all purchase events (batch)
    events_ref = (
        _db()
        .collection("users")
        .document(user_id)
        .collection("purchases")
        .where("catalog_name_norm", "==", src_name_norm)
    )
    batch = _db().batch()
    batch_count = 0
    reparented = 0
    for event_doc in events_ref.stream():
        batch.update(event_doc.reference, apply_update_metadata({
            "catalog_name_norm": dst_name_norm,
            "catalog_display": dst_data.get("display_name"),
        }))
        batch_count += 1
        reparented += 1
        if batch_count >= 400:
            batch.commit()
            batch = _db().batch()
            batch_count = 0
    if batch_count:
        batch.commit()

    # 2. Update destination — aggregate counters + aliases + barcode (pure computation)
    updates = _compute_merge_updates(src_data, dst_data)
    dst_ref.update(apply_update_metadata(updates))

    # 3. Delete source
    src_ref.delete()

    logger.info(
        "catalog.merged user=%s src=%s dst=%s events=%d",
        user_id, src_name_norm, dst_name_norm, reparented,
    )
    return get_catalog_entry(user_id, dst_name_norm)


# ---------------------------------------------------------------------------
# Counter updates — called by purchase_event_service in transactions
# ---------------------------------------------------------------------------


def increment_counters_tx(tx, user_id: str, name_norm: str, active_delta: int, total_delta: int) -> None:
    """Transactional counter update. Used by purchase_event_service.

    Args:
        tx: Firestore transaction
        user_id: owner
        name_norm: catalog key
        active_delta: +1 on create, -1 on status change (active→used/thrown/transferred)
        total_delta: +1 on create, 0 on status change
    """
    doc_ref = _db().collection(_COLLECTION).document(_doc_id(user_id, name_norm))
    updates: dict[str, Any] = {
        "updated_at": firestore.SERVER_TIMESTAMP,
    }
    if active_delta:
        updates["active_purchases"] = firestore.Increment(active_delta)
    if total_delta:
        updates["total_purchases"] = firestore.Increment(total_delta)
    if total_delta > 0:
        updates["last_purchased_at"] = firestore.SERVER_TIMESTAMP
    tx.update(doc_ref, updates)


# ---------------------------------------------------------------------------
# Cleanup — scheduler job
# ---------------------------------------------------------------------------


def cleanup_unlinked_catalog(dry_run: bool = False) -> int:
    """Delete catalog entries where:
        - barcode IS null (user-created, no product link)
        - active_purchases == 0
        - last_purchased_at < now - 365 days

    Returns count of entries deleted (or would-be-deleted in dry_run).
    """
    from datetime import datetime, timedelta, timezone
    cutoff = datetime.now(timezone.utc) - timedelta(days=365)

    # Firestore can't query "barcode IS null" directly — need to scan
    # For efficiency, filter by active_purchases first (sparse field)
    query = (
        _db()
        .collection(_COLLECTION)
        .where("active_purchases", "==", 0)
        .where("last_purchased_at", "<", cutoff)
    )

    deleted = 0
    batch = _db().batch()
    batch_count = 0
    for doc in query.stream():
        data = doc.to_dict() or {}
        if data.get("barcode"):  # skip if linked to barcode
            continue
        if dry_run:
            logger.info("cleanup.would_delete id=%s", doc.id)
        else:
            batch.delete(doc.reference)
            batch_count += 1
            if batch_count >= 400:
                batch.commit()
                batch = _db().batch()
                batch_count = 0
        deleted += 1

    if not dry_run and batch_count:
        batch.commit()

    if deleted:
        logger.info("catalog.cleanup deleted=%d dry_run=%s", deleted, dry_run)
    return deleted


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _check_barcode_not_linked_elsewhere(
    user_id: str,
    barcode: str,
    exclude_doc_id: Optional[str] = None,
) -> None:
    """Ensure no OTHER catalog entry for this user already has this barcode.

    Raises:
        ConflictError if found
    """
    existing = find_by_barcode(user_id, barcode)
    if existing and existing.get("id") != exclude_doc_id:
        raise ConflictError(
            f"Barcode {barcode} is already linked to another catalog entry",
            details={
                "existing_entry": {
                    "name_norm": existing.get("name_norm"),
                    "display_name": existing.get("display_name"),
                    "id": existing.get("id"),
                },
            },
        )
