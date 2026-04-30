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

    Honors the user's CURRENT `currency_preference` for all monetary fields —
    historical events stored with a different display_currency get reconverted
    at read time via fx_rate_service. The save-time lock from Phase B is
    bypassed because users intuit "I changed my currency, show me everything
    in my currency" rather than "show me what I paid back when in the
    historical local rate."

    Raises NotFoundError if the catalog row doesn't exist.
    """
    from app.services import currency_service

    db = _db()
    cat_snap = db.collection(_CATALOG_COLLECTION).document(_doc_id(user_id, name_norm)).get()
    if not cat_snap.exists:
        raise NotFoundError(f"Catalog entry '{name_norm}' not found")
    entry = cat_snap.to_dict() or {}
    entry["id"] = cat_snap.id

    # User's CURRENT display-currency preference. Pre-migration users default
    # to SGD (matches the migration default).
    user_snap = db.collection("users").document(user_id).get()
    user_currency_pref = (
        (user_snap.to_dict() or {}).get("currency_preference") or "SGD"
        if user_snap.exists else "SGD"
    )

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

    # Read-time currency rewrite. We mutate each event's display_amount /
    # display_currency in-place so downstream aggregations naturally pick up
    # the user's current preference. unit_price is recomputed from the new
    # display_amount.
    for ev in events:
        derived = currency_service.display_amount_for_user(ev, user_currency_pref)
        if derived is not None:
            ev["display_amount"] = derived
            ev["display_currency"] = user_currency_pref
            qty = ev.get("quantity")
            pack_size = ev.get("pack_size") or 1
            if qty:
                try:
                    ev["unit_price"] = float(derived) / float(qty) / pack_size
                except (TypeError, ValueError, ZeroDivisionError):
                    pass

    counters = _compute_counters(events)
    lifetime = _compute_lifetime_breakdown(events)
    waste_rate = _compute_waste_rate(lifetime)
    timeline = _compute_movement_timeline(events)
    lineage = _compute_split_lineage(events)
    price_history = _compute_price_history_per_store(user_id, events)
    current_locations = _compute_current_locations(events)
    cadence = _compute_cadence(events)
    waste_cost = _compute_waste_cost(events)

    return {
        "entry": _serialize_entry(entry),
        "counters": counters,
        "lifetime_breakdown": lifetime,
        "waste_rate": waste_rate,
        "movement_timeline": timeline,
        "split_lineage": lineage,
        "price_history_per_store": price_history,
        # Phase E expansion (post-deploy feedback): "where do I have it now?",
        # "how often do I buy this and when's the next buy?", "how much money
        # have I lost to waste?" — analytics that help a user reason about
        # their behavior with this item, not just observe history.
        "current_locations": current_locations,
        "cadence": cadence,
        "waste_cost": waste_cost,
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


def _compute_current_locations(events: list[dict]) -> list[dict]:
    """Active inventory grouped by location — answers 'where do I have this now?'.

    Sorted by qty desc. Each entry includes:
      - active_qty: sum of event.quantity (the "batch count" view — what each
        event represents to the user, e.g. 4 packs).
      - active_base_units: sum of event.quantity × event.pack_size (the user's
        natural unit — e.g. 24 eggs across those 4 packs). The display layer
        leads with this.
      - pack_sizes: distinct pack_size values seen at this location, so the
        UI can render "6 eggs/pack" or "mixed pack sizes" honestly.
      - base_unit_label: best-effort label for the natural unit ("egg", "ml").
      - active_event_count: number of separate event docs.
      - soonest_expiry / most_urgent_event_id / most_urgent_event_qty:
        the most-urgent batch in this location (the one a Use/Move action
        should target by default).

    Skips terminal events (used / thrown / given / transferred).
    """
    by_location: dict[str, dict[str, Any]] = {}
    for ev in events:
        if ev.get("status") != "active":
            continue
        loc = ev.get("location") or "(none)"
        if loc not in by_location:
            by_location[loc] = {
                "location": loc,
                "active_qty": 0.0,
                "active_base_units": 0.0,
                "active_event_count": 0,
                "pack_sizes": set(),
                "base_unit_label": None,
                "soonest_expiry": None,
                "most_urgent_event_id": None,
                "most_urgent_event_qty": None,
                "most_urgent_event_pack_size": None,
            }
        bl = by_location[loc]
        try:
            qty = float(ev.get("quantity") or 0)
        except (TypeError, ValueError):
            qty = 0.0
        try:
            pack_size = int(ev.get("pack_size") or 1) or 1
        except (TypeError, ValueError):
            pack_size = 1
        bl["active_qty"] += qty
        bl["active_base_units"] += qty * pack_size
        bl["active_event_count"] += 1
        bl["pack_sizes"].add(pack_size)
        if not bl["base_unit_label"] and ev.get("base_unit_label"):
            bl["base_unit_label"] = ev.get("base_unit_label")

        expiry = ev.get("expiry_date")
        # Track the most-urgent event in this location (soonest expiry, with
        # null expiries treated as last so a real expiring batch wins).
        cur_expiry = bl["soonest_expiry"]
        promote = False
        if expiry is not None and (cur_expiry is None or expiry < cur_expiry):
            promote = True
        elif expiry is None and bl["most_urgent_event_id"] is None:
            promote = True
        if promote:
            bl["soonest_expiry"] = expiry if expiry is not None else cur_expiry
            bl["most_urgent_event_id"] = ev.get("id")
            bl["most_urgent_event_qty"] = ev.get("quantity")
            bl["most_urgent_event_pack_size"] = pack_size

    out: list[dict] = []
    for entry in by_location.values():
        pack_sizes = sorted(entry["pack_sizes"])
        out.append({
            "location": entry["location"],
            "active_qty": round(entry["active_qty"], 4),
            "active_base_units": round(entry["active_base_units"], 4),
            "active_event_count": entry["active_event_count"],
            "pack_sizes": pack_sizes,
            "mixed_pack_sizes": len(pack_sizes) > 1,
            "base_unit_label": entry["base_unit_label"] or "unit",
            "soonest_expiry": _iso(entry["soonest_expiry"]),
            "most_urgent_event_id": entry["most_urgent_event_id"],
            "most_urgent_event_qty": entry["most_urgent_event_qty"],
            "most_urgent_event_pack_size": entry["most_urgent_event_pack_size"],
        })
    # Sort by base units desc — "where do I have the most" matches the user's
    # mental count better than event count.
    out.sort(key=lambda x: -x["active_base_units"])
    return out


def _compute_cadence(events: list[dict]) -> dict[str, Any]:
    """Purchase + consumption cadence + restock prediction.

    Cadence math:
      - Buy timestamps: date_bought from logical purchases (no split_from_event_id)
      - avg_days_between_buys: mean of consecutive deltas (None if < 2 buys)
      - days_since_last_buy: now - last_buy
      - predicted_next_buy_in_days: avg_days_between_buys - days_since_last_buy
        (negative = overdue; positive = days remaining; None = insufficient data)

    Consumption math:
      - For events with status=used and consumed_date set:
        consumed_date - date_bought = days the user kept that batch
      - avg_days_buy_to_use: mean across all used events
    """
    now = datetime.now(timezone.utc)
    buy_dates: list[datetime] = []
    for ev in events:
        if ev.get("split_from_event_id"):
            continue  # split children aren't independent buys
        db_dt = ev.get("date_bought")
        if db_dt is None:
            continue
        if hasattr(db_dt, "to_datetime"):
            db_dt = db_dt.to_datetime()
        if db_dt.tzinfo is None:
            db_dt = db_dt.replace(tzinfo=timezone.utc)
        buy_dates.append(db_dt)
    buy_dates.sort()

    avg_days_between_buys: Optional[float] = None
    if len(buy_dates) >= 2:
        deltas = [
            (buy_dates[i + 1] - buy_dates[i]).total_seconds() / 86400.0
            for i in range(len(buy_dates) - 1)
        ]
        if deltas:
            avg_days_between_buys = sum(deltas) / len(deltas)

    last_buy = buy_dates[-1] if buy_dates else None
    days_since_last_buy: Optional[float] = None
    if last_buy is not None:
        days_since_last_buy = (now - last_buy).total_seconds() / 86400.0

    predicted_next_buy_in_days: Optional[float] = None
    if avg_days_between_buys is not None and days_since_last_buy is not None:
        predicted_next_buy_in_days = avg_days_between_buys - days_since_last_buy

    consumption_deltas: list[float] = []
    for ev in events:
        if ev.get("status") != "used":
            continue
        consumed = ev.get("consumed_date")
        bought = ev.get("date_bought")
        if not consumed or not bought:
            continue
        if hasattr(consumed, "to_datetime"):
            consumed = consumed.to_datetime()
        if hasattr(bought, "to_datetime"):
            bought = bought.to_datetime()
        if consumed.tzinfo is None:
            consumed = consumed.replace(tzinfo=timezone.utc)
        if bought.tzinfo is None:
            bought = bought.replace(tzinfo=timezone.utc)
        delta = (consumed - bought).total_seconds() / 86400.0
        if delta >= 0:
            consumption_deltas.append(delta)

    avg_days_buy_to_use: Optional[float] = None
    if consumption_deltas:
        avg_days_buy_to_use = sum(consumption_deltas) / len(consumption_deltas)

    return {
        "logical_buy_count": len(buy_dates),
        "avg_days_between_buys": _round_or_none(avg_days_between_buys, 1),
        "last_buy_at": _iso(last_buy),
        "days_since_last_buy": _round_or_none(days_since_last_buy, 1),
        "predicted_next_buy_in_days": _round_or_none(predicted_next_buy_in_days, 1),
        "avg_days_buy_to_use": _round_or_none(avg_days_buy_to_use, 1),
        "use_event_count": len(consumption_deltas),
    }


def _compute_waste_cost(events: list[dict]) -> dict[str, Any]:
    """Money lost to waste — concrete dollar figure beats a percentage.

    Spent_total = sum of display_amount across all events with a price.
    waste_pct_by_value = thrown_value / spent_total (independent from
    waste_pct_by_qty in `waste_rate` — different denominators answer
    different questions).
    """
    spent_total = 0.0
    used_total = 0.0
    thrown_total = 0.0
    given_total = 0.0
    display_currency: Optional[str] = None
    for ev in events:
        amt = ev.get("display_amount")
        if amt is None:
            amt = ev.get("amount")
        if amt is None:
            amt = ev.get("price")
        if amt is None:
            continue
        try:
            amt = float(amt)
        except (TypeError, ValueError):
            continue
        spent_total += amt
        if display_currency is None and ev.get("display_currency"):
            display_currency = ev.get("display_currency")
        status = ev.get("status")
        if status == "used":
            used_total += amt
        elif status == "thrown":
            thrown_total += amt
        elif status in ("given", "transferred"):
            given_total += amt
    return {
        "display_currency": display_currency,
        "spent_total": round(spent_total, 2),
        "used_total": round(used_total, 2),
        "thrown_total": round(thrown_total, 2),
        "given_total": round(given_total, 2),
        "waste_pct_by_value": (
            round(thrown_total / spent_total * 100, 2) if spent_total else 0.0
        ),
    }


def _round_or_none(v: Optional[float], ndigits: int) -> Optional[float]:
    return round(v, ndigits) if v is not None else None


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
