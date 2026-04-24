"""Catalog API — user's personal name catalog (reusable item names).

GET    /api/catalog                          — List/search my catalog entries
GET    /api/catalog/lookup/barcode/{barcode} — Find my catalog entry by barcode
GET    /api/catalog/{name_norm}              — Get a single catalog entry (with history)
PATCH  /api/catalog/{name_norm}              — Update display_name / barcode / defaults
POST   /api/catalog/{name_norm}/merge        — Merge into another catalog entry (reparents events)
DELETE /api/catalog/{name_norm}              — Delete (blocked if active_purchases > 0)
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import UserInfo, get_current_user
from app.core.rate_limit import rate_limit
from app.schemas.catalog import CatalogMergeRequest, CatalogUpdate
from app.services import catalog_service, purchase_event_service

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

@router.get("")
async def list_catalog(
    q: str = Query("", description="autocomplete prefix"),
    sort_by: str = Query("last_purchased_at"),
    limit: int = Query(50, ge=1, le=500),
    cursor: Optional[str] = Query(None, description="opaque cursor from previous response's next_cursor"),
    user: UserInfo = Depends(get_current_user),
):
    """List the authenticated user's catalog entries with cursor pagination.

    Response: `{count, items, next_cursor}`. `next_cursor` is null when no more
    pages exist. Pass it as the `cursor` param on the next request to continue.
    """
    return catalog_service.list_catalog(
        user_id=user.uid,
        query=q,
        limit=limit,
        sort_by=sort_by,
        cursor=cursor,
    )


@router.get("/lookup/barcode/{barcode}")
async def lookup_by_barcode(barcode: str, user: UserInfo = Depends(get_current_user)):
    """Find this user's catalog entry matching the barcode. Returns {entry: null} if none."""
    entry = catalog_service.find_by_barcode(user.uid, barcode)
    return {"entry": entry}


@router.get("/{name_norm}")
async def get_catalog_entry(name_norm: str, user: UserInfo = Depends(get_current_user)):
    """Get a single catalog entry including recent purchase history."""
    entry = catalog_service.get_catalog_entry(user.uid, name_norm)
    if not entry:
        raise HTTPException(status_code=404, detail=f"Catalog entry '{name_norm}' not found")
    history_page = purchase_event_service.list_purchases(
        user_id=user.uid,
        catalog_name_norm=name_norm,
        limit=20,
    )
    entry["history"] = history_page["items"]
    return entry


# ---------------------------------------------------------------------------
# Update / merge / delete
# ---------------------------------------------------------------------------

@router.patch("/{name_norm}", dependencies=[Depends(rate_limit(60))])
async def update_catalog_entry(
    name_norm: str,
    data: CatalogUpdate,
    user: UserInfo = Depends(get_current_user),
):
    """Partial update. Pass barcode='' to unlink."""
    updates = data.model_dump(exclude_unset=True)
    return catalog_service.update_catalog_entry(user.uid, name_norm, updates)


@router.post("/{name_norm}/merge", dependencies=[Depends(rate_limit(60))])
async def merge_catalog_entry(
    name_norm: str,
    data: CatalogMergeRequest,
    user: UserInfo = Depends(get_current_user),
):
    """Merge this catalog entry into the target (target_name_norm). Reparents all events."""
    return catalog_service.merge_catalog(
        user_id=user.uid,
        src_name_norm=name_norm,
        dst_name_norm=data.target_name_norm,
    )


@router.delete("/{name_norm}", dependencies=[Depends(rate_limit(60))])
async def delete_catalog_entry(
    name_norm: str,
    force: bool = Query(False, description="force delete even if active_purchases > 0"),
    user: UserInfo = Depends(get_current_user),
):
    """Delete a catalog entry. Blocked if it has active purchases unless force=true."""
    catalog_service.delete_catalog_entry(user.uid, name_norm, force=force)
    return {"success": True, "name_norm": name_norm}
