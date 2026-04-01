"""
Tesseract OCR provider — local, free, no API key needed.

Pipeline:
  1. Pillow preprocessing (EXIF transpose, grayscale, contrast, adaptive threshold)
  2. pytesseract OCR → raw text
  3. Regex-based line parser → ReceiptData

Best as a fallback when cloud providers are unavailable or over quota.
"""

from __future__ import annotations

import io
import logging
import re
from datetime import date
from typing import Optional

from .base import (
    OcrProvider,
    OcrProviderError,
    ReceiptData,
    ReceiptItem,
    ReceiptStore,
)

logger = logging.getLogger(__name__)


class TesseractProvider(OcrProvider):
    key = "tesseract"
    name = "Tesseract (Local)"

    def requires_api_key(self) -> bool:
        return False

    async def extract(self, image_bytes: bytes) -> ReceiptData:
        try:
            import pytesseract
            from PIL import Image, ImageFilter, ImageOps
        except ImportError as e:
            raise OcrProviderError("dependency_missing", f"Required package not installed: {e}")

        # On Windows, tesseract may not be in PATH — check common install locations
        import shutil
        if not shutil.which("tesseract"):
            import os
            for candidate in [
                r"C:\Program Files\Tesseract-OCR\tesseract.exe",
                r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
            ]:
                if os.path.isfile(candidate):
                    pytesseract.pytesseract.tesseract_cmd = candidate
                    break

        # --- 1. Preprocessing ---
        try:
            img = Image.open(io.BytesIO(image_bytes))
        except Exception as exc:
            raise OcrProviderError("image_invalid", f"Cannot open image: {exc}")

        img = ImageOps.exif_transpose(img) or img
        img = img.convert("L")  # grayscale
        img = ImageOps.autocontrast(img, cutoff=1)  # boost contrast
        img = img.filter(ImageFilter.SHARPEN)
        # Adaptive threshold for thermal receipts
        img = img.point(lambda x: 255 if x > 140 else 0, "1")

        # --- 2. OCR ---
        # Use eng+msa if Malay data available, fall back to eng only
        lang = "eng"
        try:
            available = pytesseract.get_languages()
            if "msa" in available:
                lang = "eng+msa"
        except Exception:
            pass

        try:
            raw_text: str = pytesseract.image_to_string(
                img, lang=lang, config="--psm 6"
            )
        except Exception as exc:
            raise OcrProviderError("ocr_failed", f"Tesseract failed: {exc}")

        if not raw_text.strip():
            raise OcrProviderError("empty_result", "Tesseract returned no text")

        # --- 3. Parse ---
        items = _parse_receipt_lines(raw_text)
        store = _parse_store(raw_text)
        total = _parse_total(raw_text)
        receipt_date = _parse_date(raw_text)
        tax = _parse_tax(raw_text)

        confidence = min(0.3 + 0.1 * len(items), 0.7)  # rough heuristic

        return ReceiptData(
            items=items,
            store=store,
            subtotal=None,
            tax=tax,
            total=total,
            date=receipt_date,
            currency="MYR",
            raw_text=raw_text,
            confidence=confidence,
        )


# ---------------------------------------------------------------------------
# Receipt text parsers
# ---------------------------------------------------------------------------

# Pattern 1: item name followed by price (right-aligned, 2+ spaces gap)
# Examples:
#   SUSU SEGAR 1L          5.90
#   WHITE BREAD x2         3.50
#   MILO 1KG              12.90
_ITEM_LINE_RE = re.compile(
    r"^(.+?)\s{2,}(\d+\.\d{2})\s*$", re.MULTILINE
)

# Pattern 2: Malaysian barcode format — barcode + item name + price on same line
# Examples:
#   09555039902111 4INI CHOCO 4.50
#   09555039900599 4INI PANDA 3.99
#   0955503990 MINI CHOCO 4.50
_BARCODE_ITEM_RE = re.compile(
    r"^(\d{8,14})\s+(.+?)\s+(\d+\.\d{2})\s*$", re.MULTILINE
)

# Pattern 3: Looser price at end of line (single space OK, for garbled OCR)
# Catches: "anything 4.50", "garbled text 3.99"
_LOOSE_PRICE_RE = re.compile(
    r"^(.{3,}?)\s+(\d+\.\d{2})\s*$", re.MULTILINE
)

# Quantity prefix/suffix patterns
_QTY_RE = re.compile(r"\bx\s*(\d+)\b", re.IGNORECASE)
_QTY_PREFIX_RE = re.compile(r"^(\d+)\s*[xX@]\s*")

# Total line patterns
_TOTAL_RE = re.compile(
    r"(?:TOTAL|JUMLAH|AMOUNT\s*DUE|GRAND\s*TOTAL)\s*[:\s]*([\d,]+\.\d{2})",
    re.IGNORECASE,
)

# Tax patterns (Malaysian SST/GST)
_TAX_RE = re.compile(
    r"(?:SST|GST|TAX|CUKAI|SERVICE\s*TAX)\s*(?:\d+%?)?\s*([\d,]+\.\d{2})",
    re.IGNORECASE,
)

# Date patterns
_DATE_PATTERNS = [
    re.compile(r"(\d{2})[/\-.](\d{2})[/\-.](\d{4})"),  # DD/MM/YYYY
    re.compile(r"(\d{4})[/\-.](\d{2})[/\-.](\d{2})"),  # YYYY/MM/DD
    re.compile(r"(\d{2})[/\-.](\d{2})[/\-.](\d{2})"),  # DD/MM/YY
]

