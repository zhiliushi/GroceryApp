"""User management service — Firestore CRUD on users collection."""

import logging
import time
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
# Create / Onboarding v2 (PLAN_ONBOARDING_V2.md — Phase 0)
# ---------------------------------------------------------------------------


def create_user_profile(
    uid: str,
    email: str,
    display_name: str = "",
    status: str = "pending",
    invitation_code: Optional[str] = None,
) -> Dict[str, Any]:
    """Single source-of-truth profile creator. Idempotent via set(merge=True).

    Used by:
      - `/api/me` first-call (Phase 2 — invited users get status="active",
        self-signups get status="pending")
      - Backfill script (existing dev/test users get status="active",
        registration_complete=False so they hit the form)

    Replaces ad-hoc `users.document(uid).set()` and `.update()` patterns that
    were silently broken when the doc didn't exist.

    Args:
        uid: Firebase Auth UID (used as Firestore doc id)
        email: from token; stored on profile for admin queries + invite matching
        display_name: from token (Google `name` claim) or empty
        status: "pending" (self-signup, awaiting admin approval), "active"
                (invited user OR backfill of existing dev user), or "disabled"
        invitation_code: 6-char code if user came in via /join/CODE; stored on
                         profile so `complete_registration` can auto-accept

    Returns:
        The fully-populated profile dict (with `uid` field added).
    """
    if status not in ("pending", "active", "disabled"):
        raise ValueError(f"Invalid status: {status}")

    now_ms = int(time.time() * 1000)
    profile = {
        "uid": uid,
        "email": email or "",
        "display_name": display_name or "",
        "status": status,
        "registration_complete": False,
        "tier": "free",
        "country": None,
        "currency_preference": None,
        "selected_tools": [],
        "homemaker_enabled": False,
        "household_id": None,
        "household_role": None,
        "invitation_code_used": invitation_code.upper() if invitation_code else None,
        "created_at": now_ms,
        "schema_version": 1,
    }
    if status == "pending":
        profile["pending_approval_at"] = now_ms
    elif status == "active":
        # Backfill / invited users: pre-fill approval timestamps so admin queue
        # doesn't include them.
        profile["approved_at"] = now_ms
        profile["approved_by"] = "system"

    db = _get_db()
    db.collection("users").document(uid).set(profile, merge=True)
    logger.info(
        "Created user profile uid=%s status=%s invitation=%s",
        uid, status, invitation_code or "none",
    )
    return profile


def complete_registration(
    uid: str,
    display_name: str,
    country: str,
    currency: str,
) -> Optional[Dict[str, Any]]:
    """Finalise the user's profile after they fill the registration form.

    Validates inputs (display name length, ISO country code length, ISO
    currency code length). Sets `registration_complete=True` so the auth
    gate releases the user to the dashboard.

    Caller (the `POST /api/me/complete-registration` endpoint, added in
    Phase 2) is responsible for any post-registration side-effects like
    auto-accepting a pending household invitation when
    `profile.invitation_code_used` is set.
    """
    name = (display_name or "").strip()
    cc = (country or "").strip().upper()
    ccy = (currency or "").strip().upper()

    if len(name) < 2 or len(name) > 50:
        raise ValueError("Display name must be 2–50 characters")
    if len(cc) != 2 or not cc.isalpha():
        raise ValueError("Country must be a 2-letter ISO 3166 code")
    if len(ccy) != 3 or not ccy.isalpha():
        raise ValueError("Currency must be a 3-letter ISO 4217 code")

    db = _get_db()
    doc_ref = db.collection("users").document(uid)
    doc = doc_ref.get()
    if not doc.exists:
        return None

    now_ms = int(time.time() * 1000)
    doc_ref.update({
        "display_name": name,
        "country": cc,
        "currency_preference": ccy,
        "registration_complete": True,
        "registration_completed_at": now_ms,
    })
    logger.info(
        "User %s completed registration (country=%s currency=%s)", uid, cc, ccy,
    )
    updated = doc_ref.get().to_dict() or {}
    updated["uid"] = uid
    return updated


def reject_user(uid: str, admin_uid: str, reason: str = "rejected") -> bool:
    """Admin rejects a pending user. Sets status=disabled, revokes tokens.

    Different from `update_user_status(disabled)` semantically — `disabled_reason`
    is set to a fixed "rejected" sentinel so the admin pending-queue UI can
    distinguish rejected (admin action on a never-active user) from disabled
    (admin action on an active user).
    """
    db = _get_db()
    doc = db.collection("users").document(uid).get()
    if not doc.exists:
        return False

    now_ms = int(time.time() * 1000)
    db.collection("users").document(uid).update({
        "status": "disabled",
        "disabled_at": now_ms,
        "disabled_reason": reason,
        "rejected_by": admin_uid,
    })
    # Force immediate logout — pending users may have a valid 60-min token in
    # hand even though status flipped.
    try:
        firebase_auth.revoke_refresh_tokens(uid)
        logger.info("Rejected user %s and revoked refresh tokens (by %s)", uid, admin_uid)
    except Exception as e:
        logger.warning("Token revocation failed for rejected user %s: %s", uid, e)
    return True


# ---------------------------------------------------------------------------
# Role management
# ---------------------------------------------------------------------------

def update_user_role(uid: str, role: str) -> None:
    """Set user role in Firestore and Firebase custom claims.

    Onboarding v2 — Phase 5: also revokes the user's refresh tokens so a
    demoted admin loses powers immediately rather than after the current
    token's TTL (~50 min). Evicts the auth-module role cache so the next
    request re-reads the new role from Firestore even if the new token
    hasn't been minted yet.
    """
    db = _get_db()
    db.collection("users").document(uid).update({"role": role})

    try:
        firebase_auth.set_custom_user_claims(uid, {"role": role})
        logger.info("Set custom claim role=%s for user %s", role, uid)
    except Exception as e:
        logger.warning("Failed to set custom claims for %s: %s", uid, e)

    # Force immediate re-auth so the new role is reflected in the next token.
    try:
        firebase_auth.revoke_refresh_tokens(uid)
        logger.info("Revoked refresh tokens for user %s after role change", uid)
    except Exception as e:
        logger.warning("Failed to revoke refresh tokens for %s: %s", uid, e)

    # Evict the in-process role cache so /api/me and other auth-using
    # endpoints re-read the role on the next request.
    try:
        from app.core.auth import _evict_role_cache
        _evict_role_cache(uid)
    except Exception as e:
        logger.warning("Failed to evict role cache for %s: %s", uid, e)


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
    """Enable or disable a user.

    Onboarding v2 — Phase 5: on transition to `disabled`, revokes the user's
    refresh tokens so their currently-issued ID token (valid up to ~60 min)
    can't be used to reach authenticated endpoints. Without this, a disabled
    user would retain access until token expiry — a real security gap.

    Re-enabling a user does NOT auto-revoke; they keep working with whatever
    token they have. Their session was wiped at disable; signing back in
    issues a fresh token that picks up `status="active"`.
    """
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

    if status == "disabled":
        try:
            firebase_auth.revoke_refresh_tokens(uid)
            logger.info("Revoked refresh tokens for disabled user %s", uid)
        except Exception as e:
            logger.warning("Failed to revoke refresh tokens for %s: %s", uid, e)

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
