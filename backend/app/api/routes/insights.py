"""Insights API — user milestone + AI-generated insights.

Backed by Firestore: `users/{uid}/insights/{insightId}`. Scheduler job
`check_milestones` writes milestone docs when user crosses 50/100/500/1000
total purchases.

GET /api/insights               — list active insights (not dismissed)
GET /api/insights/{insight_id}  — single insight
POST /api/insights/{insight_id}/dismiss — mark dismissed
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import firestore

from app.core.auth import UserInfo, get_current_user
from app.core.feature_flags import is_enabled
from app.core.metadata import apply_update_metadata

logger = logging.getLogger(__name__)

router = APIRouter()


def _db():
    return firestore.client()


def _user_insights_ref(uid: str):
    return _db().collection("users").document(uid).collection("insights")


@router.get("")
async def list_insights(user: UserInfo = Depends(get_current_user)):
    """List the authenticated user's insights. Most recent first."""
    # Gate behind `insights` flag — return empty list when flag is off
    if not is_enabled("insights"):
        return {"count": 0, "insights": []}

    q = _user_insights_ref(user.uid)
    items = []
    for doc in q.stream():
        data = doc.to_dict() or {}
        if data.get("dismissed_at"):
            continue
        data["id"] = doc.id
        items.append(data)
    # Sort newest first
    items.sort(
        key=lambda x: (
            x.get("created_at") or datetime.min.replace(tzinfo=timezone.utc)
        ),
        reverse=True,
    )
    return {"count": len(items), "insights": items}


@router.get("/{insight_id}")
async def get_insight(insight_id: str, user: UserInfo = Depends(get_current_user)):
    """Get a single insight."""
    snap = _user_insights_ref(user.uid).document(insight_id).get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Insight not found")
    data = snap.to_dict() or {}
    data["id"] = snap.id
    return data


@router.post("/{insight_id}/dismiss")
async def dismiss_insight(insight_id: str, user: UserInfo = Depends(get_current_user)):
    """Mark an insight as dismissed so it no longer surfaces on the dashboard."""
    doc_ref = _user_insights_ref(user.uid).document(insight_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Insight not found")
    doc_ref.update(apply_update_metadata({"dismissed_at": firestore.SERVER_TIMESTAMP}))
    logger.info("insight.dismissed user=%s id=%s", user.uid, insight_id)
    return {"success": True, "id": insight_id}
