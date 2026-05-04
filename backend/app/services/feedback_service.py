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
# Admin-authored one-line summary surfaced as a prominent card above
# the user's thread. Distinct from `admin_response` (which is the
# reply text) — the summary is the takeaway / TL;DR a casual reader
# should see at a glance ("we shipped this in v0.7" / "tracked as
# duplicate of #abc"). Capped tighter than admin_response since it's
# meant to be one line.
_MAX_SUMMARY_LEN = 280
# Auto-archive window for resolved/wont_fix threads in the user-facing
# My feedback list. Threads with admin response older than this go off
# the user's main view (admin sees them in the Archived tab). Pinned
# threads bypass archival.
_ARCHIVE_AFTER_HOURS = 24
_MAX_MESSAGE_LEN = 5000
# Threading subcollection name. Each feedback doc gets a
# `messages/{auto_id}` subcollection where every turn (user reply,
# admin reply) is a doc with {author, text, created_at, author_email}.
# Legacy docs (schema_version=1 or 2 without any messages) synthesize
# a virtual admin message from `admin_response` at read time so the
# v1+v2 corpus renders correctly under the new UI.
_MESSAGES_SUBCOLLECTION = "messages"
_VALID_AUTHORS = {"user", "admin"}
_MAX_THREAD_MESSAGE_LEN = 2000


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
        # Admin-authored one-line takeaway (≤_MAX_SUMMARY_LEN chars).
        # Surfaced as a prominent card above the thread on the user's
        # My feedback page when set. Distinct from admin_response,
        # which is the reply body.
        "summary": None,
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
    summary: Optional[str] = None,
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
    if summary is not None:
        # Empty string clears the summary; trim whitespace; cap length.
        s = summary.strip()
        updates["summary"] = s[:_MAX_SUMMARY_LEN] if s else None
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


# ---------------------------------------------------------------------------
# Threading — each feedback doc has a `messages/` subcollection.
# Sprint 2 design (2026-05-04): full multi-turn replies (vs. v1's
# "latest admin reply wins"). User can reply too, which closes the
# loop without forcing the user to submit a fresh feedback row.
# ---------------------------------------------------------------------------


def list_messages(feedback_id: str, *, parent: Optional[dict[str, Any]] = None) -> list[dict[str, Any]]:
    """Return the chronological message list for a feedback thread.

    Read-time fallback: when the doc has no messages subcollection
    (legacy v1/v2 rows), synthesize a single virtual admin message
    from `admin_response` so the new threaded UI renders the existing
    corpus correctly. The synthesized message is NOT written back —
    it's purely a read-time projection so we don't have to migrate.
    The first time admin posts a message via post_message() the legacy
    admin_response is materialized as a real message row so future
    reads stop synthesizing.

    `parent` (optional) is the parent doc dict if the caller already
    has it, to avoid a redundant get().
    """
    doc_ref = _db().collection(_COLLECTION).document(feedback_id)
    if parent is None:
        snap = doc_ref.get()
        if not snap.exists:
            raise NotFoundError(f"Feedback {feedback_id} not found")
        parent = snap.to_dict() or {}

    msgs: list[dict[str, Any]] = []
    for snap in (
        doc_ref.collection(_MESSAGES_SUBCOLLECTION)
        .order_by("created_at")
        .stream()
    ):
        m = snap.to_dict() or {}
        m["id"] = snap.id
        msgs.append(m)

    # Legacy projection: if no real messages and admin_response is set,
    # surface the v1 reply as a virtual admin message. virtual=True flag
    # lets callers tell the difference (no edit / delete affordances).
    if not msgs and parent.get("admin_response"):
        msgs.append(
            {
                "id": "__virtual_admin_response__",
                "author": "admin",
                "author_email": None,
                "text": parent["admin_response"],
                "created_at": parent.get("responded_at") or parent.get("updated_at"),
                "virtual": True,
            }
        )
    return msgs


