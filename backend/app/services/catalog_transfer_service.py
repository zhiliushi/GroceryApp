"""Catalog transfer service — Phase G of catalog_evolution.md §6.

Move all events from one catalog row (the "source") onto another (the
"destination"), then soft-delete source via an audit log doc. Reversible
within 7 days (tombstone-restore from the audit doc's snapshot).

Design choices (per plan §6.4 / §6.3):
  - Whole-row transfer only — no split-mode in v1
  - Consolidation only — source is removed, never duplicated
  - 7d reversal via `reversal_token` written into `transfer_audit_log`
  - base_unit_label mismatch warning surfaced in preview, not blocked
  - Counters recomputed from raw events rather than incremented (safe under
    re-pointing churn)
  - Quota slot released if source was user_custom; restored on reverse
"""

from __future__ import annotations

import logging
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.metadata import apply_create_metadata, apply_update_metadata
from app.services import quota_service

logger = logging.getLogger(__name__)

_CATALOG_COLLECTION = "catalog_entries"
_USER_COLLECTION = "users"
_AUDIT_COLLECTION = "transfer_audit_log"
_REVERSAL_DAYS = 7


def _db():
    return firestore.client()


def _user_purchases_ref(user_id: str):
    return _db().collection(_USER_COLLECTION).document(user_id).collection("purchases")


def _audit_ref(user_id: str):
    return _db().collection(_AUDIT_COLLECTION).document(user_id).collection("items")


def _doc_id(user_id: str, name_norm: str) -> str:
    return f"{user_id}__{name_norm}"


def _iso(v: Any) -> Optional[str]:
    if v is None:
        return None
    try:
        return v.isoformat() if hasattr(v, "isoformat") else str(v)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Preview
# ---------------------------------------------------------------------------


def preview_transfer(user_id: str, src_name_norm: str, dst_name_norm: str) -> dict[str, Any]:
    """Predict what `execute_transfer` will move. Read-only.

    Returns:
        {
          src: {...minimal...},
          dst: {...minimal...},
          event_count, with_price_count, with_waste_count,
          base_unit_label_mismatch: bool,
          src_base_unit_label, dst_base_unit_label,
          would_release_quota: bool,
        }
    """
    if src_name_norm == dst_name_norm:
        raise ValidationError("Source and destination must be different")

    db = _db()
    src_snap = db.collection(_CATALOG_COLLECTION).document(_doc_id(user_id, src_name_norm)).get()
    dst_snap = db.collection(_CATALOG_COLLECTION).document(_doc_id(user_id, dst_name_norm)).get()
    if not src_snap.exists:
        raise NotFoundError(f"Source catalog '{src_name_norm}' not found")
    if not dst_snap.exists:
        raise NotFoundError(f"Destination catalog '{dst_name_norm}' not found")

    src = src_snap.to_dict() or {}
    dst = dst_snap.to_dict() or {}

    event_count = 0
    with_price_count = 0
    with_waste_count = 0
    src_unit_labels: set[str] = set()
    for snap in (
        _user_purchases_ref(user_id)
        .where(filter=FieldFilter("catalog_name_norm", "==", src_name_norm))
        .stream()
    ):
        d = snap.to_dict() or {}
        event_count += 1
        if d.get("price") is not None or d.get("display_amount") is not None:
            with_price_count += 1
        if (d.get("status") or "active") in ("thrown", "given"):
            with_waste_count += 1
        if d.get("base_unit_label"):
            src_unit_labels.add(d["base_unit_label"])

    dst_unit_labels: set[str] = set()
    for snap in (
        _user_purchases_ref(user_id)
        .where(filter=FieldFilter("catalog_name_norm", "==", dst_name_norm))
        .stream()
    ):
        d = snap.to_dict() or {}
        if d.get("base_unit_label"):
            dst_unit_labels.add(d["base_unit_label"])

    src_unit = next(iter(src_unit_labels)) if src_unit_labels else None
    dst_unit = next(iter(dst_unit_labels)) if dst_unit_labels else None
    mismatch = bool(src_unit and dst_unit and src_unit != dst_unit)

    return {
        "src": _summary(src),
        "dst": _summary(dst),
        "event_count": event_count,
        "with_price_count": with_price_count,
        "with_waste_count": with_waste_count,
        "base_unit_label_mismatch": mismatch,
        "src_base_unit_label": src_unit,
        "dst_base_unit_label": dst_unit,
        "would_release_quota": (src.get("catalog_mode") == "user_custom"),
    }


def _summary(cat: dict) -> dict:
    return {
        "name_norm": cat.get("name_norm"),
        "display_name": cat.get("display_name"),
        "barcode": cat.get("barcode"),
        "catalog_mode": cat.get("catalog_mode"),
        "total_purchases": int(cat.get("total_purchases") or 0),
        "active_purchases": int(cat.get("active_purchases") or 0),
    }


# ---------------------------------------------------------------------------
# Execute
# ---------------------------------------------------------------------------


