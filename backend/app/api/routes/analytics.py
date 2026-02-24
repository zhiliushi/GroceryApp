"""
Analytics API routes.

POST /api/analytics/batch           — Batch sync events from mobile app
POST /api/analytics/sync            — Legacy sync endpoint (kept for compat)
GET  /api/analytics/stats/{user_id} — Aggregated stats
GET  /api/analytics/insights/{user_id} — AI-powered insights
"""

import logging
import time

from fastapi import APIRouter, HTTPException
from typing import Optional

from app.schemas.analytics import (
    AnalyticsBatchRequest,
    AnalyticsBatchResponse,
    AnalyticsStatsResponse,
    InsightsResponse,
)
from app.services import analytics_service, insights_service

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Batch Sync
# ---------------------------------------------------------------------------

@router.post("/batch", response_model=AnalyticsBatchResponse)
async def batch_sync(request: AnalyticsBatchRequest):
    """
    Receive a batch of analytics events from the mobile app and store in Firestore.

    Events are grouped by user_id and written in Firestore batches.
    Max 500 events per request.
    """
    try:
        events = [evt.model_dump() for evt in request.events]
        synced = analytics_service.sync_events(events)
        return AnalyticsBatchResponse(success=True, synced_count=synced)
    except Exception as e:
        logger.error("Batch sync failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Error syncing analytics: {e}")


# ---------------------------------------------------------------------------
# Legacy Sync (matches mobile app's POST /api/analytics/sync)
# ---------------------------------------------------------------------------

@router.post("/sync")
async def sync_analytics(request: AnalyticsBatchRequest):
    """
    Legacy sync endpoint — same as /batch.
    Kept for backward compatibility with the mobile app's SyncService.
    """
    try:
        events = [evt.model_dump() for evt in request.events]
        synced = analytics_service.sync_events(events)
        return {
            "success": True,
            "synced_count": synced,
            "message": f"Synced {synced} analytics records",
        }
    except Exception as e:
        logger.error("Sync failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Error syncing analytics: {e}")


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@router.get("/stats/{user_id}", response_model=AnalyticsStatsResponse)
async def get_stats(user_id: str, period: Optional[str] = "month"):
    """
    Get aggregated analytics stats for a user.

    Period: day, week, month, year, all
    """
    if period not in ("day", "week", "month", "year", "all"):
        raise HTTPException(status_code=400, detail="Invalid period. Use: day, week, month, year, all")

    try:
        result = analytics_service.get_user_stats(user_id, period)
        return AnalyticsStatsResponse(
            user_id=result["user_id"],
            period=result["period"],
            stats=result["stats"],
        )
    except Exception as e:
        logger.error("Stats fetch failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Error fetching stats: {e}")


# ---------------------------------------------------------------------------
# AI Insights
# ---------------------------------------------------------------------------

@router.get("/insights/{user_id}", response_model=InsightsResponse)
async def get_insights(user_id: str, period: Optional[str] = "month"):
    """
    Generate AI-powered insights for a user's grocery habits.

    Uses Ollama/OpenAI when available, falls back to rule-based heuristics.
    """
    if period not in ("day", "week", "month", "year", "all"):
        raise HTTPException(status_code=400, detail="Invalid period. Use: day, week, month, year, all")

    try:
        events = analytics_service.get_user_events(user_id, period)
        inventory = analytics_service.get_user_inventory(user_id)
        insights = await insights_service.generate_insights(events, inventory)

        return InsightsResponse(
            insights=insights,
            generated_at=int(time.time() * 1000),
        )
    except Exception as e:
        logger.error("Insights generation failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Error generating insights: {e}")
