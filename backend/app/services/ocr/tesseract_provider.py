"""
Tesseract OCR provider — local, free, no API key needed.

Pipeline:
  1. Preprocessing: EXIF transpose, resize, grayscale, autocontrast, denoise, deskew, Otsu threshold
  2. pytesseract OCR → raw text (multi-PSM: auto first, single block fallback)
  3. Regex-based line parser → ReceiptData

The preprocess_for_ocr(), detect_tesseract(), and get_ocr_lang() functions are
module-level so they can be imported by admin.py's OCR test-scan endpoint.
"""

from __future__ import annotations

import io
import logging
import re
from datetime import date
from typing import Optional

import numpy as np
from PIL import Image, ImageFilter, ImageOps

from .base import (
    OcrProvider,
    OcrProviderError,
    ReceiptData,
    ReceiptItem,
    ReceiptStore,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Shared preprocessing (importable by admin.py)
# ---------------------------------------------------------------------------

_tesseract_detected = False


def detect_tesseract() -> None:
    """Set pytesseract.tesseract_cmd if not in PATH (Windows)."""
    global _tesseract_detected
    if _tesseract_detected:
        return

    import pytesseract
    import shutil
    import os

    if not shutil.which("tesseract"):
        for candidate in [
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        ]:
            if os.path.isfile(candidate):
                pytesseract.pytesseract.tesseract_cmd = candidate
                break

    _tesseract_detected = True


def get_ocr_lang() -> str:
    """Detect available Tesseract languages, return 'eng+msa' or 'eng'."""
    import pytesseract

    try:
        available = pytesseract.get_languages()
        if "msa" in available:
            return "eng+msa"
    except Exception:
        pass
    return "eng"


def preprocess_for_ocr(image_bytes: bytes) -> Image.Image:
    """Full preprocessing pipeline for Tesseract OCR.

    Steps: EXIF transpose → resize → grayscale → autocontrast → denoise →
           deskew → Otsu threshold → invert check.

    Returns a binary PIL Image ready for Tesseract.
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))
    except Exception as exc:
        raise OcrProviderError("image_invalid", f"Cannot open image: {exc}")

    # 1. EXIF transpose (auto-correct phone rotation)
    img = ImageOps.exif_transpose(img) or img

    # 2. Size normalization
    w, h = img.size
    # Downscale if too large (avoid slow OCR)
    if w > 3000:
        scale = 3000 / w
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    # Upscale if too small (Tesseract needs ~300 DPI equivalent)
    w, h = img.size
    if w < 1500 or h < 500:
        scale = max(1500 / w, 500 / h, 1.0)
        if scale > 1.0:
            img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    # 3. Grayscale
    img = img.convert("L")

    # 4. Autocontrast — stretches histogram, improves faded text
    img = ImageOps.autocontrast(img, cutoff=1)

    # 5. Denoise — MedianFilter removes salt-and-pepper noise (better than SHARPEN for OCR)
    img = img.filter(ImageFilter.MedianFilter(3))

    # 6. Deskew — detect and correct text skew
    angle = _detect_skew(img)
    if abs(angle) > 0.5:
        img = img.rotate(-angle, expand=True, fillcolor=255, resample=Image.BICUBIC)

    # 7. Otsu threshold (adaptive, replaces fixed 140)
    arr = np.array(img, dtype=np.uint8)
    std = float(np.std(arr))

    if std < 10:
        # Image is already binary — skip thresholding
        pass
    else:
        threshold = _otsu_threshold(arr)
        # Guard: degenerate threshold means histogram is unimodal
        if threshold < 30 or threshold > 225:
            threshold = 128
        img = img.point(lambda x: 255 if x > threshold else 0, "1")

        # 8. Invert check — if mostly black, text is probably white-on-dark
        arr2 = np.array(img, dtype=np.uint8)
        black_ratio = np.sum(arr2 == 0) / arr2.size
        if black_ratio > 0.8:
            img = ImageOps.invert(img.convert("L")).point(lambda x: 255 if x > 128 else 0, "1")

    return img


def _otsu_threshold(arr: np.ndarray) -> int:
    """Compute Otsu's optimal threshold for bimodal histogram.

    Pure numpy — no OpenCV dependency.
    """
    hist = np.bincount(arr.ravel(), minlength=256).astype(np.float64)
    total = arr.size
    sum_total = np.dot(np.arange(256, dtype=np.float64), hist)

    sum_bg = 0.0
    weight_bg = 0.0
    max_var = 0.0
    best_t = 128

    for t in range(256):
        weight_bg += hist[t]
        if weight_bg == 0:
            continue
        weight_fg = total - weight_bg
        if weight_fg == 0:
            break
        sum_bg += t * hist[t]
        mean_bg = sum_bg / weight_bg
        mean_fg = (sum_total - sum_bg) / weight_fg
        var_between = weight_bg * weight_fg * (mean_bg - mean_fg) ** 2
        if var_between > max_var:
            max_var = var_between
            best_t = t

    return best_t


def _detect_skew(img: Image.Image) -> float:
    """Detect text skew angle using horizontal projection profile variance.

    Tests angles from -15° to +15° in 1° steps.
    Returns the angle that maximizes projection variance (= best text alignment).
    """
    arr = np.array(img, dtype=np.uint8)

    # Need enough content to detect skew
    binary = (arr < 128).astype(np.uint8)
    text_pixels = np.sum(binary)
    if text_pixels < 500:
        return 0.0  # too little content — skip deskew

    best_angle = 0.0
    best_var = 0.0

    for angle_deg in range(-15, 16):
        angle = float(angle_deg)
        rotated = Image.fromarray(binary * 255).rotate(angle, expand=False, fillcolor=0)
        rot_arr = np.array(rotated, dtype=np.uint8)
        proj = rot_arr.sum(axis=1)
        var = float(np.var(proj))
        if var > best_var:
            best_var = var
            best_angle = angle

    return best_angle


# ---------------------------------------------------------------------------
# TesseractProvider class
# ---------------------------------------------------------------------------


class TesseractProvider(OcrProvider):
    key = "tesseract"
    name = "Tesseract (Local)"

    def requires_api_key(self) -> bool:
        return False

    async def extract(self, image_bytes: bytes) -> ReceiptData:
        import pytesseract

        detect_tesseract()
        img = preprocess_for_ocr(image_bytes)
        lang = get_ocr_lang()

        ocr_config = f"--oem 1 --dpi 300"

        # Multi-PSM strategy: try auto (3) first, fallback to single block (6)
        # Never raises on empty — always returns whatever was found (even nothing).
        # Only true infrastructure failures (TesseractNotFoundError) propagate.
        try:
            raw_text: str = pytesseract.image_to_string(
                img, lang=lang, config=f"--psm 3 {ocr_config}"
            )
        except Exception:
            raw_text = ""

        if len(raw_text.strip()) < 10:
            try:
                raw_text_fallback: str = pytesseract.image_to_string(
                    img, lang=lang, config=f"--psm 6 {ocr_config}"
                )
                if len(raw_text_fallback.strip()) > len(raw_text.strip()):
                    raw_text = raw_text_fallback
            except Exception as exc:
                # Log but don't raise — return whatever we have (even empty)
                logger.warning("Tesseract PSM 6 fallback failed: %s", exc)

        # Return whatever was found — even if empty. Let the caller decide.
        if not raw_text.strip():
            return ReceiptData(
                items=[],
                store=ReceiptStore(),
                raw_text="",
                confidence=0.0,
                currency="MYR",
            )

        # --- Parse ---
        items = _parse_receipt_lines(raw_text)

        # LLM fallback: if regex found nothing but we have OCR text, try Mistral
        if not items and len(raw_text.strip()) > 20:
            items = await _llm_parse_receipt(raw_text)

        store = _parse_store(raw_text)
        total = _parse_total(raw_text)
        receipt_date = _parse_date(raw_text)
        tax = _parse_tax(raw_text)

        confidence = min(0.3 + 0.1 * len(items), 0.7) if items else min(0.1 + 0.05 * len(raw_text.split()), 0.3)

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
# Receipt text parsers — tiered regex + LLM fallback
# ---------------------------------------------------------------------------

# Flexible price fragment: 5.90, 12.5, 12 (integer), with optional RM/MYR
_P = r"(\d+(?:\.\d{1,2})?)"  # captures the number

# --- Tier 1: High confidence (0.6) ---

# Barcode + name + RM price: 1234567890123 MILK RM5.90
_BARCODE_RM_RE = re.compile(
    rf"^(\d{{8,14}})\s+(.+?)\s+(?:RM|MYR)\s*{_P}\s*$", re.MULTILINE | re.IGNORECASE
)
# Barcode + name + price: 1234567890123 MILK 5.90
_BARCODE_ITEM_RE = re.compile(
    rf"^(\d{{8,14}})\s+(.+?)\s+{_P}\s*$", re.MULTILINE
)
# Name + 2+ spaces + RM price: MILK    RM5.90
_ITEM_RM_RE = re.compile(
    rf"^(.+?)\s{{2,}}(?:RM|MYR)\s*{_P}\s*$", re.MULTILINE | re.IGNORECASE
)
# Name + 2+ spaces + price: MILK    5.90
_ITEM_LINE_RE = re.compile(
    rf"^(.+?)\s{{2,}}{_P}\s*$", re.MULTILINE
)
# Name + RM price (single space OK): MILK RM5.90
_RM_PRICE_RE = re.compile(
    rf"^(.{{2,}}?)\s+(?:RM|MYR)\s*{_P}\s*$", re.MULTILINE | re.IGNORECASE
)
# Quantity calc: MILK 2 x 5.90 = 11.80  or  2 x RM5.90
_QTY_CALC_RE = re.compile(
    rf"^(.{{2,}}?)\s+(\d+)\s*[xX@]\s*(?:RM|MYR)?\s*{_P}"
    rf"(?:\s*=\s*(?:RM|MYR)?\s*\d+(?:\.\d{{1,2}})?)?[\s*]*$",
    re.MULTILINE | re.IGNORECASE,
)
# Tab-separated: MILK\t\t5.90
_TAB_SEP_RE = re.compile(
    rf"^(.{{2,}}?)\t+(?:RM|MYR)?\s*{_P}\s*$", re.MULTILINE | re.IGNORECASE
)

# --- Tier 2: Medium confidence (0.4) ---

# RM price at start: RM5.90 MILK
_RM_START_RE = re.compile(
    rf"^(?:RM|MYR)\s*{_P}\s+(.{{2,}}?)\s*$", re.MULTILINE | re.IGNORECASE
)
# Price at start (no RM): 5.90 MILK
_PRICE_START_RE = re.compile(
    rf"^{_P}\s+(.{{2,}}?)\s*$", re.MULTILINE
)
# Name + price + RM suffix: MILK 5.90RM
_PRICE_RM_SUFFIX_RE = re.compile(
    rf"^(.{{2,}}?)\s+{_P}\s*(?:RM|MYR)\s*$", re.MULTILINE | re.IGNORECASE
)

# --- Tier 3: Low confidence (0.3, fallback only) ---

# Anything + space + price (single space OK, 3+ char name)
_LOOSE_PRICE_RE = re.compile(
    rf"^(.{{3,}}?)\s+{_P}[\s*TtAa]*$", re.MULTILINE
)

# --- Quantity ---
_QTY_RE = re.compile(r"\bx\s*(\d+)\b", re.IGNORECASE)
_QTY_PREFIX_RE = re.compile(r"^(\d+)\s*[xX@]\s*")

# --- Totals, tax, dates ---
_TOTAL_RE = re.compile(
    r"(?:TOTAL|JUMLAH|AMOUNT\s*DUE|GRAND\s*TOTAL)\s*[:\s]*(?:RM|MYR)?\s*([\d,]+(?:\.\d{1,2})?)",
    re.IGNORECASE,
)

_TAX_RE = re.compile(
    r"(?:SST|GST|TAX|CUKAI|SERVICE\s*TAX)\s*(?:\d+%?)?\s*(?:RM|MYR)?\s*([\d,]+(?:\.\d{1,2})?)",
    re.IGNORECASE,
)

_DATE_PATTERNS = [
    re.compile(r"(\d{2})[/\-.](\d{2})[/\-.](\d{4})"),
    re.compile(r"(\d{4})[/\-.](\d{2})[/\-.](\d{2})"),
    re.compile(r"(\d{2})[/\-.](\d{2})[/\-.](\d{2})"),
]

# Lines to skip (headers, footers, non-item lines)
_SKIP_PATTERNS = re.compile(
    r"(TOTAL|JUMLAH|SUBTOTAL|CHANGE|TUNAI|CASH|VISA|MASTER|DEBIT|CREDIT|"
    r"CARD|TAX|SST|GST|CUKAI|THANK|TERIMA\s*KASIH|RECEIPT|RESIT|"
    r"CASHIER|KASIR|REG|TRANS|INV|TEL|FAX|GST\s*REG|NO\.?|"
    r"ROUNDING|BOUNDING|DISCOUNT|DISKAUN|MEMBER|AHLI|OPEN\s*DAILY|"
    r"SIGN\s*UP|SAVINGS|CLUBCARD|POINTS|MISSED|www\.|\.com|\.my|"
    r"PAYMENT|BAYARAN|ROUNDED|QR\s*CODE|SCAN\s*TO|BALANCE|BAKI)",
    re.IGNORECASE,
)


def _clean_price(price_str: str) -> float:
    """Strip currency prefix/suffix and convert to float."""
    cleaned = re.sub(r"[^\d.]", "", price_str)
    return float(cleaned) if cleaned else 0.0


def _try_add_item(
    items: list[ReceiptItem],
    seen: set[str],
    raw_name: str,
    price_str: str,
    confidence: float,
    barcode: Optional[str] = None,
    quantity: int = 0,
    min_name_len: int = 2,
) -> None:
    """Validate and add an item to the list. Shared by all pattern tiers."""
    raw_name = raw_name.strip()
    if _SKIP_PATTERNS.search(raw_name):
        return
    price = _clean_price(price_str)
    if price <= 0 or price > 99999:
        return
    line_key = f"{raw_name}:{price_str}"
    if line_key in seen:
        return
    seen.add(line_key)

    name, qty = _extract_qty(raw_name)
    if quantity > 0:
        qty = quantity  # override from qty-calc pattern
    name = re.sub(r"^\d{8,14}\s*", "", name).strip()
    if len(name) < min_name_len:
        return
    if not barcode:
        bc_match = re.search(r"\b(\d{8,13})\b", raw_name)
        if bc_match:
            barcode = bc_match.group(1)
    items.append(ReceiptItem(name=name, price=price, quantity=qty, barcode=barcode, confidence=confidence))


def _parse_receipt_lines(text: str) -> list[ReceiptItem]:
    """Extract item lines from raw OCR text using tiered regex patterns.

    Tier 1 (0.6): barcode+RM, barcode, name+RM(2sp), name(2sp), name+RM(1sp), qty-calc, tab
    Tier 2 (0.4): RM-start, price-start, RM-suffix (if Tier 1 found items, still add Tier 2)
    Tier 3 (0.3): loose fallback (only if Tiers 1+2 found nothing)
    """
    items: list[ReceiptItem] = []
    seen: set[str] = set()

    # --- Tier 1: High confidence ---
    for m in _BARCODE_RM_RE.finditer(text):
        _try_add_item(items, seen, m.group(2), m.group(3), 0.6, barcode=m.group(1))
    for m in _BARCODE_ITEM_RE.finditer(text):
        _try_add_item(items, seen, m.group(2), m.group(3), 0.6, barcode=m.group(1))
    for m in _ITEM_RM_RE.finditer(text):
        _try_add_item(items, seen, m.group(1), m.group(2), 0.6)
    for m in _ITEM_LINE_RE.finditer(text):
        _try_add_item(items, seen, m.group(1), m.group(2), 0.6)
    for m in _RM_PRICE_RE.finditer(text):
        _try_add_item(items, seen, m.group(1), m.group(2), 0.6)
    for m in _QTY_CALC_RE.finditer(text):
        _try_add_item(items, seen, m.group(1), m.group(3), 0.6, quantity=int(m.group(2)))
    for m in _TAB_SEP_RE.finditer(text):
        _try_add_item(items, seen, m.group(1), m.group(2), 0.6)

    # --- Tier 2: Medium confidence ---
    for m in _RM_START_RE.finditer(text):
        _try_add_item(items, seen, m.group(2), m.group(1), 0.4)
    for m in _PRICE_START_RE.finditer(text):
        _try_add_item(items, seen, m.group(2), m.group(1), 0.4)
    for m in _PRICE_RM_SUFFIX_RE.finditer(text):
        _try_add_item(items, seen, m.group(1), m.group(2), 0.4)

    # --- Tier 3: Low confidence (only if nothing found yet) ---
    if not items:
        for m in _LOOSE_PRICE_RE.finditer(text):
            _try_add_item(items, seen, m.group(1), m.group(2), 0.3, min_name_len=3)

    return items


def _extract_qty(raw_name: str) -> tuple[str, int]:
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
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()][:5]
    name = lines[0] if lines else None
    address = lines[1] if len(lines) > 1 and len(lines[1]) > 10 else None
    return ReceiptStore(name=name, address=address)


def _parse_total(text: str) -> Optional[float]:
    matches = _TOTAL_RE.findall(text)
    if matches:
        return float(matches[-1].replace(",", ""))
    return None


def _parse_tax(text: str) -> Optional[float]:
    match = _TAX_RE.search(text)
    if match:
        return float(match.group(1).replace(",", ""))
    return None


def _parse_date(text: str) -> Optional[date]:
    for pattern in _DATE_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue
        groups = match.groups()
        try:
            if len(groups[0]) == 4:
                return date(int(groups[0]), int(groups[1]), int(groups[2]))
            elif len(groups[2]) == 4:
                return date(int(groups[2]), int(groups[1]), int(groups[0]))
            else:
                year = 2000 + int(groups[2])
                return date(year, int(groups[1]), int(groups[0]))
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------------------
# LLM fallback — Mistral AI structured extraction
# ---------------------------------------------------------------------------


async def _llm_parse_receipt(raw_text: str) -> list[ReceiptItem]:
    """Use Mistral's free API to extract items when regex fails.

    Only called when:
    - _parse_receipt_lines() returned 0 items
    - raw_text has 20+ chars of content
    - MISTRAL_API_KEY is configured

    Returns list of ReceiptItem with confidence=0.5, or [] on any failure.
    """
    import json
    import httpx

    from app.core.config import settings

    if not settings.MISTRAL_API_KEY:
        return []

    prompt = (
        "Extract grocery items from this receipt text. "
        "Return ONLY a JSON object with an 'items' key containing an array.\n"
        'Example: {"items": [{"name": "MILK", "price": 5.90, "quantity": 1}]}\n'
        "Rules:\n"
        "- Only include purchased items (food, drinks, household products)\n"
        "- Ignore headers, footers, store info, totals, taxes, payment lines\n"
        "- Price should be a number (strip RM/MYR currency prefix)\n"
        "- Quantity defaults to 1 if not specified\n"
        "- If no items found, return {\"items\": []}\n\n"
        f"Receipt text:\n{raw_text[:3000]}"
    )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.MISTRAL_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "mistral-small-latest",
                    "messages": [
                        {"role": "system", "content": "You extract grocery items from receipt text. Return ONLY valid JSON."},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.0,
                    "max_tokens": 2000,
                    "response_format": {"type": "json_object"},
                },
            )

        if resp.status_code != 200:
            logger.info("Mistral API returned %d — skipping LLM fallback", resp.status_code)
            return []

        content = resp.json()["choices"][0]["message"]["content"]
        parsed = json.loads(content)

        # Handle both {"items": [...]} and bare [...]
        raw_items = parsed.get("items", parsed) if isinstance(parsed, dict) else parsed
        if not isinstance(raw_items, list):
            return []

        items: list[ReceiptItem] = []
        for item in raw_items:
            name = str(item.get("name", "")).strip()
            if len(name) < 2 or _SKIP_PATTERNS.search(name):
                continue
            try:
                price = float(item.get("price", 0))
            except (ValueError, TypeError):
                continue
            if price <= 0 or price > 99999:
                continue
            qty = max(1, int(item.get("quantity", 1)))
            barcode = item.get("barcode") or None
            items.append(ReceiptItem(name=name, price=price, quantity=qty, barcode=barcode, confidence=0.5))

        if items:
            logger.info("LLM fallback extracted %d items from receipt", len(items))
        return items

    except Exception as e:
        logger.info("LLM fallback failed (non-fatal): %s", e)
        return []
