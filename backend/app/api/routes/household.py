"""
Household API routes — user-facing CRUD for household management.

All endpoints require authentication. Owner-only actions are enforced.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query

from app.core.auth import UserInfo, get_current_user, get_optional_user
from app.services import household_service, invitation_service

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Household CRUD
# ---------------------------------------------------------------------------


@router.get("/my")
async def get_my_household(user: UserInfo = Depends(get_current_user)):
    """Get the current user's household."""
    household = household_service.get_user_household(user.uid)
    if not household:
        return {"household": None}

    # Include available roles for the tier
    tier = household.get("tier", "free")
    roles = household_service.get_available_roles(tier)
    pending_invites = invitation_service.get_pending_invites(household["id"])

    return {
        "household": household,
        "available_roles": roles,
        "pending_invites": pending_invites,
    }


@router.post("/create")
async def create_household(body: dict, user: UserInfo = Depends(get_current_user)):
    """Create a new household. The current user becomes the owner."""
    name = body.get("name", "").strip()
    if not name or len(name) < 2:
        raise HTTPException(400, "Household name must be at least 2 characters")

    role_key = body.get("role", "papa")

    # Get user's tier
    from app.services import user_service
    profile = user_service.get_user(user.uid) or {}
    tier = profile.get("tier", "free")

    try:
        household = household_service.create_household(
            owner_uid=user.uid,
            name=name,
            owner_display_name=user.display_name or user.email.split("@")[0],
            owner_role_key=role_key,
            owner_tier=tier,
        )
        return {"success": True, "household": household}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.put("/rename")
async def rename_household(body: dict, user: UserInfo = Depends(get_current_user)):
    """Rename the household (owner only)."""
    household = household_service.get_user_household(user.uid)
    if not household:
        raise HTTPException(404, "You're not in a household")
    if household["owner_uid"] != user.uid:
        raise HTTPException(403, "Only the owner can rename the household")

    new_name = body.get("name", "").strip()
    if not new_name or len(new_name) < 2:
        raise HTTPException(400, "Name must be at least 2 characters")

    household_service.rename_household(household["id"], new_name)
    return {"success": True}


@router.delete("/dissolve")
async def dissolve_household(user: UserInfo = Depends(get_current_user)):
    """Dissolve the household (owner only). All members become solo."""
    household = household_service.get_user_household(user.uid)
    if not household:
        raise HTTPException(404, "You're not in a household")
    if household["owner_uid"] != user.uid:
        raise HTTPException(403, "Only the owner can dissolve the household")

    household_service.dissolve_household(household["id"], user.uid)
    return {"success": True, "message": "Household dissolved"}


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------


@router.post("/leave")
async def leave_household(user: UserInfo = Depends(get_current_user)):
    """Leave the current household."""
    try:
        result = household_service.leave_household(user.uid)
        if not result:
            raise HTTPException(404, "You're not in a household")
        return {"success": True, "message": "You left the household"}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/remove/{member_uid}")
async def remove_member(member_uid: str, user: UserInfo = Depends(get_current_user)):
    """Remove a member (owner only)."""
    household = household_service.get_user_household(user.uid)
    if not household:
        raise HTTPException(404, "You're not in a household")
    if household["owner_uid"] != user.uid:
        raise HTTPException(403, "Only the owner can remove members")

    try:
        result = household_service.remove_member(household["id"], member_uid, user.uid)
        if not result:
            raise HTTPException(404, "Member not found in household")
        return {"success": True}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/transfer/{new_owner_uid}")
async def transfer_ownership(new_owner_uid: str, user: UserInfo = Depends(get_current_user)):
    """Transfer household ownership (owner only)."""
    household = household_service.get_user_household(user.uid)
    if not household:
        raise HTTPException(404, "You're not in a household")
    try:
        household_service.transfer_ownership(household["id"], new_owner_uid, user.uid)
        return {"success": True, "message": f"Ownership transferred"}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.put("/role")
async def update_my_role(body: dict, user: UserInfo = Depends(get_current_user)):
    """Update your own personalised role (display_role, role_icon, role_color)."""
    household = household_service.get_user_household(user.uid)
    if not household:
        raise HTTPException(404, "You're not in a household")

    updates = {}
    if "display_role" in body:
        updates["display_role"] = body["display_role"]
    if "role_icon" in body:
        updates["role_icon"] = body["role_icon"]
    if "role_color" in body:
        updates["role_color"] = body["role_color"]

    if not updates:
        raise HTTPException(400, "No updates provided")

    household_service.update_member_role(household["id"], user.uid, updates)
    return {"success": True}


# ---------------------------------------------------------------------------
# Invitations
# ---------------------------------------------------------------------------


@router.post("/invite")
async def generate_invite(body: dict, user: UserInfo = Depends(get_current_user)):
    """Generate an invitation code (owner only)."""
    household = household_service.get_user_household(user.uid)
    if not household:
        raise HTTPException(404, "You're not in a household")
    if household["owner_uid"] != user.uid:
        raise HTTPException(403, "Only the owner can invite members")

    assigned_role = body.get("role", "brother")
    invited_email = body.get("email")  # optional

    try:
        invitation = invitation_service.generate_invite(
            household_id=household["id"],
            invited_by=user.uid,
            assigned_role=assigned_role,
            invited_email=invited_email,
        )

        # Send email if provided (best-effort)
        if invited_email:
            try:
                from app.services import email_service
                email_service.send_invitation_email(
                    to_email=invited_email,
                    household_name=household["name"],
                    inviter_name=user.display_name or user.email,
                    code=invitation["code"],
                )
                invitation["email_sent"] = True
            except Exception as e:
                logger.warning("Failed to send invite email: %s", e)
                invitation["email_sent"] = False

        return {"success": True, "invitation": invitation}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/invite/{code}/revoke")
async def revoke_invite(code: str, user: UserInfo = Depends(get_current_user)):
    """Revoke a pending invitation."""
    if not invitation_service.revoke_invite(code, user.uid):
        raise HTTPException(404, "Invitation not found or already used")
    return {"success": True}


# ---------------------------------------------------------------------------
# Join (public — used by /join/:code page)
# ---------------------------------------------------------------------------


@router.get("/join/{code}")
async def get_invitation_info(code: str):
    """Get invitation details for the join page (no auth required for viewing)."""
    invitation = invitation_service.get_invitation(code)
    if not invitation:
        return {"valid": False, "error": "Invalid invitation code"}

    # Don't expose sensitive fields
    try:
        invitation_service.validate_code(code)
        return {
            "valid": True,
            "household_name": invitation.get("household_name"),
            "assigned_role": invitation.get("assigned_role"),
            "expires_at": invitation.get("expires_at"),
        }
    except ValueError as e:
        return {"valid": False, "error": str(e)}


@router.post("/join/{code}")
async def accept_invitation(code: str, user: UserInfo = Depends(get_current_user)):
    """Accept an invitation and join the household."""
    try:
        household = invitation_service.accept_invite(
            code=code,
            uid=user.uid,
            display_name=user.display_name or user.email.split("@")[0],
        )
        return {"success": True, "household": household}
    except ValueError as e:
        raise HTTPException(400, str(e))
