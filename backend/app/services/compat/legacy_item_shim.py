"""Legacy shape translator — converts between old `grocery_items` shape and new
`catalog_entries + purchases` model.

Purpose: existing mobile app queries `/api/inventory/my` and expects responses
with legacy field names (name, barcode, expiryDate in ms, status values like
'consumed'/'discarded'). This module lets the new backend produce those shapes
from the new data model without mobile-side changes.

Remove once mobile app migrates — see docs/FUTURE_MOBILE_REFACTOR.md.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional


# Status mapping: new model → legacy model
_NEW_TO_LEGACY_STATUS = {
    "active": "active",
    "used": "consumed",
    "thrown": "expired",       # default, overridden by reason below
    "transferred": "discarded",
}

# Legacy → new mapping (for writes)
_LEGACY_TO_NEW_STATUS = {
    "active": ("active", None),
    "consumed": ("used", "used_up"),
    "expired": ("thrown", "expired"),
    "discarded": ("thrown", "bad"),
}


def new_event_to_legacy_item(event: dict) -> dict:
    """Convert a new-model purchase event to legacy grocery_items shape.

    Handles:
    - field renames (catalog_display → name, expiry_date → expiryDate in ms)
    - status mapping (used → consumed, thrown+expired → expired, thrown+bad → discarded)
    - Timestamp conversion (datetime → epoch ms)
    """
    # Determine legacy status
    new_status = event.get("status", "active")
    reason = event.get("consumed_reason")

    if new_status == "thrown" and reason == "bad":
        legacy_status = "discarded"
    elif new_status == "thrown" and reason == "gift":
        legacy_status = "discarded"  # best-effort; legacy has no "gift" concept
    else:
        legacy_status = _NEW_TO_LEGACY_STATUS.get(new_status, "active")

    return {
        "id": event.get("id"),
        "user_id": event.get("user_id") or "",  # caller passes uid
        "name": event.get("catalog_display") or event.get("catalog_name_norm", ""),
        "barcode": event.get("barcode"),
        "quantity": int(event.get("quantity", 1)) if event.get("quantity") is not None else 1,
        "location": event.get("location"),
        "status": legacy_status,
        "expiryDate": _dt_to_ms(event.get("expiry_date")),
        "expiry_date": _dt_to_ms(event.get("expiry_date")),  # both keys — app uses either
        "addedDate": _dt_to_ms(event.get("date_bought")),
        "added_date": _dt_to_ms(event.get("date_bought")),
        "purchase_date": _dt_to_ms(event.get("date_bought")),
        "purchaseDate": _dt_to_ms(event.get("date_bought")),
        "consumed_date": _dt_to_ms(event.get("consumed_date")),
        "consumedDate": _dt_to_ms(event.get("consumed_date")),
        "price": event.get("price"),
        "category": None,  # purchase events don't store this; could look up catalog
        "source": event.get("source", "migration"),
        "reason": reason,
        "needsReview": False,  # purchase events don't flag individually; catalog does
        "expiry_past": event.get("expiry_past", False),
        "updatedAt": _dt_to_ms(event.get("updated_at")),
    }


def legacy_item_to_new_purchase_payload(legacy: dict) -> dict:
    """Convert a legacy grocery_items payload to new-model purchase create args.

    Used when old mobile client POSTs to a legacy endpoint — the shim
    translates the payload before calling purchase_event_service.create_purchase.
    """
    # Extract status + reason
    legacy_status = legacy.get("status", "active")
    new_status, reason = _LEGACY_TO_NEW_STATUS.get(legacy_status, ("active", None))

    return {
        "name": legacy.get("name"),
        "barcode": legacy.get("barcode"),
        "quantity": float(legacy.get("quantity", 1)),
        "expiry_date": _ms_to_dt(legacy.get("expiryDate") or legacy.get("expiry_date")),
        "price": legacy.get("price"),
        "date_bought": _ms_to_dt(legacy.get("purchaseDate") or legacy.get("addedDate")),
        "location": legacy.get("location"),
        # Status not set here — status is set by separate endpoint call in legacy flow
    }


def _dt_to_ms(dt: Any) -> Optional[int]:
    """Convert datetime to epoch milliseconds. Accepts datetime, Timestamp, or None."""
    if dt is None:
        return None
    if hasattr(dt, "to_datetime"):
        dt = dt.to_datetime()
    if isinstance(dt, datetime):
        return int(dt.timestamp() * 1000)
    if isinstance(dt, (int, float)):
        return int(dt)
    return None


def _ms_to_dt(ms: Any) -> Optional[datetime]:
    """Convert epoch milliseconds to datetime. Accepts int/float/None."""
    if ms is None:
        return None
    if isinstance(ms, datetime):
        return ms
    try:
        return datetime.fromtimestamp(float(ms) / 1000.0)
    except (TypeError, ValueError):
        return None
