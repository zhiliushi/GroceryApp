"""Pydantic schemas for foodbank endpoints."""

from pydantic import BaseModel
from typing import Optional, List


class FoodbankBase(BaseModel):
    name: str
    description: Optional[str] = None
    country: str
    state: Optional[str] = None
    location_name: Optional[str] = None
    location_address: Optional[str] = None
    location_link: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source_url: Optional[str] = None
    source_name: Optional[str] = None
    is_active: bool = True


class FoodbankResponse(FoodbankBase):
    id: str
    created_at: float
    updated_at: float
    last_refreshed: Optional[float] = None


class FoodbankListResponse(BaseModel):
    count: int
    foodbanks: List[FoodbankResponse]


class FoodbankSeedResponse(BaseModel):
    success: bool
    message: str
    inserted: int
    skipped: int


class FoodbankRefreshResponse(BaseModel):
    success: bool
    message: str
    new_entries: int


class FoodbankCreateRequest(FoodbankBase):
    """Request to create a new foodbank."""
    pass


class FoodbankUpdateRequest(BaseModel):
    """Request to update an existing foodbank. All fields optional."""
    name: Optional[str] = None
    description: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    location_name: Optional[str] = None
    location_address: Optional[str] = None
    location_link: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source_url: Optional[str] = None
    source_name: Optional[str] = None
    is_active: Optional[bool] = None


class FoodbankToggleResponse(BaseModel):
    success: bool
    is_active: bool
    message: str


# ---------------------------------------------------------------------------
# Source management
# ---------------------------------------------------------------------------

class FoodbankSource(BaseModel):
    id: str
    name: str
    url: str
    country: str
    status: str  # "healthy", "cooldown", "disabled"
    last_success: Optional[float] = None
    last_error: Optional[float] = None
    error_message: Optional[str] = None
    cooldown_until: Optional[float] = None
    cooldown_hours: int = 6


class FoodbankSourceListResponse(BaseModel):
    count: int
    sources: List[FoodbankSource]


class FoodbankFetchResponse(BaseModel):
    success: bool
    message: str
    new_count: int
