"""
Analytics service — batch event storage and stats aggregation.

All analytics events live in Firestore at:
  users/{userId}/analytics/{eventId}
"""

import logging
import time
from typing import Any, Dict, List, Optional

from firebase_admin import firestore

logger = logging.getLogger(__name__)


def _get_db():
    return firestore.client()


# ---------------------------------------------------------------------------
# Batch Sync
# ---------------------------------------------------------------------------

def sync_events(events: List[Dict[str, Any]]) -> int:
    """
    Write a batch of analytics events to Firestore.
    Groups events by user_id and writes in Firestore batches (max 500 per commit).

    Returns the number of events successfully written.
    """
    db = _get_db()

    # Group events by user
    by_user: Dict[str, List[Dict[str, Any]]] = {}
    for evt in events:
        uid = evt["user_id"]
        by_user.setdefault(uid, []).append(evt)

    written = 0
    for uid, user_events in by_user.items():
        col_ref = db.collection("users").document(uid).collection("analytics")

        # Firestore batch limit is 500 writes
        for i in range(0, len(user_events), 500):
            chunk = user_events[i : i + 500]
            batch = db.batch()
            for evt in chunk:
                doc_ref = col_ref.document()
                batch.set(doc_ref, {
                    "event_type": evt["event_type"],
                    "event_data": evt["event_data"],
                    "timestamp": evt["timestamp"],
                    "user_id": uid,
                    "synced_at": int(time.time() * 1000),
                })
            batch.commit()
            written += len(chunk)

    return written


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

def get_user_stats(user_id: str, period: str = "month") -> Dict[str, Any]:
    """
    Aggregate analytics stats for a user over the given period.

    Period: "day", "week", "month", "year", "all"
    """
    db = _get_db()
    col_ref = db.collection("users").document(user_id).collection("analytics")

    cutoff = _period_cutoff(period)
    if cutoff:
        query = col_ref.where("timestamp", ">=", cutoff).stream()
    else:
        query = col_ref.stream()

    events: List[Dict[str, Any]] = []
    for doc in query:
        events.append(doc.to_dict())

    # Aggregate counters
    total_scans = 0
    items_added = 0
    items_consumed = 0
    items_expired = 0
    items_discarded = 0
    total_spent = 0.0

    for evt in events:
        et = evt.get("event_type", "")
        ed = evt.get("event_data", {})

        if et == "barcode_scanned":
            total_scans += 1
        elif et == "item_added":
            items_added += 1
            price = ed.get("price")
            if price and isinstance(price, (int, float)):
                total_spent += float(price)
        elif et == "item_consumed":
            reason = ed.get("reason", "used_up")
            if reason == "expired":
                items_expired += 1
            elif reason == "discarded":
                items_discarded += 1
            else:
                items_consumed += 1

    total_items = items_added if items_added else 1  # avoid division by zero
    waste_pct = round((items_expired + items_discarded) / total_items * 100, 1)

    return {
        "user_id": user_id,
        "period": period,
        "stats": {
            "total_scans": total_scans,
            "items_added": items_added,
            "items_consumed": items_consumed,
            "items_expired": items_expired,
            "items_discarded": items_discarded,
            "waste_percentage": waste_pct,
            "total_spent": round(total_spent, 2),
            "event_count": len(events),
        },
    }


# ---------------------------------------------------------------------------
# Inventory snapshot (for insights)
# ---------------------------------------------------------------------------

def get_user_inventory(user_id: str) -> List[Dict[str, Any]]:
    """Fetch all grocery_items for a user from Firestore."""
    db = _get_db()
    col_ref = db.collection("users").document(user_id).collection("grocery_items")
    items = []
    for doc in col_ref.stream():
        items.append(doc.to_dict())
    return items


def get_user_events(user_id: str, period: str = "month") -> List[Dict[str, Any]]:
    """Fetch analytics events for a user within a period."""
    db = _get_db()
    col_ref = db.collection("users").document(user_id).collection("analytics")
    cutoff = _period_cutoff(period)
    if cutoff:
        query = col_ref.where("timestamp", ">=", cutoff).stream()
    else:
        query = col_ref.stream()

    return [doc.to_dict() for doc in query]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _period_cutoff(period: str) -> Optional[int]:
    """Return epoch-millis cutoff for a period, or None for 'all'."""
    now = int(time.time() * 1000)
    mapping = {
        "day": 24 * 60 * 60 * 1000,
        "week": 7 * 24 * 60 * 60 * 1000,
        "month": 30 * 24 * 60 * 60 * 1000,
        "year": 365 * 24 * 60 * 60 * 1000,
    }
    delta = mapping.get(period)
    if delta:
        return now - delta
    return None
