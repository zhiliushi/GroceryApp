"""User-side shopping-list routes.

Mounted at /api/shopping-lists/*. The authenticated user's uid comes from
`get_current_user` — never from the URL — so a user can only see and
mutate their own lists. Cross-user admin routes stay at
`/api/admin/shopping-lists/*` in admin.py.

See `.claude/docs/pages/shopping-lists.md` for the v2 design.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.auth import UserInfo, get_current_user
from app.services import shopping_list_service

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CreateListRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)


class UpdateListRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=80)


class ItemRequest(BaseModel):
    """Add or fully-replace an item. PATCH passes a partial subset."""
    item_name: str = Field(..., min_length=1, max_length=120)
    quantity: Optional[float] = None
    unit: Optional[str] = None
    weight_value: Optional[float] = None
    weight_unit: Optional[str] = None
    volume_value: Optional[float] = None
    volume_unit: Optional[str] = None
    notes: Optional[str] = None
    barcode: Optional[str] = None
    source_catalog_name_norm: Optional[str] = None
    source: Optional[str] = "manual"  # 'manual' | 'catalog' | 'scan' | 'cross_page'


class ItemPatchRequest(BaseModel):
    item_name: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    weight_value: Optional[float] = None
    weight_unit: Optional[str] = None
    volume_value: Optional[float] = None
    volume_unit: Optional[str] = None
    notes: Optional[str] = None
    barcode: Optional[str] = None


class AddPriceRequest(BaseModel):
    price: float = Field(..., gt=0)
    currency: Optional[str] = "SGD"
    brand: Optional[str] = None
    store_name: Optional[str] = None
    barcode: Optional[str] = None


# ---------------------------------------------------------------------------
# Lists
# ---------------------------------------------------------------------------

@router.get("")
async def list_lists(user: UserInfo = Depends(get_current_user)):
    """Get all shopping lists for the authenticated user."""
    lists = shopping_list_service.get_user_lists(user.uid)
    return {"count": len(lists), "lists": lists}


@router.post("", status_code=201)
async def create_list(body: CreateListRequest, user: UserInfo = Depends(get_current_user)):
    """Create a new shopping list."""
    return shopping_list_service.create_list(user.uid, body.name)


@router.get("/{list_id}")
async def get_list(list_id: str, user: UserInfo = Depends(get_current_user)):
    """Get a list and its items."""
    list_doc = shopping_list_service.get_list_or_404(user.uid, list_id)
    items = shopping_list_service.get_list_items(user.uid, list_id)
    return {"list": list_doc, "items": items}


@router.patch("/{list_id}")
async def update_list(
    list_id: str,
    body: UpdateListRequest,
    user: UserInfo = Depends(get_current_user),
):
    """Rename a list."""
    return shopping_list_service.update_list(user.uid, list_id, name=body.name)


@router.delete("/{list_id}", status_code=204)
async def delete_list(list_id: str, user: UserInfo = Depends(get_current_user)):
    """Delete a list and cascade its items."""
    shopping_list_service.delete_list(user.uid, list_id)
    return None


# ---------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------

@router.post("/{list_id}/items", status_code=201)
async def add_item(
    list_id: str,
    body: ItemRequest,
    user: UserInfo = Depends(get_current_user),
):
    """Add an item to a list. Enforces 50-item cap."""
    payload = body.model_dump(exclude_none=True)
    source = payload.pop("source", "manual")
    return shopping_list_service.add_item(user.uid, list_id, payload, source=source)


@router.patch("/{list_id}/items/{item_id}")
async def update_item(
    list_id: str,
    item_id: str,
    body: ItemPatchRequest,
    user: UserInfo = Depends(get_current_user),
):
    """Edit an item. Pass only fields you want to change."""
    payload = body.model_dump(exclude_none=True)
    return shopping_list_service.update_item(user.uid, list_id, item_id, payload)


@router.delete("/{list_id}/items/{item_id}", status_code=204)
async def delete_item(
    list_id: str,
    item_id: str,
    user: UserInfo = Depends(get_current_user),
):
    """Remove an item. Also called by the frontend after a successful Buy."""
    shopping_list_service.delete_item(user.uid, list_id, item_id)
    return None


# ---------------------------------------------------------------------------
# Price comparison entries
# ---------------------------------------------------------------------------

@router.post("/{list_id}/items/{item_id}/prices", status_code=201)
async def add_price(
    list_id: str,
    item_id: str,
    body: AddPriceRequest,
    user: UserInfo = Depends(get_current_user),
):
    """Append a price comparison entry. Cap = 10 per item."""
    return shopping_list_service.add_price(
        user.uid,
        list_id,
        item_id,
        price=body.price,
        currency=body.currency or "SGD",
        brand=body.brand,
        store_name=body.store_name,
        barcode=body.barcode,
    )


@router.delete("/{list_id}/items/{item_id}/prices/{price_id}", status_code=204)
async def delete_price(
    list_id: str,
    item_id: str,
    price_id: str,
    user: UserInfo = Depends(get_current_user),
):
    shopping_list_service.delete_price(user.uid, list_id, item_id, price_id)
    return None
