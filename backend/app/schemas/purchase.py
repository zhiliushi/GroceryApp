"""Pydantic schemas for purchase events (individual shopping trips)."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from .common import BaseDoc

# Valid status transitions
# NOTE (validation-stage flag): the user has flagged this status enum as
# potentially-too-coarse; revisit when usage data accumulates. Keep stable
# for now — partial-action splits and waste counting depend on these.
VALID_STATUSES = frozenset({"active", "used", "thrown", "transferred"})

# Consume reasons. `bad` was merged into `unexpected_event` (broader cover
# for spillage / freezer burn / pet incident / found mouldy / etc.).
# Free-text complement lives in `consumed_reason_text`.
# Waste flagging: see `waste_service` — only `expired` + `unexpected_event`
# count as waste; `used_up` and `gift` don't.
VALID_CONSUME_REASONS = frozenset(
    {"used_up", "expired", "unexpected_event", "gift"}
)
WASTE_REASONS = frozenset({"expired", "unexpected_event"})

# Payment methods. Expanded from the old binary cash|card to cover
# Malaysian-context payment variety. Free-text method coming later (hook).
VALID_PAYMENT_METHODS = frozenset(
    {"cash", "ewallet", "debit_card", "credit_card"}
)


class PurchaseEvent(BaseDoc):
    """A single purchase event — one per shopping trip / individual buy."""

    # Catalog link (denormalized display for list views)
    catalog_name_norm: str
    catalog_display: str
    barcode: Optional[str] = None
    country_code: Optional[str] = None

    # Quantity — UNIT_TYPE_TOUCHPOINT
    # Canonical model (see `.claude/docs/unit-type-method.md`):
    #   pack_count    = how many physical containers (=alias of `quantity`)
    #   pack_label    = container name (carton/box/loose/…); descriptive
    #   pack_size     = base units per pack
    #   base_unit     = measurement unit (count/ml/L/g/kg)
    #   total_base_units (derived) = pack_count × pack_size
    # Legacy fields kept for read-compat: `quantity` aliases pack_count;
    # `unit` is the legacy mixed field that the backfill replaces.
    quantity: float = 1.0
    unit: Optional[str] = None              # legacy mixed field; deprecated for new writes
    pack_label: Optional[str] = None        # canonical: descriptive container name
    base_unit: Optional[str] = None         # canonical: measurement unit ("ml", "g", "count", …)

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
    location: Optional[str] = None         # free-text; registered or ad-hoc
    state: Optional[str] = None            # optional region/state (e.g. "Selangor")
    country: Optional[str] = None          # optional country (e.g. "Malaysia")
    status: str = "active"                 # active | used | thrown | transferred
    consumed_date: Optional[datetime] = None
    consumed_reason: Optional[str] = None  # canonical reason from VALID_CONSUME_REASONS
    consumed_reason_text: Optional[str] = None  # optional free-text complement
    transferred_to: Optional[str] = None   # uid or foodbank_id

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
    quantity: float = 1.0                     # = pack_count (legacy alias kept for old clients)
    unit: Optional[str] = None                # legacy mixed field; new clients send pack_label + base_unit
    # UNIT_TYPE_TOUCHPOINT — canonical fields (see unit-type-method.md).
    # When supplied, these win over `unit`. The write path also keeps
    # `unit` populated for read-compat with old clients.
    pack_label: Optional[str] = None          # carton / box / loose / pack / …
    pack_size: Optional[float] = None         # base units per pack (≥ 1)
    base_unit: Optional[str] = None           # ml / L / g / kg / count

    expiry_raw: Optional[str] = None          # "tomorrow", "next week", ISO, or "no expiry"
    expiry_date: Optional[datetime] = None    # explicit ISO date overrides expiry_raw
    price: Optional[float] = None
    currency: Optional[str] = None
    payment_method: Optional[str] = None      # cash | ewallet | debit_card | credit_card
    date_bought: Optional[datetime] = None    # defaults to now
    location: Optional[str] = None            # free-text; registered or ad-hoc
    # Optional geo metadata. Validation-stage hooks for later location
    # search + regional analytics. Free-tier capped at 30 distinct values
    # each via quota_service (see purchase_event_service.create_purchase).
    state: Optional[str] = None
    country: Optional[str] = None
    # v2 store-of-purchase (catalog_evolution.md Phase D §2.2 #9). Defaults
    # to "unknown" server-side when omitted.
    store_id: Optional[str] = None

    # Category — preset slug from the frontend ITEM_CATEGORIES list
    # (e.g. "fruit_veg", "dairy", "jam_honey"). When supplied, written
    # to the catalog row's `default_category` so subsequent purchases
    # of the same item inherit it. Free-text not validated server-side
    # to keep the schema simple — the frontend dropdown is the gate.
    category: Optional[str] = None


class PurchaseUpdate(BaseModel):
    """Partial update for a purchase event."""

    quantity: Optional[float] = None
    unit: Optional[str] = None                # legacy
    # UNIT_TYPE_TOUCHPOINT — canonical edit fields
    pack_label: Optional[str] = None
    pack_size: Optional[float] = None
    base_unit: Optional[str] = None
    expiry_raw: Optional[str] = None
    expiry_date: Optional[datetime] = None
    price: Optional[float] = None
    payment_method: Optional[str] = None
    location: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None


class PurchaseStatusUpdate(BaseModel):
    """Change status (used / thrown / transferred). Validated against current state.

    `quantity` enables partial actions: if 0 < quantity < event.quantity, the
    server splits the event — a new terminal event is created with the
    portion (linked back via `split_from_event_id`), and the original event
    is decremented and stays active. Omit or pass full quantity for the
    legacy whole-event transition.
    """

    status: str                                # "used" | "thrown" | "transferred"
    reason: Optional[str] = None               # canonical: VALID_CONSUME_REASONS
    reason_text: Optional[str] = None          # optional free-text complement (any user input)
    transferred_to: Optional[str] = None       # uid or foodbank_id
    quantity: Optional[float] = None           # partial portion; None = whole event


class PurchaseMoveRequest(BaseModel):
    """Move a purchase event to a different storage location.

    Optional `quantity` enables partial moves: when 0 < quantity < event.quantity,
    the server splits the event — a new active event is created at the target
    location with the portion (linked back via `split_from_event_id`), and the
    original event is decremented and stays at its current location. Omit or
    pass full quantity for the whole-event move.
    """

    location: str                              # target location key
    quantity: Optional[float] = None           # partial portion; None = whole event
