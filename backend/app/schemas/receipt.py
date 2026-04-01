"""Pydantic models for receipt scanning API."""

from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Optional


# ---------------------------------------------------------------------------
# Scan response
# ---------------------------------------------------------------------------


class ReceiptItemResponse(BaseModel):
    name: str
    price: float
    quantity: int = 1
    barcode: Optional[str] = None
    confidence: float = 1.0
    # Enriched from barcode lookup (silently populated when barcode found in DB)
    brand: Optional[str] = None
    image_url: Optional[str] = None
    barcode_source: Optional[str] = None  # "firebase", "contributed", "openfoodfacts"


class ReceiptStoreResponse(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None


class ProviderAttemptResponse(BaseModel):
    provider: str
    status: str
    duration_ms: int = 0
    items_found: int = 0
    confidence: float = 0.0
    error_type: Optional[str] = None
    error_message: Optional[str] = None


class ReceiptScanResponse(BaseModel):
    success: bool
    scan_id: str
    provider_used: Optional[str] = None
    confidence: float = 0.0
    store: ReceiptStoreResponse = Field(default_factory=ReceiptStoreResponse)
    items: list[ReceiptItemResponse] = Field(default_factory=list)
    subtotal: Optional[float] = None
    tax: Optional[float] = None
    total: Optional[float] = None
    date: Optional[str] = None
    currency: Optional[str] = None
    raw_text: str = ""
    attempts: list[ProviderAttemptResponse] = Field(default_factory=list)
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Confirm request
# ---------------------------------------------------------------------------


class ConfirmItem(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    price: float = Field(..., ge=0, le=99999)
    quantity: int = Field(1, ge=1, le=999)
    barcode: Optional[str] = None
    location: str = "pantry"


class ReceiptConfirmRequest(BaseModel):
    scan_id: str
    store_name: Optional[str] = None
    store_address: Optional[str] = None
    date: Optional[str] = None
    destination: str = Field(..., pattern=r"^(inventory|shopping_list|price_only)$")
    list_id: Optional[str] = None  # required when destination=shopping_list
    items: list[ConfirmItem] = Field(..., min_length=1)
    total: Optional[float] = None


class ReceiptConfirmResponse(BaseModel):
    success: bool
    message: str
    items_added: int = 0
    destination: str = ""
