"""Quota service — catalog 50-cap + store 30-cap enforcement.

Plan: catalog_evolution.md §2.2 #3, Phase C.

Rules (from the user's design):
- `global_linked` rows (barcode-tied, canonical name) → NO quota cost
- `user_custom` rows (barcode-rename OR no-barcode) → consume catalog_quota
- Free-tier user_custom limit: 50
- Paid users (`tier in {plus, pro}`) → no idle TTL but still respect quota cap;
  a higher quota_limit can be set on their user doc directly.

This service is the source of truth for the *check*. Increment / decrement
happen via `consume()` / `release()` which the catalog write paths call inside
transactions. Counter drift is mitigated by the periodic reconcile_quota_counts
helper (admin/idle_clock_service can call it).
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from app.core.exceptions import QuotaExceededError

logger = logging.getLogger(__name__)

_CATALOG_COLLECTION = "catalog_entries"
_USER_COLLECTION = "users"
_DEFAULT_CATALOG_LIMIT = 50
_DEFAULT_STORE_LIMIT = 30
_EVICTION_LIST_CAP = 100  # cap candidates payload to keep error responses small


def _db():
    return firestore.client()


def get_quota_status(user_id: str) -> dict[str, Any]:
    """Return current quota usage for a user. Reads denormalized counters
    on the user doc; falls back to live count if missing (pre-migration).

    Returns: {used, limit, available, at_or_above_limit, schema_version}
    """
    db = _db()
    user_snap = db.collection(_USER_COLLECTION).document(user_id).get()
    user = user_snap.to_dict() if user_snap.exists else {}
    user = user or {}

    used = user.get("catalog_quota_used")
    limit = user.get("catalog_quota_limit", _DEFAULT_CATALOG_LIMIT)
    schema_version = user.get("schema_version", 1)

    if used is None:
        # Pre-migration user — count live.
        used = _count_user_custom_live(user_id)

    return {
        "used": int(used),
        "limit": int(limit),
        "available": max(0, int(limit) - int(used)),
        "at_or_above_limit": int(used) >= int(limit),
        "schema_version": schema_version,
    }


def _count_user_custom_live(user_id: str) -> int:
    """Live count of user_custom rows. Used for pre-migration users + reconcile."""
    db = _db()
    count = 0
    for snap in (
        db.collection(_CATALOG_COLLECTION)
        .where(filter=FieldFilter("user_id", "==", user_id))
        .stream()
    ):
        d = snap.to_dict() or {}
        # Pre-migration: treat barcode-less as user_custom
        if d.get("catalog_mode") == "user_custom":
            count += 1
        elif d.get("catalog_mode") is None and not d.get("barcode"):
            count += 1
    return count


def check_or_raise(user_id: str, would_be_user_custom: bool = True) -> None:
    """Raise QuotaExceededError if creating a user_custom row would exceed quota.

    Pass `would_be_user_custom=False` to no-op (e.g. global_linked entries).
    """
    if not would_be_user_custom:
        return
    status = get_quota_status(user_id)
    if status["at_or_above_limit"]:
        candidates = list_eviction_candidates(user_id, sort_by="oldest")
        raise QuotaExceededError(
            message=(
                f"Catalog quota reached ({status['used']}/{status['limit']}). "
                "Remove an existing custom item to add a new one."
            ),
            details={
                "type": "catalog_quota_exceeded",
                "used": status["used"],
                "limit": status["limit"],
                "eviction_candidates": candidates,
            },
        )


def consume(user_id: str, amount: int = 1) -> None:
    """Increment catalog_quota_used by N. Use only AFTER the catalog row
    is committed; on failure the catalog row write should be rolled back too."""
    db = _db()
    db.collection(_USER_COLLECTION).document(user_id).set(
        {"catalog_quota_used": firestore.Increment(amount)}, merge=True
    )


def release(user_id: str, amount: int = 1) -> None:
    """Decrement catalog_quota_used by N (clamped at 0 by the reconcile path)."""
    db = _db()
    db.collection(_USER_COLLECTION).document(user_id).set(
        {"catalog_quota_used": firestore.Increment(-amount)}, merge=True
    )


def reconcile_count(user_id: str) -> dict[str, Any]:
    """Recompute catalog_quota_used from live data and write the corrected count.

    Returns {before, after, delta} so admin endpoints can surface drift.
    """
    db = _db()
    user_ref = db.collection(_USER_COLLECTION).document(user_id)
    snap = user_ref.get()
    before = (snap.to_dict() or {}).get("catalog_quota_used", 0) if snap.exists else 0
    after = _count_user_custom_live(user_id)
    user_ref.set({"catalog_quota_used": after}, merge=True)
    return {"before": int(before), "after": int(after), "delta": int(after) - int(before)}


def list_eviction_candidates(
    user_id: str,
    sort_by: str = "oldest",
    limit: int = _EVICTION_LIST_CAP,
) -> list[dict]:
    """Return user_custom catalog rows the user might want to remove.

    Args:
        sort_by: "oldest" → by `last_purchased_at` ascending (oldest first);
                 "expiry" → by `idle_expires_at` ascending (soonest expiry first).

    Each candidate is a small dict with fields the picker UI needs:
        name_norm, display_name, barcode, last_purchased_at, idle_expires_at,
        active_purchases, total_purchases.
    """
    db = _db()
    rows = []
    for snap in (
        db.collection(_CATALOG_COLLECTION)
        .where(filter=FieldFilter("user_id", "==", user_id))
        .where(filter=FieldFilter("catalog_mode", "==", "user_custom"))
        .stream()
    ):
        d = snap.to_dict() or {}
        rows.append({
            "name_norm": d.get("name_norm"),
            "display_name": d.get("display_name"),
            "barcode": d.get("barcode"),
            "last_purchased_at": _iso(d.get("last_purchased_at")),
            "idle_expires_at": _iso(d.get("idle_expires_at")),
            "active_purchases": int(d.get("active_purchases") or 0),
            "total_purchases": int(d.get("total_purchases") or 0),
        })

    if sort_by == "expiry":
        rows.sort(key=lambda r: r["idle_expires_at"] or "9999")
    else:  # oldest
        rows.sort(key=lambda r: r["last_purchased_at"] or "0")

    return rows[:limit]


def _iso(v: Any) -> Optional[str]:
    if v is None:
        return None
    try:
        return v.isoformat() if hasattr(v, "isoformat") else str(v)
    except Exception:
        return None
