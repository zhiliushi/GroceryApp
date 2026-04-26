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


def accept_invite(code: str, uid: str, display_name: str) -> Dict[str, Any]:
    """Accept an invitation and join the household."""
    from app.services import household_service

    invitation = validate_code(code)
    code_upper = code.upper()

    # Check user not already in a household
    existing = household_service.get_user_household(uid)
    if existing:
        raise ValueError(f"You're already in '{existing['name']}'. Leave first to join another household.")

    household_id = invitation["household_id"]
    assigned_role = invitation.get("assigned_role", "brother")

    # Add member (this also checks capacity)
    household = household_service.add_member(
        household_id=household_id,
        uid=uid,
        display_name=display_name,
        default_role=assigned_role,
    )

    # Mark invitation as accepted
    _invitations().document(code_upper).update({
        "status": "accepted",
        "accepted_by": uid,
        "accepted_at": datetime.utcnow().isoformat(),
    })

    logger.info("User %s accepted invite %s for household %s", uid, code_upper, household_id)
    return household


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
