"""Catalog overview service — Phase E of catalog_evolution.md.

Aggregates a single catalog entry's full history into the structured payload
the new CatalogEntryPage renders: split lineage, movement timeline, lifetime
unit breakdown (quantity-based, not event-count), price history per store
with per-unit comparison, and waste rate.

Read-only. Computed live from raw events; no denormalised counters added.
The diagnostic counter math (logical vs event count) is included alongside
the legacy `total_purchases` so the UI can show both.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from app.core.exceptions import NotFoundError

logger = logging.getLogger(__name__)

_CATALOG_COLLECTION = "catalog_entries"
_USER_COLLECTION = "users"


def _db():
    return firestore.client()


def _user_purchases_ref(user_id: str):
    return _db().collection(_USER_COLLECTION).document(user_id).collection("purchases")


def _doc_id(user_id: str, name_norm: str) -> str:
    return f"{user_id}__{name_norm}"


def _iso(v: Any) -> Optional[str]:
    if v is None:
        return None
    try:
        return v.isoformat() if hasattr(v, "isoformat") else str(v)
    except Exception:
        return None


def compute_overview(user_id: str, name_norm: str) -> dict[str, Any]:
    """Compute the full overview payload for one catalog entry.

    Raises NotFoundError if the catalog row doesn't exist.
    """
    db = _db()
    cat_snap = db.collection(_CATALOG_COLLECTION).document(_doc_id(user_id, name_norm)).get()
    if not cat_snap.exists:
        raise NotFoundError(f"Catalog entry '{name_norm}' not found")
    entry = cat_snap.to_dict() or {}
    entry["id"] = cat_snap.id

    # Load all events for this catalog
    events: list[dict] = []
    for snap in (
        _user_purchases_ref(user_id)
        .where(filter=FieldFilter("catalog_name_norm", "==", name_norm))
        .stream()
    ):
        d = snap.to_dict() or {}
        d["id"] = snap.id
        events.append(d)

    # Sort by date_bought ascending for timelines
    events.sort(key=lambda e: e.get("date_bought") or datetime.min.replace(tzinfo=timezone.utc))

    counters = _compute_counters(events)
    lifetime = _compute_lifetime_breakdown(events)
    waste_rate = _compute_waste_rate(lifetime)
    timeline = _compute_movement_timeline(events)
    lineage = _compute_split_lineage(events)
    price_history = _compute_price_history_per_store(user_id, events)

    return {
        "entry": _serialize_entry(entry),
        "counters": counters,
        "lifetime_breakdown": lifetime,
        "waste_rate": waste_rate,
        "movement_timeline": timeline,
        "split_lineage": lineage,
        "price_history_per_store": price_history,
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Sub-computations
# ---------------------------------------------------------------------------


def _serialize_entry(entry: dict) -> dict:
    """Strip Firestore-only timestamps to ISO strings for JSON safety."""
    return {
        **entry,
        "last_purchased_at": _iso(entry.get("last_purchased_at")),
        "idle_expires_at": _iso(entry.get("idle_expires_at")),
        "created_at": _iso(entry.get("created_at")),
        "updated_at": _iso(entry.get("updated_at")),
    }


def _compute_counters(events: list[dict]) -> dict[str, int]:
    """logical_purchase_count vs total_event_count (the diagnostic distinction)."""
    total_event_count = len(events)
    logical_purchase_count = sum(1 for ev in events if not ev.get("split_from_event_id"))
    active_count = sum(1 for ev in events if ev.get("status") == "active")
    return {
        "logical_purchase_count": logical_purchase_count,
        "total_event_count": total_event_count,
        "active_count": active_count,
    }


def _compute_lifetime_breakdown(events: list[dict]) -> dict[str, float]:
    """Quantity-based breakdown across the full event history.

    All quantities expressed in the same unit (typically the catalog's base
    unit). For multi-pack events: each event's quantity is "packs"; the
    base-unit total would multiply by pack_size. We sum quantities verbatim
    here — the UI labels with the base_unit_label when available.
    """
    bucket = {
        "total_qty": 0.0,
        "active_qty": 0.0,
        "used_qty": 0.0,
        "thrown_qty": 0.0,
        "given_qty": 0.0,
        "transferred_qty": 0.0,
    }
    for ev in events:
        try:
            qty = float(ev.get("quantity") or 0)
        except (TypeError, ValueError):
            qty = 0.0
        bucket["total_qty"] += qty
        status = ev.get("status") or "active"
        if status == "active":
            bucket["active_qty"] += qty
        elif status == "used":
            bucket["used_qty"] += qty
        elif status == "thrown":
            bucket["thrown_qty"] += qty
        elif status == "given":
            bucket["given_qty"] += qty
        elif status == "transferred":
            bucket["transferred_qty"] += qty
    return {k: round(v, 4) for k, v in bucket.items()}


def _compute_waste_rate(lifetime: dict[str, float]) -> dict[str, float]:
    """% by quantity. Plan §7 Phase E: NOT event-count-based.

    Waste = thrown / total. Rate is 0 when total is 0.
    """
    total = lifetime.get("total_qty", 0.0)
    if total <= 0:
        return {
            "waste_pct": 0.0, "used_pct": 0.0, "thrown_pct": 0.0,
            "given_pct": 0.0, "active_pct": 0.0,
        }
    return {
        "waste_pct": round(lifetime["thrown_qty"] / total * 100, 2),
        "used_pct": round(lifetime["used_qty"] / total * 100, 2),
        "thrown_pct": round(lifetime["thrown_qty"] / total * 100, 2),
        "given_pct": round((lifetime["given_qty"] + lifetime["transferred_qty"]) / total * 100, 2),
        "active_pct": round(lifetime["active_qty"] / total * 100, 2),
    }


def _compute_movement_timeline(events: list[dict]) -> list[dict]:
    """Chronological list of all events with location info, plus split-derived
    move events. Each entry: {date, event_id, action, location, quantity, status}.
    """
    out: list[dict] = []
    for ev in events:
        out.append({
            "date": _iso(ev.get("date_bought")) or _iso(ev.get("created_at")),
            "event_id": ev.get("id"),
            "action": "purchased" if not ev.get("split_from_event_id") else _split_action(ev),
            "location": ev.get("location"),
            "quantity": ev.get("quantity"),
            "status": ev.get("status"),
            "split_from_event_id": ev.get("split_from_event_id"),
        })
    return out


def _split_action(ev: dict) -> str:
    """Map split-derived events to a human action label."""
    status = ev.get("status")
    if status == "transferred":
        return "moved"
    if status == "used":
        return "split_used"
    if status == "thrown":
        return "split_thrown"
    if status == "given":
        return "split_given"
    return f"split_{status or 'unknown'}"


def _compute_split_lineage(events: list[dict]) -> list[dict]:
    """Build a tree of {parent_event, children: [...]}.

    A "parent" is any event that has at least one event with
    split_from_event_id pointing to it. Non-parent originals are still
    included as singletons.
    """
    parents_by_id: dict[str, dict] = {}
    children_by_parent: dict[str, list[dict]] = {}
    for ev in events:
        sid = ev.get("split_from_event_id")
        if sid:
            children_by_parent.setdefault(sid, []).append(_minimal_event(ev))
        else:
            parents_by_id[ev["id"]] = _minimal_event(ev)
    out = []
    for parent_id, parent in parents_by_id.items():
        children = children_by_parent.get(parent_id, [])
        out.append({**parent, "children": children})
    # Stable order: oldest parent first
    out.sort(key=lambda p: p.get("date_bought") or "")
    return out


def _minimal_event(ev: dict) -> dict:
    """Trimmed event payload for tree/timeline rendering."""
    return {
        "id": ev.get("id"),
        "date_bought": _iso(ev.get("date_bought")),
        "quantity": ev.get("quantity"),
        "status": ev.get("status"),
        "location": ev.get("location"),
        "expiry_date": _iso(ev.get("expiry_date")),
        "consumed_reason": ev.get("consumed_reason"),
        "split_from_event_id": ev.get("split_from_event_id"),
        "store_id": ev.get("store_id"),
    }


def _compute_price_history_per_store(user_id: str, events: list[dict]) -> list[dict]:
    """Group events by store_id; for each store compute samples + per-unit stats.

    Resolves store_id → name via store_catalog so the UI doesn't have to
    cross-reference. Skips events without a price.
    """
    from app.services import store_catalog_service

    store_names: dict[str, str] = {}
    by_store: dict[str, list[dict]] = {}
    for ev in events:
        if ev.get("price") is None and ev.get("display_amount") is None:
            continue
        sid = ev.get("store_id") or "unknown"
        by_store.setdefault(sid, []).append(ev)
        if sid not in store_names:
            s = store_catalog_service.get_store(user_id, sid)
            store_names[sid] = s["name"] if s else (sid.replace("_", " ").title())

    out: list[dict] = []
    for sid, evs in by_store.items():
        samples = []
        for ev in evs:
            samples.append({
                "event_id": ev.get("id"),
                "date": _iso(ev.get("date_bought")),
                "amount": ev.get("amount") if ev.get("amount") is not None else ev.get("price"),
                "currency": ev.get("currency"),
                "display_amount": ev.get("display_amount"),
                "display_currency": ev.get("display_currency"),
                "unit_price": ev.get("unit_price"),
                "quantity": ev.get("quantity"),
                "pack_size": ev.get("pack_size"),
            })
        # Newest first
        samples.sort(key=lambda s: s.get("date") or "", reverse=True)
        unit_prices = [s["unit_price"] for s in samples if s.get("unit_price") is not None]
        out.append({
            "store_id": sid,
            "store_name": store_names.get(sid, sid),
            "samples": samples,
            "mean_unit_price": (
                round(sum(unit_prices) / len(unit_prices), 4) if unit_prices else None
            ),
            "min_unit_price": min(unit_prices) if unit_prices else None,
            "max_unit_price": max(unit_prices) if unit_prices else None,
            "latest_unit_price": samples[0]["unit_price"] if samples else None,
            "sample_count": len(samples),
        })
    # Cheapest mean_unit_price first (None last)
    out.sort(key=lambda s: (s["mean_unit_price"] is None, s["mean_unit_price"]))
    return out
