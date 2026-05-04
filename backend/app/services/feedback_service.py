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
# Admin-set "cute" badges visible to the user. Distinct from internal
# `status` (which gates archival logic). `noted` is the soft acknowledgement;
# `on_it` signals active work; `need_info` parks the thread waiting for the
# user; `resolved` + `shipped` flag user-visible completion; `parked`
# is a friendlier wont_fix.
_VALID_BADGES = {"noted", "on_it", "need_info", "resolved", "shipped", "parked"}
# Auto-archive window for resolved/wont_fix threads in the user-facing
# My feedback list. Threads with admin response older than this go off
# the user's main view (admin sees them in the Archived tab). Pinned
# threads bypass archival.
_ARCHIVE_AFTER_HOURS = 24
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
        "admin_response": None,
        "responded_at": None,
        # Admin-set cute badge surfaced to the user (e.g. 'on_it').
        # See _VALID_BADGES. None = no admin signal yet.
        "admin_badge": None,
        # When True, the thread bypasses the 24h archive sweep and stays
        # visible to the user permanently. Admin sets via the pin action
        # in Admin Hub when a thread is worth keeping (led to a feature,
        # is a recurring concern, etc.).
        "pinned": False,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
        "schema_version": 2,
    }
    _db().collection(_COLLECTION).document(doc["id"]).set(doc)
    logger.info(
        "feedback.created id=%s user=%s kind=%s source=%s",
        doc["id"], user_id, kind, source,
    )

    # P1.5: fire-and-forget Telegram notification to admin chat. Wrapped
    # so a notification outage NEVER blocks feedback writes. See
    # `app/services/notification_service.py` for the silent-on-failure
    # contract.
    try:
        from app.services import notification_service, config_service
        web_public_url = (config_service.get_system_config() or {}).get("web_public_url") or ""
        notification_service.notify_admin_feedback(doc, web_public_url=web_public_url)
    except Exception as exc:  # noqa: BLE001
        logger.warning("feedback.notify admin failed (non-fatal): %s", exc)

    return doc


def list_feedback(
    *,
    kind: Optional[str] = None,
    status: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 100,
    archive_view: str = "active",
) -> list[dict[str, Any]]:
    """Admin: browse feedback. Filter by kind/status/user (all optional).

    Sort behaviour:
      - When `user_id` is provided we sort in Python after the read,
        avoiding a composite (`user_id` + `created_at` desc) index that
        we don't want to maintain at closed-beta scale (per-user row
        count is tiny). Same trick used in `list_reminders` —
        cf. `nudge_service.py:140-158`.
      - Otherwise (admin browse), Firestore-side `order_by(created_at)`
        is fine: equality filters on kind/status compose with the
        single-field index already in place.
    """
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
        # No order_by here — sort in Python below.
    else:
        q = q.order_by("created_at", direction=firestore.Query.DESCENDING)
    q = q.limit(limit)

    out: list[dict[str, Any]] = []
    for snap in q.stream():
        data = snap.to_dict() or {}
        data["id"] = snap.id
        out.append(data)

    if user_id:
        out.sort(key=lambda r: r.get("created_at", ""), reverse=True)

    # Archive filter (24h sweep + pin override). `archive_view`:
    #   - 'active'  (default) — exclude archived rows. Pinned bypass.
    #   - 'archived'          — only archived rows.
    #   - 'all'               — no filter.
    if archive_view != "all":
        now_iso = _now_iso()
        if archive_view == "archived":
            out = [r for r in out if is_archived(r, now_iso=now_iso)]
        else:  # 'active' or anything else → behave as active
            out = [r for r in out if not is_archived(r, now_iso=now_iso)]

    return out


def update_feedback(
    feedback_id: str,
    *,
    status: Optional[str] = None,
    admin_notes: Optional[str] = None,
    admin_response: Optional[str] = None,
    admin_badge: Optional[str] = None,
    pinned: Optional[bool] = None,
) -> dict[str, Any]:
    """Admin: update status / notes / reply / badge / pin on a feedback
    entry. Pass only the fields you want to change.

    `admin_badge`: must be one of `_VALID_BADGES` or None to clear.
    `pinned`: True keeps the thread out of the auto-archive sweep. False
              re-includes it (and it may immediately archive if it
              already crossed the 24h window).
    `admin_response`: setting this also stamps `responded_at` so the
                      24h archive timer starts from the latest reply
                      (not the first triage touch). Empty string
                      clears the field but leaves responded_at as-is.
    """
    if status is not None and status not in _VALID_STATUSES:
        raise ValidationError(f"status must be one of {sorted(_VALID_STATUSES)}")
    if admin_badge is not None and admin_badge != "" and admin_badge not in _VALID_BADGES:
        raise ValidationError(f"admin_badge must be one of {sorted(_VALID_BADGES)} or empty")

    doc_ref = _db().collection(_COLLECTION).document(feedback_id)
    snap = doc_ref.get()
    if not snap.exists:
        raise NotFoundError(f"Feedback {feedback_id} not found")

    updates: dict[str, Any] = {"updated_at": _now_iso()}
    if status is not None:
        updates["status"] = status
    if admin_notes is not None:
        updates["admin_notes"] = admin_notes[:2000]
    if admin_response is not None:
        updates["admin_response"] = admin_response[:2000]
        # Stamp the response time only when we have actual reply text;
        # an empty-string clear keeps the previous timestamp so the
        # 24h archive window doesn't reset.
        if admin_response.strip():
            updates["responded_at"] = _now_iso()
    if admin_badge is not None:
        updates["admin_badge"] = admin_badge or None
    if pinned is not None:
        updates["pinned"] = bool(pinned)
    doc_ref.update(updates)

    out = snap.to_dict() or {}
    out.update(updates)
    out["id"] = feedback_id
    return out


def is_archived(doc: dict[str, Any], *, now_iso: Optional[str] = None) -> bool:
    """Return True when a feedback row should be hidden from the user's
    main My feedback view (auto-archived).

    Rules:
      - Pinned threads never archive (admin's explicit save).
      - Threads still active (not resolved/wont_fix) never archive.
      - Otherwise: archive once `responded_at` is older than
        `_ARCHIVE_AFTER_HOURS`. If responded_at is missing, fall back
        to updated_at (admin can resolve without typing a reply).
    """
    if doc.get("pinned"):
        return False
    if doc.get("status") not in ("resolved", "wont_fix"):
        return False
    stamp = doc.get("responded_at") or doc.get("updated_at") or doc.get("created_at")
    if not stamp:
        return False
    try:
        stamp_dt = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return False
    if stamp_dt.tzinfo is None:
        stamp_dt = stamp_dt.replace(tzinfo=timezone.utc)
    cutoff_dt = datetime.fromisoformat((now_iso or _now_iso()).replace("Z", "+00:00"))
    if cutoff_dt.tzinfo is None:
        cutoff_dt = cutoff_dt.replace(tzinfo=timezone.utc)
    age_hours = (cutoff_dt - stamp_dt).total_seconds() / 3600.0
    return age_hours >= _ARCHIVE_AFTER_HOURS


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
