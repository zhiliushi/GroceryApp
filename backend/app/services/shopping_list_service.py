"""Shopping list service.

v1 = read-only admin window into legacy mobile-app shopping lists.
v2 = transit list owned by the user. Item TTL 30d, 50-item cap per list,
quota separate from catalog. See `.claude/docs/pages/shopping-lists.md`.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any

from firebase_admin import firestore

from app.core.exceptions import (
    NotFoundError,
    QuotaExceededError,
    ValidationError,
)

logger = logging.getLogger(__name__)


def _get_db():
    return firestore.client()


# ---------------------------------------------------------------------------
# v2 constants
# ---------------------------------------------------------------------------

MAX_ITEMS_PER_LIST = 50
MAX_PRICES_PER_ITEM = 10
ITEM_TTL_DAYS = 30
SCHEMA_VERSION = 2

_ALLOWED_WEIGHT_UNITS = {"g", "kg", "oz", "lb"}
_ALLOWED_VOLUME_UNITS = {"ml", "l", "fl_oz", "cup"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _norm(name: str) -> str:
    """Lowercase + strip — minimal catalog-matching key."""
    return (name or "").strip().lower()


def _new_metadata(uid: str, source: str = "web_admin") -> Dict[str, Any]:
    now = _now_iso()
    return {
        "created_at": now,
        "updated_at": now,
        "schema_version": SCHEMA_VERSION,
        "created_by": uid,
        "source": source,
    }


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

def get_user_lists(uid: str) -> List[Dict[str, Any]]:
    """Get all shopping lists for a user."""
    db = _get_db()
    results = []
    try:
        for doc in db.collection("users").document(uid).collection("shopping_lists").stream():
            data = doc.to_dict()
            data["id"] = doc.id
            data["user_id"] = uid
            results.append(data)
    except Exception as e:
        logger.warning("Failed to query shopping lists for %s: %s", uid, e)
        return []

    results.sort(key=lambda x: x.get("createdDate", 0), reverse=True)
    return results


def get_household_lists(uid: str) -> List[Dict[str, Any]]:
    """Get shopping lists for a user AND their household members.

    Merges all members' lists. Each list includes member attribution.
    Falls back to get_user_lists() if user has no household.
    """
    from app.services import household_service

    household = household_service.get_user_household(uid)
    if not household:
        return get_user_lists(uid)

    member_uids = household_service.get_household_member_uids(household["id"])
    if not member_uids:
        return get_user_lists(uid)

    member_map = {}
    for m in household.get("members", []):
        member_map[m["uid"]] = {
            "display_name": m.get("display_name", ""),
            "display_role": m.get("display_role", ""),
            "role_icon": m.get("role_icon", ""),
        }

    db = _get_db()
    all_lists: List[Dict[str, Any]] = []

    for member_uid in member_uids:
        try:
            for doc in db.collection("users").document(member_uid).collection("shopping_lists").stream():
                data = doc.to_dict()
                data["id"] = doc.id
                data["user_id"] = member_uid
                info = member_map.get(member_uid, {})
                data["_member_name"] = info.get("display_name", "")
                data["_member_role"] = info.get("display_role", "")
                data["_member_icon"] = info.get("role_icon", "")
                all_lists.append(data)
        except Exception as e:
            logger.warning("Failed to query lists for member %s: %s", member_uid, e)

    all_lists.sort(key=lambda x: x.get("createdDate", 0), reverse=True)
    return all_lists


def get_list_items(uid: str, list_id: str) -> List[Dict[str, Any]]:
    """Get items in a specific shopping list."""
    db = _get_db()
    col = db.collection("users").document(uid).collection("shopping_lists").document(list_id).collection("items")
    results = []
    for doc in col.stream():
        data = doc.to_dict()
        data["id"] = doc.id
        results.append(data)
    return results


def get_all_lists(limit: int = 50) -> List[Dict[str, Any]]:
    """Admin: get lists across all users."""
    db = _get_db()
    results = []

    try:
        users = db.collection("users").select([]).stream()
        for user_doc in users:
            uid = user_doc.id
            for doc in db.collection("users").document(uid).collection("shopping_lists").stream():
                data = doc.to_dict()
                data["id"] = doc.id
                data["user_id"] = uid
                results.append(data)
    except Exception as e:
        logger.warning("Failed to query shopping lists: %s", e)
        return []

    results.sort(key=lambda x: x.get("createdDate", 0), reverse=True)
    return results[:limit]


def get_list(uid: str, list_id: str) -> Optional[Dict[str, Any]]:
    """Get a single shopping list."""
    db = _get_db()
    doc = db.collection("users").document(uid).collection("shopping_lists").document(list_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    data["id"] = doc.id
    data["user_id"] = uid
    return data


def get_list_or_404(uid: str, list_id: str) -> Dict[str, Any]:
    """Read-or-raise. Used by mutation helpers and routes."""
    data = get_list(uid, list_id)
    if not data:
        raise NotFoundError(f"Shopping list {list_id} not found")
    return data


# ---------------------------------------------------------------------------
# v2 — Lists
# ---------------------------------------------------------------------------

def create_list(uid: str, name: str) -> Dict[str, Any]:
    """Create a new shopping list."""
    name = (name or "").strip()
    if not name:
        raise ValidationError("List name is required")
    if len(name) > 80:
        raise ValidationError("List name must be ≤ 80 characters")

    db = _get_db()
    col = db.collection("users").document(uid).collection("shopping_lists")
    doc = col.document()
    payload = {
        "name": name,
        "item_count": 0,
        **_new_metadata(uid),
    }
    doc.set(payload)
    return {"id": doc.id, "user_id": uid, **payload}


def update_list(
    uid: str,
    list_id: str,
    *,
    name: Optional[str] = None,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Update mutable list fields (name, notes).

    Pass `notes=""` to clear; pass `None` to leave unchanged.
    Tier-gating of `notes` (plus only) lives in the frontend via
    useVisibility('trip_notes'); the service stores whatever is sent.
    """
    get_list_or_404(uid, list_id)

    updates: Dict[str, Any] = {"updated_at": _now_iso()}
    if name is not None:
        name = name.strip()
        if not name:
            raise ValidationError("List name cannot be empty")
        if len(name) > 80:
            raise ValidationError("List name must be ≤ 80 characters")
        updates["name"] = name
    if notes is not None:
        if len(notes) > 1000:
            raise ValidationError("Notes must be ≤ 1000 characters")
        updates["notes"] = notes

    db = _get_db()
    db.collection("users").document(uid).collection("shopping_lists").document(list_id).update(updates)
    return get_list_or_404(uid, list_id)


