"""Shopping list service for web admin."""

import logging
from typing import Optional, List, Dict, Any

from firebase_admin import firestore

logger = logging.getLogger(__name__)


def _get_db():
    return firestore.client()


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
