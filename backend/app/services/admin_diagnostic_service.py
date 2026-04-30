"""Admin diagnostic service — read-only health checks on user data shape.

Phase F of the catalog evolution plan
(`F:\\ClaudeProjects\\GroceryApp\\.claude\\docs\\plans\\catalog_evolution.md`).

Answers "is the numbering tally?" without changing schema. Recomputes catalog
counters from raw purchase events and reports drift.

Core distinction surfaced by this service:
  - stored `total_purchases` — ever-incremented event counter on catalog row
  - recomputed `total_event_count` — count of all events with that catalog_name_norm
  - recomputed `logical_purchase_count` — count of events with split_from_event_id is None
                                           (i.e., original purchases, not split children)

If `stored != recomputed_total_event_count` → real storage drift (bug).
If `stored > logical_purchase_count` → event-vs-logical inflation (the user-perceived
    "numbering not tally" symptom from Phase 1-4 splits).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

logger = logging.getLogger(__name__)

_CATALOG_COLLECTION = "catalog_entries"


def _db():
    return firestore.client()


def _user_purchases_ref(user_id: str):
    return _db().collection("users").document(user_id).collection("purchases")


def _isoformat(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if isinstance(dt, datetime):
        return dt.astimezone(timezone.utc).isoformat() if dt.tzinfo else dt.isoformat()
    return str(dt)


def compute_catalog_counter_diagnostics(user_id: str) -> dict[str, Any]:
    """Recompute catalog counters from raw events and report per-row deltas.

    One pass over `users/{uid}/purchases`, group in memory by `catalog_name_norm`,
    join with `catalog_entries` for that user. Read-only — no writes.

    Returns:
        {
            user_id: str,
            computed_at: ISO str,
            total_catalog_rows: int,
            total_events: int,
            divergent_count: int,    # rows where stored_total != recomputed_total_event_count
            inflated_count: int,     # rows where stored_total > logical_purchase_count
            orphan_event_count: int, # events whose catalog_name_norm has no catalog row
            rows: [...],             # all catalog rows with diagnostics
            top_divergent: [...],    # top 10 by abs(delta_total)
            top_inflated: [...],     # top 10 by inflation (stored - logical)
            orphan_events: [...],    # events with no matching catalog row (capped at 50)
        }
    """
    db = _db()
    now_iso = datetime.now(timezone.utc).isoformat()

    # --- 1. Load all catalog entries for this user (single query) ---
    catalog_q = (
        db.collection(_CATALOG_COLLECTION)
        .where(filter=FieldFilter("user_id", "==", user_id))
    )
    catalog_by_norm: dict[str, dict] = {}
    for snap in catalog_q.stream():
        data = snap.to_dict() or {}
        nn = data.get("name_norm")
        if nn:
            catalog_by_norm[nn] = data

    # --- 2. Stream all purchase events for this user, group in memory ---
    events_by_norm: dict[str, list[dict]] = {}
    total_events = 0
    for snap in _user_purchases_ref(user_id).stream():
        ev = snap.to_dict() or {}
        ev["id"] = snap.id
        nn = ev.get("catalog_name_norm")
        if not nn:
            continue
        events_by_norm.setdefault(nn, []).append(ev)
        total_events += 1

    # --- 3. Build per-row diagnostics for every catalog row ---
    rows: list[dict] = []
    divergent_count = 0
    inflated_count = 0
    for nn, cat in catalog_by_norm.items():
        evs = events_by_norm.get(nn, [])

        recomputed_total = len(evs)
        recomputed_logical = sum(1 for ev in evs if not ev.get("split_from_event_id"))
        recomputed_active = sum(1 for ev in evs if ev.get("status") == "active")
        split_count = sum(1 for ev in evs if ev.get("split_from_event_id"))

        # status breakdown for context
        status_counts: dict[str, int] = {}
        for ev in evs:
            s = ev.get("status") or "unknown"
            status_counts[s] = status_counts.get(s, 0) + 1

        # event timestamps
        date_boughts = [ev.get("date_bought") for ev in evs if ev.get("date_bought")]
        first_at = min(date_boughts) if date_boughts else None
        last_at = max(date_boughts) if date_boughts else None

        stored_total = int(cat.get("total_purchases") or 0)
        stored_active = int(cat.get("active_purchases") or 0)

        delta_total = stored_total - recomputed_total
        inflation = stored_total - recomputed_logical
        delta_active = stored_active - recomputed_active

        if delta_total != 0:
            divergent_count += 1
        if inflation > 0:
            inflated_count += 1

        rows.append({
            "name_norm": nn,
            "display_name": cat.get("display_name") or nn,
            "barcode": cat.get("barcode"),
            "stored_total_purchases": stored_total,
            "stored_active_purchases": stored_active,
            "recomputed_total_event_count": recomputed_total,
            "recomputed_logical_purchase_count": recomputed_logical,
            "recomputed_active": recomputed_active,
            "delta_total": delta_total,
            "delta_active": delta_active,
            "inflation": inflation,
            "split_event_count": split_count,
            "status_counts": status_counts,
            "first_event_at": _isoformat(first_at),
            "last_event_at": _isoformat(last_at),
        })

    # --- 4. Orphan events (catalog_name_norm referenced but no catalog row exists) ---
    orphan_norms = set(events_by_norm.keys()) - set(catalog_by_norm.keys())
    orphan_events: list[dict] = []
    for nn in orphan_norms:
        for ev in events_by_norm[nn][:5]:  # cap per-norm to avoid blowup
            orphan_events.append({
                "catalog_name_norm": nn,
                "event_id": ev.get("id"),
                "catalog_display": ev.get("catalog_display"),
                "barcode": ev.get("barcode"),
                "status": ev.get("status"),
                "date_bought": _isoformat(ev.get("date_bought")),
            })
            if len(orphan_events) >= 50:
                break
        if len(orphan_events) >= 50:
            break

    # --- 5. Top-divergent + top-inflated rankings ---
    top_divergent = sorted(
        [r for r in rows if r["delta_total"] != 0],
        key=lambda r: abs(r["delta_total"]),
        reverse=True,
    )[:10]
    top_inflated = sorted(
        [r for r in rows if r["inflation"] > 0],
        key=lambda r: r["inflation"],
        reverse=True,
    )[:10]

    # Default sort of rows: largest inflation first, then stored_total desc
    rows.sort(key=lambda r: (r["inflation"], r["stored_total_purchases"]), reverse=True)

    logger.info(
        "diagnostic.catalog_counters user=%s rows=%d events=%d divergent=%d inflated=%d orphans=%d",
        user_id, len(rows), total_events, divergent_count, inflated_count, len(orphan_events),
    )

    return {
        "user_id": user_id,
        "computed_at": now_iso,
        "total_catalog_rows": len(rows),
        "total_events": total_events,
        "divergent_count": divergent_count,
        "inflated_count": inflated_count,
        "orphan_event_count": sum(len(events_by_norm[nn]) for nn in orphan_norms),
        "rows": rows,
        "top_divergent": top_divergent,
        "top_inflated": top_inflated,
        "orphan_events": orphan_events,
    }
