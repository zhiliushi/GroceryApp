"""
Household service — family/group sharing for grocery data.

Firestore collection: households/{household_id}

A household groups users who share inventory, shopping lists, and price data.
Each member has a family role (Papa, Mama, Brother, Sister, Baby, or custom)
that is personalizable (name, icon, color).
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any

from firebase_admin import firestore

logger = logging.getLogger(__name__)

# Default family roles available per tier
DEFAULT_ROLES = [
    {"key": "papa", "name": "Papa", "icon": "🧔", "color": "#3B82F6"},
    {"key": "mama", "name": "Mama", "icon": "👩", "color": "#EC4899"},
    {"key": "brother", "name": "Brother", "icon": "👦", "color": "#22C55E"},
    {"key": "sister", "name": "Sister", "icon": "👧", "color": "#A855F7"},
    {"key": "baby", "name": "Baby", "icon": "👶", "color": "#EAB308"},
]

FREE_ROLES = ["papa", "mama"]
PLUS_PRO_ROLES = ["papa", "mama", "brother", "sister", "baby"]

TIER_MAX_MEMBERS = {"free": 2, "plus": 5, "pro": 5, "admin": 10}


def _db():
    return firestore.client()


def _households():
    return _db().collection("households")


def _user_memberships_ref(uid: str):
    return _db().collection("users").document(uid).collection("memberships")


def _write_membership(
    uid: str,
    household_id: str,
    role: str,
    joined_at: Optional[str] = None,
    txn=None,
) -> None:
    """Write a membership doc to users/{uid}/memberships/{household_id}.

    MH-3c: this is the canonical source of truth for "which households does
    this user belong to". The legacy `users/{uid}.household_id` field stays
    as a write-shadow for backward compat (current active scope) — see
    callers of this helper for the dual-write logic.

    `txn` is an optional Firestore transaction; passed through when called
    from inside `accept_invite`'s transaction.
    """
    doc = {
        "household_id": household_id,
        "role": role,
        "joined_at": joined_at or datetime.utcnow().isoformat(),
        "frozen": False,
    }
    ref = _user_memberships_ref(uid).document(household_id)
    if txn is not None:
        txn.set(ref, doc, merge=True)
    else:
        ref.set(doc, merge=True)


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


def create_household(
    owner_uid: str,
    name: str,
    owner_display_name: str,
    owner_role_key: str = "papa",
    owner_tier: str = "free",
) -> Dict[str, Any]:
    """Create a new household. Owner is the first member.

    MH-3c: only blocks if the user already OWNS a household — they may
    still be a member of N others. Asymmetric model: owner=1, member=N.
    """
    if get_owned_household(owner_uid):
        raise ValueError(
            "You already own a household. You can only own one at a time. "
            "Leave or dissolve your current one first to create a new one."
        )

    # Resolve role defaults
    role_def = next((r for r in DEFAULT_ROLES if r["key"] == owner_role_key), DEFAULT_ROLES[0])

    household_id = uuid.uuid4().hex[:12]
    max_members = TIER_MAX_MEMBERS.get(owner_tier, 2)
    now = datetime.utcnow().isoformat()

    household = {
        "name": name,
        "owner_uid": owner_uid,
        "tier": owner_tier,
        "max_members": max_members,
        "members": [
            {
                "uid": owner_uid,
                "role": "owner",
                "default_role": owner_role_key,
                "display_role": role_def["name"],
                "role_icon": role_def["icon"],
                "role_color": role_def["color"],
                "display_name": owner_display_name,
                "joined_at": now,
                "frozen": False,
            }
        ],
        "created_at": now,
        "updated_at": now,
    }

    _households().document(household_id).set(household)

    # Update user profile (legacy fields kept as the active-scope shadow).
    _db().collection("users").document(owner_uid).update({
        "household_id": household_id,
        "household_role": "owner",
    })

    # MH-3c: also write to memberships subcollection (canonical source).
    _write_membership(owner_uid, household_id, role="owner", joined_at=now)

    household["id"] = household_id
    logger.info("Household %s created by %s", household_id, owner_uid)
    return household


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------


def get_household(household_id: str) -> Optional[Dict[str, Any]]:
    """Get a household by ID."""
    doc = _households().document(household_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    data["id"] = doc.id
    return data


def get_user_household(uid: str) -> Optional[Dict[str, Any]]:
    """Get the household a user is currently scoped to, if any.

    MH-3c: returns the user's *active scope* (the legacy single-valued
    `household_id` field). Existing 40+ call sites still rely on this
    one-household-per-user signature; multi-household reads use
    `list_user_memberships(uid)` instead.
    """
    user_doc = _db().collection("users").document(uid).get()
    if not user_doc.exists:
        return None
    user_data = user_doc.to_dict()
    hid = user_data.get("household_id")
    if not hid:
        return None
    return get_household(hid)


def list_user_memberships(uid: str) -> List[Dict[str, Any]]:
    """Return every household this user belongs to, with role.

    MH-3c: prefers `users/{uid}/memberships/*` subcollection (canonical).
    Falls back to legacy `users/{uid}.household_id` field when the
    subcollection is empty (pre-MH-3b backfill state). Synthesises a
    single Membership entry from the legacy household so downstream
    callers can treat both paths uniformly.

    Each returned dict has shape:
      {
        "household_id": str,
        "household_name": str,
        "role": "owner" | "member",
        "joined_at": str (ISO),
        "frozen": bool,
      }

    Owner-first ordering, then alphabetical by household name.
    """
    db = _db()
    docs = list(_user_memberships_ref(uid).stream())

    if not docs:
        # Legacy fallback — synthesise from the single-valued household_id.
        legacy = get_user_household(uid)
        if legacy is None:
            return []
        is_owner = legacy.get("owner_uid") == uid
        return [{
            "household_id": legacy["id"],
            "household_name": legacy.get("name", legacy["id"]),
            "role": "owner" if is_owner else "member",
            "joined_at": "",
            "frozen": False,
        }]

    out: List[Dict[str, Any]] = []
    for doc in docs:
        data = doc.to_dict() or {}
        hid = data.get("household_id") or doc.id
        # Pull household name in one extra read. Cheap at N <= ~5 memberships;
        # if a power user joins many households we can switch to a batched get.
        h_snap = db.collection("households").document(hid).get()
        if not h_snap.exists:
            # Orphaned membership — household deleted out from under us. Skip.
            continue
        h_data = h_snap.to_dict() or {}
        out.append({
            "household_id": hid,
            "household_name": h_data.get("name", hid),
            "role": data.get("role", "member"),
            "joined_at": data.get("joined_at", ""),
            "frozen": bool(data.get("frozen", False)),
        })

    # Owner first, then alphabetical.
    out.sort(key=lambda m: (0 if m["role"] == "owner" else 1, m["household_name"].lower()))
    return out


def get_owned_household(uid: str) -> Optional[Dict[str, Any]]:
    """Return the household this user OWNS, if any. Multi-membership users
    have at most one owned household — that's the asymmetric invariant.

    Used by `create_household` to enforce the "you can only own one" rule.
    """
    for m in list_user_memberships(uid):
        if m["role"] == "owner":
            return get_household(m["household_id"])
    return None


def get_household_member_uids(household_id: str) -> List[str]:
    """Get list of UIDs for all active (non-frozen) members."""
    household = get_household(household_id)
    if not household:
        return []
    return [m["uid"] for m in household.get("members", []) if not m.get("frozen")]


def list_all_households(limit: int = 100) -> List[Dict[str, Any]]:
    """Admin: list all households."""
    results = []
    for doc in _households().stream():
        data = doc.to_dict()
        data["id"] = doc.id
        results.append(data)
    results.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return results[:limit]


# ---------------------------------------------------------------------------
# Add member
# ---------------------------------------------------------------------------


def add_member(
    household_id: str,
    uid: str,
    display_name: str,
    default_role: str = "brother",
) -> Dict[str, Any]:
    """Add a member to a household. Returns updated household.

    MH-3c: multi-membership is now allowed. The previous "User is already
    in another household" cross-household block has been removed — a user
    can be a member of N households (but still only own 1, enforced in
    `create_household`).

    Writes to both the canonical memberships subcollection AND the legacy
    `users/{uid}.household_id` field. The legacy field reflects the user's
    active scope; we set it here only when the user has no current scope,
    so existing single-household users see no behaviour change while
    multi-household users keep their previously-active scope on join.
    """
    household = get_household(household_id)
    if not household:
        raise ValueError("Household not found")

    members = household.get("members", [])

    # Check capacity
    active_count = sum(1 for m in members if not m.get("frozen"))
    if active_count >= household.get("max_members", 2):
        raise ValueError(f"Household is full ({active_count}/{household['max_members']} members)")

    # Check user not already a member of *this* household
    if any(m["uid"] == uid for m in members):
        raise ValueError("User is already a member of this household")

    # Resolve role
    role_def = next((r for r in DEFAULT_ROLES if r["key"] == default_role), DEFAULT_ROLES[2])

    joined_at = datetime.utcnow().isoformat()
    new_member = {
        "uid": uid,
        "role": "member",
        "default_role": default_role,
        "display_role": role_def["name"],
        "role_icon": role_def["icon"],
        "role_color": role_def["color"],
        "display_name": display_name,
        "joined_at": joined_at,
        "frozen": False,
    }

    members.append(new_member)
    _households().document(household_id).update({
        "members": members,
        "updated_at": datetime.utcnow().isoformat(),
    })

    # MH-3c: write canonical membership.
    _write_membership(uid, household_id, role="member", joined_at=joined_at)

    # Legacy active-scope shadow: only set if the user has no current scope.
    # Existing single-household users still get household_id set (their first
    # household becomes their active scope); multi-household users keep their
    # current scope and switch via the SPA pill.
    user_ref = _db().collection("users").document(uid)
    user_snap = user_ref.get()
    current_scope = (user_snap.to_dict() or {}).get("household_id") if user_snap.exists else None
    if not current_scope:
        user_ref.update({
            "household_id": household_id,
            "household_role": "member",
        })

    logger.info("User %s joined household %s as %s", uid, household_id, default_role)
    household["members"] = members
    return household


# ---------------------------------------------------------------------------
# Remove member / Leave
# ---------------------------------------------------------------------------


def remove_member(household_id: str, uid: str, removed_by: str) -> bool:
    """Remove a member from a household. Returns False if not found."""
    household = get_household(household_id)
    if not household:
        return False

    # Can't remove the owner directly
    if uid == household["owner_uid"]:
        raise ValueError("Cannot remove the owner. Transfer ownership or dissolve the household.")

    members = household.get("members", [])
    new_members = [m for m in members if m["uid"] != uid]
    if len(new_members) == len(members):
        return False  # not found

    _households().document(household_id).update({
        "members": new_members,
        "updated_at": datetime.utcnow().isoformat(),
    })

    # MH-3c: delete the canonical membership doc.
    _user_memberships_ref(uid).document(household_id).delete()

    # Legacy active-scope shadow handling: if the user's active scope was
    # this household, fall back to the next remaining membership (if any).
    # This avoids stranding the user on a "scope: nothing" view.
    user_ref = _db().collection("users").document(uid)
    user_snap = user_ref.get()
    if user_snap.exists:
        user_data = user_snap.to_dict() or {}
        if user_data.get("household_id") == household_id:
            remaining = list_user_memberships(uid)
            if remaining:
                # Owner-first ordering enforced by list_user_memberships.
                fallback = remaining[0]
                user_ref.update({
                    "household_id": fallback["household_id"],
                    "household_role": fallback["role"],
                })
            else:
                user_ref.update({
                    "household_id": None,
                    "household_role": None,
                })

    logger.info("User %s removed from household %s by %s", uid, household_id, removed_by)
    return True


def leave_household(uid: str) -> bool:
    """Member leaves their household voluntarily."""
    household = get_user_household(uid)
    if not household:
        return False

    if uid == household["owner_uid"]:
        # Owner leaving with no other members → dissolve
        active_members = [m for m in household["members"] if m["uid"] != uid]
        if not active_members:
            return dissolve_household(household["id"], uid)
        raise ValueError("Transfer ownership to another member before leaving.")

    return remove_member(household["id"], uid, uid)


# ---------------------------------------------------------------------------
# Transfer ownership
# ---------------------------------------------------------------------------


def transfer_ownership(household_id: str, new_owner_uid: str, current_owner_uid: str) -> bool:
    """Transfer household ownership to another member."""
    household = get_household(household_id)
    if not household:
        return False
    if household["owner_uid"] != current_owner_uid:
        raise ValueError("Only the current owner can transfer ownership.")

    members = household.get("members", [])
    if not any(m["uid"] == new_owner_uid for m in members):
        raise ValueError("New owner must be a current member.")

    # Update roles
    for m in members:
        if m["uid"] == new_owner_uid:
            m["role"] = "owner"
        elif m["uid"] == current_owner_uid:
            m["role"] = "member"

    _households().document(household_id).update({
        "owner_uid": new_owner_uid,
        "members": members,
        "updated_at": datetime.utcnow().isoformat(),
    })

    # Update user profiles
    _db().collection("users").document(new_owner_uid).update({"household_role": "owner"})
    _db().collection("users").document(current_owner_uid).update({"household_role": "member"})

    logger.info("Household %s ownership transferred from %s to %s", household_id, current_owner_uid, new_owner_uid)
    return True


# ---------------------------------------------------------------------------
# Dissolve
# ---------------------------------------------------------------------------


def dissolve_household(household_id: str, dissolved_by: str) -> bool:
    """Dissolve a household. All members become solo users."""
    household = get_household(household_id)
    if not household:
        return False

    # Clear all members' household_id
    for member in household.get("members", []):
        try:
            _db().collection("users").document(member["uid"]).update({
                "household_id": None,
                "household_role": None,
            })
        except Exception as e:
            logger.warning("Failed to clear household for user %s: %s", member["uid"], e)

    # Delete household doc
    _households().document(household_id).delete()

    logger.info("Household %s dissolved by %s", household_id, dissolved_by)
    return True


# ---------------------------------------------------------------------------
# Personalise role
# ---------------------------------------------------------------------------


def update_member_role(household_id: str, uid: str, updates: Dict[str, str]) -> bool:
    """Update a member's personalised role (display_role, role_icon, role_color)."""
    household = get_household(household_id)
    if not household:
        return False

    members = household.get("members", [])
    found = False
    for m in members:
        if m["uid"] == uid:
            if "display_role" in updates:
                m["display_role"] = updates["display_role"][:30]
            if "role_icon" in updates:
                m["role_icon"] = updates["role_icon"][:4]
            if "role_color" in updates:
                m["role_color"] = updates["role_color"][:10]
            found = True
            break

    if not found:
        return False

    _households().document(household_id).update({
        "members": members,
        "updated_at": datetime.utcnow().isoformat(),
    })
    return True