def execute_transfer(
    user_id: str,
    src_name_norm: str,
    dst_name_norm: str,
    actor_uid: Optional[str] = None,
) -> dict[str, Any]:
    """Re-point all events from src → dst, soft-delete src catalog row,
    write audit log with 7d reversal token.

    Atomicity: each individual write is via batched commits. The audit doc
    is written FIRST (so a partial failure leaves enough state for an
    operator to reconcile). Counter recompute happens after re-pointing.
    """
    if src_name_norm == dst_name_norm:
        raise ValidationError("Source and destination must be different")

    db = _db()
    src_ref = db.collection(_CATALOG_COLLECTION).document(_doc_id(user_id, src_name_norm))
    dst_ref = db.collection(_CATALOG_COLLECTION).document(_doc_id(user_id, dst_name_norm))
    src_snap = src_ref.get()
    dst_snap = dst_ref.get()
    if not src_snap.exists:
        raise NotFoundError(f"Source catalog '{src_name_norm}' not found")
    if not dst_snap.exists:
        raise NotFoundError(f"Destination catalog '{dst_name_norm}' not found")

    src_data = src_snap.to_dict() or {}
    dst_data = dst_snap.to_dict() or {}

    now = datetime.now(timezone.utc)
    transfer_id = f"xfer_{now.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
    reversal_token = secrets.token_urlsafe(24)

    # Snapshot src events for fast reverse re-pointing
    event_ids: list[str] = []
    event_refs: list[Any] = []
    for snap in (
        _user_purchases_ref(user_id)
        .where(filter=FieldFilter("catalog_name_norm", "==", src_name_norm))
        .stream()
    ):
        event_ids.append(snap.id)
        event_refs.append(snap.reference)

    audit_payload = {
        "transfer_id": transfer_id,
        "from_catalog_id": src_name_norm,
        "from_display_name": src_data.get("display_name"),
        "to_catalog_id": dst_name_norm,
        "to_display_name": dst_data.get("display_name"),
        "transferred_event_count": len(event_ids),
        "transferred_event_ids": event_ids,
        "transferred_at": now,
        "reversal_token": reversal_token,
        "reversal_expires_at": now + timedelta(days=_REVERSAL_DAYS),
        "reversed_at": None,
        "reversed_by": None,
        "actor_uid": actor_uid or user_id,
        "source_snapshot": _strip_for_snapshot(src_data),
        "src_was_user_custom": src_data.get("catalog_mode") == "user_custom",
    }
    _audit_ref(user_id).document(transfer_id).set(
        apply_create_metadata(audit_payload, uid=actor_uid or user_id, source="manual")
    )

    # Re-point events in batches of 450 (Firestore commit limit 500, leave headroom)
    new_display = dst_data.get("display_name")
    repointed = 0
    i = 0
    while i < len(event_refs):
        chunk = event_refs[i : i + 450]
        batch = db.batch()
        for ref in chunk:
            batch.update(ref, apply_update_metadata({
                "catalog_name_norm": dst_name_norm,
                "catalog_display": new_display,
            }))
        batch.commit()
        repointed += len(chunk)
        i += 450

    # Delete source catalog row (snapshot already in audit log)
    src_ref.delete()

    # Release src's quota slot if user_custom
    if src_data.get("catalog_mode") == "user_custom":
        try:
            quota_service.release(user_id, amount=1)
        except Exception as e:
            logger.warning("quota release failed user=%s src=%s err=%s",
                           user_id, src_name_norm, e)

    # Recompute dst counters from raw events
    _reconcile_catalog_counters(user_id, dst_name_norm)

    logger.info(
        "transfer.executed user=%s src=%s dst=%s events=%d transfer_id=%s",
        user_id, src_name_norm, dst_name_norm, repointed, transfer_id,
    )

    return {
        "transfer_id": transfer_id,
        "from_catalog_id": src_name_norm,
        "to_catalog_id": dst_name_norm,
        "transferred_event_count": repointed,
        "reversal_token": reversal_token,
        "reversal_expires_at": _iso(now + timedelta(days=_REVERSAL_DAYS)),
    }


def _strip_for_snapshot(data: dict) -> dict:
    """Remove SERVER_TIMESTAMP sentinel-style values that aren't JSON-safe."""
    return {
        k: _iso(v) if hasattr(v, "isoformat") else v
        for k, v in data.items()
        if k not in ("created_at", "updated_at")
    }


def _reconcile_catalog_counters(user_id: str, name_norm: str) -> None:
    """Recompute total_purchases / active_purchases / last_purchased_at from raw events."""
    db = _db()
    cat_ref = db.collection(_CATALOG_COLLECTION).document(_doc_id(user_id, name_norm))
    if not cat_ref.get().exists:
        return
    total = 0
    active = 0
    last_purchased = None
    for snap in (
        _user_purchases_ref(user_id)
        .where(filter=FieldFilter("catalog_name_norm", "==", name_norm))
        .stream()
    ):
        d = snap.to_dict() or {}
        total += 1
        if d.get("status") == "active":
            active += 1
        db_dt = d.get("date_bought")
        if db_dt and (last_purchased is None or db_dt > last_purchased):
            last_purchased = db_dt
    cat_ref.update(apply_update_metadata({
        "total_purchases": total,
        "active_purchases": active,
        "last_purchased_at": last_purchased,
    }))


