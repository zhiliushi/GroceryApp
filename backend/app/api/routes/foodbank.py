"""
Foodbank API routes.

GET    /api/foodbanks                       — List all (optional ?country=MY)
GET    /api/foodbanks/sources               — List all sources with status
POST   /api/foodbanks/sources/{id}/fetch    — Manually fetch from one source (admin)
POST   /api/foodbanks/sources/{id}/reset    — Reset cooldown (admin)
POST   /api/foodbanks/sources/{id}/toggle   — Enable/disable source (admin)
GET    /api/foodbanks/{id}                  — Get single foodbank
POST   /api/foodbanks                       — Create new foodbank (admin)
PUT    /api/foodbanks/{id}                  — Update foodbank (admin)
DELETE /api/foodbanks/{id}                  — Delete foodbank (admin)
PATCH  /api/foodbanks/{id}/toggle           — Toggle active/inactive (admin)
POST   /api/foodbanks/seed                  — Trigger Malaysia seed (one-time)
POST   /api/foodbanks/refresh               — Trigger manual refresh
"""

import logging

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional

from app.core.auth import UserInfo, require_admin
from app.schemas.foodbank import (
    FoodbankResponse,
    FoodbankListResponse,
    FoodbankSeedResponse,
    FoodbankRefreshResponse,
    FoodbankCreateRequest,
    FoodbankUpdateRequest,
    FoodbankToggleResponse,
    FoodbankSource,
    FoodbankSourceListResponse,
    FoodbankFetchResponse,
)
from app.services import foodbank_service
from app.services import foodbank_sources

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------

@router.get("", response_model=FoodbankListResponse)
async def list_foodbanks(country: Optional[str] = Query(None, description="ISO country code (e.g. MY, US)")):
    """List all active foodbanks, optionally filtered by country."""
    foodbanks = foodbank_service.get_all(country=country)
    return FoodbankListResponse(
        count=len(foodbanks),
        foodbanks=[FoodbankResponse(**fb) for fb in foodbanks],
    )


# ---------------------------------------------------------------------------
# Sources — list, fetch, reset, toggle
# ---------------------------------------------------------------------------

@router.get("/sources", response_model=FoodbankSourceListResponse)
async def list_sources():
    """List all foodbank data sources with their current status."""
    sources = foodbank_sources.list_sources()
    return FoodbankSourceListResponse(
        count=len(sources),
        sources=[FoodbankSource(**s) for s in sources],
    )


@router.post("/sources/{source_id}/fetch", response_model=FoodbankFetchResponse)
async def fetch_source(source_id: str, admin: UserInfo = Depends(require_admin)):
    """Manually trigger a fetch from a single source."""
    result = foodbank_sources.fetch_source(source_id)
    if not result["success"]:
        return FoodbankFetchResponse(
            success=False,
            message=result.get("error", "Fetch failed"),
            new_count=0,
        )
    return FoodbankFetchResponse(
        success=True,
        message=f"Fetched successfully: {result['new_count']} entries refreshed",
        new_count=result["new_count"],
    )


@router.post("/sources/{source_id}/reset")
async def reset_source_cooldown(source_id: str, admin: UserInfo = Depends(require_admin)):
    """Reset a source's cooldown, restoring it to healthy status."""
    if not foodbank_sources.reset_cooldown(source_id):
        raise HTTPException(status_code=404, detail="Source not found")
    return {"success": True, "message": "Cooldown cleared"}


