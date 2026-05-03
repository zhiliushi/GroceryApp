"""Recipe finance — per-ingredient pricing from the user's recent buy history.

F1 (base finance): for every recipe ingredient that resolves to a catalog
entry (via Phase-0 auto-match), look up the user's most recent purchase
event for that catalog and surface its display-currency price as the
"last-paid" reference. Sum of last-paid prices is the recipe's
approximate total cost (with disclaimer — it's not portion-aware).

The richer "weight × unit_price" math is intentionally deferred to
homemaker (snapshot_finance per revision) — see the project memory tier
vision. For F1 base we just expose the last-paid amount; cooks read
"egg: RM 0.50 last paid 2 weeks ago" and mentally adjust for portion.

Doesn't depend on homemaker — F1 is a base feature for ALL users.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

logger = logging.getLogger(__name__)


def _db():
    return firestore.client()


def _user_purchases_ref(uid: str):
    return _db().collection("users").document(uid).collection("purchases")


def _user_currency_pref(uid: str) -> str:
    snap = _db().collection("users").document(uid).get()
    if not snap.exists:
        return "SGD"
    return (snap.to_dict() or {}).get("currency_preference") or "SGD"


def get_recent_price(uid: str, catalog_name_norm: str) -> Optional[Dict[str, Any]]:
    """Most-recent purchase event with a price for the given catalog name.

    Returns None when:
      - The user has never purchased this catalog entry.
      - All matching purchases have null price (e.g. gift-received items).
      - Currency conversion to user's preference fails (rare; fx-table miss).

    Returned dict shape:
      {
        currency: str,           # user's display currency at read-time
        display_amount: float,   # most-recent paid price, in display currency
        date_bought: str | None, # ISO 8601 if datetime, else None
        pack_size: float | None, # raw pack_size (null if not stored on event)
        base_unit: str | None,   # for future homemaker weight × price math
      }
    """
    if not catalog_name_norm:
        return None
    from app.services import currency_service

    user_pref = _user_currency_pref(uid)
    q = (
        _user_purchases_ref(uid)
        .where(filter=FieldFilter("catalog_name_norm", "==", catalog_name_norm))
    )

    best: Optional[Dict[str, Any]] = None
    best_date: Optional[datetime] = None
    for doc in q.stream():
        data = doc.to_dict() or {}
        amount = currency_service.display_amount_for_user(data, user_pref)
        if amount is None:
            continue
        # Resolve a comparable date — prefer date_bought (purchase time);
        # fall back to created_at if missing.
        raw_date = data.get("date_bought") or data.get("created_at")
        if raw_date is None:
            continue
        if hasattr(raw_date, "to_datetime"):
            raw_date = raw_date.to_datetime()
        if not isinstance(raw_date, datetime):
            continue
        # Normalise to aware UTC for safe comparisons
        if raw_date.tzinfo is None:
            raw_date = raw_date.replace(tzinfo=timezone.utc)
        if best_date is None or raw_date > best_date:
            best_date = raw_date
            best = {
                "currency": user_pref,
                "display_amount": float(amount),
                "date_bought": raw_date.isoformat(),
                "pack_size": data.get("pack_size"),
                "base_unit": data.get("base_unit"),
            }
    return best


def estimate_recipe_cost(
    uid: str, ingredients: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Compute the recipe's approximate total + per-ingredient last-paid lines.

    For each ingredient with a `catalog_name_norm` (Phase-0 auto-match),
    look up the most-recent purchase price and add it as a line. Lines for
    common-only matches OR free-text fall through with `last_paid: None`
    (the user hasn't bought that thing in their history yet).

    Total is the sum of available lines. `total_is_partial` flags when
    any line is missing — UI should show "≈ RM 12 (4 of 6 priced)".
    """
    user_pref = _user_currency_pref(uid)
    lines: List[Dict[str, Any]] = []
    total = 0.0
    priced = 0
    total_lines = 0

    for ing in ingredients or []:
        if not isinstance(ing, dict):
            continue
        total_lines += 1
        name = ing.get("name") or ""
        cnn = ing.get("catalog_name_norm") or None
        common = ing.get("common_name_norm") or None
        match_source = ing.get("match_source") or "free_text"

        line: Dict[str, Any] = {
            "name": name,
            "catalog_name_norm": cnn,
            "common_name_norm": common,
            "match_source": match_source,
            "last_paid": None,
            "date_bought": None,
        }

        if cnn:
            recent = get_recent_price(uid, cnn)
            if recent is not None:
                line["last_paid"] = round(recent["display_amount"], 2)
                line["date_bought"] = recent["date_bought"]
                line["pack_size"] = recent.get("pack_size")
                line["base_unit"] = recent.get("base_unit")
                total += recent["display_amount"]
                priced += 1

        lines.append(line)

    return {
        "currency": user_pref,
        "total_cost": round(total, 2) if priced else None,
        "total_is_partial": priced < total_lines,
        "priced_count": priced,
        "total_count": total_lines,
        "lines": lines,
        "disclaimer": (
            "Approximate — uses your most-recent paid price per ingredient. "
            "Not portion-aware (1 egg or 2, same line)."
        ),
    }


def estimate_for_recipe(uid: str, recipe_id: str) -> Optional[Dict[str, Any]]:
    """Convenience: load the recipe doc and return `estimate_recipe_cost`
    on its ingredients. None if the recipe doesn't exist."""
    doc = (
        _db().collection("users").document(uid)
        .collection("recipes").document(recipe_id).get()
    )
    if not doc.exists:
        return None
    data = doc.to_dict() or {}
    return estimate_recipe_cost(uid, data.get("ingredients") or [])
