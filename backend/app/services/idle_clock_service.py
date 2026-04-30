"""Idle clock + cascade service for catalog_evolution.md Phase C.

Two responsibilities:
  1. **tick** — bump `idle_expires_at = now + 30d` on a catalog row whenever the
     user "touches" the entry (buy, add to grocery list, transfer). Plain
     view-scans do NOT tick.
  2. **cascade** — find catalog rows past their idle deadline and dispose
     according to mode:
        mode (a) user_custom WITH barcode → catalog row deleted, events left
                                           in place (will resolve to global
                                           via barcode lookup later).
        mode (b) user_custom WITHOUT barcode → hard-delete catalog + events.
        paid users → never cascade (idle_expires_at stays null on their rows).

Phase C scope:
  - Cascade is admin-fired (`POST /admin/idle-clock/cascade`). No automatic
    scheduler yet; that lands later when the project picks a job runner.
  - Quota counter is decremented atomically with cascade.
  - Audit log written to `cascade_audit_log` collection.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from app.core.metadata import apply_create_metadata, apply_update_metadata
from app.services import quota_service

logger = logging.getLogger(__name__)

_CATALOG_COLLECTION = "catalog_entries"
_USER_COLLECTION = "users"
_AUDIT_COLLECTION = "cascade_audit_log"
_PAID_TIERS = {"plus", "pro"}
_TICK_DAYS = 30


def _db():
    return firestore.client()


def _user_purchases_ref(user_id: str):
    return _db().collection(_USER_COLLECTION).document(user_id).collection("purchases")


def _audit_doc_ref(run_id: str):
    return _db().collection(_AUDIT_COLLECTION).document(run_id)


def _doc_id(user_id: str, name_norm: str) -> str:
    return f"{user_id}__{name_norm}"


def _is_paid_user(user_id: str) -> bool:
    snap = _db().collection(_USER_COLLECTION).document(user_id).get()
    if not snap.exists:
        return False
    return ((snap.to_dict() or {}).get("tier") or "free") in _PAID_TIERS


# ---------------------------------------------------------------------------
# Tick — extend the idle clock on user touch
# ---------------------------------------------------------------------------


def tick(user_id: str, name_norm: str) -> Optional[datetime]:
    """Bump `idle_expires_at` by 30 days from now. No-op for:
      - non-existent catalog rows
      - global_linked rows (no clock)
      - paid users (no clock)

    Returns the new `idle_expires_at`, or None if no tick was applied.
    """
    if not name_norm:
        return None
    doc_ref = _db().collection(_CATALOG_COLLECTION).document(_doc_id(user_id, name_norm))
    snap = doc_ref.get()
    if not snap.exists:
        return None
    data = snap.to_dict() or {}
    if data.get("catalog_mode") != "user_custom":
        return None
    if _is_paid_user(user_id):
        return None

    new_expires = datetime.now(timezone.utc) + timedelta(days=_TICK_DAYS)
    doc_ref.update(apply_update_metadata({"idle_expires_at": new_expires}))
    logger.debug("idle_clock.ticked user=%s name_norm=%s new_expires=%s",
                 user_id, name_norm, new_expires.isoformat())
    return new_expires


def tick_safe(user_id: str, name_norm: str) -> None:
    """Tick wrapper that swallows exceptions — fire-and-forget from write paths."""
    try:
        tick(user_id, name_norm)
    except Exception as e:
        logger.warning("idle_clock.tick_safe swallowed err user=%s name_norm=%s err=%s",
                       user_id, name_norm, e)


# ---------------------------------------------------------------------------
# Cascade — dispose of expired user_custom rows
# ---------------------------------------------------------------------------


def list_expired(user_id: Optional[str] = None) -> list[dict]:
    """List user_custom catalog rows past their idle deadline.

    If `user_id` provided, scoped to that user; else cross-user.
    Returns small dicts ready for the admin UI / dry-run preview.
    """
    db = _db()
    now = datetime.now(timezone.utc)
    q = db.collection(_CATALOG_COLLECTION).where(
        filter=FieldFilter("catalog_mode", "==", "user_custom")
    )
    if user_id:
        q = q.where(filter=FieldFilter("user_id", "==", user_id))

    expired: list[dict] = []
    for snap in q.stream():
        d = snap.to_dict() or {}
        idle = d.get("idle_expires_at")
        if idle is None:
            continue  # paid-user rows have null clock
        # Compare timezone-aware
        try:
            idle_dt = idle if isinstance(idle, datetime) else datetime.fromisoformat(str(idle))
            if idle_dt.tzinfo is None:
                idle_dt = idle_dt.replace(tzinfo=timezone.utc)
        except Exception:
            continue
        if idle_dt > now:
            continue
        expired.append({
            "user_id": d.get("user_id"),
            "name_norm": d.get("name_norm"),
            "display_name": d.get("display_name"),
            "barcode": d.get("barcode"),
            "idle_expires_at": idle_dt.isoformat(),
            "mode": "a" if d.get("barcode") else "b",
            "active_purchases": int(d.get("active_purchases") or 0),
            "total_purchases": int(d.get("total_purchases") or 0),
        })
    return expired


def cascade_one(user_id: str, name_norm: str) -> dict:
    """Cascade-dispose a single catalog row. Mode-aware (§2.2 #1).

    Returns:
        {mode: 'a' | 'b' | 'skipped', name_norm, display_name,
         events_deleted, quota_released, reason?}
    """
    db = _db()
    cat_ref = db.collection(_CATALOG_COLLECTION).document(_doc_id(user_id, name_norm))
    snap = cat_ref.get()
    if not snap.exists:
        return {"mode": "skipped", "name_norm": name_norm, "reason": "not_found"}
    data = snap.to_dict() or {}

    if data.get("catalog_mode") != "user_custom":
        return {"mode": "skipped", "name_norm": name_norm, "reason": "not_user_custom"}
    if _is_paid_user(user_id):
        return {"mode": "skipped", "name_norm": name_norm, "reason": "paid_user"}

    has_barcode = bool(data.get("barcode"))
    display = data.get("display_name")

    if has_barcode:
        # Mode (a): delete catalog row, events stay (will appear as orphans in
        # diagnostic until reconciled by user / future global-linked promotion).
        cat_ref.delete()
        quota_service.release(user_id, amount=1)
        logger.info("cascade.mode_a user=%s name_norm=%s display=%r",
                    user_id, name_norm, display)
        return {
            "mode": "a",
            "name_norm": name_norm,
            "display_name": display,
            "events_deleted": 0,
            "quota_released": 1,
        }

    # Mode (b): hard-delete events + catalog row.
    purchases_q = (
        _user_purchases_ref(user_id)
        .where(filter=FieldFilter("catalog_name_norm", "==", name_norm))
    )
    deleted_count = 0
    # Batched delete (Firestore limit 500/batch)
    batch = db.batch()
    batch_size = 0
    for ev_snap in purchases_q.stream():
        batch.delete(ev_snap.reference)
        batch_size += 1
        deleted_count += 1
        if batch_size >= 450:
            batch.commit()
            batch = db.batch()
            batch_size = 0
    if batch_size > 0:
        batch.commit()
    cat_ref.delete()
    quota_service.release(user_id, amount=1)
    logger.info("cascade.mode_b user=%s name_norm=%s display=%r events_deleted=%d",
                user_id, name_norm, display, deleted_count)
    return {
        "mode": "b",
        "name_norm": name_norm,
        "display_name": display,
        "events_deleted": deleted_count,
        "quota_released": 1,
    }


def run_cascade(actor_uid: str, user_id: Optional[str] = None) -> dict:
    """Cascade every expired user_custom row (optionally scoped to one user).

    Writes a `cascade_audit_log` doc summarising the run for traceability.
    """
    now = datetime.now(timezone.utc)
    run_id = f"cascade_{now.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
    audit: dict[str, Any] = {
        "run_id": run_id,
        "actor_uid": actor_uid,
        "started_at": now,
        "completed_at": None,
        "scope_user_id": user_id,
        "expired_found": 0,
        "mode_a_count": 0,
        "mode_b_count": 0,
        "events_deleted": 0,
        "quota_released": 0,
        "skipped": 0,
        "errors": [],
        "per_row": [],
        "status": "running",
    }
    _audit_doc_ref(run_id).set(
        apply_create_metadata(audit, uid=actor_uid, source="admin")
    )

    expired = list_expired(user_id=user_id)
    audit["expired_found"] = len(expired)

    for row in expired:
        try:
            result = cascade_one(row["user_id"], row["name_norm"])
        except Exception as e:
            logger.exception("cascade_one failed user=%s name_norm=%s",
                             row["user_id"], row["name_norm"])
            audit["errors"].append({
                "user_id": row["user_id"],
                "name_norm": row["name_norm"],
                "message": str(e),
            })
            continue

        if result["mode"] == "a":
            audit["mode_a_count"] += 1
        elif result["mode"] == "b":
            audit["mode_b_count"] += 1
            audit["events_deleted"] += result.get("events_deleted", 0)
        else:
            audit["skipped"] += 1
        audit["quota_released"] += result.get("quota_released", 0)
        audit["per_row"].append({
            "user_id": row["user_id"],
            **{k: v for k, v in result.items() if k not in ("user_id",)},
        })

    audit["completed_at"] = datetime.now(timezone.utc)
    audit["status"] = "complete" if not audit["errors"] else "complete_with_errors"
    _audit_doc_ref(run_id).set(apply_update_metadata(audit), merge=True)
    logger.info(
        "cascade.completed run_id=%s expired=%d mode_a=%d mode_b=%d errors=%d",
        run_id, audit["expired_found"], audit["mode_a_count"], audit["mode_b_count"],
        len(audit["errors"]),
    )
    return audit


def list_runs(limit: int = 20) -> list[dict]:
    db = _db()
    out = []
    for snap in (
        db.collection(_AUDIT_COLLECTION)
        .order_by("started_at", direction=firestore.Query.DESCENDING)
        .limit(limit)
        .stream()
    ):
        d = snap.to_dict() or {}
        d["run_id"] = snap.id
        d["per_row_count"] = len(d.get("per_row") or [])
        d.pop("per_row", None)
        out.append(d)
    return out
