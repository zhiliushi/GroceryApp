"""User-side feedback routes.

Mounted at /api/feedback. The authenticated user's uid + email are
attached server-side. The same endpoint accepts capture from any source
(web, cap-trigger auto-prompt, future raspberry-pi device) — `source`
is just a tag on the resulting doc.

Admin browse + status updates live under /api/admin/feedback in admin.py.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.auth import UserInfo, get_current_user
from app.services import feedback_service

logger = logging.getLogger(__name__)
router = APIRouter()


class SubmitFeedbackRequest(BaseModel):
    kind: str = Field(..., description="cap_request | bug | feature | general")
    message: str = Field(..., min_length=1, max_length=5000)
    source: Optional[str] = "web"
    context: Optional[dict[str, Any]] = None


@router.post("", status_code=201)
async def submit_feedback(
    body: SubmitFeedbackRequest,
    user: UserInfo = Depends(get_current_user),
):
    """Submit a feedback entry. Idempotency = none."""
    return feedback_service.create_feedback(
        user.uid,
        kind=body.kind,
        message=body.message,
        source=body.source or "web",
        context=body.context,
        user_email=user.email,
    )


@router.get("/mine")
async def list_my_feedback(
    limit: int = 50,
    archive_view: str = "active",
    user: UserInfo = Depends(get_current_user),
):
    """User-scoped feedback list. Powers the My feedback tab on User Hub
    — closes the loop so users can see what they submitted + where each
    item stands.

    `archive_view`: 'active' (default) | 'archived' | 'all'. Active hides
    threads that have been resolved/wont_fix for >24h (auto-archive).
    Pinned threads bypass the sweep and stay 'active' indefinitely. The
    User Hub UI flips this when the user toggles "Show archived".

    Auth: any authenticated user; returns only their own rows. Admin
    browse (all users) lives at /api/admin/feedback per admin.py.
    """
    items = feedback_service.list_feedback(
        user_id=user.uid, limit=limit, archive_view=archive_view,
    )
    return {"items": items, "count": len(items)}
