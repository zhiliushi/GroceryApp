"""Pydantic schemas for purchase events (individual shopping trips)."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from .common import BaseDoc

# Valid status transitions
VALID_STATUSES = frozenset({"active", "used", "thrown", "transferred"})
VALID_CONSUME_REASONS = frozenset({"used_up", "expired", "bad", "gift"})
VALID_PAYMENT_METHODS = frozenset({"cash", "card"})


class PurchaseEvent(BaseDoc):
    """A single purchase event — one per shopping trip / individual buy."""

    # Catalog link (denormalized display for list views)
    catalog_name_norm: str
    catalog_display: str
    barcode: Optional[str] = None
    country_code: Optional[str] = None

    # Quantity
    quantity: float = 1.0
    unit: Optional[str] = None  # "pcs" | "g" | "kg" | "ml" | "L"

    # Expiry
    expiry_date: Optional[datetime] = None
    expiry_source: Optional[str] = None  # "user" | "nlp" | "ocr" | "none"
    expiry_raw: Optional[str] = None     # original user input ("tomorrow")

    # Price
    price: Optional[float] = None
    currency: Optional[str] = None
    payment_method: Optional[str] = None  # "cash" | "card" | None

    # Lifecycle
    date_bought: datetime
    location: Optional[str] = None
    status: str = "active"                # active | used | thrown | transferred
    consumed_date: Optional[datetime] = None
    consumed_reason: Optional[str] = None
    transferred_to: Optional[str] = None  # uid or foodbank_id

    # Reminders
    reminder_stage: int = 0               # 0=none, 1=7d, 2=14d, 3=21d
    last_reminded_at: Optional[datetime] = None

    # Household context
    household_id: Optional[str] = None

    # Migration tracking
    source_ref: Optional[str] = None      # original grocery_items id if migrated


class PurchaseCreate(BaseModel):
    """Request body for POST /api/purchases (core add-item flow).

    Either `name` OR `catalog_name_norm` must be provided. If `name`, the
    service will upsert a catalog entry with that display_name.
    """

    # Catalog reference — one of these
    name: Optional[str] = None                # display name (creates catalog if new)
    catalog_name_norm: Optional[str] = None   # use existing catalog directly

    # Metadata
    barcode: Optional[str] = None
    quantity: float = 1.0
    unit: Optional[str] = None
    expiry_raw: Optional[str] = None          # "tomorrow", "next week", ISO, or "no expiry"
    expiry_date: Optional[datetime] = None    # explicit ISO date overrides expiry_raw
    price: Optional[float] = None
    currency: Optional[str] = None
    payment_method: Optional[str] = None
    date_bought: Optional[datetime] = None    # defaults to now
    location: Optional[str] = None


class PurchaseUpdate(BaseModel):
    """Partial update for a purchase event."""

    quantity: Optional[float] = None
    unit: Optional[str] = None
    expiry_raw: Optional[str] = None
    expiry_date: Optional[datetime] = None
    price: Optional[float] = None
    payment_method: Optional[str] = None
    location: Optional[str] = None


class PurchaseStatusUpdate(BaseModel):
    """Change status (used / thrown / transferred). Validated against current state."""

    status: str                                # "used" | "thrown" | "transferred"
    reason: Optional[str] = None               # "used_up" | "expired" | "bad" | "gift"
    transferred_to: Optional[str] = None       # uid or foodbank_id