# ---------------------------------------------------------------------------
# Update household
# ---------------------------------------------------------------------------


def rename_household(household_id: str, new_name: str) -> bool:
    """Rename a household."""
    doc = _households().document(household_id).get()
    if not doc.exists:
        return False
    _households().document(household_id).update({
        "name": new_name.strip()[:50],
        "updated_at": datetime.utcnow().isoformat(),
    })
    return True


def update_tier_limits(household_id: str, new_tier: str) -> None:
    """Update household max_members when owner's tier changes.
    Freeze excess members if downgrading."""
    household = get_household(household_id)
    if not household:
        return

    new_max = TIER_MAX_MEMBERS.get(new_tier, 2)
    members = household.get("members", [])

    # Determine which roles stay active based on tier
    active_roles = FREE_ROLES if new_tier == "free" else PLUS_PRO_ROLES

    for m in members:
        if m["role"] == "owner":
            m["frozen"] = False  # owner never frozen
        elif m.get("default_role") in active_roles:
            m["frozen"] = False
        else:
            # Freeze members whose roles exceed tier
            active_count = sum(1 for mm in members if not mm.get("frozen"))
            if active_count > new_max:
                m["frozen"] = True

    _households().document(household_id).update({
        "tier": new_tier,
        "max_members": new_max,
        "members": members,
        "updated_at": datetime.utcnow().isoformat(),
    })

    logger.info("Household %s tier updated to %s (max %d members)", household_id, new_tier, new_max)


def get_available_roles(tier: str) -> List[Dict[str, str]]:
    """Get available default roles for a tier."""
    if tier in ("plus", "pro", "admin"):
        return DEFAULT_ROLES
    return [r for r in DEFAULT_ROLES if r["key"] in FREE_ROLES]
