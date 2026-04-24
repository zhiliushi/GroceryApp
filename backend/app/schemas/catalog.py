"""Pydantic schemas for catalog entries (user's personal name catalog)."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from .common import BaseDoc


class CatalogEntry(BaseDoc):
    """A single catalog entry owned by a user. Doc ID = `{user_id}__{name_norm}`."""

    user_id: str                                # FK to users, redundant with doc-id prefix
    name_norm: str                              # normalized name (doc-id suffix)
    display_name: str                           # user's preferred casing ("Organic Milk")
    aliases: list[str] = Field(default_factory=list)  # other casings seen
    barcode: Optional[str] = None               # SINGLE barcode, nullable
    country_code: Optional[str] = None          # inherited from barcode prefix or manual
    default_location: Optional[str] = None      # last-used (fridge/pantry/freezer)
    default_category: Optional[str] = None
    image_url: Optional[str] = None             # from linked product
    total_purchases: int = 0                    # all-time count
    active_purchases: int = 0                   # current active count
    last_purchased_at: Optional[datetime] = None
    needs_review: bool = False                  # flagged by reminder stage-3 or AI dedup


class CatalogCreate(BaseModel):
    """Request body for creating a catalog entry directly (admin / advanced flow)."""

    display_name: str
    barcode: Optional[str] = None
    default_location: Optional[str] = None
    default_category: Optional[str] = None


class CatalogUpdate(BaseModel):
    """Partial update for a catalog entry."""

    display_name: Optional[str] = None
    barcode: Optional[str] = None  # use empty string to unlink
    default_location: Optional[str] = None
    default_category: Optional[str] = None


class CatalogMergeRequest(BaseModel):
    """Merge source catalog into target. Reparents all purchase events, deletes source."""

    target_name_norm: str