def post_message(
    feedback_id: str,
    *,
    author: str,
    text: str,
    author_email: Optional[str] = None,
    requesting_user_id: Optional[str] = None,
) -> dict[str, Any]:
    """Append a message to a feedback thread.

    Args:
      author              : 'user' | 'admin'
      text                : reply text (≤_MAX_THREAD_MESSAGE_LEN, trimmed)
      author_email        : denorm for display (admin's email, etc.)
      requesting_user_id  : when author='user', enforce that the user
                            owns the thread. When author='admin', no
                            ownership check (admin route does the gate).

    Side effects when author='admin':
      - Stamps `responded_at` on the parent doc → the 24h archive timer
        starts/resets here.
      - Mirrors the latest admin message into `admin_response` so legacy
        UIs (v1 FeedbackTab, the inline My feedback fallback) keep
        displaying the most recent admin reply without needing to know
        about the messages subcollection.
      - On the first admin message in a thread that previously had a
        legacy `admin_response`, that legacy text is materialized as a
        real message row first so the chronological order stays correct.

    Side effects when author='user':
      - Stamps `updated_at`. We deliberately do NOT touch `responded_at`
        — that field is reserved for admin replies (it gates archival).
      - If the parent's status is 'resolved' or 'wont_fix', it bumps
        back to 'triaged' so the user reply visibly re-opens the
        thread on admin's queue. (Pinned threads stay pinned.)

    Raises:
      ValidationError on bad author / empty text / overlong text.
      NotFoundError when feedback_id doesn't exist.
      ValidationError("not your thread") if user posts to someone else's.
    """
    if author not in _VALID_AUTHORS:
        raise ValidationError(f"author must be one of {sorted(_VALID_AUTHORS)}")
    body = (text or "").strip()
    if not body:
        raise ValidationError("text is required")
    if len(body) > _MAX_THREAD_MESSAGE_LEN:
        raise ValidationError(f"text must be ≤ {_MAX_THREAD_MESSAGE_LEN} characters")

    doc_ref = _db().collection(_COLLECTION).document(feedback_id)
    snap = doc_ref.get()
    if not snap.exists:
        raise NotFoundError(f"Feedback {feedback_id} not found")
    parent = snap.to_dict() or {}

    if author == "user":
        if requesting_user_id and parent.get("user_id") != requesting_user_id:
            raise ValidationError("not your thread")

    msgs_ref = doc_ref.collection(_MESSAGES_SUBCOLLECTION)

    # First admin message in a thread that has a legacy admin_response
    # → materialize the legacy reply as a real message so the order is
    # right when admin's new turn lands. We only do this when the
    # subcollection is empty, so this is a one-time cost per thread.
    if author == "admin" and parent.get("admin_response"):
        existing = list(msgs_ref.limit(1).stream())
        if not existing:
            legacy_id = str(uuid.uuid4())
            msgs_ref.document(legacy_id).set(
                {
                    "id": legacy_id,
                    "author": "admin",
                    "author_email": None,
                    "text": parent["admin_response"],
                    "created_at": parent.get("responded_at")
                    or parent.get("updated_at")
                    or parent.get("created_at"),
                    "materialized_from_legacy": True,
                }
            )

    msg_id = str(uuid.uuid4())
    msg_doc = {
        "id": msg_id,
        "author": author,
        "author_email": author_email,
        "text": body,
        "created_at": _now_iso(),
    }
    msgs_ref.document(msg_id).set(msg_doc)

    parent_updates: dict[str, Any] = {"updated_at": _now_iso()}
    if author == "admin":
        # Mirror latest admin reply into admin_response so legacy
        # surfaces (v1 list rendering, my-feedback inline fallback,
        # archive predicate) keep working without code changes.
        parent_updates["admin_response"] = body
        parent_updates["responded_at"] = _now_iso()
    else:
        # User reply re-opens a closed thread so admin sees it again.
        if parent.get("status") in ("resolved", "wont_fix"):
            parent_updates["status"] = "triaged"
    doc_ref.update(parent_updates)

    logger.info(
        "feedback.message id=%s feedback=%s author=%s len=%d",
        msg_id, feedback_id, author, len(body),
    )

    # User replies → push to admin Telegram. Admin replies don't notify
    # (admin already knows what they sent). Wrapped so a notification
    # outage NEVER blocks the message write.
    if author == "user":
        try:
            from app.services import notification_service, config_service
            web_public_url = (
                config_service.get_system_config() or {}
            ).get("web_public_url") or ""
            # Reflect the post-update status so the notify message can
            # mention "re-opens" correctly when the user reply bumped a
            # closed thread back to triaged.
            parent_for_notify = {**parent, "id": feedback_id, **parent_updates}
            notification_service.notify_admin_user_reply(
                parent_for_notify,
                reply_text=body,
                web_public_url=web_public_url,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("feedback.notify user-reply failed (non-fatal): %s", exc)

    return msg_doc


def _sync_admin_response_mirror(doc_ref: Any) -> None:
    """Recompute the parent doc's `admin_response` + `responded_at`
    mirror from the messages subcollection.

    Called after a message edit / delete so legacy single-reply
    surfaces (v1 FeedbackTab in Admin Settings, my-feedback inline
    fallback, the 24h archive predicate that reads responded_at)
    don't end up pointing at stale text.

    Strategy: walk the messages in chronological order, find the
    last non-deleted admin message; mirror its text + timestamp.
    If no admin messages remain, clear the mirror (admin_response =
    None, responded_at = None) — the thread is effectively un-replied
    again, so the 24h timer should not fire.
    """
    latest_admin_text: Optional[str] = None
    latest_admin_at: Optional[str] = None
    for snap in (
        doc_ref.collection(_MESSAGES_SUBCOLLECTION)
        .order_by("created_at")
        .stream()
    ):
        m = snap.to_dict() or {}
        if m.get("author") != "admin":
            continue
        if m.get("deleted"):
            continue
        latest_admin_text = m.get("text")
        latest_admin_at = m.get("created_at") or latest_admin_at
    doc_ref.update(
        {
            "admin_response": latest_admin_text,
            "responded_at": latest_admin_at,
            "updated_at": _now_iso(),
        }
    )


def update_message(
    feedback_id: str,
    msg_id: str,
    *,
    text: str,
    requesting_author: str,
    requesting_user_id: Optional[str] = None,
) -> dict[str, Any]:
    """Edit an existing thread message.

    Authorization:
      - 'user' caller: may only edit their own user-authored messages.
        Verified via `requesting_user_id` matching the parent's
        user_id (the same gate `post_message` enforces).
      - 'admin' caller: may edit any admin-authored message. Admin
        edits on user-authored messages are rejected (admins can
        moderate via delete, not by silently rewriting a user's
        words).

    Stamps `edited_at` so the UI can render an "(edited)" hint.

    When the edited message is the latest admin reply, the parent's
    `admin_response` mirror is re-synced so legacy single-reply UIs
    show the new text.

    Raises:
      ValidationError on bad text / overlong / wrong author / virtual.
      NotFoundError when feedback or message doesn't exist.
    """
    if requesting_author not in _VALID_AUTHORS:
        raise ValidationError(f"requesting_author must be one of {sorted(_VALID_AUTHORS)}")
    body = (text or "").strip()
    if not body:
        raise ValidationError("text is required")
    if len(body) > _MAX_THREAD_MESSAGE_LEN:
        raise ValidationError(f"text must be ≤ {_MAX_THREAD_MESSAGE_LEN} characters")
    if msg_id == "__virtual_admin_response__":
        raise ValidationError("cannot edit the legacy single-reply projection")

    doc_ref = _db().collection(_COLLECTION).document(feedback_id)
    parent_snap = doc_ref.get()
    if not parent_snap.exists:
        raise NotFoundError(f"Feedback {feedback_id} not found")
    parent = parent_snap.to_dict() or {}

    if requesting_author == "user":
        if requesting_user_id and parent.get("user_id") != requesting_user_id:
            raise ValidationError("not your thread")

    msg_ref = doc_ref.collection(_MESSAGES_SUBCOLLECTION).document(msg_id)
    msg_snap = msg_ref.get()
    if not msg_snap.exists:
        raise NotFoundError(f"Message {msg_id} not found")
    msg = msg_snap.to_dict() or {}
    if msg.get("deleted"):
        raise ValidationError("cannot edit a deleted message")

    # Author authorization: each side can only edit their own author kind.
    msg_author = msg.get("author")
    if requesting_author == "user" and msg_author != "user":
        raise ValidationError("can only edit your own messages")
    if requesting_author == "admin" and msg_author != "admin":
        raise ValidationError("admin can edit admin messages only")

    msg_ref.update({"text": body, "edited_at": _now_iso()})

    # Mirror sync only matters when the edited message was an admin
    # reply — that's what `admin_response` shadows.
    if msg_author == "admin":
        _sync_admin_response_mirror(doc_ref)
    else:
        doc_ref.update({"updated_at": _now_iso()})

    out = {**msg, "text": body, "edited_at": _now_iso(), "id": msg_id}
    return out


def delete_message(
    feedback_id: str,
    msg_id: str,
    *,
    requesting_author: str,
    requesting_user_id: Optional[str] = None,
) -> dict[str, Any]:
    """Soft-delete a thread message. Sets `deleted: true` + `deleted_at`
    + clears `text` so the row stays in chronological order but no
    longer shows content.

    Authorization:
      - 'user' caller: may only delete their own user-authored
        messages on their own thread.
      - 'admin' caller: may delete any message (moderation override).
        This is the asymmetry that earns admin a delete affordance on
        user messages — same shape as comment moderation in any forum.

    The mirror sync runs unconditionally after a delete since either
    (a) we deleted an admin reply and the previous admin reply (if
    any) becomes the canonical mirror, or (b) we deleted a user
    message which doesn't change the mirror but bumps updated_at.
    """
    if requesting_author not in _VALID_AUTHORS:
        raise ValidationError(f"requesting_author must be one of {sorted(_VALID_AUTHORS)}")
    if msg_id == "__virtual_admin_response__":
        raise ValidationError("cannot delete the legacy single-reply projection")

    doc_ref = _db().collection(_COLLECTION).document(feedback_id)
    parent_snap = doc_ref.get()
    if not parent_snap.exists:
        raise NotFoundError(f"Feedback {feedback_id} not found")
    parent = parent_snap.to_dict() or {}

    if requesting_author == "user":
        if requesting_user_id and parent.get("user_id") != requesting_user_id:
            raise ValidationError("not your thread")

    msg_ref = doc_ref.collection(_MESSAGES_SUBCOLLECTION).document(msg_id)
    msg_snap = msg_ref.get()
    if not msg_snap.exists:
        raise NotFoundError(f"Message {msg_id} not found")
    msg = msg_snap.to_dict() or {}
    if msg.get("deleted"):
        # Idempotent — second delete is a no-op.
        return {**msg, "id": msg_id}

    msg_author = msg.get("author")
    if requesting_author == "user" and msg_author != "user":
        raise ValidationError("can only delete your own messages")

    msg_ref.update(
        {
            "deleted": True,
            "deleted_at": _now_iso(),
            "deleted_by": requesting_author,
            "text": "",
        }
    )
    _sync_admin_response_mirror(doc_ref)

    return {
        **msg,
        "deleted": True,
        "deleted_at": _now_iso(),
        "text": "",
        "id": msg_id,
    }


def stats() -> dict[str, Any]:
    """Aggregate counts for the admin stats dashboard.

    At closed-beta scale the whole collection fits in one stream
    comfortably (≤ a few thousand docs over the lifetime of the beta).
    If we cross ~10k feedback rows we'd swap this for periodic
    materialised counters; not worth the complexity yet.

    Returns:
        total                    — total docs
        by_status                — { 'new': N, 'triaged': N, ... }
        by_kind                  — { 'bug': N, 'feature': N, ... }
        by_badge                 — { 'noted': N, 'on_it': N, ... };
                                    'none' = no badge set yet
        active                   — count visible to user (not archived)
        archived                 — count auto-archived (24h sweep)
        pinned                   — count admin marked pinned
        responded                — count with an admin_response set
        unresponded              — total - responded (admin's queue)
        median_first_reply_hours — median (created_at -> responded_at)
                                    over docs with admin_response set;
                                    None when the corpus is empty
    """
    all_docs = list(_db().collection(_COLLECTION).stream())
    now_iso = _now_iso()

    by_status: dict[str, int] = {}
    by_kind: dict[str, int] = {}
    by_badge: dict[str, int] = {}
    active = 0
    archived = 0
    pinned = 0
    responded = 0
    first_reply_hours: list[float] = []

    for snap in all_docs:
        d = snap.to_dict() or {}
        by_status[d.get("status", "new")] = by_status.get(d.get("status", "new"), 0) + 1
        by_kind[d.get("kind", "general")] = by_kind.get(d.get("kind", "general"), 0) + 1
        badge = d.get("admin_badge") or "none"
        by_badge[badge] = by_badge.get(badge, 0) + 1

        if is_archived(d, now_iso=now_iso):
            archived += 1
        else:
            active += 1
        if d.get("pinned"):
            pinned += 1
        if d.get("admin_response"):
            responded += 1
            # Time from user submission to first admin reply. Uses
            # responded_at (latest reply timestamp); good enough for
            # closed-beta where threads are short. Once threading lands
            # we'll switch this to the FIRST message author=admin.
            try:
                created = d.get("created_at")
                resp = d.get("responded_at")
                if created and resp:
                    cdt = datetime.fromisoformat(str(created).replace("Z", "+00:00"))
                    rdt = datetime.fromisoformat(str(resp).replace("Z", "+00:00"))
                    hrs = (rdt - cdt).total_seconds() / 3600.0
                    if hrs >= 0:
                        first_reply_hours.append(hrs)
            except (ValueError, AttributeError):
                pass

    median_first_reply: Optional[float] = None
    if first_reply_hours:
        first_reply_hours.sort()
        n = len(first_reply_hours)
        mid = n // 2
        median_first_reply = (
            first_reply_hours[mid]
            if n % 2 == 1
            else (first_reply_hours[mid - 1] + first_reply_hours[mid]) / 2.0
        )

    return {
        "total": len(all_docs),
        "by_status": by_status,
        "by_kind": by_kind,
        "by_badge": by_badge,
        "active": active,
        "archived": archived,
        "pinned": pinned,
        "responded": responded,
        "unresponded": len(all_docs) - responded,
        "median_first_reply_hours": median_first_reply,
    }