def delete_list(uid: str, list_id: str) -> None:
    """Delete a list and cascade-delete its items.

    Firestore doesn't auto-cascade subcollections; we batch-delete items
    then the list doc. For lists at the 50-item cap this is one batch.
    """
    get_list_or_404(uid, list_id)

    db = _get_db()
    list_ref = db.collection("users").document(uid).collection("shopping_lists").document(list_id)
    items_ref = list_ref.collection("items")

    batch = db.batch()
    n = 0
    for snap in items_ref.stream():
        batch.delete(snap.reference)
        n += 1
        # Firestore batch hard cap = 500 ops; flush early to be safe.
        if n % 400 == 0:
            batch.commit()
            batch = db.batch()
    batch.delete(list_ref)
    batch.commit()


# ---------------------------------------------------------------------------
# v2 — Items
# ---------------------------------------------------------------------------

def _validate_item_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize + validate add/update item payload. Returns cleaned dict.

    Required: item_name (non-empty).
    Optional: quantity, unit, weight_value/weight_unit pair, volume_value/volume_unit pair,
              notes, barcode, source_catalog_name_norm.
    Validation: only ONE of (count+unit, weight, volume) carries dimensional info,
                but we don't reject mixed input — the buy flow chooses one.
    """
    name = (payload.get("item_name") or "").strip()
    if not name:
        raise ValidationError("item_name is required")
    if len(name) > 120:
        raise ValidationError("item_name must be ≤ 120 characters")

    cleaned: Dict[str, Any] = {
        "item_name": name,
        "name_norm": _norm(name),
    }

    if (q := payload.get("quantity")) is not None:
        try:
            qf = float(q)
        except (TypeError, ValueError):
            raise ValidationError("quantity must be a number")
        if qf <= 0:
            raise ValidationError("quantity must be > 0")
        cleaned["quantity"] = qf

    if (u := payload.get("unit")):
        cleaned["unit"] = str(u)[:16]

    wv, wu = payload.get("weight_value"), payload.get("weight_unit")
    if wv is not None or wu is not None:
        if wv is None or wu is None:
            raise ValidationError("weight_value and weight_unit must both be set")
        try:
            wvf = float(wv)
        except (TypeError, ValueError):
            raise ValidationError("weight_value must be a number")
        if wvf <= 0:
            raise ValidationError("weight_value must be > 0")
        if wu not in _ALLOWED_WEIGHT_UNITS:
            raise ValidationError(f"weight_unit must be one of {sorted(_ALLOWED_WEIGHT_UNITS)}")
        cleaned["weight_value"] = wvf
        cleaned["weight_unit"] = wu

    vv, vu = payload.get("volume_value"), payload.get("volume_unit")
    if vv is not None or vu is not None:
        if vv is None or vu is None:
            raise ValidationError("volume_value and volume_unit must both be set")
        try:
            vvf = float(vv)
        except (TypeError, ValueError):
            raise ValidationError("volume_value must be a number")
        if vvf <= 0:
            raise ValidationError("volume_value must be > 0")
        if vu not in _ALLOWED_VOLUME_UNITS:
            raise ValidationError(f"volume_unit must be one of {sorted(_ALLOWED_VOLUME_UNITS)}")
        cleaned["volume_value"] = vvf
        cleaned["volume_unit"] = vu

    if (notes := payload.get("notes")):
        cleaned["notes"] = str(notes)[:500]
    if (bc := payload.get("barcode")):
        cleaned["barcode"] = str(bc).strip()
    if (src := payload.get("source_catalog_name_norm")):
        cleaned["source_catalog_name_norm"] = str(src).strip()

    return cleaned


def _count_items(uid: str, list_id: str) -> int:
    db = _get_db()
    col = (
        db.collection("users").document(uid)
        .collection("shopping_lists").document(list_id)
        .collection("items")
    )
    # Live count — small lists (≤50), so the stream cost is acceptable.
    return sum(1 for _ in col.stream())


def add_item(uid: str, list_id: str, payload: Dict[str, Any], *, source: str = "manual") -> Dict[str, Any]:
    """Add an item to a list. Enforces 50-item cap.

    `source` distinguishes entry points for analytics: 'manual' | 'catalog' |
    'scan' | 'receipt' | 'cross_page'. Persisted as `source` on the item doc.
    """
    get_list_or_404(uid, list_id)
    cleaned = _validate_item_payload(payload)

    used = _count_items(uid, list_id)
    if used >= MAX_ITEMS_PER_LIST:
        raise QuotaExceededError(
            f"Shopping list cap reached ({MAX_ITEMS_PER_LIST} items)",
            details={"used": used, "limit": MAX_ITEMS_PER_LIST, "scope": "shopping_list_items"},
        )

    db = _get_db()
    list_ref = db.collection("users").document(uid).collection("shopping_lists").document(list_id)
    items_ref = list_ref.collection("items")

    now = _now_iso()
    doc = items_ref.document()
    item_payload = {
        **cleaned,
        "prices": [],
        "added_at": now,
        **_new_metadata(uid, source=source),
    }
    item_payload["updated_at"] = now

    batch = db.batch()
    batch.set(doc, item_payload)
    # Bump denormalized counter on the list doc for cheap reads.
    batch.update(list_ref, {"item_count": used + 1, "updated_at": now})
    batch.commit()
    return {"id": doc.id, **item_payload}


def update_item(uid: str, list_id: str, item_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Edit an item in place. Pass only fields you want to update."""
    db = _get_db()
    item_ref = (
        db.collection("users").document(uid)
        .collection("shopping_lists").document(list_id)
        .collection("items").document(item_id)
    )
    snap = item_ref.get()
    if not snap.exists:
        raise NotFoundError(f"Item {item_id} not found")

    # Re-validate the merged payload so partial updates can't bypass rules
    merged = {**snap.to_dict(), **payload}
    cleaned = _validate_item_payload(merged)
    cleaned["updated_at"] = _now_iso()
    item_ref.update(cleaned)

    out = snap.to_dict() or {}
    out.update(cleaned)
    out["id"] = item_id
    return out


