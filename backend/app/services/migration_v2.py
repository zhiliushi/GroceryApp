"""Phase A — actual catalog evolution v2 migration. Writes to production data.

Plan: F:\\ClaudeProjects\\GroceryApp\\.claude\\docs\\plans\\catalog_evolution.md §4.

Idempotent: docs marked `schema_version: 2` are skipped on re-run.
Batched: 500-write chunks per Firestore commit limit.
Error-collecting: per-doc failures are logged to `migration_audit_log` errors[]
without bailing the whole run.

Triggered ONLY via authenticated admin endpoint (`POST /admin/migration/run-v2`)
with explicit `confirm=true` body. Never auto-run on startup.

Defaults applied per plan §4.2 (mirrored from migration_v2_dry_run.py — keep
the two files in lockstep).
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from app.core.exceptions import ValidationError
from app.core.metadata import apply_create_metadata, apply_update_metadata
from app.services import migration_v2_dry_run as _dr  # share the unit-inference + classifier

logger = logging.getLogger(__name__)

_SCHEMA_VERSION_TARGET = 2
_CATALOG_COLLECTION = "catalog_entries"
_USER_COLLECTION = "users"
_AUDIT_COLLECTION = "migration_audit_log"
_STORE_COLLECTION = "store_catalog"
_BATCH_LIMIT = 500
_PAID_TIERS = {"plus", "pro"}
_DEFAULT_CURRENCY = "SGD"
_GRACE_DAYS = 60


def _db():
    return firestore.client()


def _user_purchases_ref(user_id: str):
    return _db().collection(_USER_COLLECTION).document(user_id).collection("purchases")


def _audit_doc_ref(run_id: str):
    return _db().collection(_AUDIT_COLLECTION).document(run_id)


def _store_doc_ref(user_id: str, store_id: str):
    return (
        _db()
        .collection(_STORE_COLLECTION)
        .document(user_id)
        .collection("stores")
        .document(store_id)
    )


def _is_paid(user_data: Optional[dict]) -> bool:
    if not user_data:
        return False
    return (user_data.get("tier") or "free") in _PAID_TIERS


# ---------------------------------------------------------------------------
# Per-doc field builders
# ---------------------------------------------------------------------------


def _build_catalog_update(cat: dict, is_paid: bool, now: datetime) -> Optional[dict]:
    """Return the field updates for a catalog row, or None if already migrated."""
    if int(cat.get("schema_version") or 1) >= _SCHEMA_VERSION_TARGET:
        return None
    mode, _flags = _dr._classify_catalog_row(cat)
    barcode = cat.get("barcode")
    display = cat.get("display_name")

    if mode == "global_linked" or is_paid:
        idle_expires_at = None
    else:
        idle_expires_at = now + timedelta(days=_GRACE_DAYS)

    return {
        "catalog_mode": mode,
        "canonical_name": display,
        "idle_expires_at": idle_expires_at,
        "schema_version": _SCHEMA_VERSION_TARGET,
        # Don't touch existing fields. Don't write barcode anew (already there).
        "_migration_v2_applied_at": now,
    }


def _build_event_update(
    event: dict,
    catalog_name_by_norm: dict[str, str],
    user_currency_pref: str,
    now: datetime,
) -> Optional[dict]:
    """Return the field updates for a purchase_event, or None if already migrated."""
    if int(event.get("schema_version") or 1) >= _SCHEMA_VERSION_TARGET:
        return None

    nn = event.get("catalog_name_norm")
    cat_name = catalog_name_by_norm.get(nn) or event.get("catalog_display") or ""
    unit_label, _inferred = _dr._infer_base_unit_label(cat_name)

    currency = event.get("currency") or user_currency_pref
    amount = event.get("price")
    quantity = event.get("quantity")
    pack_size = 1

    unit_price: Optional[float] = None
    if amount is not None and quantity not in (None, 0):
        try:
            unit_price = float(amount) / float(quantity) / pack_size
        except (TypeError, ValueError):
            unit_price = None

    is_split = event.get("split_from_event_id") is not None
    contributes_to_logical = not is_split

    fx_rate_at_save = 1.0 if currency == user_currency_pref else None

    return {
        "amount": amount,
        "currency": currency,
        "display_amount": amount,
        "display_currency": user_currency_pref,
        "fx_rate_at_save": fx_rate_at_save,
        "fx_rate_date": now.strftime("%Y-%m-%d"),
        "pack_size": pack_size,
        "base_unit_label": unit_label,
        "unit_price": unit_price,
        "store_id": "unknown",
        "contributes_to_logical_count": contributes_to_logical,
        "schema_version": _SCHEMA_VERSION_TARGET,
        "_migration_v2_applied_at": now,
    }


def _build_user_update(
    user_data: Optional[dict],
    user_custom_count: int,
    now: datetime,
) -> Optional[dict]:
    """Return the field updates for a user doc, or None if already migrated."""
    if not user_data:
        return None
    if int(user_data.get("schema_version") or 1) >= _SCHEMA_VERSION_TARGET:
        return None
    return {
        "is_paid": _is_paid(user_data),
        "currency_preference": user_data.get("currency_preference") or _DEFAULT_CURRENCY,
        "catalog_quota_used": user_custom_count,
        "catalog_quota_limit": 50,
        "store_quota_used": 1,
        "store_quota_limit": 30,
        "schema_version": _SCHEMA_VERSION_TARGET,
        "_migration_v2_applied_at": now,
    }


def _ensure_unknown_store(user_id: str, use_count: int, actor_uid: str, now: datetime) -> bool:
    """Create the auto 'Unknown' store if it doesn't exist. Returns True if created."""
    ref = _store_doc_ref(user_id, "unknown")
    if ref.get().exists:
        return False
    payload = apply_create_metadata(
        {
            "store_id": "unknown",
            "name": "Unknown",
            "auto_created": True,
            "use_count": use_count,
            "last_used_at": now,
        },
        uid=actor_uid,
        source="migration",
    )
    ref.set(payload)
    return True


