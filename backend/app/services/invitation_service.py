"""
Invitation service — generate, validate, and accept household invite codes.

Firestore collection: invitations/{code}

Codes are 6-char alphanumeric, valid for 7 days, one-time use.
Max 3 pending codes per household.
"""

from __future__ import annotations

import logging
import random
import string
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

logger = logging.getLogger(__name__)

CODE_LENGTH = 6
CODE_EXPIRY_DAYS = 7
MAX_PENDING_PER_HOUSEHOLD = 3


def _db():
    return firestore.client()


def _invitations():
    return _db().collection("invitations")


def _generate_code() -> str:
    """Generate a unique 6-char alphanumeric code."""
    chars = string.ascii_uppercase + string.digits
    for _ in range(10):  # retry if collision
        code = "".join(random.choices(chars, k=CODE_LENGTH))
        doc = _invitations().document(code).get()
        if not doc.exists:
            return code
    raise RuntimeError("Failed to generate unique invite code after 10 attempts")


# ---------------------------------------------------------------------------
# Generate
# ---------------------------------------------------------------------------


def generate_invite(
    household_id: str,
    invited_by: str,
    assigned_role: str = "brother",
    invited_email: Optional[str] = None,
) -> Dict[str, Any]:
    """Generate a new invitation code for a household."""
    from app.services import household_service

    household = household_service.get_household(household_id)
    if not household:
        raise ValueError("Household not found")

    # Check household not full
    active_count = sum(1 for m in household.get("members", []) if not m.get("frozen"))
    if active_count >= household.get("max_members", 2):
        raise ValueError(f"Household is full ({active_count}/{household['max_members']} members)")

    # Check max pending codes
    pending = get_pending_invites(household_id)
    if len(pending) >= MAX_PENDING_PER_HOUSEHOLD:
        raise ValueError(f"Too many pending invites ({len(pending)}/{MAX_PENDING_PER_HOUSEHOLD}). Revoke one first.")

    code = _generate_code()
    now = datetime.utcnow()
    expires = now + timedelta(days=CODE_EXPIRY_DAYS)

    invitation = {
        "code": code,
        "household_id": household_id,
        "household_name": household.get("name", ""),
        "invited_by": invited_by,
        "invited_email": invited_email,
        "assigned_role": assigned_role,
        "status": "pending",
        "created_at": now.isoformat(),
        "expires_at": expires.isoformat(),
        "accepted_by": None,
        "accepted_at": None,
        "email_sent": invited_email is not None,
    }

    _invitations().document(code).set(invitation)
    logger.info("Invite %s generated for household %s by %s", code, household_id, invited_by)

    invitation["link"] = f"/join/{code}"
    return invitation


# ---------------------------------------------------------------------------
# Validate & Accept
# ---------------------------------------------------------------------------


def validate_code(code: str) -> Dict[str, Any]:
    """Validate an invite code. Returns invitation data or raises ValueError."""
    doc = _invitations().document(code.upper()).get()
    if not doc.exists:
        raise ValueError("Invalid invitation code.")

    invitation = doc.to_dict()

    if invitation["status"] == "accepted":
        raise ValueError("This invitation was already used.")
    if invitation["status"] == "revoked":
        raise ValueError("This invitation was cancelled by the owner.")

    # Check expiry
    expires_at = invitation.get("expires_at", "")
    if expires_at and datetime.fromisoformat(expires_at) < datetime.utcnow():
        _invitations().document(code.upper()).update({"status": "expired"})
        raise ValueError(f"This invitation expired. Ask the household owner for a new code.")

    if invitation["status"] != "pending":
        raise ValueError(f"This invitation is no longer valid (status: {invitation['status']}).")

    return invitation


