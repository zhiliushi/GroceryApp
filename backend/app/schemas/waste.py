"""Pydantic schemas for waste stats and health score."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class HealthComponents(BaseModel):
    """Breakdown of items by state."""

    active_healthy: int
    active_expiring_7d: int       # 4-7 days out
    active_expiring_3d: int       # <=3 days out
    active_expired: int           # past expiry but still status=active
    active_untracked: int         # no expiry, age > 7 days
    thrown_this_month: int
    used_this_month: int


class HealthScore(BaseModel):
    """Overall inventory health score (0-100) + components."""

    score: int                    # 0-100
    grade: str                    # "green" | "yellow" | "red"
    components: HealthComponents
    waste_rate_month: float       # 0..1 — thrown / (used+thrown) this month
    computed_at: datetime


class WasteSummaryItem(BaseModel):
    """One item's waste stats for a period."""

    catalog_name_norm: str
    display_name: str
    count: int
    total_value: float            # sum of prices


class WasteSummary(BaseModel):
    """Waste aggregation for a period (month / week / all)."""

    period: str                   # "month" | "week" | "year" | "all"
    from_date: datetime
    to_date: datetime
    thrown_count: int
    thrown_value: float
    top_wasted: list[WasteSummaryItem]
