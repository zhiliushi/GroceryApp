"""
Google Cloud Vision OCR provider.

Pipeline:
  1. Call Vision API DOCUMENT_TEXT_DETECTION (handles rotation, blur natively)
  2. Use bounding-box spatial layout to identify line items:
     - Items cluster on the left, prices cluster on the right
     - Group words into lines by Y-coordinate proximity
     - Extract item name (left) and price (right) from each line
  3. Extract store name from top text block, total from bottom

Uses the existing Firebase service account credentials (no separate API key needed
if the project has Vision API enabled).
"""

from __future__ import annotations

import io
import logging
import re

from .base import (
    OcrProvider,
    OcrProviderError,
    ReceiptData,
    ReceiptItem,
    ReceiptStore,
)

logger = logging.getLogger(__name__)


def _get_google_credentials():
    """Extract Google Cloud credentials from Firebase's service account.

    Firebase Admin SDK stores credentials internally but doesn't expose them
    to other Google Cloud client libraries. This rebuilds credentials from
    the same source (FIREBASE_CREDENTIALS_JSON or FIREBASE_CREDENTIALS_PATH)
    so Vision API can reuse them without a separate env var.
    """
    try:
        from google.oauth2 import service_account
        from app.core.config import settings
        import json
        import os

        # Priority 1: JSON from env (Render deployment)
        if settings.FIREBASE_CREDENTIALS_JSON:
            info = json.loads(settings.FIREBASE_CREDENTIALS_JSON)
            return service_account.Credentials.from_service_account_info(
                info, scopes=["https://www.googleapis.com/auth/cloud-vision"]
            )

        # Priority 2: File path (local dev)
        if settings.FIREBASE_CREDENTIALS_PATH and os.path.exists(settings.FIREBASE_CREDENTIALS_PATH):
            return service_account.Credentials.from_service_account_file(
                settings.FIREBASE_CREDENTIALS_PATH,
                scopes=["https://www.googleapis.com/auth/cloud-vision"],
            )
    except Exception as e:
        logger.warning("Could not load Google credentials from Firebase config: %s", e)

    return None


# Import shared parsing helpers from tesseract provider (no duplication)
from .tesseract_provider import (
    _parse_store,
    _parse_total,
    _parse_date,
    _parse_tax,
    _detect_currency,
    _compute_confidence,
    _SKIP_PATTERNS,
    _TAX_RE,
)

_SKIP_RE = _SKIP_PATTERNS  # alias for references in _extract_items_from_lines
_PRICE_RE = re.compile(r"^(?:RM|MYR)?\s*\d+(?:\.\d{1,2})?$", re.IGNORECASE)
_QTY_RE = re.compile(r"\bx\s*(\d+)\b", re.IGNORECASE)


class GoogleVisionProvider(OcrProvider):
    key = "google_vision"
    name = "Google Cloud Vision"

    def __init__(self, timeout: float = 15.0):
        self._timeout = timeout
        self._client = None

    def _get_client(self):
        """Lazily create Vision client, reusing Firebase service account credentials."""
        if self._client:
            return self._client

        from google.cloud import vision

        # Try to reuse Firebase service account credentials for Vision API
        # (avoids needing a separate GOOGLE_APPLICATION_CREDENTIALS env var)
        creds = _get_google_credentials()
        if creds:
            self._client = vision.ImageAnnotatorClient(credentials=creds)
        else:
            # Fallback: ADC (GOOGLE_APPLICATION_CREDENTIALS env var or metadata server)
            self._client = vision.ImageAnnotatorClient()

        return self._client

    async def extract(self, image_bytes: bytes) -> ReceiptData:
        try:
            from google.cloud import vision
        except ImportError:
            raise OcrProviderError(
                "dependency_missing",
                "google-cloud-vision package not installed",
            )

        client = self._get_client()
        image = vision.Image(content=image_bytes)

        try:
            response = client.document_text_detection(
                image=image,
                image_context={"language_hints": ["en", "ms"]},
            )
        except Exception as exc:
            error_msg = str(exc).lower()
            if "permission" in error_msg or "403" in error_msg:
                raise OcrProviderError("auth_error", f"Vision API permission denied: {exc}")
            if "quota" in error_msg or "429" in error_msg:
                raise OcrProviderError("rate_limited", f"Vision API rate limited: {exc}")
            raise OcrProviderError("api_error", f"Vision API call failed: {exc}")

        if response.error.message:
            raise OcrProviderError("api_error", response.error.message)

        annotation = response.full_text_annotation
        if not annotation or not annotation.text:
            raise OcrProviderError("empty_result", "Vision API returned no text")

        raw_text = annotation.text

        # --- Spatial layout parsing ---
        lines = _group_words_into_lines(annotation)
        items = _extract_items_from_lines(lines)
        store = _parse_store(raw_text)
        total = _parse_total(raw_text)
        tax = _parse_tax(raw_text)
        receipt_date = _parse_date(raw_text)
        currency = _detect_currency(raw_text)
        confidence = _compute_confidence(items, store, total, receipt_date, currency)

        return ReceiptData(
            items=items,
            store=store,
            subtotal=None,
            tax=tax,
            total=total,
            date=receipt_date,
            currency=currency,
            raw_text=raw_text,
            confidence=confidence,
        )


