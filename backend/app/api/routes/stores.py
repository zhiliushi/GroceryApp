"""Store catalog API — per-user store registry (Phase D of catalog_evolution.md)."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import UserInfo, get_current_user
from app.core.exceptions import (
    NotFoundError,
    QuotaExceededError,
    ValidationError,
)
from app.services import store_catalog_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("")
async def list_stores(
    include_unknown: bool = Query(True),
    user: UserInfo = Depends(get_current_user),
):
    """All stores for the calling user. Sorted by use_count desc."""
    return {"stores": store_catalog_service.list_stores(user.uid, include_unknown=include_unknown)}


@router.get("/quota")
async def get_quota(user: UserInfo = Depends(get_current_user)):
    """Store catalog quota status for the calling user."""
    return store_catalog_service.get_quota_status(user.uid)


@router.get("/search")
async def search_stores(
    q: str = Query("", description="Name prefix or substring"),
    limit: int = Query(8, ge=1, le=50),
    user: UserInfo = Depends(get_current_user),
):
    """Autocomplete: matches by normalized name prefix, ranked by use_count."""
    return {"matches": store_catalog_service.search_stores(user.uid, q, limit=limit)}


@router.get("/{store_id}")
async def get_store(store_id: str, user: UserInfo = Depends(get_current_user)):
    s = store_catalog_service.get_store(user.uid, store_id)
    if not s:
        raise HTTPException(status_code=404, detail=f"Store '{store_id}' not found")
    return s


@router.post("")
async def create_store(body: dict, user: UserInfo = Depends(get_current_user)):
    """Create or return-existing on duplicate name. 30-cap (free tier)."""
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    try:
        return store_catalog_service.create_store(user.uid, name, actor_uid=user.uid)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    # QuotaExceededError → 409 via DomainError handler in main.py


@router.put("/{store_id}")
async def update_store(store_id: str, body: dict, user: UserInfo = Depends(get_current_user)):
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    try:
        return store_catalog_service.update_store(user.uid, store_id, name)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{store_id}")
async def delete_store(store_id: str, user: UserInfo = Depends(get_current_user)):
    try:
        store_catalog_service.delete_store(user.uid, store_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"success": True, "store_id": store_id}
