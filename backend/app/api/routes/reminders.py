"""Reminders API — 7/14/21-day nudges for active purchases without expiry.

GET  /api/reminders                      — List my active reminders
GET  /api/reminders/{reminder_id}        — Get a single reminder
POST /api/reminders/{reminder_id}/dismiss — Dismiss with action (used/thrown/still_have/snooze)
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import UserInfo, get_current_user
from app.core.rate_limit import rate_limit
from app.schemas.reminder import ReminderDismissRequest
from app.services import nudge_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("")
async def list_reminders(
    include_dismissed: bool = Query(False),
    limit: int = Query(20, ge=1, le=100),
    user: UserInfo = Depends(get_current_user),
):
    """List reminders for the authenticated user. Non-dismissed first."""
    items = nudge_service.list_reminders(user.uid, include_dismissed=include_dismissed, limit=limit)
    return {"count": len(items), "reminders": items}


@router.get("/{reminder_id}")
async def get_reminder(reminder_id: str, user: UserInfo = Depends(get_current_user)):
    """Get a single reminder."""
    reminder = nudge_service.get_reminder(user.uid, reminder_id)
    if not reminder:
        raise HTTPException(status_code=404, detail=f"Reminder '{reminder_id}' not found")
    return reminder


@router.post("/{reminder_id}/dismiss", dependencies=[Depends(rate_limit(60))])
async def dismiss_reminder(
    reminder_id: str,
    data: ReminderDismissRequest,
    user: UserInfo = Depends(get_current_user),
):
    """Dismiss a reminder with an action.

    Side effects:
      - action="used" → linked purchase event marked used
      - action="thrown" → linked purchase event marked thrown (reason optional)
      - action="still_have" | "snooze" → just dismiss
    """
    return nudge_service.dismiss_reminder(
        user_id=user.uid,
        reminder_id=reminder_id,
        action=data.action,
        reason=data.reason,
    )