# Lines to skip (headers, footers, non-item lines)
_SKIP_PATTERNS = re.compile(
    r"(TOTAL|JUMLAH|SUBTOTAL|CHANGE|TUNAI|CASH|VISA|MASTER|DEBIT|CREDIT|"
    r"CARD|TAX|SST|GST|CUKAI|THANK|TERIMA\s*KASIH|RECEIPT|RESIT|"
    r"CASHIER|KASIR|REG|TRANS|INV|TEL|FAX|GST\s*REG|NO\.?|"
    r"ROUNDING|BOUNDING|DISCOUNT|DISKAUN|MEMBER|AHLI|OPEN\s*DAILY|"
    r"SIGN\s*UP|SAVINGS|CLUBCARD|POINTS|MISSED|www\.|\.com|\.my)",
    re.IGNORECASE,
)


def _parse_receipt_lines(text: str) -> list[ReceiptItem]:
    """Extract item lines from raw OCR text using multiple patterns."""
    items: list[ReceiptItem] = []
    seen_lines: set[str] = set()  # deduplicate

    # --- Pass 1: Barcode + item + price (Malaysian format) ---
    for match in _BARCODE_ITEM_RE.finditer(text):
        barcode = match.group(1)
        raw_name = match.group(2).strip()
        price_str = match.group(3)
        line_key = f"{raw_name}:{price_str}"
        if line_key in seen_lines or _SKIP_PATTERNS.search(raw_name):
            continue
        seen_lines.add(line_key)
        price = float(price_str)
        if price <= 0 or price > 99999:
            continue
        name, quantity = _extract_qty(raw_name)
        if len(name) < 2:
            continue
        items.append(ReceiptItem(name=name, price=price, quantity=quantity, barcode=barcode, confidence=0.5))

    # --- Pass 2: Standard item + price (2+ space gap) ---
    for match in _ITEM_LINE_RE.finditer(text):
        raw_name = match.group(1).strip()
        price_str = match.group(2)
        line_key = f"{raw_name}:{price_str}"
        if line_key in seen_lines or _SKIP_PATTERNS.search(raw_name):
            continue
        seen_lines.add(line_key)
        price = float(price_str)
        if price <= 0 or price > 99999:
            continue
        name, quantity = _extract_qty(raw_name)
        # Strip leading barcode if embedded in name
        name = re.sub(r"^\d{8,14}\s*", "", name).strip()
        if len(name) < 2:
            continue
        barcode = None
        bc_match = re.search(r"\b(\d{8,13})\b", raw_name)
        if bc_match:
            barcode = bc_match.group(1)
        items.append(ReceiptItem(name=name, price=price, quantity=quantity, barcode=barcode, confidence=0.5))

    # --- Pass 3: Loose price match (fallback for garbled OCR) ---
    if not items:
        for match in _LOOSE_PRICE_RE.finditer(text):
            raw_name = match.group(1).strip()
            price_str = match.group(2)
            line_key = f"{raw_name}:{price_str}"
            if line_key in seen_lines or _SKIP_PATTERNS.search(raw_name):
                continue
            seen_lines.add(line_key)
            price = float(price_str)
            if price <= 0 or price > 99999:
                continue
            name, quantity = _extract_qty(raw_name)
            name = re.sub(r"^\d{8,14}\s*", "", name).strip()
            if len(name) < 3:
                continue
            barcode = None
            bc_match = re.search(r"\b(\d{8,13})\b", raw_name)
            if bc_match:
                barcode = bc_match.group(1)
            items.append(ReceiptItem(name=name, price=price, quantity=quantity, barcode=barcode, confidence=0.3))

    return items


def _extract_qty(raw_name: str) -> tuple[str, int]:
    """Extract quantity from item name and return (cleaned_name, quantity)."""
    quantity = 1
    qty_match = _QTY_RE.search(raw_name)
    if qty_match:
        quantity = int(qty_match.group(1))
        raw_name = _QTY_RE.sub("", raw_name).strip()
    else:
        qty_prefix = _QTY_PREFIX_RE.match(raw_name)
        if qty_prefix:
            quantity = int(qty_prefix.group(1))
            raw_name = raw_name[qty_prefix.end():].strip()
    name = re.sub(r"\s+", " ", raw_name).strip()
    return name, quantity


def _parse_store(text: str) -> ReceiptStore:
    """Extract store name from first few lines of receipt."""
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()][:5]
    name = lines[0] if lines else None
    # Second line often has address
    address = lines[1] if len(lines) > 1 and len(lines[1]) > 10 else None
    return ReceiptStore(name=name, address=address)


def _parse_total(text: str) -> Optional[float]:
    """Extract total amount from receipt text."""
    matches = _TOTAL_RE.findall(text)
    if matches:
        # Take the last (usually GRAND TOTAL)
        return float(matches[-1].replace(",", ""))
    return None


def _parse_tax(text: str) -> Optional[float]:
    """Extract tax amount from receipt text."""
    match = _TAX_RE.search(text)
    if match:
        return float(match.group(1).replace(",", ""))
    return None


def _parse_date(text: str) -> Optional[date]:
    """Extract date from receipt text."""
    for pattern in _DATE_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue
        groups = match.groups()
        try:
            if len(groups[0]) == 4:  # YYYY/MM/DD
                return date(int(groups[0]), int(groups[1]), int(groups[2]))
            elif len(groups[2]) == 4:  # DD/MM/YYYY
                return date(int(groups[2]), int(groups[1]), int(groups[0]))
            else:  # DD/MM/YY
                year = 2000 + int(groups[2])
                return date(year, int(groups[1]), int(groups[0]))
        except ValueError:
            continue
    return None
