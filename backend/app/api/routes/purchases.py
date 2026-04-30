"""Purchase event API — core add-item flow for the refactored model.

POST   /api/purchases                      — Create purchase (core add-item flow)
GET    /api/purchases                      — List purchase events (filter by status/location/catalog)
GET    /api/purchases/{event_id}           — Get a single event
PATCH  /api/purchases/{event_id}           — Partial update (quantity, expiry, price, location)
POST   /api/purchases/{event_id}/status    — Change status (used / thrown / transferred)
POST   /api/purchases/{event_id}/move      — Move to another location (supports partial split)
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
    PurchaseMoveRequest,
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
        store_id=data.store_id,
        source="api",
    )
    background_tasks.add_task(_check_milestones_safe, user.uid)
    return event


@router.post("/multi-pack", dependencies=[Depends(rate_limit(60))])
async def create_multi_pack(
    body: dict,
    background_tasks: BackgroundTasks,
    user: UserInfo = Depends(get_current_user),
):
    """Create N events sharing a `multi_pack_parent_id` (catalog_evolution.md §2.2 #5).

    Body: {
      name: str,
      pack_count: int,
      units_per_pack: int,
      price_per_pack: float | null,
      currency: str | null,
      barcode: str | null,
      expiry_raw: str | null,
      expiry_date: ISO str | null,
      location: str | null,
      base_unit_label: str | null,
    }
    """
    from app.core.exceptions import ValidationError
    from datetime import datetime

    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    try:
        pack_count = int(body.get("pack_count") or 0)
        units_per_pack = int(body.get("units_per_pack") or 0)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="pack_count and units_per_pack must be integers")

    expiry_date = None
    if body.get("expiry_date"):
        try:
            expiry_date = datetime.fromisoformat(str(body["expiry_date"]).replace("Z", "+00:00"))
        except Exception:
            raise HTTPException(status_code=400, detail="expiry_date must be ISO-8601")

    try:
        result = purchase_event_service.create_multi_pack(
            user_id=user.uid,
            name=name,
            pack_count=pack_count,
            units_per_pack=units_per_pack,
            price_per_pack=body.get("price_per_pack"),
            currency=body.get("currency"),
            barcode=body.get("barcode"),
            expiry_raw=body.get("expiry_raw"),
            expiry_date=expiry_date,
            location=body.get("location"),
            base_unit_label=body.get("base_unit_label"),
            store_id=body.get("store_id"),
        )
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    background_tasks.add_task(_check_milestones_safe, user.uid)
    return result


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
    """Transition status from `active` to a terminal state (used / thrown / transferred).

    Optional `quantity` enables partial actions — see PurchaseStatusUpdate docstring.
    """
    return purchase_event_service.update_status(
        user_id=user.uid,
        event_id=event_id,
        status=data.status,
        reason=data.reason,
        transferred_to=data.transferred_to,
        quantity=data.quantity,
    )


@router.post("/{event_id}/move", dependencies=[Depends(rate_limit(60))])
async def move_purchase(
    event_id: str,
    data: PurchaseMoveRequest,
    user: UserInfo = Depends(get_current_user),
):
    """Move the event to a different storage location.

    Optional `quantity` enables partial moves: when 0 < quantity < event.quantity,
    the event is split — a new active event is created at the target location
    with the portion (with `split_from_event_id` lineage), and the original
    event is decremented and stays at its current location.
    """
    return purchase_event_service.move_to_location(
        user_id=user.uid,
        event_id=event_id,
        location=data.location,
        quantity=data.quantity,
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
