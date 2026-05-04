"""
Firebase Auth middleware for FastAPI.

Provides dependencies:
  - get_optional_user: Returns UserInfo or None
  - get_current_user: Returns UserInfo or raises 401
  - require_admin: Returns admin UserInfo or raises 403

Onboarding v2 — Phase 1 changes (PLAN_ONBOARDING_V2.md):
  - `_verify_token` rejects password-provider tokens unless `email_verified=true`
  - `_get_user_role` caches the Firestore role lookup with a 5-min TTL,
    stopping the per-request read that would otherwise burn the daily quota
"""

import logging
import time
from typing import Optional

from fastapi import Request, HTTPException, Depends
from firebase_admin import auth as firebase_auth, firestore

from app.core.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# User context
# ---------------------------------------------------------------------------

class UserInfo:
    """Authenticated user context."""

    def __init__(self, uid: str, email: str, role: str = "user", display_name: str = ""):
        self.uid = uid
        self.email = email
        self.role = role
        self.display_name = display_name

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"


# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------

def _extract_token(request: Request) -> Optional[str]:
    """Extract Firebase ID token from cookie or Authorization header."""
    token = request.cookies.get("__session")
    if token:
        return token

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]

    return None


def _verify_token(token: str) -> Optional[dict]:
    """Verify Firebase ID token. Returns decoded claims or None.

    Phase 1 gate: password-provider users must have `email_verified=true`.
    Google sign-ins always set `email_verified=true` because Google guarantees
    the email is real, so no extra check is needed for that path. Anonymous /
    phone / other providers pass the gate (Firebase can't verify those by
    email anyway — they identify by other means).
    """
    try:
        decoded = firebase_auth.verify_id_token(token)
    except Exception as e:
        logger.warning("Token verification failed: %s", e)
        return None

    provider = (decoded.get("firebase") or {}).get("sign_in_provider")
    if provider == "password" and not decoded.get("email_verified"):
        logger.info(
            "Token rejected: email not verified (uid=%s, email=%s)",
            decoded.get("uid", "unknown"),
            decoded.get("email", "unknown"),
        )
        return None

    return decoded


# ---------------------------------------------------------------------------
# Role cache (Phase 1)
#
# Without this cache, every authenticated request triggers a Firestore read
# inside `_get_user_role` to look up the user's role document. At free-tier
# scale (50k Firestore reads/day) that's the dominant cost. 5-min TTL keeps
# the cache fresh enough that admin demotes propagate within ~5 min via
# `_evict_role_cache(uid)` — wired from user_service in Phase 5.
# ---------------------------------------------------------------------------

_ROLE_CACHE: dict[str, tuple[str, float]] = {}  # uid -> (role, expires_at_unix)
_ROLE_CACHE_TTL_SEC = 300.0


def _evict_role_cache(uid: Optional[str] = None) -> None:
    """Force the next role lookup for `uid` to re-read Firestore.

    Pass `uid=None` to clear the entire cache (test helper / startup reset).
    Phase 5 wires this into `user_service.update_user_role` so admin demotes
    take effect immediately rather than on the next 5-min refresh.
    """
    if uid is None:
        _ROLE_CACHE.clear()
    else:
        _ROLE_CACHE.pop(uid, None)


def _get_user_role(decoded_token: dict, uid: str) -> str:
    """Determine user role from custom claims, Firestore (cached), or config.

    Resolution order:
      1. Firebase custom claim (`role=admin` on the token itself — fastest, no I/O)
      2. Firestore `users/{uid}.role` (cached 5 min — avoids per-request read)
      3. Bootstrap `settings.ADMIN_UIDS` (config fallback for first admin)

    The cache is uid-scoped, so demoting one user doesn't impact others.
    """
    # 1. Custom claim — token-resident, always fresh, no cache
    if decoded_token.get("role") == "admin":
        return "admin"

    # 2. Firestore role — TTL-cached
    now = time.time()
    cached = _ROLE_CACHE.get(uid)
    if cached and cached[1] > now:
        return cached[0]

    role = "user"
    try:
        db = firestore.client()
        user_doc = db.collection("users").document(uid).get()
        if user_doc.exists:
            data = user_doc.to_dict() or {}
            if data.get("role") == "admin":
                role = "admin"
    except Exception:
        # Best-effort — if Firestore is unreachable, fall through to step 3.
        pass

    # 3. Bootstrap admin UIDs from config
    if uid in settings.ADMIN_UIDS:
        role = "admin"

    _ROLE_CACHE[uid] = (role, now + _ROLE_CACHE_TTL_SEC)
    return role


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------

async def get_optional_user(request: Request) -> Optional[UserInfo]:
    """Returns UserInfo if authenticated, None otherwise."""
    token = _extract_token(request)
    if not token:
        return None
    decoded = _verify_token(token)
    if not decoded:
        return None
    uid = decoded["uid"]
    role = _get_user_role(decoded, uid)
    return UserInfo(
        uid=uid,
        email=decoded.get("email", ""),
        role=role,
        display_name=decoded.get("name", ""),
    )


async def get_current_user(request: Request) -> UserInfo:
    """Returns UserInfo or raises 401."""
    user = await get_optional_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


async def require_admin(user: UserInfo = Depends(get_current_user)) -> UserInfo:
    """Returns admin UserInfo or raises 403."""
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
