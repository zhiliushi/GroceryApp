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

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.auth import UserInfo, get_current_user
from app.core.exceptions import NotFoundError, ValidationError
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


# ---------------------------------------------------------------------------
# Threading — user-side endpoints. The user can read their own thread
# and post replies to their own thread (re-opens it on admin's queue).
# ---------------------------------------------------------------------------

class PostMessageRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)


def _load_user_owned(feedback_id: str, user: UserInfo) -> dict[str, Any]:
    """Fetch a feedback doc and confirm the calling user owns it.

    Returns the parent dict on success. 404s when the row doesn't exist
    (we don't leak existence to non-owners). 403 when the row exists
    but belongs to someone else.
    """
    from app.services.feedback_service import _COLLECTION as _COL  # noqa: PLC0415
    from firebase_admin import firestore  # noqa: PLC0415

    snap = firestore.client().collection(_COL).document(feedback_id).get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Feedback not found")
    parent = snap.to_dict() or {}
    if parent.get("user_id") != user.uid:
        raise HTTPException(status_code=403, detail="Not your thread")
    parent["id"] = snap.id
    return parent


@router.get("/{feedback_id}/messages")
async def list_my_thread(
    feedback_id: str,
    user: UserInfo = Depends(get_current_user),
):
    """Return the chronological message list for one of the user's own
    feedback threads. 404 when the row doesn't exist; 403 when the user
    doesn't own it.
    """
    parent = _load_user_owned(feedback_id, user)
    try:
        messages = feedback_service.list_messages(feedback_id, parent=parent)
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return {"feedback_id": feedback_id, "messages": messages, "count": len(messages)}


@router.post("/{feedback_id}/messages", status_code=201)
async def post_my_reply(
    feedback_id: str,
    body: PostMessageRequest,
    user: UserInfo = Depends(get_current_user),
):
    """Post a user reply to one of the user's own threads. Re-opens the
    thread on admin's queue when status was resolved/wont_fix.

    Auth: any authenticated user; ownership is enforced by service.
    Admin replies go through PATCH /api/admin/feedback/{id}/messages
    (admin route) so they hit the admin gate.
    """
    # Verify ownership at the route layer for a clean 403 (the service
    # raises ValidationError which would 400; HTTP semantics matter
    # here for the SPA error renderer).
    _load_user_owned(feedback_id, user)
    try:
        msg = feedback_service.post_message(
            feedback_id,
            author="user",
            text=body.text,
            author_email=user.email,
            requesting_user_id=user.uid,
        )
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Feedback not found")
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return msg
