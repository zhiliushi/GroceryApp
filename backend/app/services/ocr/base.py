"""
OCR provider base — shared dataclasses and abstract interface.

Every provider outputs the same ReceiptData shape so the confirmation form
and downstream logic is provider-agnostic.
"""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional


# ---------------------------------------------------------------------------
# Data classes — common output format
# ---------------------------------------------------------------------------


@dataclass
class ReceiptItem:
    """A single line item extracted from a receipt."""

    name: str
    price: float
    quantity: int = 1
    barcode: Optional[str] = None
    confidence: float = 1.0  # 0.0–1.0 per-item confidence


@dataclass
class ReceiptStore:
    """Store information extracted from a receipt."""

    name: Optional[str] = None
    address: Optional[str] = None


@dataclass
class ReceiptData:
    """Structured output from any OCR provider."""

    items: list[ReceiptItem] = field(default_factory=list)
    store: ReceiptStore = field(default_factory=ReceiptStore)
    subtotal: Optional[float] = None
    tax: Optional[float] = None
    total: Optional[float] = None
    date: Optional[date] = None
    currency: Optional[str] = None
    raw_text: str = ""
    confidence: float = 0.0  # overall confidence 0.0–1.0


@dataclass
class ProviderAttempt:
    """Logged result of a single provider attempt during cascading."""

    provider: str
    status: str  # "success", "error", "skipped"
    duration_ms: int = 0
    items_found: int = 0
    confidence: float = 0.0
    error_type: Optional[str] = None  # "quota_exceeded", "timeout", "auth_error", "rate_limited", "parse_failed", "key_missing", ...
    error_message: Optional[str] = None


@dataclass
class ScanResult:
    """Complete result returned to the client from /api/receipt/scan."""

    scan_id: str = field(default_factory=lambda: f"rcpt_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}")
    success: bool = False
    provider_used: Optional[str] = None
    data: Optional[ReceiptData] = None
    attempts: list[ProviderAttempt] = field(default_factory=list)
    error: Optional[str] = None  # set when success=False


# ---------------------------------------------------------------------------
# Abstract provider
# ---------------------------------------------------------------------------


class OcrProvider(ABC):
    """Base class for OCR providers.

    Each provider is fully self-contained: it handles its own image
    preprocessing, API calls, and output parsing.  The only contract is
    that ``extract`` returns a ``ReceiptData`` instance.
    """

    key: str  # e.g. "google_vision", "mindee", "tesseract"
    name: str  # display name

    @abstractmethod
    async def extract(self, image_bytes: bytes) -> ReceiptData:
        """Process a receipt image and return structured data.

        Raises:
            OcrProviderError: on any failure (timeout, auth, parse, etc.)
        """

    def requires_api_key(self) -> bool:
        """Return True if this provider needs an API key to function."""
        return True


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class OcrProviderError(Exception):
    """Raised when a provider fails to process an image."""

    def __init__(self, error_type: str, message: str):
        self.error_type = error_type
        self.message = message
        super().__init__(f"[{error_type}] {message}")
