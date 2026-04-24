"""Pydantic schemas for reminders (7/14/21-day nudges for untracked items)."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class Reminder(BaseModel):
    """A single reminder about a purchase event that's been around for a while without expiry."""

    id: str
    purchase_event_id: str
    catalog_name_norm: str
    display_name: str
    stage: int                    # 7 | 14 | 21
    message: str
    created_at: datetime
    dismissed_at: Optional[datetime] = None
    acted_at: Optional[datetime] = None
    action_taken: Optional[str] = None  # "used" | "thrown" | "snooze" | "still_have"


class ReminderDismissRequest(BaseModel):
    """POST body when user dismisses/acts on a reminder."""

    action: str  # "used" | "thrown" | "still_have" | "snooze"
    reason: Optional[str] = None  # for "thrown": "expired" | "bad" | "forgot"
