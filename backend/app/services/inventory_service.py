"""Inventory service — cross-user inventory queries for web admin."""

import logging
import time
from typing import Optional, List, Dict, Any

from firebase_admin import firestore

logger = logging.getLogger(__name__)


def _get_db():
    return firestore.client()


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

def get_all_items(
    limit: int = 50,
    offset: int = 0,
    status: Optional[str] = None,
    needs_review: Optional[bool] = None,
    location: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Admin: list items across ALL users using collection group query.
    Filters and sorts in Python to avoid Firestore composite index requirements."""
    db = _get_db()
    query = db.collection_group("grocery_items")

    results = []
    try:
        for doc in query.stream():
            data = doc.to_dict()
            # Apply filters in Python
            if status and data.get("status") != status:
                continue
            if needs_review is not None and data.get("needsReview") != needs_review:
                continue
            if location and data.get("location") != location:
                continue
            data["id"] = doc.id
            # Extract user_id from path: users/{uid}/grocery_items/{item_id}
            path_parts = doc.reference.path.split("/")
            if len(path_parts) >= 2:
                data["user_id"] = path_parts[1]
            results.append(data)
    except Exception as e:
        logger.warning("Failed to query grocery_items collection group: %s", e)
        return []

    # Sort by updatedAt descending in Python
    results.sort(key=lambda x: x.get("updatedAt", 0), reverse=True)
    # Apply offset/limit
    return results[offset:offset + limit]


def get_household_items(
    uid: str,
    limit: int = 200,
    offset: int = 0,
    status: Optional[str] = None,
    location: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Get items for a user AND their household members.

    If the user is in a household, queries all members' grocery_items
    and merges. If solo, falls back to get_user_items().
    Each item includes _member_name/_member_role/_member_icon for attribution.
    """
    from app.services import household_service

    household = household_service.get_user_household(uid)
    if not household:
        return get_user_items(uid, limit=limit, offset=offset, status=status)

    member_uids = household_service.get_household_member_uids(household["id"])
    if not member_uids:
        return get_user_items(uid, limit=limit, offset=offset, status=status)

    # Member lookup for role attribution
    member_map = {}
    for m in household.get("members", []):
        member_map[m["uid"]] = {
            "display_name": m.get("display_name", ""),
            "display_role": m.get("display_role", ""),
            "role_icon": m.get("role_icon", ""),
        }

    db = _get_db()
    all_items: List[Dict[str, Any]] = []

    for member_uid in member_uids:
        try:
            for doc in db.collection("users").document(member_uid).collection("grocery_items").stream():
                data = doc.to_dict()
                if status and data.get("status") != status:
                    continue
                if location and data.get("location") != location:
                    continue
                data["id"] = doc.id
                data["user_id"] = member_uid
                info = member_map.get(member_uid, {})
                data["_member_name"] = info.get("display_name", "")
                data["_member_role"] = info.get("display_role", "")
                data["_member_icon"] = info.get("role_icon", "")
                all_items.append(data)
        except Exception as e:
            logger.warning("Failed to query items for member %s: %s", member_uid, e)

    all_items.sort(key=lambda x: x.get("updatedAt", 0), reverse=True)
    return all_items[offset:offset + limit]


def get_user_items(
    uid: str,
    limit: int = 50,
    offset: int = 0,
    status: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """User: list own items with optional filters."""
    db = _get_db()
    query = db.collection("users").document(uid).collection("grocery_items")

    results = []
    try:
        for doc in query.stream():
            data = doc.to_dict()
            if status and data.get("status") != status:
                continue
            data["id"] = doc.id
            data["user_id"] = uid
            results.append(data)
    except Exception as e:
        logger.warning("Failed to query user items for %s: %s", uid, e)
        return []

    results.sort(key=lambda x: x.get("updatedAt", 0), reverse=True)
    return results[offset:offset + limit]


def get_item(uid: str, item_id: str) -> Optional[Dict[str, Any]]:
    """Get a single item."""
    db = _get_db()
    doc = db.collection("users").document(uid).collection("grocery_items").document(item_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    data["id"] = doc.id
    data["user_id"] = uid
    return data


# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------

def update_item(uid: str, item_id: str, data: Dict[str, Any]) -> None:
    """Update item fields."""
    db = _get_db()
    data["updatedAt"] = time.time() * 1000  # epoch ms
    db.collection("users").document(uid).collection("grocery_items").document(item_id).update(data)


# ---------------------------------------------------------------------------
# Needs review
# ---------------------------------------------------------------------------

def get_needs_review_items(limit: int = 50) -> List[Dict[str, Any]]:
    """Admin: get items with needsReview=true across all users."""
    return get_all_items(limit=limit, needs_review=True)


# ---------------------------------------------------------------------------
# Barcode-based queries (for scanner popup)
# ---------------------------------------------------------------------------


def find_items_by_barcode(uid: str, barcode: str) -> Dict[str, Any]:
    """Find all active inventory items matching a barcode for the user + household.

    Returns summary with items grouped, total in stock, and member attribution.
    Used by the scanner popup to show "You Already Have" section.
    """
    from app.services import household_service

    household = household_service.get_user_household(uid)
    member_uids = [uid]
    member_map: Dict[str, Dict] = {uid: {"display_name": "You", "display_role": "", "role_icon": ""}}

    if household:
        all_uids = household_service.get_household_member_uids(household["id"])
        if all_uids:
            member_uids = all_uids
        for m in household.get("members", []):
            member_map[m["uid"]] = {
                "display_name": m.get("display_name", ""),
                "display_role": m.get("display_role", ""),
                "role_icon": m.get("role_icon", ""),
            }

    db = _get_db()
    items: List[Dict[str, Any]] = []
    total_qty = 0

    for m_uid in member_uids:
        try:
            for doc in db.collection("users").document(m_uid).collection("grocery_items").stream():
                data = doc.to_dict()
                if data.get("barcode") != barcode:
                    continue
                if data.get("status") != "active":
                    continue
                data["id"] = doc.id
                data["user_id"] = m_uid
                info = member_map.get(m_uid, {})
                data["_member_name"] = info.get("display_name", "")
                data["_member_role"] = info.get("display_role", "")
                data["_member_icon"] = info.get("role_icon", "")
                data["_is_own"] = (m_uid == uid)
                qty = data.get("quantity", 1) or 1
                total_qty += qty
                items.append(data)
        except Exception as e:
            logger.warning("find_items_by_barcode: failed for member %s: %s", m_uid, e)

    # Sort: own items first, then by expiry ascending (soonest first), no-expiry last
    def _sort_key(item):
        own = 0 if item.get("_is_own") else 1
        exp = item.get("expiryDate") or item.get("expiry_date")
        if exp:
            exp_ms = exp if exp > 1e12 else exp * 1000
        else:
            exp_ms = float("inf")
        return (own, exp_ms)

    items.sort(key=_sort_key)

    return {
        "barcode": barcode,
        "items": items,
        "total_in_stock": total_qty,
    }


# ---------------------------------------------------------------------------
# Smart consume (FIFO by expiry)
# ---------------------------------------------------------------------------


def use_one_item(uid: str, barcode: str, qty_to_use: int = 1) -> Dict[str, Any]:
    """Consume items matching a barcode using FIFO expiry logic.

    Priority: own items first, then soonest expiry, then lowest qty, then oldest added.
    If quantity > 1: decrement. If quantity reaches 0: auto-set consumed.

    Returns details of what was consumed.
    Raises ValueError if no stock found.
    """
    stock = find_items_by_barcode(uid, barcode)
    items = stock["items"]

    if not items:
        raise ValueError("No active items with this barcode in your inventory.")

    # Pick the best item to consume (already sorted: own first, soonest expiry)
    target = items[0]
    target_uid = target["user_id"]
    target_id = target["id"]
    current_qty = target.get("quantity", 1) or 1
    item_name = target.get("name", barcode)
    location = target.get("location", "")

    db = _get_db()
    ref = db.collection("users").document(target_uid).collection("grocery_items").document(target_id)
    now_ms = int(time.time() * 1000)

    new_qty = max(0, current_qty - qty_to_use)

    if new_qty <= 0:
        # Fully consumed
        ref.update({
            "quantity": 0,
            "status": "consumed",
            "consumed_date": now_ms,
            "reason": "used_up",
            "updatedAt": now_ms,
        })
        action = "consumed"
        logger.info("Item %s/%s fully consumed via use-one (barcode %s)", target_uid, target_id, barcode)
    else:
        # Decrement
        ref.update({
            "quantity": new_qty,
            "updatedAt": now_ms,
        })
        action = "decremented"
        logger.info("Item %s/%s decremented %d→%d via use-one (barcode %s)", target_uid, target_id, current_qty, new_qty, barcode)

    member_info = target.get("_member_name", "")
    location_label = location.capitalize() if location else "inventory"
    from_text = f" from {member_info}'s {location_label}" if member_info and member_info != "You" else f" from {location_label}"

    return {
        "success": True,
        "action": action,
        "item_id": target_id,
        "item_owner": target_uid,
        "item_name": item_name,
        "location": location,
        "quantity_before": current_qty,
        "quantity_after": new_qty,
        "message": f"Used {qty_to_use} × {item_name}{from_text} ({new_qty} left)" if action == "decremented"
                   else f"Used {item_name}{from_text} (none left)",
    }


# ---------------------------------------------------------------------------
# Expiry flagging (for daily scheduler)
# ---------------------------------------------------------------------------


def flag_expired_items() -> int:
    """Scan all active items and flag those past their expiry date.

    Sets expiry_past=true + needs_review=true on items where:
    - status == "active"
    - expiry_date is set and < start of today (UTC)
    - expiry_past is not already true

    Returns count of newly flagged items.
    """
    import datetime

    db = _get_db()
    today_start_ms = int(datetime.datetime.utcnow().replace(
        hour=0, minute=0, second=0, microsecond=0
    ).timestamp() * 1000)

    flagged = 0
    batch = db.batch()
    batch_count = 0

    try:
        for doc in db.collection_group("grocery_items").stream():
            data = doc.to_dict()

            if data.get("status") != "active":
                continue
            if data.get("expiry_past") is True:
                continue

            exp = data.get("expiryDate") or data.get("expiry_date")
            if not exp:
                continue

            exp_ms = exp if exp > 1e12 else exp * 1000
            if exp_ms >= today_start_ms:
                continue

            # This item is expired and not yet flagged
            batch.update(doc.reference, {
                "expiry_past": True,
                "needsReview": True,
                "updatedAt": int(time.time() * 1000),
            })
            flagged += 1
            batch_count += 1

            if batch_count >= 500:
                batch.commit()
                batch = db.batch()
                batch_count = 0

    except Exception as e:
        logger.warning("flag_expired_items: error during scan: %s", e)

    if batch_count > 0:
        try:
            batch.commit()
        except Exception as e:
            logger.warning("flag_expired_items: batch commit failed: %s", e)

    logger.info("flag_expired_items: flagged %d items", flagged)
    return flagged
