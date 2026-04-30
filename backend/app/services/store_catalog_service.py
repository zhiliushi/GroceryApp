"""Store catalog service — per-user catalog of "where I shop".

Plan: catalog_evolution.md §2.2 #9, Phase D.

Data model:
    store_catalog/{user_id}/stores/{store_id}
    {store_id, name, auto_created, created_at, last_used_at, use_count}

Rules:
- Free tier: 30-store cap (`user.store_quota_limit`)
- Paid tier (plus/pro): same cap unless admin raises the limit
- Phase A migration auto-creates a single "unknown" store per user for
  events whose store wasn't recorded
- Free-text on first add; select-or-create on subsequent (similarity match
  via name_norm prefix lookup)
- Delete leaves any events that referenced that store_id intact (UI shows
  "(deleted)" or falls back to the store_id literal)
"""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from app.core.exceptions import (
    NotFoundError,
    QuotaExceededError,
    ValidationError,
)
from app.core.metadata import apply_create_metadata, apply_update_metadata

logger = logging.getLogger(__name__)

_COLLECTION = "store_catalog"
_USER_COLLECTION = "users"
_DEFAULT_STORE_LIMIT = 30
_MAX_NAME_LEN = 120
_PAID_TIERS = {"plus", "pro"}


def _db():
    return firestore.client()


def _stores_ref(user_id: str):
    return _db().collection(_COLLECTION).document(user_id).collection("stores")


def _normalize(name: str) -> str:
    """Slug for autocomplete + duplicate detection."""
    if not name:
        return ""
    cleaned = re.sub(r"[^\w\s]", "", name.strip().lower())
    return re.sub(r"\s+", "_", cleaned).strip("_")


def _validate_name(name: str) -> str:
    name = (name or "").strip()
    if not name:
        raise ValidationError("Store name cannot be empty")
    if len(name) > _MAX_NAME_LEN:
        raise ValidationError(f"Store name too long (max {_MAX_NAME_LEN} chars)")
    return name


def _is_paid(user_data: Optional[dict]) -> bool:
    if not user_data:
        return False
    return (user_data.get("tier") or "free") in _PAID_TIERS


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------


def list_stores(user_id: str, include_unknown: bool = True) -> list[dict]:
    """All stores the user has registered, sorted by use_count desc.

    Args:
        include_unknown: include the migration-created "unknown" store row.
    """
    stores: list[dict] = []
    for snap in _stores_ref(user_id).stream():
        d = snap.to_dict() or {}
        if not include_unknown and d.get("store_id") == "unknown":
            continue
        d["store_id"] = d.get("store_id") or snap.id
        stores.append(d)
    stores.sort(key=lambda s: -int(s.get("use_count") or 0))
    return stores


def get_store(user_id: str, store_id: str) -> Optional[dict]:
    snap = _stores_ref(user_id).document(store_id).get()
    if not snap.exists:
        return None
    d = snap.to_dict() or {}
    d["store_id"] = store_id
    return d


def search_stores(user_id: str, query: str, limit: int = 8) -> list[dict]:
    """Prefix-match store names. Returns up to `limit` candidates ranked by
    use_count + exact-prefix matches first."""
    q_norm = _normalize(query)
    if not q_norm:
        return list_stores(user_id)[:limit]
    matches: list[dict] = []
    for snap in _stores_ref(user_id).stream():
        d = snap.to_dict() or {}
        nn = _normalize(d.get("name") or "")
        if nn.startswith(q_norm) or q_norm in nn:
            d["store_id"] = d.get("store_id") or snap.id
            d["_match_kind"] = "prefix" if nn.startswith(q_norm) else "substring"
            matches.append(d)
    matches.sort(
        key=lambda s: (
            0 if s["_match_kind"] == "prefix" else 1,
            -int(s.get("use_count") or 0),
        )
    )
    for m in matches:
        m.pop("_match_kind", None)
    return matches[:limit]


# ---------------------------------------------------------------------------
# Quota
# ---------------------------------------------------------------------------


def _get_quota_status(user_id: str) -> dict[str, int]:
    db = _db()
    snap = db.collection(_USER_COLLECTION).document(user_id).get()
    user = snap.to_dict() if snap.exists else {}
    user = user or {}
    used = user.get("store_quota_used")
    limit = int(user.get("store_quota_limit", _DEFAULT_STORE_LIMIT))
    if used is None:
        # pre-migration → live count
        used = sum(1 for _ in _stores_ref(user_id).stream())
    return {"used": int(used), "limit": limit, "available": max(0, limit - int(used))}


