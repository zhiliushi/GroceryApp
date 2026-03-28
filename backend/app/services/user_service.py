"""User management service — Firestore CRUD on users collection."""

import logging
from typing import Optional, List, Dict, Any

from firebase_admin import firestore, auth as firebase_auth

logger = logging.getLogger(__name__)


def _get_db():
    return firestore.client()


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

def list_users(limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
    """List all users (admin). Returns user profiles with uid."""
    db = _get_db()
    results = []
    try:
        for doc in db.collection("users").stream():
            data = doc.to_dict()
            data["uid"] = doc.id
            results.append(data)
    except Exception as e:
        logger.warning("Failed to list users: %s", e)
        return []

    results.sort(key=lambda x: x.get("email", ""))
    return results[offset:offset + limit]


def get_user(uid: str) -> Optional[Dict[str, Any]]:
    """Get single user profile."""
    db = _get_db()
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    data["uid"] = doc.id
    return data


def count_users() -> int:
    """Count total users."""
    db = _get_db()
    docs = list(db.collection("users").select([]).stream())
    return len(docs)


# ---------------------------------------------------------------------------
# Role management
# ---------------------------------------------------------------------------

def update_user_role(uid: str, role: str) -> None:
    """Set user role in Firestore and Firebase custom claims."""
    db = _get_db()
    db.collection("users").document(uid).update({"role": role})

    try:
        firebase_auth.set_custom_user_claims(uid, {"role": role})
        logger.info("Set custom claim role=%s for user %s", role, uid)
    except Exception as e:
        logger.warning("Failed to set custom claims for %s: %s", uid, e)


def update_user_tier(uid: str, tier: str, admin_uid: str) -> bool:
    """Change a user's subscription tier."""
    if tier not in ("free", "plus", "pro"):
        return False
    db = _get_db()
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        return False
    import time
    db.collection("users").document(uid).update({
        "tier": tier,
        "tier_changed_at": int(time.time() * 1000),
        "tier_changed_by": admin_uid,
    })
    logger.info("User %s tier changed to %s by %s", uid, tier, admin_uid)
    return True


def update_user_status(uid: str, status: str, reason: str = "") -> bool:
    """Enable or disable a user."""
    if status not in ("active", "disabled"):
        return False
    db = _get_db()
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        return False
    import time
    update = {"status": status}
    if status == "disabled":
        update["disabled_at"] = int(time.time() * 1000)
        update["disabled_reason"] = reason
    else:
        update["disabled_at"] = None
        update["disabled_reason"] = None
    db.collection("users").document(uid).update(update)
    logger.info("User %s status changed to %s", uid, status)
    return True


def approve_user(uid: str, admin_uid: str) -> bool:
    """Approve a pending user."""
    db = _get_db()
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        return False
    import time
    db.collection("users").document(uid).update({
        "approved": True,
        "approved_at": int(time.time() * 1000),
        "approved_by": admin_uid,
        "status": "active",
    })
    logger.info("User %s approved by %s", uid, admin_uid)
    return True


def delete_user(uid: str) -> bool:
    """Delete user from Firestore and Firebase Auth."""
    db = _get_db()
    try:
        db.collection("users").document(uid).delete()
        logger.info("Deleted Firestore user doc: %s", uid)
    except Exception as e:
        logger.warning("Failed to delete Firestore user %s: %s", uid, e)
        return False

    try:
        firebase_auth.delete_user(uid)
        logger.info("Deleted Firebase Auth user: %s", uid)
    except Exception as e:
        logger.warning("Failed to delete Firebase Auth user %s: %s", uid, e)
    return True


def update_user_tools(uid: str, selected_tools: list) -> bool:
    """Update a Smart Cart user's selected tools."""
    db = _get_db()
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        return False
    import time
    db.collection("users").document(uid).update({
        "selected_tools": selected_tools,
        "tools_changed_at": int(time.time() * 1000),
    })
    logger.info("User %s tools updated: %s", uid, selected_tools)
    return True


# ---------------------------------------------------------------------------
# Dashboard stats
# ---------------------------------------------------------------------------

def get_dashboard_stats() -> Dict[str, Any]:
    """Aggregate counts for the admin dashboard."""
    db = _get_db()

    total_users = count_users()

    # Count inventory items across all users (collection group)
    total_items = 0
    active_items = 0
    expired_items = 0
    needs_review_count = 0
    try:
        items = list(db.collection_group("grocery_items").select(["needsReview", "status"]).stream())
        total_items = len(items)
        for i in items:
            d = i.to_dict()
            if d.get("needsReview", False):
                needs_review_count += 1
            s = d.get("status", "")
            if s == "active":
                active_items += 1
            elif s == "expired":
                expired_items += 1
    except Exception as e:
        logger.warning("Failed to query collection group: %s", e)

    # Count foodbanks
    foodbank_count = 0
    try:
        for doc in db.collection("foodbanks").stream():
            if doc.to_dict().get("is_active", True):
                foodbank_count += 1
    except Exception:
        pass

    # Count contributed products pending review
    contributed_pending = 0
    try:
        for doc in db.collection("contributed_products").stream():
            if doc.to_dict().get("status") == "pending_review":
                contributed_pending += 1
    except Exception:
        pass

    return {
        "total_users": total_users,
        "total_items": total_items,
        "active_items": active_items,
        "expired_items": expired_items,
        "needs_review_count": needs_review_count,
        "total_foodbanks": foodbank_count,
        "contributed_pending": contributed_pending,
    }
