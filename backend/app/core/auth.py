"""
Firebase Auth middleware for FastAPI.

Provides dependencies:
  - get_optional_user: Returns UserInfo or None
  - get_current_user: Returns UserInfo or raises 401
  - require_admin: Returns admin UserInfo or raises 403
"""

import logging
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
    """Verify Firebase ID token. Returns decoded claims or None."""
    try:
        return firebase_auth.verify_id_token(token)
    except Exception as e:
        logger.warning("Token verification failed: %s", e)
        return None


def _get_user_role(decoded_token: dict, uid: str) -> str:
    """Determine user role from custom claims, Firestore, or config."""
    # 1. Firebase custom claims
    if decoded_token.get("role") == "admin":
        return "admin"

    # 2. Firestore user document
    try:
        db = firestore.client()
        user_doc = db.collection("users").document(uid).get()
        if user_doc.exists:
            data = user_doc.to_dict()
            if data.get("role") == "admin":
                return "admin"
    except Exception:
        pass

    # 3. Bootstrap admin UIDs from config
    if uid in settings.ADMIN_UIDS:
        return "admin"

    return "user"


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
