"""Waste + spending aggregations and health-score endpoints.

GET /api/waste/summary?period=month       — Thrown items aggregation (top wasted, total value)
GET /api/waste/spending?period=month      — Cash vs card spending totals
GET /api/waste/health-score               — Overall inventory health (0-100) with breakdown
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query

from app.core.auth import UserInfo, get_current_user
from app.core.feature_flags import require_flag
from app.services import waste_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/summary")
async def waste_summary(
    period: str = Query("month", description="week | month | year | all"),
    user: UserInfo = Depends(get_current_user),
):
    """Thrown items aggregated over a period. Top-10 wasted catalog entries."""
    return waste_service.get_waste_summary(user.uid, period=period)


@router.get("/spending")
async def spending_summary(
    period: str = Query("month", description="week | month | year | all"),
    user: UserInfo = Depends(get_current_user),
):
    """Spending totals (cash/card/untracked) over a period."""
    return waste_service.get_spending_summary(user.uid, period=period)


@router.get("/financial-summary", dependencies=[require_flag("financial_tracking")])
async def financial_summary(
    period: str = Query("month", description="week | month | year | all"),
    user: UserInfo = Depends(get_current_user),
):
    """Per-catalog spent-vs-wasted comparison.

    Returns one row per catalog entry purchased in the period with
    total_spent, thrown_value, waste_pct, waste_value_pct. Sorted by
    thrown_value DESC so high-waste items surface first. Grand totals
    (spent / wasted / waste %) in the top-level response.

    Gated by the `financial_tracking` feature flag.
    """
    return waste_service.get_financial_summary(user.uid, period=period)


@router.get("/health-score")
async def health_score(
    no_cache: bool = Query(False, description="bypass 5min cache"),
    user: UserInfo = Depends(get_current_user),
):
    """Inventory health score (0-100) with per-bucket breakdown.

    See docs/HEALTH_SCORE.md for formula. Wrapped in a last-ditch try/except
    so the frontend always gets JSON (blank-but-valid) instead of a 500 —
    the HealthBar component renders "Could not compute health score." on any
    error, which is unhelpful when the real cause is transient.
    """
    try:
        return waste_service.compute_health_score(user.uid, use_cache=not no_cache)
    except Exception as exc:  # noqa: BLE001 — we truly want to swallow anything
        logger.exception("health_score endpoint: unrecoverable error for uid=%s", user.uid)
        return {
            "score": 100,
            "grade": "green",
            "components": {
                "active_healthy": 0,
                "active_expiring_7d": 0,
                "active_expiring_3d": 0,
                "active_expired": 0,
                "active_untracked": 0,
                "thrown_this_month": 0,
                "used_this_month": 0,
            },
            "waste_rate_month": 0.0,
            "computed_at": None,
            "error": str(exc),
        }
