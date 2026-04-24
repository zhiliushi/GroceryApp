"""Purchase event API — core add-item flow for the refactored model.

POST   /api/purchases                      — Create purchase (core add-item flow)
GET    /api/purchases                      — List purchase events (filter by status/location/catalog)
GET    /api/purchases/{event_id}           — Get a single event
PATCH  /api/purchases/{event_id}           — Partial update (quantity, expiry, price, location)
POST   /api/purchases/{event_id}/status    — Change status (used / thrown / transferred)
DELETE /api/purchases/{event_id}           — Hard delete (rare — prefer status change)
POST   /api/purchases/consume              — FIFO consume by catalog name (mark oldest as used)
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query

from app.core.auth import UserInfo, get_current_user
from app.core.rate_limit import rate_limit
from app.schemas.purchase import (
    PurchaseCreate,
    PurchaseStatusUpdate,
    PurchaseUpdate,
)
from app.services import insights_service, purchase_event_service

logger = logging.getLogger(__name__)

router = APIRouter()


def _check_milestones_safe(uid: str) -> None:
    """Wrapper that swallows exceptions — fire-and-forget after purchase create."""
    try:
        insights_service.check_user_milestones(uid)
    except Exception as exc:
        logger.warning("background: check_user_milestones failed for uid=%s: %s", uid, exc)


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

@router.post("", dependencies=[Depends(rate_limit(60))])
async def create_purchase(
    data: PurchaseCreate,
    background_tasks: BackgroundTasks,
    user: UserInfo = Depends(get_current_user),
):
    """Create a purchase event. Transactionally upserts catalog + increments counters.

    Either `name` (creates/uses catalog) OR `catalog_name_norm` (existing catalog) required.

    Side effect: after response is sent, `insights_service.check_user_milestones`
    runs as a background task to emit 50/100/500/1000 milestone insights without
    blocking the response.
    """
    event = purchase_event_service.create_purchase(
        user_id=user.uid,
        name=data.name,
        catalog_name_norm=data.catalog_name_norm,
        barcode=data.barcode,
        quantity=data.quantity,
        unit=data.unit,
        expiry_raw=data.expiry_raw,
        expiry_date=data.expiry_date,
        price=data.price,
        currency=data.currency,
        payment_method=data.payment_method,
        date_bought=data.date_bought,
        location=data.location,
        source="api",
    )
    background_tasks.add_task(_check_milestones_safe, user.uid)
    return event


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

@router.get("")
async def list_purchases(
    status: Optional[str] = Query(None, description="active | used | thrown | transferred"),
    location: Optional[str] = Query(None),
    catalog_name_norm: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    cursor: Optional[str] = Query(None, description="opaque cursor from previous response's next_cursor"),
    user: UserInfo = Depends(get_current_user),
):
    """List the authenticated user's purchase events with cursor pagination.

    Response: `{count, items, next_cursor}`. Most recent first (by `date_bought`).
    `next_cursor` is null when no further pages exist.
    """
    return purchase_event_service.list_purchases(
        user_id=user.uid,
        status=status,
        location=location,
        catalog_name_norm=catalog_name_norm,
        limit=limit,
        cursor=cursor,
    )


@router.get("/{event_id}")
async def get_purchase(event_id: str, user: UserInfo = Depends(get_current_user)):
    """Get a single purchase event."""
    event = purchase_event_service.get_purchase(user.uid, event_id)
    if not event:
        raise HTTPException(status_code=404, detail=f"Purchase event '{event_id}' not found")
    return event


# ---------------------------------------------------------------------------
# Update — partial + status transitions
# ---------------------------------------------------------------------------

@router.patch("/{event_id}", dependencies=[Depends(rate_limit(60))])
async def update_purchase(
    event_id: str,
    data: PurchaseUpdate,
    user: UserInfo = Depends(get_current_user),
):
    """Partial update. Does NOT change status — use POST /status for that."""
    updates = data.model_dump(exclude_unset=True)
    return purchase_event_service.update_purchase(user.uid, event_id, updates)


@router.post("/{event_id}/status", dependencies=[Depends(rate_limit(60))])
async def change_status(
    event_id: str,
    data: PurchaseStatusUpdate,
    user: UserInfo = Depends(get_current_user),
):
    """Transition status from `active` to a terminal state (used / thrown / transferred)."""
    return purchase_event_service.update_status(
        user_id=user.uid,
        event_id=event_id,
        status=data.status,
        reason=data.reason,
        transferred_to=data.transferred_to,
    )


# ---------------------------------------------------------------------------
# FIFO consume
# ---------------------------------------------------------------------------

@router.post("/consume", dependencies=[Depends(rate_limit(60))])
async def consume_by_catalog(
    body: dict,
    user: UserInfo = Depends(get_current_user),
):
    """FIFO consume — mark the oldest-expiry active event for a catalog entry as used.

    Body: {"catalog_name_norm": "milk", "quantity": 1}
    """
    catalog_name_norm = (body or {}).get("catalog_name_norm")
    if not catalog_name_norm:
        raise HTTPException(status_code=400, detail="catalog_name_norm is required")
    quantity = int((body or {}).get("quantity", 1))
    return purchase_event_service.consume_one_by_catalog(user.uid, catalog_name_norm, quantity)


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

@router.delete("/{event_id}", dependencies=[Depends(rate_limit(60))])
async def delete_purchase(event_id: str, user: UserInfo = Depends(get_current_user)):
    """Hard-delete a purchase event. Prefer status=thrown to preserve history."""
    purchase_event_service.delete_purchase(user.uid, event_id)
    return {"success": True, "id": event_id}
