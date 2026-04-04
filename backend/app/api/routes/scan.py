"""
Smart camera scan routes — product label, expiry date, shelf audit.

All 3 endpoints use Tesseract only (free, local).
Mindee and Google Vision are reserved for receipt scanning.
"""

import io
import logging

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from PIL import Image

from app.core.auth import UserInfo, get_current_user
from app.services import product_label_service

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_IMAGE_SIZE = 5 * 1024 * 1024


async def _ocr_tesseract_only(image_bytes: bytes) -> str:
    """Run OCR using Tesseract only (no cloud providers)."""
    from app.services.ocr.tesseract_provider import TesseractProvider
    provider = TesseractProvider()
    result = await provider.extract(image_bytes)
    return result.raw_text


async def _validate_image(image: UploadFile) -> bytes:
    """Validate and read uploaded image."""
    if image.content_type and image.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(400, "Only JPEG/PNG images accepted")
    image_bytes = await image.read()
    if len(image_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(413, "Image too large (max 5MB)")
    try:
        Image.open(io.BytesIO(image_bytes))
    except Exception:
        raise HTTPException(422, "Could not read image")
    return image_bytes


# ---------------------------------------------------------------------------
# POST /api/scan/product-label
# ---------------------------------------------------------------------------

@router.post("/product-label")
async def scan_product_label(
    image: UploadFile = File(...),
    user: UserInfo = Depends(get_current_user),
):
    """Scan a product label/packaging photo. Extracts name, brand, weight, expiry, barcode."""
    image_bytes = await _validate_image(image)

    try:
        raw_text = await _ocr_tesseract_only(image_bytes)
    except Exception as e:
        logger.warning("Label scan OCR failed: %s", e)
        return {"success": False, "raw_text": "", "parsed": {}, "message": f"OCR failed: {e}"}

    parsed = product_label_service.parse_product_label(raw_text)
    fields_extracted = sum(1 for v in [parsed.get("name"), parsed.get("brand"), parsed.get("weight"), parsed.get("expiry_date"), parsed.get("barcode")] if v)

    # If barcode detected, check inventory
    inventory_check = None
    if parsed.get("barcode"):
        from app.services import inventory_service
        inventory_check = inventory_service.find_items_by_barcode(user.uid, parsed["barcode"])

    return {
        "success": fields_extracted > 0,
        "provider": "tesseract",
        "fields_extracted": fields_extracted,
        "parsed": parsed,
        "inventory": inventory_check,
        "message": f"Extracted {fields_extracted} field(s)" if fields_extracted > 0 else "Could not read the label. Try a clearer photo.",
    }


# ---------------------------------------------------------------------------
# POST /api/scan/expiry-date
# ---------------------------------------------------------------------------

@router.post("/expiry-date")
async def scan_expiry_date(
    image: UploadFile = File(...),
    user: UserInfo = Depends(get_current_user),
):
    """Scan just the expiry date from a product photo. Returns ISO date string."""
    image_bytes = await _validate_image(image)

    try:
        raw_text = await _ocr_tesseract_only(image_bytes)
    except Exception as e:
        logger.warning("Expiry scan OCR failed: %s", e)
        return {"success": False, "date": None, "raw_text": "", "message": f"OCR failed: {e}"}

    expiry = product_label_service.parse_expiry_text(raw_text)

    if expiry:
        return {
            "success": True,
            "date": expiry,
            "raw_text": raw_text[:1000],
            "message": f"Detected expiry date: {expiry}",
        }
    else:
        return {
            "success": False,
            "date": None,
            "raw_text": raw_text[:1000],
            "message": "No expiry date detected. Try pointing the camera directly at the date text.",
        }


# ---------------------------------------------------------------------------
# POST /api/scan/shelf-audit
# ---------------------------------------------------------------------------

@router.post("/shelf-audit")
async def scan_shelf_audit(
    image: UploadFile = File(...),
    user: UserInfo = Depends(get_current_user),
):
    """Scan a shelf/fridge photo and match visible products against inventory."""
    image_bytes = await _validate_image(image)

    try:
        raw_text = await _ocr_tesseract_only(image_bytes)
    except Exception as e:
        logger.warning("Shelf audit OCR failed: %s", e)
        return {"success": False, "results": {}, "raw_text": "", "message": f"OCR failed: {e}"}

    if not raw_text.strip():
        return {
            "success": False,
            "results": {"matched": [], "unknown": [], "ignored": [], "summary": {"matched_count": 0, "unknown_count": 0, "ignored_count": 0}},
            "raw_text": "",
            "message": "No text detected. Try with better lighting or clearer labels.",
        }

    # Get user's inventory for matching
    from app.services import inventory_service
    items = inventory_service.get_household_items(user.uid, limit=500, status="active")

    results = product_label_service.parse_shelf_audit(raw_text, items)

    return {
        "success": results["summary"]["matched_count"] > 0 or results["summary"]["unknown_count"] > 0,
        "results": results,
        "raw_text": raw_text[:3000],
        "message": f"{results['summary']['matched_count']} matched, {results['summary']['unknown_count']} new",
    }