def delete_item(uid: str, list_id: str, item_id: str) -> None:
    db = _get_db()
    list_ref = db.collection("users").document(uid).collection("shopping_lists").document(list_id)
    item_ref = list_ref.collection("items").document(item_id)
    snap = item_ref.get()
    if not snap.exists:
        raise NotFoundError(f"Item {item_id} not found")

    batch = db.batch()
    batch.delete(item_ref)
    # Decrement counter; floor at 0.
    list_snap = list_ref.get()
    cur = (list_snap.to_dict() or {}).get("item_count", 0)
    batch.update(list_ref, {"item_count": max(0, cur - 1), "updated_at": _now_iso()})
    batch.commit()


# ---------------------------------------------------------------------------
# v2 — Price comparison entries
# ---------------------------------------------------------------------------

def add_price(
    uid: str,
    list_id: str,
    item_id: str,
    *,
    price: float,
    brand: Optional[str] = None,
    currency: str = "SGD",
    store_name: Optional[str] = None,
    barcode: Optional[str] = None,
) -> Dict[str, Any]:
    """Append a price comparison entry to an item. Cap = 10 entries."""
    try:
        pf = float(price)
    except (TypeError, ValueError):
        raise ValidationError("price must be a number")
    if pf <= 0:
        raise ValidationError("price must be > 0")

    db = _get_db()
    item_ref = (
        db.collection("users").document(uid)
        .collection("shopping_lists").document(list_id)
        .collection("items").document(item_id)
    )
    snap = item_ref.get()
    if not snap.exists:
        raise NotFoundError(f"Item {item_id} not found")

    data = snap.to_dict() or {}
    prices: List[Dict[str, Any]] = list(data.get("prices") or [])
    if len(prices) >= MAX_PRICES_PER_ITEM:
        raise QuotaExceededError(
            f"Price comparison cap reached ({MAX_PRICES_PER_ITEM} entries)",
            details={"used": len(prices), "limit": MAX_PRICES_PER_ITEM, "scope": "shopping_list_prices"},
        )

    entry = {
        "id": str(uuid.uuid4()),
        "price": pf,
        "currency": (currency or "SGD")[:8],
        "brand": (brand or None),
        "store_name": (store_name or None),
        "barcode": (barcode or None),
        "added_at": _now_iso(),
    }
    prices.append(entry)
    item_ref.update({"prices": prices, "updated_at": _now_iso()})
    return entry