def accept_invite(
    code: str,
    uid: str,
    display_name: str,
    user_email: str = "",
) -> Dict[str, Any]:
    """Accept an invitation and join the household — race-safe, email-bound.

    Onboarding v2 — Phase 3 (PLAN_ONBOARDING_V2.md). Wrapped in a Firestore
    transaction so concurrent accepts of the same code race-fairly: exactly
    one wins, the other gets `ValueError("This invitation was already used.")`.

    Email-bound enforcement (per Decision #5 / IP audit gap): if the invitation
    specifies `invited_email`, the accepting user's email MUST match (case-
    insensitive). Anonymous-share invitations (no `invited_email` set) accept
    any signed-in user — owner's choice at invite time.

    Args:
        code: 6-char invitation code (case-insensitive)
        uid: accepting user's Firebase UID
        display_name: name to record on the household member entry
        user_email: accepting user's email — REQUIRED when the invitation has
                    `invited_email` set, ignored otherwise. Defaults to ""
                    for callers that don't pass it (legacy compatibility).

    Returns:
        Updated household dict.

    Raises:
        ValueError: with a human-readable message for any of:
            - Invalid code, already used, revoked, expired
            - Email mismatch (if invitation is email-bound)
            - User already a member of THIS household (dedup)
            - Household full / not found

    MH-3c: multi-membership is allowed. The previous "already in another
    household" cross-household block has been removed. Users may join N
    households as a member; ownership is still single (enforced separately
    in `household_service.create_household`).
    """
    from app.services import household_service

    code_upper = code.upper()
    db = firestore.client()
    transaction = db.transaction()

    @firestore.transactional
    def _txn(txn):
        # ----- Reads phase -----
        inv_ref = _invitations().document(code_upper)
        inv_snap = inv_ref.get(transaction=txn)
        if not inv_snap.exists:
            raise ValueError("Invalid invitation code.")
        invitation = inv_snap.to_dict()

        if invitation["status"] == "accepted":
            raise ValueError("This invitation was already used.")
        if invitation["status"] == "revoked":
            raise ValueError("This invitation was cancelled by the owner.")

        # Expiry check — write expired status atomically and return a sentinel.
        expires_iso = invitation.get("expires_at", "")
        if expires_iso:
            expires_at = datetime.fromisoformat(expires_iso)
            if expires_at < datetime.utcnow():
                txn.update(inv_ref, {"status": "expired"})
                return {"_status": "expired"}

        if invitation["status"] != "pending":
            raise ValueError(
                f"This invitation is no longer valid (status: {invitation['status']})."
            )

        # Email-bound enforcement (Phase 3)
        invited_email = (invitation.get("invited_email") or "").strip().lower()
        if invited_email:
            actual_email = (user_email or "").strip().lower()
            if invited_email != actual_email:
                raise ValueError("This invitation is for a different email address.")

        # Read user — only blocks if they're already a member of THIS household.
        # MH-3c: cross-household block removed; multi-membership is allowed.
        user_ref = db.collection("users").document(uid)
        user_snap = user_ref.get(transaction=txn)
        existing_active_hid = None
        if user_snap.exists:
            existing_active_hid = (user_snap.to_dict() or {}).get("household_id")

        if existing_active_hid == invitation["household_id"]:
            raise ValueError("You're already a member of this household.")

        # Read target household
        household_id = invitation["household_id"]
        household_ref = db.collection("households").document(household_id)
        household_snap = household_ref.get(transaction=txn)
        if not household_snap.exists:
            raise ValueError("Household not found.")
        household = household_snap.to_dict()
        members = household.get("members", [])

        # Capacity check
        active_count = sum(1 for m in members if not m.get("frozen"))
        max_members = household.get("max_members", 2)
        if active_count >= max_members:
            raise ValueError(
                f"Household is full ({active_count}/{max_members} members)."
            )

        # Defensive dedup — already covered by existing_hid check, but cheap
        if any(m["uid"] == uid for m in members):
            raise ValueError("You're already a member of this household.")

        # Resolve role from household_service.DEFAULT_ROLES
        assigned_role = invitation.get("assigned_role", "brother")
        role_def = next(
            (r for r in household_service.DEFAULT_ROLES if r["key"] == assigned_role),
            household_service.DEFAULT_ROLES[2],
        )

        now_iso = datetime.utcnow().isoformat()
        new_member = {
            "uid": uid,
            "role": "member",
            "default_role": assigned_role,
            "display_role": role_def["name"],
            "role_icon": role_def["icon"],
            "role_color": role_def["color"],
            "display_name": display_name,
            "joined_at": now_iso,
            "frozen": False,
        }
        members.append(new_member)

        # ----- Writes phase -----
        txn.update(household_ref, {
            "members": members,
            "updated_at": now_iso,
        })

        # MH-3c: write canonical membership doc inside the same transaction.
        # Idempotent via merge; safe to retry.
        membership_ref = (
            db.collection("users").document(uid)
            .collection("memberships").document(household_id)
        )
        txn.set(membership_ref, {
            "household_id": household_id,
            "role": "member",
            "joined_at": now_iso,
            "frozen": False,
        }, merge=True)

        # Legacy active-scope shadow: only set if the user has no current scope.
        # New users get this household as their first scope. Multi-household
        # users keep their existing scope and switch via the SPA pill.
        if user_snap.exists:
            if not existing_active_hid:
                txn.update(user_ref, {
                    "household_id": household_id,
                    "household_role": "member",
                })
        else:
            txn.set(user_ref, {
                "household_id": household_id,
                "household_role": "member",
            }, merge=True)

        txn.update(inv_ref, {
            "status": "accepted",
            "accepted_by": uid,
            "accepted_at": now_iso,
        })

        result_household = dict(household)
        result_household["id"] = household_id
        result_household["members"] = members
        return {"_status": "success", "household": result_household}

    result = _txn(transaction)

    if result.get("_status") == "expired":
        raise ValueError(
            "This invitation expired. Ask the household owner for a new code."
        )

    logger.info(
        "User %s accepted invite %s for household %s (txn-safe)",
        uid, code_upper, result["household"]["id"],
    )
    return result["household"]


# ---------------------------------------------------------------------------
# Management
# ---------------------------------------------------------------------------


def get_pending_invites(household_id: str) -> List[Dict[str, Any]]:
    """Get all pending invitations for a household."""
    results = []
    try:
        docs = (
            _invitations()
            .where(filter=FieldFilter("household_id", "==", household_id))
            .where(filter=FieldFilter("status", "==", "pending"))
            .get()
        )
        for doc in docs:
            data = doc.to_dict()
            # Check if expired (lazy expiry)
            expires_at = data.get("expires_at", "")
            if expires_at and datetime.fromisoformat(expires_at) < datetime.utcnow():
                _invitations().document(doc.id).update({"status": "expired"})
                continue
            results.append(data)
    except Exception as e:
        logger.warning("Failed to query pending invites: %s", e)
    return results


def revoke_invite(code: str, revoked_by: str) -> bool:
    """Revoke a pending invitation."""
    doc = _invitations().document(code.upper()).get()
    if not doc.exists:
        return False
    data = doc.to_dict()
    if data["status"] != "pending":
        return False
    _invitations().document(code.upper()).update({
        "status": "revoked",
        "revoked_by": revoked_by,
        "revoked_at": datetime.utcnow().isoformat(),
    })
    logger.info("Invite %s revoked by %s", code, revoked_by)
    return True


def get_invitation(code: str) -> Optional[Dict[str, Any]]:
    """Get invitation details by code (for display on join page)."""
    doc = _invitations().document(code.upper()).get()
    if not doc.exists:
        return None
    return doc.to_dict()
