"""
Product label parsing service — extract product details from OCR text.

Three parsers:
1. parse_product_label() — name, brand, weight, expiry, barcode from packaging label
2. parse_expiry_text() — expiry date only (quick capture)
3. parse_shelf_audit() — fuzzy match text chunks against inventory items
"""

from __future__ import annotations

import re
import logging
from datetime import date, datetime
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Stop words for shelf audit (common text that isn't a product name)
# ---------------------------------------------------------------------------

STOP_WORDS = {
    "sdn", "bhd", "halal", "product", "products", "malaysia", "made", "in",
    "net", "wt", "weight", "ingredients", "nutrition", "storage", "store",
    "keep", "refrigerated", "contains", "allergen", "serving", "size",
    "per", "energy", "protein", "fat", "carbohydrate", "sugar", "sodium",
    "best", "before", "use", "by", "exp", "mfg", "lot", "batch",
    "manufactured", "distributed", "imported", "packed", "for",
    "the", "and", "or", "of", "to", "a", "an", "is", "it", "no",
    "tel", "fax", "www", "com", "my", "org", "email",
}

# ---------------------------------------------------------------------------
# Weight/volume patterns
# ---------------------------------------------------------------------------

_WEIGHT_RE = re.compile(
    r"(?:Net\s*(?:Wt|Weight|Vol)[.\s:]*)?(\d+(?:\.\d+)?)\s*(g|kg|ml|l|oz|lb|cl)\b",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Expiry date patterns
# ---------------------------------------------------------------------------

_EXPIRY_KEYWORD_RE = re.compile(
    r"(?:Best\s*Before|BB|BBD|Exp(?:iry)?|Use\s*By|EXP\s*DATE)\s*[:\s./-]*",
    re.IGNORECASE,
)

_DATE_PATTERNS = [
    # DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    re.compile(r"(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})"),
    # DD/MM/YY
    re.compile(r"(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})"),
    # YYYY/MM/DD
    re.compile(r"(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})"),
    # DD MMM YYYY (15 APR 2026, 15 Apr 26)
    re.compile(r"(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\w*\s+(\d{2,4})", re.IGNORECASE),
    # MMM YYYY (APR 2026) — no day
    re.compile(r"(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\w*\s+(\d{4})", re.IGNORECASE),
]

_MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

# Barcode pattern (8-13 digits)
_BARCODE_RE = re.compile(r"\b(\d{8,13})\b")


# ---------------------------------------------------------------------------
# 1. Parse product label
# ---------------------------------------------------------------------------


def parse_product_label(raw_text: str) -> Dict[str, Any]:
    """Parse OCR text from a product label/packaging.

    Extracts: name, brand, weight, weight_unit, expiry_date, barcode.
    """
    lines = [ln.strip() for ln in raw_text.split("\n") if ln.strip()]
    if not lines:
        return {"name": None, "brand": None, "weight": None, "weight_unit": None, "expiry_date": None, "barcode": None}

    # Brand: usually first line (company name)
    brand = lines[0] if lines else None

    # Name: second line (or first if only one line)
    name = lines[1] if len(lines) > 1 else lines[0]

    # Filter out generic lines for name
    if name and _is_generic_text(name):
        for ln in lines[2:5]:
            if not _is_generic_text(ln) and len(ln) > 2:
                name = ln
                break

    # Weight
    weight = None
    weight_unit = None
    for ln in lines:
        m = _WEIGHT_RE.search(ln)
        if m:
            weight = float(m.group(1))
            weight_unit = m.group(2).lower()
            if weight_unit == "l":
                weight_unit = "L"
            break

    # Expiry date
    expiry_date = _find_expiry_date(raw_text)

    # Barcode
    barcode = None
    for m in _BARCODE_RE.finditer(raw_text):
        candidate = m.group(1)
        # Prefer longer barcodes (EAN-13 over EAN-8)
        if barcode is None or len(candidate) > len(barcode):
            barcode = candidate

    return {
        "name": _clean_text(name) if name else None,
        "brand": _clean_text(brand) if brand else None,
        "weight": weight,
        "weight_unit": weight_unit,
        "expiry_date": expiry_date.isoformat() if expiry_date else None,
        "barcode": barcode,
        "raw_text": raw_text[:2000],
    }


# ---------------------------------------------------------------------------
# 2. Parse expiry date only
# ---------------------------------------------------------------------------


def parse_expiry_text(raw_text: str) -> Optional[str]:
    """Parse just the expiry date from OCR text. Returns ISO date string or None."""
    d = _find_expiry_date(raw_text)
    return d.isoformat() if d else None


def _find_expiry_date(text: str) -> Optional[date]:
    """Find the most likely expiry date in text."""
    # Strategy 1: Find date after expiry keywords
    for keyword_match in _EXPIRY_KEYWORD_RE.finditer(text):
        after_keyword = text[keyword_match.end():]
        d = _parse_first_date(after_keyword)
        if d:
            return d

    # Strategy 2: Find any date in the text (take the latest one — more likely expiry than manufacture)
    all_dates = _find_all_dates(text)
    if all_dates:
        return max(all_dates)

    return None


def _parse_first_date(text: str) -> Optional[date]:
    """Parse the first date found in text."""
    for pattern in _DATE_PATTERNS:
        m = pattern.search(text)
        if m:
            return _match_to_date(m)
    return None


def _find_all_dates(text: str) -> List[date]:
    """Find all dates in text."""
    dates = []
    for pattern in _DATE_PATTERNS:
        for m in pattern.finditer(text):
            d = _match_to_date(m)
            if d:
                dates.append(d)
    return dates


def _match_to_date(m: re.Match) -> Optional[date]:
    """Convert a regex match to a date object."""
    groups = m.groups()
    try:
        if len(groups) == 3:
            a, b, c = groups

            # Check for month name (DD MMM YYYY)
            if isinstance(b, str) and b[:3].lower() in _MONTH_MAP:
                day = int(a)
                month = _MONTH_MAP[b[:3].lower()]
                year = int(c)
                if year < 100:
                    year += 2000
                return date(year, month, day)

            a, b, c = int(a), int(b), int(c)

            # YYYY/MM/DD
            if a > 1000:
                return date(a, b, c)

            # DD/MM/YY or DD/MM/YYYY
            if c < 100:
                c += 2000
            # Malaysian convention: DD/MM/YYYY
            return date(c, b, a)

        elif len(groups) == 2:
            # MMM YYYY (no day → use 1st)
            month_str, year_str = groups
            month = _MONTH_MAP.get(month_str[:3].lower())
            if month:
                return date(int(year_str), month, 1)

    except (ValueError, TypeError):
        pass
    return None


# ---------------------------------------------------------------------------
# 3. Shelf audit — fuzzy match text to inventory
# ---------------------------------------------------------------------------


def parse_shelf_audit(
    raw_text: str,
    inventory_items: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Parse shelf/fridge photo OCR and match against inventory.

    Returns grouped results: matched, unknown, ignored.
    """
    lines = [ln.strip() for ln in raw_text.split("\n") if ln.strip()]

    # Deduplicate similar lines
    seen = set()
    unique_chunks = []
    for ln in lines:
        normalized = ln.lower().strip()
        if normalized not in seen and len(normalized) > 1:
            seen.add(normalized)
            unique_chunks.append(ln)

    matched = []
    unknown = []
    ignored = []

    for chunk in unique_chunks:
        # Skip generic/stop word lines
        if _is_generic_text(chunk):
            ignored.append({"text": chunk, "reason": "generic"})
            continue

        # Skip very short text (1-2 chars)
        if len(chunk.strip()) <= 2:
            ignored.append({"text": chunk, "reason": "too_short"})
            continue

        # Skip lines that are just numbers
        if re.match(r"^[\d\s.,/:-]+$", chunk):
            ignored.append({"text": chunk, "reason": "numbers_only"})
            continue

        # Fuzzy match against inventory
        chunk_lower = chunk.lower()
        best_match = None
        for item in inventory_items:
            item_name = (item.get("name") or "").lower()
            if not item_name:
                continue
            # Substring match in either direction
            if chunk_lower in item_name or item_name in chunk_lower:
                best_match = item
                break
            # Word overlap (≥50% words match)
            chunk_words = set(chunk_lower.split())
            item_words = set(item_name.split())
            if chunk_words and item_words:
                overlap = len(chunk_words & item_words) / max(len(chunk_words), len(item_words))
                if overlap >= 0.5:
                    best_match = item
                    break

        if best_match:
            # Check expiry status
            exp = best_match.get("expiryDate") or best_match.get("expiry_date")
            exp_ms = (exp if exp and exp > 1e12 else (exp * 1000 if exp else None))
            now_ms = datetime.utcnow().timestamp() * 1000
            is_expired = exp_ms is not None and exp_ms < now_ms
            is_expiring = exp_ms is not None and 0 < (exp_ms - now_ms) < 7 * 24 * 60 * 60 * 1000

            matched.append({
                "text": chunk,
                "item_id": best_match.get("id"),
                "item_name": best_match.get("name"),
                "item_location": best_match.get("location"),
                "item_quantity": best_match.get("quantity"),
                "item_user_id": best_match.get("user_id"),
                "is_expired": is_expired,
                "is_expiring": is_expiring,
            })
        else:
            unknown.append({"text": chunk})

    return {
        "matched": matched,
        "unknown": unknown,
        "ignored": ignored,
        "summary": {
            "matched_count": len(matched),
            "unknown_count": len(unknown),
            "ignored_count": len(ignored),
        },
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _is_generic_text(text: str) -> bool:
    """Check if text is too generic to be a product name."""
    words = set(text.lower().split())
    if not words:
        return True
    # If >70% of words are stop words, it's generic
    stop_count = sum(1 for w in words if w.rstrip(".,;:") in STOP_WORDS)
    return stop_count / len(words) > 0.7


def _clean_text(text: str) -> str:
    """Clean extracted text."""
    text = re.sub(r"\s+", " ", text).strip()
    # Remove trailing punctuation
    text = text.rstrip(".,;:-")
    return text[:100]
