"""Feedback service — captures user feedback for cap revisits + bugs +
feature requests.

Designed to be a single sink that accepts feedback from multiple sources:
  - 'web'                     — submitted via UI feedback form
  - 'cap_hit_primary'         — auto-triggered when user hits 15-primary cap
  - 'cap_hit_alternative'     — auto-triggered when user hits 3-alt cap
  - 'rpi_voice' / 'rpi_text'  — future raspberry-pi capture path
                                 (writes to the same endpoint; no schema change)

Storage: top-level `feedback/{auto_id}` collection. We DON'T scope under
users/{uid} because the admin browse view needs a single read query.
user_id field on the doc lets per-user filters work in the admin UI.

Per the v3 design discussion (2026-05-04), Shahir wants admin to use
this data to decide whether to bump beta caps. Hence kind='cap_request'
gets a dedicated context blob with the user's intended action.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from app.core.exceptions import NotFoundError, ValidationError

logger = logging.getLogger(__name__)

_COLLECTION = "feedback"
_VALID_KINDS = {"cap_request", "bug", "feature", "general"}
_VALID_STATUSES = {"new", "triaged", "resolved", "wont_fix"}
_MAX_MESSAGE_LEN = 5000


def _db():
    return firestore.client()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_feedback(
    user_id: str,
    *,
    kind: str,
    message: str,
    source: str = "web",
    context: Optional[dict[str, Any]] = None,
    user_email: Optional[str] = None,
) -> dict[str, Any]:
    """Submit a feedback entry. Idempotency = none (each call = new doc).

    Args:
      user_id   : authenticated user's uid (required even for raspberry-pi
                  capture — the device should be paired to a user account)
      kind      : 'cap_request' | 'bug' | 'feature' | 'general'
      message   : free-text from user (≤5000 chars; trimmed)
      source    : 'web' | 'cap_hit_primary' | 'cap_hit_alternative' |
                  'rpi_voice' | 'rpi_text' | other
      context   : optional structured data (e.g. {cap_type, list_id, ...})
                  for cap_request entries — admin uses this to gauge
                  whether to bump caps
      user_email: optional denorm so admin browse doesn't need a user
                  doc lookup per row

    Returns the created doc with id.

    Raises:
      ValidationError on bad kind / empty message / overlong message
    """
    if kind not in _VALID_KINDS:
        raise ValidationError(f"kind must be one of {sorted(_VALID_KINDS)}")
    msg = (message or "").strip()
    if not msg:
        raise ValidationError("message is required")
    if len(msg) > _MAX_MESSAGE_LEN:
        raise ValidationError(f"message must be ≤ {_MAX_MESSAGE_LEN} characters")

    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_email": user_email,
        "kind": kind,
        "source": source,
        "message": msg,
        "context": context or {},
        "status": "new",
        "admin_notes": None,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
        "schema_version": 1,
    }
    _db().collection(_COLLECTION).document(doc["id"]).set(doc)
    logger.info(
        "feedback.created id=%s user=%s kind=%s source=%s",
        doc["id"], user_id, kind, source,
    )
    return doc


def list_feedback(
    *,
    kind: Optional[str] = None,
    status: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """Admin: browse feedback. Filter by kind/status/user (all optional)."""
    q = _db().collection(_COLLECTION)
    if kind:
        if kind not in _VALID_KINDS:
            raise ValidationError(f"kind must be one of {sorted(_VALID_KINDS)}")
        q = q.where(filter=FieldFilter("kind", "==", kind))
    if status:
        if status not in _VALID_STATUSES:
            raise ValidationError(f"status must be one of {sorted(_VALID_STATUSES)}")
        q = q.where(filter=FieldFilter("status", "==", status))
    if user_id:
        q = q.where(filter=FieldFilter("user_id", "==", user_id))
    q = q.order_by("created_at", direction=firestore.Query.DESCENDING).limit(limit)

    out: list[dict[str, Any]] = []
    for snap in q.stream():
        data = snap.to_dict() or {}
        data["id"] = snap.id
        out.append(data)
    return out


def update_feedback(
    feedback_id: str,
    *,
    status: Optional[str] = None,
    admin_notes: Optional[str] = None,
) -> dict[str, Any]:
    """Admin: update status / notes on a feedback entry. Pass only fields
    you want to change."""
    if status is not None and status not in _VALID_STATUSES:
        raise ValidationError(f"status must be one of {sorted(_VALID_STATUSES)}")

    doc_ref = _db().collection(_COLLECTION).document(feedback_id)
    snap = doc_ref.get()
    if not snap.exists:
        raise NotFoundError(f"Feedback {feedback_id} not found")

    updates: dict[str, Any] = {"updated_at": _now_iso()}
    if status is not None:
        updates["status"] = status
    if admin_notes is not None:
        updates["admin_notes"] = admin_notes[:2000]
    doc_ref.update(updates)

    out = snap.to_dict() or {}
    out.update(updates)
    out["id"] = feedback_id
    return out


def stats() -> dict[str, Any]:
    """Quick counts for admin dashboard. Returns counts by status + kind."""
    all_docs = list(_db().collection(_COLLECTION).stream())
    by_status: dict[str, int] = {}
    by_kind: dict[str, int] = {}
    for snap in all_docs:
        d = snap.to_dict() or {}
        by_status[d.get("status", "new")] = by_status.get(d.get("status", "new"), 0) + 1
        by_kind[d.get("kind", "general")] = by_kind.get(d.get("kind", "general"), 0) + 1
    return {
        "total": len(all_docs),
        "by_status": by_status,
        "by_kind": by_kind,
    }
