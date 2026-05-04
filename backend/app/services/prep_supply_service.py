"""Preppers supply estimate — how many days the user's stockpile will feed
their household.

Inputs:
  - User's preppers_household composition (adults/youth/elderly + per-
    person daily-servings configurable defaults).
  - User's active prep batches (status="active") with `servings` per batch.

Output: total servings on hand, daily servings consumed by household,
days of supply, and a per-batch breakdown for transparency.

Beta scope: only counts active batches (preparing + ready phases) of the
preppers feature. Doesn't pull in regular grocery inventory. The basic
batch tracker stays open regardless of score (informational layer).

Phase P9 of preppers.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.services import prep_batch_service, user_service

logger = logging.getLogger(__name__)


def compute_supply_estimate(uid: str, now: Optional[datetime] = None) -> Dict[str, Any]:
    """Days of supply from active batches given the user's household.

    Returns:
      {
        days_of_supply: float | None,        # None when daily consumption is 0
        total_servings: int,                 # sum across active batches
        daily_consumption: float,            # servings/day from household
        household: {adults, youth, elderly, ...},
        active_batches_count: int,
        batches_breakdown: [
          { id, name, prep_type, servings, status, days_until_ready, days_until_expires }
        ],
        empty: bool,                         # True when no batches at all
        explanation: str,
      }
    """
    now = now or datetime.now(timezone.utc)
    household = user_service.get_preppers_household(uid)

    daily = (
        household["adults"] * household["servings_per_adult"]
        + household["youth"] * household["servings_per_youth"]
        + household["elderly"] * household["servings_per_elderly"]
    )

    batches = prep_batch_service.list_batches(uid, status_filter="active")
    total_servings = 0
    breakdown: List[Dict[str, Any]] = []
    for b in batches:
        servings = int(b.get("servings") or 0)
        total_servings += servings
        # Already ISO-8601 strings — parse for the deltas
        try:
            ready_at = datetime.fromisoformat(b["ready_at"].replace("Z", "+00:00"))
            expires_at = datetime.fromisoformat(b["expires_at"].replace("Z", "+00:00"))
        except (KeyError, ValueError):
            continue
        days_until_ready = max(0.0, (ready_at - now).total_seconds() / 86400.0)
        days_until_expires = (expires_at - now).total_seconds() / 86400.0
        breakdown.append({
            "id": b.get("id"),
            "name": b.get("name"),
            "prep_type": b.get("prep_type"),
            "servings": servings,
            "status": b.get("status"),
            "days_until_ready": round(days_until_ready, 1),
            "days_until_expires": round(days_until_expires, 1),
        })

    days_of_supply: Optional[float] = None
    if daily > 0 and total_servings > 0:
        days_of_supply = round(total_servings / daily, 1)

    empty = len(batches) == 0
    if empty:
        explanation = (
            "No active batches yet. Start a batch from a recipe or common "
            "preset to build up your stockpile."
        )
    elif daily <= 0:
        explanation = (
            "Set your household composition (adults / youth / elderly) to "
            "estimate days of supply."
        )
    elif days_of_supply is None:
        explanation = (
            "Active batches exist but none have servings counts yet. Edit "
            "a batch and set its servings to enable the estimate."
        )
    else:
        explanation = (
            f"At {daily:.1f} servings/day, {total_servings} servings across "
            f"{len(batches)} active batch{'es' if len(batches) != 1 else ''} "
            f"will feed your household for ~{days_of_supply:.1f} days."
        )

    return {
        "days_of_supply": days_of_supply,
        "total_servings": total_servings,
        "daily_consumption": round(daily, 2),
        "household": household,
        "active_batches_count": len(batches),
        "batches_breakdown": breakdown,
        "empty": empty,
        "explanation": explanation,
    }