def _check_store_quota(user_id: str) -> None:
    status = _get_quota_status(user_id)
    if status["used"] >= status["limit"]:
        raise QuotaExceededError(
            message=(
                f"Store catalog full ({status['used']}/{status['limit']}). "
                "Remove an existing store or upgrade for a higher cap."
            ),
            details={
                "type": "store_quota_exceeded",
                "used": status["used"],
                "limit": status["limit"],
                "eviction_candidates": [
                    {
                        "store_id": s.get("store_id"),
                        "name": s.get("name"),
                        "use_count": int(s.get("use_count") or 0),
                        "last_used_at": _iso(s.get("last_used_at")),
                    }
                    for s in list_stores(user_id, include_unknown=False)
                ],
            },
        )


def _iso(v: Any) -> Optional[str]:
    if v is None:
        return None
    try:
        return v.isoformat() if hasattr(v, "isoformat") else str(v)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------


def create_store(user_id: str, name: str, actor_uid: Optional[str] = None) -> dict:
    """Create a store. Quota-checked. Returns the new store doc.

    Idempotent on duplicate normalized name: returns the existing match
    rather than failing or creating a second row.
    """
    name = _validate_name(name)
    norm = _normalize(name)
    if not norm:
        raise ValidationError("Store name normalizes to empty")

    db = _db()
    # Idempotent — return existing if name matches
    existing = search_stores(user_id, name, limit=5)
    for s in existing:
        if _normalize(s.get("name") or "") == norm:
            return s

    _check_store_quota(user_id)

    store_id = norm if norm != "unknown" else f"u_{uuid.uuid4().hex[:8]}"
    # Disambiguate if the slug already exists for some reason
    while _stores_ref(user_id).document(store_id).get().exists:
        store_id = f"{norm}_{uuid.uuid4().hex[:4]}"

    now = datetime.now(timezone.utc)
    doc = {
        "store_id": store_id,
        "name": name,
        "auto_created": False,
        "created_at": now,
        "last_used_at": now,
        "use_count": 0,
    }
    _stores_ref(user_id).document(store_id).set(
        apply_create_metadata(doc, uid=actor_uid or user_id, source="manual"),
    )

    # Increment user.store_quota_used
    db.collection(_USER_COLLECTION).document(user_id).set(
        {"store_quota_used": firestore.Increment(1)}, merge=True
    )

    logger.info("store.created user=%s store_id=%s", user_id, store_id)
    return get_store(user_id, store_id)


def update_store(user_id: str, store_id: str, name: str) -> dict:
    if not get_store(user_id, store_id):
        raise NotFoundError(f"Store '{store_id}' not found")
    name = _validate_name(name)
    _stores_ref(user_id).document(store_id).update(
        apply_update_metadata({"name": name})
    )
    return get_store(user_id, store_id)


def delete_store(user_id: str, store_id: str) -> None:
    """Delete a store. Events that reference it stay in place (UI displays
    a fallback). Releases one quota slot.

    Refuses to delete the auto-created "unknown" store — it's a sink for
    events the user hasn't categorized."""
    if store_id == "unknown":
        raise ValidationError("Cannot delete the auto-created 'unknown' store")
    if not get_store(user_id, store_id):
        raise NotFoundError(f"Store '{store_id}' not found")
    _stores_ref(user_id).document(store_id).delete()
    _db().collection(_USER_COLLECTION).document(user_id).set(
        {"store_quota_used": firestore.Increment(-1)}, merge=True
    )
    logger.info("store.deleted user=%s store_id=%s", user_id, store_id)


def touch_store(user_id: str, store_id: str) -> None:
    """Bump last_used_at + use_count on a store. Fire-and-forget from the
    purchase write path. Silently no-ops if the store doesn't exist."""
    try:
        ref = _stores_ref(user_id).document(store_id)
        snap = ref.get()
        if not snap.exists:
            return
        ref.update(apply_update_metadata({
            "last_used_at": datetime.now(timezone.utc),
            "use_count": firestore.Increment(1),
        }))
    except Exception as e:
        logger.warning("store.touch_safe swallowed err user=%s store_id=%s err=%s",
                       user_id, store_id, e)


def get_quota_status(user_id: str) -> dict[str, Any]:
    """User-facing quota status for the picker UI."""
    status = _get_quota_status(user_id)
    return {**status, "at_or_above_limit": status["used"] >= status["limit"]}