# ---------------------------------------------------------------------------
# Reverse
# ---------------------------------------------------------------------------


def reverse_transfer(user_id: str, transfer_id: str, actor_uid: Optional[str] = None) -> dict[str, Any]:
    """Reverse a transfer within the 7d window.

    Restores the source catalog row from the audit doc's snapshot, re-points
    all originally-transferred events back to source, recomputes counters
    on both sides, and re-consumes a quota slot if applicable.

    Raises:
        NotFoundError if transfer_id missing
        ConflictError if already reversed or expired
    """
    db = _db()
    audit_ref = _audit_ref(user_id).document(transfer_id)
    audit_snap = audit_ref.get()
    if not audit_snap.exists:
        raise NotFoundError(f"Transfer '{transfer_id}' not found")

    audit = audit_snap.to_dict() or {}
    if audit.get("reversed_at"):
        raise ConflictError("Transfer already reversed")
    expires_at = audit.get("reversal_expires_at")
    if expires_at and isinstance(expires_at, datetime):
        if datetime.now(timezone.utc) > expires_at:
            raise ConflictError("Reversal window (7 days) has passed")

    src_name_norm = audit["from_catalog_id"]
    dst_name_norm = audit["to_catalog_id"]
    src_ref = db.collection(_CATALOG_COLLECTION).document(_doc_id(user_id, src_name_norm))
    if src_ref.get().exists:
        raise ConflictError(
            f"Source catalog '{src_name_norm}' already exists (was it re-created?). "
            "Reverse manually."
        )

    # Restore source catalog row from snapshot
    snapshot = dict(audit.get("source_snapshot") or {})
    snapshot.pop("schema_version", None)  # let apply_create_metadata stamp it
    src_ref.set(
        apply_create_metadata(snapshot, uid=actor_uid or user_id, source="manual",
                              schema_version=2),
    )

    # Re-point events back from dst → src
    event_ids = audit.get("transferred_event_ids") or []
    src_display = snapshot.get("display_name")
    repointed = 0
    i = 0
    while i < len(event_ids):
        chunk = event_ids[i : i + 450]
        batch = db.batch()
        for eid in chunk:
            ref = _user_purchases_ref(user_id).document(eid)
            ev_snap = ref.get()
            if not ev_snap.exists:
                continue
            # Only re-point if currently at dst (don't clobber events the user
            # has manually moved elsewhere since)
            ev = ev_snap.to_dict() or {}
            if ev.get("catalog_name_norm") != dst_name_norm:
                continue
            batch.update(ref, apply_update_metadata({
                "catalog_name_norm": src_name_norm,
                "catalog_display": src_display,
            }))
            repointed += 1
        batch.commit()
        i += 450

    # Recompute counters on both sides
    _reconcile_catalog_counters(user_id, src_name_norm)
    _reconcile_catalog_counters(user_id, dst_name_norm)

    # Re-consume quota if src was user_custom
    if audit.get("src_was_user_custom"):
        try:
            quota_service.consume(user_id, amount=1)
        except Exception as e:
            logger.warning("quota re-consume failed user=%s src=%s err=%s",
                           user_id, src_name_norm, e)

    audit_ref.update(apply_update_metadata({
        "reversed_at": datetime.now(timezone.utc),
        "reversed_by": actor_uid or user_id,
        "reversed_event_count": repointed,
    }))

    logger.info(
        "transfer.reversed user=%s transfer_id=%s events=%d",
        user_id, transfer_id, repointed,
    )
    return {
        "transfer_id": transfer_id,
        "from_catalog_id": src_name_norm,
        "to_catalog_id": dst_name_norm,
        "reversed_event_count": repointed,
    }


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------


def list_transfers(user_id: str, limit: int = 20) -> list[dict[str, Any]]:
    """Recent transfer audit log entries (newest first)."""
    out: list[dict[str, Any]] = []
    for snap in (
        _audit_ref(user_id)
        .order_by("transferred_at", direction=firestore.Query.DESCENDING)
        .limit(limit)
        .stream()
    ):
        d = snap.to_dict() or {}
        d["transfer_id"] = d.get("transfer_id") or snap.id
        # Strip large fields for the list view
        d.pop("transferred_event_ids", None)
        d.pop("source_snapshot", None)
        d["transferred_at"] = _iso(d.get("transferred_at"))
        d["reversal_expires_at"] = _iso(d.get("reversal_expires_at"))
        d["reversed_at"] = _iso(d.get("reversed_at"))
        d["reversal_window_open"] = (
            d.get("reversed_at") is None
            and (d.get("reversal_expires_at") or "0") > datetime.now(timezone.utc).isoformat()
        )
        out.append(d)
    return out