# ---------------------------------------------------------------------------
# Spatial layout helpers
# ---------------------------------------------------------------------------


def _get_word_center_y(word) -> float:
    """Get vertical center of a word's bounding box."""
    vertices = word.bounding_box.vertices
    return sum(v.y for v in vertices) / len(vertices)


def _get_word_center_x(word) -> float:
    """Get horizontal center of a word's bounding box."""
    vertices = word.bounding_box.vertices
    return sum(v.x for v in vertices) / len(vertices)


def _group_words_into_lines(annotation) -> list[list]:
    """Group all words by Y-coordinate proximity into logical lines."""
    words = []
    for page in annotation.pages:
        for block in page.blocks:
            for paragraph in block.paragraphs:
                for word in paragraph.words:
                    text = "".join(s.text for s in word.symbols)
                    center_y = _get_word_center_y(word)
                    center_x = _get_word_center_x(word)
                    words.append({"text": text, "x": center_x, "y": center_y})

    if not words:
        return []

    # Sort by Y then X
    words.sort(key=lambda w: (w["y"], w["x"]))

    # Group into lines (words within 15px vertical distance)
    lines: list[list] = []
    current_line: list = [words[0]]

    for word in words[1:]:
        if abs(word["y"] - current_line[-1]["y"]) < 15:
            current_line.append(word)
        else:
            current_line.sort(key=lambda w: w["x"])
            lines.append(current_line)
            current_line = [word]

    if current_line:
        current_line.sort(key=lambda w: w["x"])
        lines.append(current_line)

    return lines


def _extract_items_from_lines(lines: list[list]) -> list[ReceiptItem]:
    """Extract item name + price from spatially grouped lines.

    Heuristic: the rightmost element that looks like a price (X.XX) is the
    price, everything to its left is the item name.
    """
    items: list[ReceiptItem] = []

    for line_words in lines:
        if not line_words:
            continue

        line_text = " ".join(w["text"] for w in line_words)

        # Skip non-item lines
        if _SKIP_RE.search(line_text):
            continue

        # Find the rightmost price-like token
        price_idx = None
        for i in range(len(line_words) - 1, -1, -1):
            if _PRICE_RE.match(line_words[i]["text"]):
                price_idx = i
                break

        if price_idx is None or price_idx == 0:
            continue

        price_text = re.sub(r"[^\d.]", "", line_words[price_idx]["text"])
        price = float(price_text) if price_text else 0.0
        if price <= 0 or price > 99999:
            continue

        name_parts = [w["text"] for w in line_words[:price_idx]]
        raw_name = " ".join(name_parts).strip()

        if len(raw_name) < 2:
            continue

        # Extract quantity
        quantity = 1
        qty_match = _QTY_RE.search(raw_name)
        if qty_match:
            quantity = int(qty_match.group(1))
            raw_name = _QTY_RE.sub("", raw_name).strip()

        # Check for barcode-like numbers
        barcode = None
        bc_match = re.search(r"\b(\d{8,13})\b", raw_name)
        if bc_match:
            barcode = bc_match.group(1)

        name = re.sub(r"\s+", " ", raw_name).strip()
        if name:
            items.append(ReceiptItem(
                name=name,
                price=price,
                quantity=quantity,
                barcode=barcode,
                confidence=0.8,
            ))

    return items



# _extract_store, _extract_total, _extract_tax, _extract_date are now imported
# from tesseract_provider as _parse_store, _parse_total, _parse_tax, _parse_date
