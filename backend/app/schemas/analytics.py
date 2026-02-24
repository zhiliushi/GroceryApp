from pydantic import BaseModel, field_validator
from typing import List, Dict, Any, Optional
from enum import Enum


# ---------------------------------------------------------------------------
# Analytics Batch Sync
# ---------------------------------------------------------------------------

class AnalyticsEvent(BaseModel):
    event_type: str
    event_data: Dict[str, Any]
    timestamp: int  # epoch millis
    user_id: str


class AnalyticsBatchRequest(BaseModel):
    events: List[AnalyticsEvent]

    @field_validator("events")
    @classmethod
    def events_not_empty(cls, v: list) -> list:
        if not v:
            raise ValueError("Events list must not be empty")
        if len(v) > 500:
            raise ValueError("Batch size cannot exceed 500 events")
        return v


class AnalyticsBatchResponse(BaseModel):
    success: bool
    synced_count: int


# ---------------------------------------------------------------------------
# Analytics Stats
# ---------------------------------------------------------------------------

class AnalyticsStatsResponse(BaseModel):
    user_id: str
    period: str
    stats: Dict[str, Any]


# ---------------------------------------------------------------------------
# AI Insights
# ---------------------------------------------------------------------------

class InsightPriority(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class InsightCategory(str, Enum):
    WASTE = "waste_reduction"
    SHOPPING = "shopping_optimization"
    NUTRITION = "nutrition"
    BUDGET = "budget"
    EXPIRY = "expiry_warning"


class Insight(BaseModel):
    title: str
    description: str
    priority: InsightPriority
    category: InsightCategory


class InsightsResponse(BaseModel):
    insights: List[Insight]
    generated_at: int  # epoch millis