def delete_price(uid: str, list_id: str, item_id: str, price_id: str) -> None:
    db = _get_db()
    item_ref = (
        db.collection("users").document(uid)
        .collection("shopping_lists").document(list_id)
        .collection("items").document(item_id)
    )
    snap = item_ref.get()
    if not snap.exists:
        raise NotFoundError(f"Item {item_id} not found")

    data = snap.to_dict() or {}
    prices: List[Dict[str, Any]] = list(data.get("prices") or [])
    new_prices = [p for p in prices if p.get("id") != price_id]
    if len(new_prices) == len(prices):
        raise NotFoundError(f"Price entry {price_id} not found")
    item_ref.update({"prices": new_prices, "updated_at": _now_iso()})


# ---------------------------------------------------------------------------
# v2 — TTL sweep (called by scheduler daily)
# ---------------------------------------------------------------------------

def sweep_expired_items(now: Optional[datetime] = None) -> Dict[str, int]:
    """Delete items where `added_at < now - 30 days`. Returns counts.

    Scope: across ALL users. Iterates `users/*/shopping_lists/*/items/*`.
    Idempotent and safe — re-running it after a partial sweep just keeps
    going. Logs a summary at INFO so the scheduler trail is visible.
    """
    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(days=ITEM_TTL_DAYS)
    cutoff_iso = cutoff.isoformat()

    db = _get_db()
    deleted_items = 0
    affected_lists = 0
    list_decrements: Dict[str, int] = {}

    try:
        # Use collection_group to scan items across all users in one query.
        # Filter: added_at < cutoff. Field index required if dataset is large.
        items = db.collection_group("items").where(
            "added_at", "<", cutoff_iso
        ).stream()

        batch = db.batch()
        n = 0
        for snap in items:
            # Filter to ONLY shopping-list items (collection_group is unscoped):
            # parent path is users/{uid}/shopping_lists/{listId}/items/{itemId}.
            parent = snap.reference.parent.parent  # the list doc
            if parent is None or "shopping_lists" not in parent.path:
                continue
            batch.delete(snap.reference)
            list_decrements[parent.path] = list_decrements.get(parent.path, 0) + 1
            deleted_items += 1
            n += 1
            if n % 400 == 0:
                batch.commit()
                batch = db.batch()

        # Apply decrements to list counters in a second batch.
        for list_path, dec in list_decrements.items():
            list_ref = db.document(list_path)
            list_snap = list_ref.get()
            cur = (list_snap.to_dict() or {}).get("item_count", 0)
            batch.update(list_ref, {
                "item_count": max(0, cur - dec),
                "updated_at": now.isoformat(),
            })
            affected_lists += 1
            n += 1
            if n % 400 == 0:
                batch.commit()
                batch = db.batch()

        batch.commit()
    except Exception as e:
        logger.exception("sweep_expired_items failed: %s", e)
        return {"deleted_items": deleted_items, "affected_lists": affected_lists, "error": str(e)}

    logger.info(
        "shopping_list TTL sweep: deleted %d items across %d lists (cutoff=%s)",
        deleted_items, affected_lists, cutoff_iso,
    )
    return {"deleted_items": deleted_items, "affected_lists": affected_lists}
