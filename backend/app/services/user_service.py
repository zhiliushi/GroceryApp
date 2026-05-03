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


def update_user_homemaker(uid: str, enabled: bool, admin_uid: str) -> bool:
    """Toggle a user's homemaker subscription gate.

    `homemaker_enabled` is the per-user side of the homemaker access check.
    The full gate is: `user.homemaker_enabled AND feature_flag('homemaker_<sub>')`.
    Both must be True before the corresponding sub-feature (versioning,
    social) is exposed in API or UI.
    """
    db = _get_db()
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        return False
    import time
    db.collection("users").document(uid).update({
        "homemaker_enabled": bool(enabled),
        "homemaker_changed_at": int(time.time() * 1000),
        "homemaker_changed_by": admin_uid,
    })
    logger.info(
        "User %s homemaker_enabled set to %s by %s", uid, enabled, admin_uid,
    )
    return True


def is_homemaker_enabled(uid: str, sub: str) -> bool:
    """Resolve homemaker access for a sub-feature.

    Args:
        uid: target user
        sub: "versioning" | "social"  (extend when more sub-features land)

    Truth table:
      user.homemaker_enabled  ×  feature_flag(homemaker_{sub})  →  result
      False                   ×  *                              →  False
      True                    ×  False                          →  False  (kill-switch)
      True                    ×  True                           →  True

    Note: `finance` is intentionally NOT a homemaker sub-feature — base
    finance is shipped to all users as a separate phase. Per-version
    finance snapshot rides on `versioning`, not its own gate.
    """
    if sub not in ("versioning", "social"):
        return False
    user = get_user(uid)
    if not user or not user.get("homemaker_enabled"):
        return False
    from app.core import feature_flags
    return feature_flags.is_enabled(f"homemaker_{sub}")


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
    """Aggregate counts for the admin dashboard.

    Counts purchase events from the v2 `purchases` collection-group (all users).
    Pre-v2 the source was `grocery_items` — that collection still exists for
    the mobile-app legacy shim but is no longer the source of truth.

    `expired_items` here means *active events whose expiry_date is in the past*
    — there is no terminal "expired" status (status="active" stays until the
    user explicitly throws/uses).
    """
    from datetime import datetime, timezone
    db = _get_db()

    total_users = count_users()

    total_items = 0
    active_items = 0
    expired_items = 0
    needs_review_count = 0
    now = datetime.now(timezone.utc)
    try:
        for snap in db.collection_group("purchases").stream():
            d = snap.to_dict() or {}
            total_items += 1
            status = d.get("status", "")
            if status == "active":
                active_items += 1
                expiry = d.get("expiry_date")
                if expiry is not None:
                    if hasattr(expiry, "to_datetime"):
                        expiry = expiry.to_datetime()
                    if hasattr(expiry, "tzinfo") and expiry.tzinfo is None:
                        expiry = expiry.replace(tzinfo=timezone.utc)
                    if expiry < now:
                        expired_items += 1
    except Exception as e:
        logger.warning("Failed to query purchases collection group: %s", e)
    # Catalog rows flagged for review
    try:
        from google.cloud.firestore_v1.base_query import FieldFilter
        for snap in (
            db.collection("catalog_entries")
            .where(filter=FieldFilter("needs_review", "==", True))
            .stream()
        ):
            needs_review_count += 1
    except Exception as e:
        logger.warning("Failed to count needs_review catalog entries: %s", e)

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