# ---------------------------------------------------------------------------
# Per-user migration
# ---------------------------------------------------------------------------


def _commit_in_chunks(writes: list[tuple[Any, dict]]) -> int:
    """Commit (doc_ref, update_dict) writes in 500-doc batches. Returns count."""
    db = _db()
    committed = 0
    i = 0
    while i < len(writes):
        chunk = writes[i : i + _BATCH_LIMIT]
        batch = db.batch()
        for ref, payload in chunk:
            batch.update(ref, payload)
        batch.commit()
        committed += len(chunk)
        i += _BATCH_LIMIT
    return committed


def _migrate_user(user_id: str, actor_uid: str, now: datetime) -> dict:
    """Run migration for a single user. Returns per-user stats."""
    db = _db()
    stats = {
        "user_id": user_id,
        "catalog_rows_processed": 0,
        "catalog_rows_global_linked": 0,
        "catalog_rows_user_custom": 0,
        "catalog_rows_skipped": 0,
        "events_processed": 0,
        "events_with_unit_label_inferred": 0,
        "events_with_unit_label_default": 0,
        "events_skipped": 0,
        "user_doc_updated": False,
        "user_doc_skipped": False,
        "store_unknown_created": False,
        "errors": [],
    }

    # --- Load user doc ---
    user_doc = db.collection(_USER_COLLECTION).document(user_id).get()
    if not user_doc.exists:
        stats["errors"].append({"doc_path": f"users/{user_id}", "message": "user doc missing"})
        return stats
    user_data = user_doc.to_dict() or {}
    is_paid = _is_paid(user_data)
    user_currency_pref = user_data.get("currency_preference") or _DEFAULT_CURRENCY

    # --- Load all catalog rows for user ---
    catalog_q = (
        db.collection(_CATALOG_COLLECTION).where(filter=FieldFilter("user_id", "==", user_id))
    )
    cat_rows: list[tuple[Any, dict]] = []
    name_by_norm: dict[str, str] = {}
    user_custom_count = 0
    cat_writes: list[tuple[Any, dict]] = []
    for snap in catalog_q.stream():
        data = snap.to_dict() or {}
        nn = data.get("name_norm")
        if nn:
            name_by_norm[nn] = data.get("display_name") or ""
        cat_rows.append((snap.reference, data))
        try:
            update = _build_catalog_update(data, is_paid, now)
        except Exception as e:
            stats["errors"].append({"doc_path": snap.reference.path, "message": f"catalog build: {e}"})
            continue
        if update is None:
            stats["catalog_rows_skipped"] += 1
        else:
            cat_writes.append((snap.reference, apply_update_metadata(update)))
            stats["catalog_rows_processed"] += 1
            if update["catalog_mode"] == "global_linked":
                stats["catalog_rows_global_linked"] += 1
            else:
                stats["catalog_rows_user_custom"] += 1
                user_custom_count += 1

    # --- Load all events for user ---
    event_writes: list[tuple[Any, dict]] = []
    event_total = 0
    for snap in _user_purchases_ref(user_id).stream():
        data = snap.to_dict() or {}
        event_total += 1
        try:
            update = _build_event_update(data, name_by_norm, user_currency_pref, now)
        except Exception as e:
            stats["errors"].append({"doc_path": snap.reference.path, "message": f"event build: {e}"})
            continue
        if update is None:
            stats["events_skipped"] += 1
        else:
            event_writes.append((snap.reference, apply_update_metadata(update)))
            stats["events_processed"] += 1
            if update["base_unit_label"] != "unit":
                stats["events_with_unit_label_inferred"] += 1
            else:
                stats["events_with_unit_label_default"] += 1

    # --- Build user doc update (catalog_quota_used uses already-migrated + freshly-counted custom) ---
    # When re-running, we need to also count rows that were already user_custom (skipped).
    # Recount from cat_rows directly using the classifier — works for both new and skipped rows.
    user_custom_total = 0
    for _ref, data in cat_rows:
        # Use the *current* state to count; if already migrated, catalog_mode is the source of truth.
        if data.get("catalog_mode") == "user_custom":
            user_custom_total += 1
        elif data.get("catalog_mode"):
            pass
        else:
            mode, _flags = _dr._classify_catalog_row(data)
            if mode == "user_custom":
                user_custom_total += 1

    user_update = _build_user_update(user_data, user_custom_total, now)
    user_writes: list[tuple[Any, dict]] = []
    if user_update is None:
        stats["user_doc_skipped"] = True
    else:
        user_writes.append((user_doc.reference, apply_update_metadata(user_update)))
        stats["user_doc_updated"] = True

    # --- Commit all writes ---
    try:
        all_writes = cat_writes + event_writes + user_writes
        _commit_in_chunks(all_writes)
    except Exception as e:
        stats["errors"].append({"doc_path": f"users/{user_id}", "message": f"commit failed: {e}"})

    # --- Auto-create the "Unknown" store (idempotent: only writes if missing) ---
    if event_total > 0:
        try:
            created = _ensure_unknown_store(user_id, event_total, actor_uid, now)
            stats["store_unknown_created"] = created
        except Exception as e:
            stats["errors"].append({"doc_path": f"store_catalog/{user_id}", "message": f"store create: {e}"})

    return stats


