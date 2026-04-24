"""Nudge service — 7/14/21-day reminders for active purchases without expiry.

Scheduler calls `scan_reminders()` daily. For each active purchase with no
expiry set, checks age since `date_bought` and creates reminder docs at
stages 1 (>=7d), 2 (>=14d), 3 (>=21d).

Users see reminders on Dashboard. Dismissing triggers optional status change
(used / thrown / snooze).
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from firebase_admin import firestore

from app.core.exceptions import NotFoundError, ValidationError
from app.core.feature_flags import feature_flag
from app.core.metadata import apply_create_metadata, apply_update_metadata
from app.services import catalog_service, purchase_event_service

logger = logging.getLogger(__name__)


def _db():
    return firestore.client()


def _user_reminders_ref(user_id: str):
    return _db().collection("users").document(user_id).collection("reminders")


# ---------------------------------------------------------------------------
# Scan — scheduler entry point
# ---------------------------------------------------------------------------


@feature_flag("reminder_scan")
def scan_reminders() -> int:
    """Scan all users' active purchases without expiry. Create reminders for 7/14/21-day buckets.

    Returns count of reminders created.
    """
    now = datetime.now(timezone.utc)
    thresholds = [
        (21, 3, "Definitely check '{name}' — you bought it 3 weeks ago"),
        (14, 2, "Still have '{name}' from 2 weeks ago?"),
        (7, 1, "Still have '{name}' from a week ago?"),
    ]

    created_count = 0
    db = _db()
    # Collection group over all users' purchases
    query = (
        db.collection_group("purchases")
        .where("status", "==", "active")
        .where("reminder_stage", "<", 3)
    )

    for doc in query.stream():
        data = doc.to_dict() or {}
        # Must have no expiry AND age >= 7 days
        if data.get("expiry_date") is not None:
            continue
        date_bought = data.get("date_bought")
        if not date_bought:
            continue
        # Convert Firestore Timestamp to datetime
        if hasattr(date_bought, "to_datetime"):
            date_bought = date_bought.to_datetime()
        if date_bought.tzinfo is None:
            date_bought = date_bought.replace(tzinfo=timezone.utc)

        age_days = (now - date_bought).days
        current_stage = data.get("reminder_stage", 0)

        # Determine applicable stage (highest triggered)
        new_stage = current_stage
        message = None
        for threshold_days, stage, msg_template in thresholds:
            if age_days >= threshold_days and current_stage < stage:
                new_stage = stage
                message = msg_template
                break

        if new_stage == current_stage:
            continue  # nothing to do

        # Extract user_id from doc path
        path_parts = doc.reference.path.split("/")
        if len(path_parts) < 4:
            continue
        user_id = path_parts[1]

        display_name = data.get("catalog_display") or data.get("catalog_name_norm", "(unknown)")
        catalog_name_norm = data.get("catalog_name_norm", "")

        # Create reminder doc
        reminder_data = {
            "purchase_event_id": doc.id,
            "catalog_name_norm": catalog_name_norm,
            "display_name": display_name,
            "stage": new_stage * 7,  # stage 1 = 7 days, 2 = 14, 3 = 21
            "message": message.format(name=display_name) if message else "",
            "dismissed_at": None,
            "acted_at": None,
            "action_taken": None,
        }
        reminder_ref = _user_reminders_ref(user_id).document()
        reminder_ref.set(apply_create_metadata(reminder_data, uid="system", source="scheduler"))

        # Update purchase event: bump reminder_stage, last_reminded_at
        event_updates = {"reminder_stage": new_stage, "last_reminded_at": firestore.SERVER_TIMESTAMP}

        # At stage 3, also flag catalog.needs_review
        if new_stage == 3 and catalog_name_norm:
            try:
                catalog_service.update_catalog_entry(
                    user_id, catalog_name_norm, {"needs_review": True}
                )
            except NotFoundError:
                pass  # catalog may have been deleted; ignore

        doc.reference.update(apply_update_metadata(event_updates))
        created_count += 1

    if created_count:
        logger.info("nudge.scan_reminders created=%d", created_count)
    return created_count


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------


def list_reminders(user_id: str, include_dismissed: bool = False, limit: int = 20) -> list[dict]:
    """List reminders for a user. Active (non-dismissed) first."""
    q = _user_reminders_ref(user_id)
    if not include_dismissed:
        q = q.where("dismissed_at", "==", None)
    q = q.order_by("stage", direction=firestore.Query.DESCENDING).limit(limit)

    results = []
    for doc in q.stream():
        data = doc.to_dict()
        data["id"] = doc.id
        results.append(data)
    return results


def get_reminder(user_id: str, reminder_id: str) -> Optional[dict]:
    doc = _user_reminders_ref(user_id).document(reminder_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    data["id"] = doc.id
    return data


# ---------------------------------------------------------------------------
# Dismiss / Act
# ---------------------------------------------------------------------------


def dismiss_reminder(
    user_id: str,
    reminder_id: str,
    action: str,
    reason: Optional[str] = None,
) -> dict:
    """Mark reminder dismissed. `action` determines side effects:
      - "used" → also mark the linked purchase event as used
      - "thrown" → also mark the linked purchase event as thrown with reason
      - "still_have" → just dismiss; reminder won't re-fire at same stage but will at next
      - "snooze" → dismiss; will re-fire after N days (future: schedule re-creation)

    Returns the updated reminder doc.
    """
    valid_actions = {"used", "thrown", "still_have", "snooze"}
    if action not in valid_actions:
        raise ValidationError(f"Invalid action: {action!r}")

    reminder_ref = _user_reminders_ref(user_id).document(reminder_id)
    snap = reminder_ref.get()
    if not snap.exists:
        raise NotFoundError(f"Reminder '{reminder_id}' not found")

    data = snap.to_dict() or {}
    purchase_event_id = data.get("purchase_event_id")

    # Execute side effects on the purchase event
    if action == "used" and purchase_event_id:
        try:
            purchase_event_service.update_status(user_id, purchase_event_id, "used", reason="used_up")
        except (NotFoundError, ValidationError) as exc:
            logger.warning("nudge.dismiss: couldn't mark used: %s", exc)
    elif action == "thrown" and purchase_event_id:
        try:
            purchase_event_service.update_status(
                user_id, purchase_event_id, "thrown", reason=reason or "expired"
            )
        except (NotFoundError, ValidationError) as exc:
            logger.warning("nudge.dismiss: couldn't mark thrown: %s", exc)

    # Update reminder
    now = firestore.SERVER_TIMESTAMP
    updates = {
        "dismissed_at": now,
        "acted_at": now if action in ("used", "thrown") else None,
        "action_taken": action,
    }
    reminder_ref.update(apply_update_metadata(updates))
    logger.info(
        "nudge.dismissed user=%s reminder_id=%s action=%s",
        user_id, reminder_id, action,
    )
    return get_reminder(user_id, reminder_id)
