"""Currency conversion at save time. Wraps fx_rate_service.

Plan: catalog_evolution.md §5. Save-time conversion locks the FX rate so
"what I paid in May reads as what I paid in May" — display_amount stays
stable even if rates fluctuate later.

Returns a dict that's safe to spread into an event_data document, even when
inputs are missing (None price, None currency). Callers should not crash on
missing fields.
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
