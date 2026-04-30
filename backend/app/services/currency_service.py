"""Currency conversion — both save-time (locked) and read-time (live).

Plan: catalog_evolution.md §5 originally specified save-time-locked display
amounts. Real-feedback iteration showed users expect changing the display
currency preference to update past events too — they don't care about the
"what I paid in original currency-X back then" audit trail; they want their
dashboard in their currency.

Two flows:
  - convert_to_display(...): save-time lock. Stamps event at create.
  - display_amount_for_user(...): read-time conversion using the user's
    CURRENT currency_preference + current FX rate. Catalog overview, spending
    summaries, and price-history aggregations all use this to honor a
    preference change without a backfill.

Source-of-truth chain at runtime:
  1. event.amount + event.currency  (what the user actually paid)
  2. fx_rate_service.get_rate(currency, user_pref)  (current rate)
  3. user_pref override of event.display_currency
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from app.services import fx_rate_service


def convert_to_display(
    amount: Optional[float],
    from_currency: Optional[str],
    to_currency: str,
    date: Optional[datetime] = None,
) -> dict:
    """Compute display fields for a price entry.

    Returns:
        {
          display_amount: float | None,
          display_currency: str,
          fx_rate_at_save: float | None,
          fx_rate_date: str (YYYY-MM-DD),
          is_stale: bool,
        }

    Behavior:
      - amount is None or from_currency is missing → display_amount = amount,
        fx_rate = None (no conversion possible; left for backfill)
      - currencies match → display_amount = amount, fx_rate = 1.0
      - cross-currency → fetch rate (cached/API/stale), apply, return
      - all paths fall back gracefully; never raises on FX failure
    """
    target_date = date or datetime.now(timezone.utc)
    date_str = target_date.strftime("%Y-%m-%d")

    if amount is None or not from_currency:
        return {
            "display_amount": amount,
            "display_currency": to_currency,
            "fx_rate_at_save": None,
            "fx_rate_date": date_str,
            "is_stale": False,
        }

    if from_currency == to_currency:
        return {
            "display_amount": amount,
            "display_currency": to_currency,
            "fx_rate_at_save": 1.0,
            "fx_rate_date": date_str,
            "is_stale": False,
        }

    rate_info = fx_rate_service.get_rate(from_currency, to_currency, target_date)
    rate = rate_info.get("rate")
    if rate is None:
        return {
            "display_amount": None,
            "display_currency": to_currency,
            "fx_rate_at_save": None,
            "fx_rate_date": date_str,
            "is_stale": False,
        }
    return {
        "display_amount": amount * rate,
        "display_currency": to_currency,
        "fx_rate_at_save": rate,
        "fx_rate_date": rate_info.get("date") or date_str,
        "is_stale": rate_info.get("is_stale", False),
    }


def display_amount_for_user(
    event: dict,
    user_currency_pref: str,
) -> Optional[float]:
    """Read-time conversion: amount → user's current display currency.

    Uses event.amount + event.currency as the source of truth and converts
    via fx_rate_service at the CURRENT rate. Falls back to the event's
    stored display_amount only when its display_currency happens to match
    the user's current preference (safe pass-through).

    Returns None when no convertible amount is available (no price recorded,
    or FX unavailable for the pair).
    """
    amount = event.get("amount")
    if amount is None:
        amount = event.get("price")
    currency = event.get("currency")
    if amount is None:
        return None
    try:
        amount = float(amount)
    except (TypeError, ValueError):
        return None
    if not currency:
        # No currency tag → can only return the raw value if user pref matches
        # the event's stored display_currency. Otherwise we can't convert.
        if event.get("display_currency") == user_currency_pref and event.get("display_amount") is not None:
            try:
                return float(event["display_amount"])
            except (TypeError, ValueError):
                return None
        return None
    if currency == user_currency_pref:
        return amount
    rate_info = fx_rate_service.get_rate(currency, user_currency_pref)
    rate = rate_info.get("rate")
    if rate is not None:
        return amount * rate
    # Fallback: stored display fields if they happen to match the pref already
    if event.get("display_currency") == user_currency_pref and event.get("display_amount") is not None:
        try:
            return float(event["display_amount"])
        except (TypeError, ValueError):
            return None
    return None