@router.post("/sources/{source_id}/toggle")
async def toggle_source(source_id: str, admin: UserInfo = Depends(require_admin)):
    """Enable or disable a foodbank source."""
    source = foodbank_sources.get_source(source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    if source["status"] == "disabled":
        foodbank_sources.enable_source(source_id)
        return {"success": True, "status": "healthy", "message": "Source enabled"}
    else:
        foodbank_sources.disable_source(source_id)
        return {"success": True, "status": "disabled", "message": "Source disabled"}


# ---------------------------------------------------------------------------
# Get by ID
# ---------------------------------------------------------------------------

@router.get("/{foodbank_id}", response_model=FoodbankResponse)
async def get_foodbank(foodbank_id: str):
    """Get a single foodbank by ID."""
    fb = foodbank_service.get_by_id(foodbank_id)
    if not fb:
        raise HTTPException(status_code=404, detail="Foodbank not found")
    return FoodbankResponse(**fb)


# ---------------------------------------------------------------------------
# Create (admin)
# ---------------------------------------------------------------------------

@router.post("", response_model=FoodbankResponse)
async def create_foodbank(body: FoodbankCreateRequest, admin: UserInfo = Depends(require_admin)):
    """Create a new foodbank."""
    doc_id = foodbank_service.create(body.model_dump())
    fb = foodbank_service.get_by_id(doc_id)
    return FoodbankResponse(**fb)


# ---------------------------------------------------------------------------
# Update (admin)
# ---------------------------------------------------------------------------

@router.put("/{foodbank_id}", response_model=FoodbankResponse)
async def update_foodbank(foodbank_id: str, body: FoodbankUpdateRequest, admin: UserInfo = Depends(require_admin)):
    """Update a foodbank."""
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not foodbank_service.update(foodbank_id, data):
        raise HTTPException(status_code=404, detail="Foodbank not found")
    fb = foodbank_service.get_by_id(foodbank_id)
    return FoodbankResponse(**fb)


# ---------------------------------------------------------------------------
# Delete (admin)
# ---------------------------------------------------------------------------

@router.delete("/{foodbank_id}")
async def delete_foodbank(foodbank_id: str, admin: UserInfo = Depends(require_admin)):
    """Delete a foodbank permanently."""
    if not foodbank_service.delete(foodbank_id):
        raise HTTPException(status_code=404, detail="Foodbank not found")
    return {"success": True, "message": "Foodbank deleted"}


# ---------------------------------------------------------------------------
# Toggle active (admin)
# ---------------------------------------------------------------------------

@router.patch("/{foodbank_id}/toggle", response_model=FoodbankToggleResponse)
async def toggle_foodbank(foodbank_id: str, admin: UserInfo = Depends(require_admin)):
    """Toggle a foodbank's active status."""
    new_value = foodbank_service.toggle_active(foodbank_id)
    if new_value is None:
        raise HTTPException(status_code=404, detail="Foodbank not found")
    return FoodbankToggleResponse(
        success=True,
        is_active=new_value,
        message=f"Foodbank {'activated' if new_value else 'deactivated'}",
    )


# ---------------------------------------------------------------------------
# Refresh single entry (admin)
# ---------------------------------------------------------------------------

@router.post("/{foodbank_id}/refresh", response_model=FoodbankResponse)
async def refresh_foodbank_entry(foodbank_id: str, admin: UserInfo = Depends(require_admin)):
    """Refresh a single foodbank entry — re-fetch and update timestamp."""
    fb = foodbank_service.refresh_entry(foodbank_id)
    if not fb:
        raise HTTPException(status_code=404, detail="Foodbank not found")
    return FoodbankResponse(**fb)


# ---------------------------------------------------------------------------
# Seed
# ---------------------------------------------------------------------------

@router.post("/seed", response_model=FoodbankSeedResponse)
async def seed_foodbanks():
    """Seed Malaysian foodbank data. Safe to call multiple times (deduplicates)."""
    inserted, skipped = foodbank_service.seed_malaysia()
    return FoodbankSeedResponse(
        success=True,
        message=f"Malaysia seed complete: {inserted} inserted, {skipped} duplicates skipped",
        inserted=inserted,
        skipped=skipped,
    )


# ---------------------------------------------------------------------------
# Refresh
# ---------------------------------------------------------------------------

@router.post("/refresh", response_model=FoodbankRefreshResponse)
async def refresh_foodbanks():
    """Trigger a manual refresh (scrape sources for new entries)."""
    new_count = foodbank_service.scrape_and_update()
    return FoodbankRefreshResponse(
        success=True,
        message=f"Refresh complete: {new_count} new entries",
        new_entries=new_count,
    )
