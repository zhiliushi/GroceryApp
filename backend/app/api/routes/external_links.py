"""External-links routes.

Mounted at /api/external-links (public read) and /api/admin/external-links
(admin write). The About page reads the public endpoint; the admin tab uses
the write endpoints.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.core.auth import UserInfo, require_admin
from app.services import external_link_service

logger = logging.getLogger(__name__)
router = APIRouter()


class CreateLinkRequest(BaseModel):
    label: str = Field(..., min_length=1, max_length=80)
    url: str = Field(..., min_length=1, max_length=500)
    category: str = Field(..., description="donation | reference | social | other")
    description: Optional[str] = Field(None, max_length=200)
    icon: Optional[str] = Field(None, max_length=8)
    sort_order: Optional[int] = 0
    enabled: Optional[bool] = True


class UpdateLinkRequest(BaseModel):
    label: Optional[str] = Field(None, min_length=1, max_length=80)
    url: Optional[str] = Field(None, min_length=1, max_length=500)
    category: Optional[str] = None
    description: Optional[str] = Field(None, max_length=200)
    icon: Optional[str] = Field(None, max_length=8)
    sort_order: Optional[int] = None
    enabled: Optional[bool] = None


# ---------------------------------------------------------------------------
# Public read — used by AboutPage. enabled_only=True is enforced server-side.
# ---------------------------------------------------------------------------

@router.get("")
async def list_public_links(
    category: Optional[str] = Query(None),
):
    items = external_link_service.list_links(
        category=category, enabled_only=True
    )
    by_category: dict[str, list] = {c: [] for c in external_link_service.VALID_CATEGORIES}
    for item in items:
        cat = item.get("category", "other")
        by_category.setdefault(cat, []).append(item)
    return {
        "items": items,
        "by_category": by_category,
        "categories": list(external_link_service.VALID_CATEGORIES),
    }


# ---------------------------------------------------------------------------
# Admin CRUD — under /api/admin/external-links via separate include in main.
# ---------------------------------------------------------------------------

admin_router = APIRouter()


@admin_router.get("")
async def admin_list_links(
    category: Optional[str] = Query(None),
    enabled_only: bool = Query(False),
    admin: UserInfo = Depends(require_admin),
):
    items = external_link_service.list_links(
        category=category, enabled_only=enabled_only
    )
    return {
        "items": items,
        "count": len(items),
        "categories": list(external_link_service.VALID_CATEGORIES),
    }


@admin_router.post("", status_code=201)
async def admin_create_link(
    body: CreateLinkRequest,
    admin: UserInfo = Depends(require_admin),
):
    return external_link_service.create_link(
        label=body.label,
        url=body.url,
        category=body.category,
        description=body.description,
        icon=body.icon,
        sort_order=body.sort_order or 0,
        enabled=bool(body.enabled) if body.enabled is not None else True,
        created_by=admin.uid,
    )


@admin_router.patch("/{link_id}")
async def admin_update_link(
    link_id: str,
    body: UpdateLinkRequest,
    admin: UserInfo = Depends(require_admin),
):
    return external_link_service.update_link(
        link_id,
        label=body.label,
        url=body.url,
        category=body.category,
        description=body.description,
        icon=body.icon,
        sort_order=body.sort_order,
        enabled=body.enabled,
    )


@admin_router.delete("/{link_id}")
async def admin_delete_link(
    link_id: str,
    admin: UserInfo = Depends(require_admin),
):
    return external_link_service.delete_link(link_id)


@admin_router.post("/seed-defaults")
async def admin_seed_defaults(
    admin: UserInfo = Depends(require_admin),
):
    inserted = external_link_service.seed_defaults_if_empty()
    return {"inserted": inserted}