# ---------------------------------------------------------------------------
# Top-level orchestration
# ---------------------------------------------------------------------------


def run_migration(actor_uid: str, confirm: bool = False) -> dict[str, Any]:
    """Run migration v2 across every user. Idempotent — safe to re-run.

    Args:
        actor_uid: who triggered the run (admin's uid)
        confirm: must be True or ValidationError is raised. Belt-and-braces.

    Returns the audit log doc.
    """
    if not confirm:
        raise ValidationError(
            "Migration v2 requires explicit confirm=true. Refusing to run unconfirmed."
        )

    now = datetime.now(timezone.utc)
    run_id = f"v2_{now.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"

    audit_doc = {
        "run_id": run_id,
        "started_at": now,
        "completed_at": None,
        "schema_version_target": _SCHEMA_VERSION_TARGET,
        "actor_uid": actor_uid,
        "user_count": 0,
        "users_completed": 0,
        "users_with_errors": 0,
        "catalog_rows_processed": 0,
        "catalog_rows_global_linked": 0,
        "catalog_rows_user_custom": 0,
        "catalog_rows_skipped": 0,
        "events_processed": 0,
        "events_with_unit_label_inferred": 0,
        "events_with_unit_label_default": 0,
        "events_skipped": 0,
        "user_docs_updated": 0,
        "user_docs_skipped": 0,
        "stores_created": 0,
        "errors": [],
        "per_user": [],
        "status": "running",
    }
    _audit_doc_ref(run_id).set(apply_create_metadata(audit_doc, uid=actor_uid, source="migration"))

    db = _db()
    user_ids = [u.id for u in db.collection(_USER_COLLECTION).stream()]
    audit_doc["user_count"] = len(user_ids)

    for uid in user_ids:
        try:
            stats = _migrate_user(uid, actor_uid, now)
        except Exception as e:
            logger.exception("migration_v2 unhandled error user=%s", uid)
            stats = {
                "user_id": uid,
                "errors": [{"doc_path": f"users/{uid}", "message": f"unhandled: {e}"}],
            }

        audit_doc["users_completed"] += 1
        if stats.get("errors"):
            audit_doc["users_with_errors"] += 1
            for err in stats["errors"]:
                audit_doc["errors"].append({"user_id": uid, **err})
        audit_doc["catalog_rows_processed"] += stats.get("catalog_rows_processed", 0)
        audit_doc["catalog_rows_global_linked"] += stats.get("catalog_rows_global_linked", 0)
        audit_doc["catalog_rows_user_custom"] += stats.get("catalog_rows_user_custom", 0)
        audit_doc["catalog_rows_skipped"] += stats.get("catalog_rows_skipped", 0)
        audit_doc["events_processed"] += stats.get("events_processed", 0)
        audit_doc["events_with_unit_label_inferred"] += stats.get(
            "events_with_unit_label_inferred", 0
        )
        audit_doc["events_with_unit_label_default"] += stats.get(
            "events_with_unit_label_default", 0
        )
        audit_doc["events_skipped"] += stats.get("events_skipped", 0)
        if stats.get("user_doc_updated"):
            audit_doc["user_docs_updated"] += 1
        if stats.get("user_doc_skipped"):
            audit_doc["user_docs_skipped"] += 1
        if stats.get("store_unknown_created"):
            audit_doc["stores_created"] += 1
        audit_doc["per_user"].append({
            "user_id": uid,
            **{k: v for k, v in stats.items() if k != "user_id"},
        })

    audit_doc["completed_at"] = datetime.now(timezone.utc)
    audit_doc["status"] = "complete" if not audit_doc["errors"] else "complete_with_errors"
    _audit_doc_ref(run_id).set(apply_update_metadata(audit_doc), merge=True)

    logger.info(
        "migration_v2.completed run_id=%s users=%d cat=%d events=%d errors=%d",
        run_id,
        audit_doc["user_count"],
        audit_doc["catalog_rows_processed"],
        audit_doc["events_processed"],
        len(audit_doc["errors"]),
    )
    return audit_doc


# ---------------------------------------------------------------------------
# Audit log read
# ---------------------------------------------------------------------------


def list_runs(limit: int = 20) -> list[dict]:
    """Most recent migration runs first."""
    db = _db()
    docs = (
        db.collection(_AUDIT_COLLECTION)
        .order_by("started_at", direction=firestore.Query.DESCENDING)
        .limit(limit)
        .stream()
    )
    out = []
    for snap in docs:
        d = snap.to_dict() or {}
        d["run_id"] = snap.id
        # Trim per_user to keep list-view payload small.
        d["per_user_count"] = len(d.get("per_user") or [])
        d.pop("per_user", None)
        out.append(d)
    return out


def get_run(run_id: str) -> Optional[dict]:
    """Full audit doc for one run."""
    snap = _audit_doc_ref(run_id).get()
    if not snap.exists:
        return None
    d = snap.to_dict() or {}
    d["run_id"] = snap.id
    return d
