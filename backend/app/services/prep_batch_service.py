"""Preppers batch service — active preservation instances.

A "batch" is a single in-progress instance of a preservation: a jar of
kimchi started yesterday, a tray of beef jerky in the dehydrator now,
etc. Distinct from `prep_recipes` (the template) — a recipe can spawn
many batches over time.

Schema highlights:
- `started_at` (when the user pressed Start)
- `ready_at`   = started_at + ready_after_hours
- `expires_at` = ready_at + shelf_life_days * 24h
- `status` ∈ {active, consumed, discarded}

The countdown in the UI is computed client-side from these timestamps;
server returns ISO-8601 datetime strings.

Phase P1 of preppers.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from firebase_admin import firestore

from app.services import common_preserves_service, prep_recipe_service

logger = logging.getLogger(__name__)

ACTIVE_BATCHES_LIMIT = 100
SCHEMA_VERSION = 1

VALID_STATUSES = {"active", "consumed", "discarded"}


def _db():
    return firestore.client()


def _user_batches_ref(uid: str):
    return _db().collection("users").document(uid).collection("prep_batches")


def list_batches(uid: str, status_filter: Optional[str] = "active") -> List[Dict[str, Any]]:
    """List user batches. Default = active only. Pass status_filter='all' for everything."""
    q = _user_batches_ref(uid)
    out: List[Dict[str, Any]] = []
    for doc in q.stream():
        data = doc.to_dict() or {}
        data["id"] = doc.id
        if status_filter and status_filter != "all":
            if data.get("status") != status_filter:
                continue
        # Convert datetimes to ISO strings for transport
        for k in ("started_at", "ready_at", "expires_at", "consumed_at", "discarded_at", "created_at", "updated_at"):
            v = data.get(k)
            if hasattr(v, "to_datetime"):
                v = v.to_datetime()
            if isinstance(v, datetime):
                data[k] = v.isoformat()
        out.append(data)
    # Newest first by started_at when present
    out.sort(key=lambda b: b.get("started_at") or "", reverse=True)
    return out


def get_batch(uid: str, bid: str) -> Optional[Dict[str, Any]]:
    doc = _user_batches_ref(uid).document(bid).get()
    if not doc.exists:
        return None
    data = doc.to_dict() or {}
    data["id"] = doc.id
    for k in ("started_at", "ready_at", "expires_at", "consumed_at", "discarded_at", "created_at", "updated_at"):
        v = data.get(k)
        if hasattr(v, "to_datetime"):
            v = v.to_datetime()
        if isinstance(v, datetime):
            data[k] = v.isoformat()
    return data


def create_batch(uid: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Start a new batch. Inputs:
      - name (required)
      - prep_type (required, one of VALID_PREP_TYPES)
      - ready_after_hours (int, >= 0)
      - shelf_life_days (int, > 0)
      - recipe_id (optional, ref to user prep_recipe)
      - common_preserve_ref (optional, ref to common_preserves)
      - ingredients_snapshot (optional list)
      - notes (optional)
      - started_at (optional ISO; default = now)
    Computes ready_at and expires_at from the durations.
    """
    name = (body.get("name") or "").strip()
    if not name:
        raise ValueError("name is required")

    prep_type = (body.get("prep_type") or "").strip()
    if prep_type not in common_preserves_service.VALID_PREP_TYPES:
        raise ValueError("invalid prep_type")

    ready_after_hours = int(body.get("ready_after_hours") or 0)
    shelf_life_days = int(body.get("shelf_life_days") or 0)
    if ready_after_hours < 0 or shelf_life_days <= 0:
        raise ValueError("ready_after_hours >= 0 and shelf_life_days > 0 required")

    # Quota check (active only — consumed/discarded don't count)
    active_count = sum(
        1 for d in _user_batches_ref(uid).stream()
        if (d.to_dict() or {}).get("status") == "active"
    )
    if active_count >= ACTIVE_BATCHES_LIMIT:
        raise ValueError(f"active batch limit reached ({ACTIVE_BATCHES_LIMIT})")

    # Timestamps
    started_at_raw = body.get("started_at")
    if started_at_raw:
        try:
            started_at = datetime.fromisoformat(str(started_at_raw).replace("Z", "+00:00"))
        except ValueError:
            raise ValueError("started_at must be ISO-8601")
        if started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)
    else:
        started_at = datetime.now(timezone.utc)

    ready_at = started_at + timedelta(hours=ready_after_hours)
    expires_at = ready_at + timedelta(days=shelf_life_days)

    bid = uuid.uuid4().hex[:16]
    now = datetime.now(timezone.utc)
    doc = {
        "name": name,
        "prep_type": prep_type,
        "ready_after_hours": ready_after_hours,
        "shelf_life_days": shelf_life_days,
        "started_at": started_at,
        "ready_at": ready_at,
        "expires_at": expires_at,
        "status": "active",
        "consumed_at": None,
        "discarded_at": None,
        "recipe_id": body.get("recipe_id") or None,
        "common_preserve_ref": body.get("common_preserve_ref") or None,
        "ingredients_snapshot": body.get("ingredients_snapshot") or [],
        "notes": (body.get("notes") or "").strip(),
        "created_at": now,
        "updated_at": now,
        "schema_version": SCHEMA_VERSION,
    }
    _user_batches_ref(uid).document(bid).set(doc)

    return get_batch(uid, bid) or {}


def set_batch_status(uid: str, bid: str, new_status: str, notes: str = "") -> Optional[Dict[str, Any]]:
    """Mark a batch as consumed or discarded.

    Status transitions allowed:
      active -> consumed
      active -> discarded
      consumed/discarded -> active   (un-do, in case of misclick)
    """
    if new_status not in VALID_STATUSES:
        raise ValueError(f"invalid status; must be one of {sorted(VALID_STATUSES)}")

    ref = _user_batches_ref(uid).document(bid)
    snap = ref.get()
    if not snap.exists:
        return None

    now = datetime.now(timezone.utc)
    update: Dict[str, Any] = {"status": new_status, "updated_at": now}
    if new_status == "consumed":
        update["consumed_at"] = now
        update["discarded_at"] = None
    elif new_status == "discarded":
        update["discarded_at"] = now
        update["consumed_at"] = None
    else:  # back to active
        update["consumed_at"] = None
        update["discarded_at"] = None

    if notes:
        update["notes"] = notes.strip()

    ref.update(update)
    return get_batch(uid, bid)


def delete_batch(uid: str, bid: str) -> bool:
    ref = _user_batches_ref(uid).document(bid)
    if not ref.get().exists:
        return False
    ref.delete()
    return True
