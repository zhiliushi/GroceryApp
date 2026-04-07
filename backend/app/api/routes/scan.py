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
        return {
            "success": False, "raw_text": "", "parsed": {}, "provider": "tesseract",
            "fields_extracted": 0, "inventory": None,
            "message": "OCR service is temporarily unavailable. Please try again later.",
        }

    parsed = product_label_service.parse_product_label(raw_text)
    fields_extracted = sum(1 for v in [parsed.get("name"), parsed.get("brand"), parsed.get("weight"), parsed.get("expiry_date"), parsed.get("barcode")] if v)

    # If barcode detected, check inventory
    inventory_check = None
    if parsed.get("barcode"):
        from app.services import inventory_service
        inventory_check = inventory_service.find_items_by_barcode(user.uid, parsed["barcode"])

    if fields_extracted > 0:
        message = f"Extracted {fields_extracted} field(s)"
    elif raw_text.strip():
        preview = raw_text.strip()[:100]
        message = f"Could not identify product details. The text found was: '{preview}'. Try photographing just the product name and barcode."
    else:
        message = "No text could be detected. Tips: Hold the label flat, ensure good lighting, and avoid reflections."

    return {
        "success": fields_extracted > 0,
        "provider": "tesseract",
        "fields_extracted": fields_extracted,
        "parsed": {**parsed, "raw_text": raw_text[:2000]},
        "inventory": inventory_check,
        "message": message,
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
        return {"success": False, "date": None, "raw_text": "", "message": "OCR service is temporarily unavailable. Please try again later."}

    expiry = product_label_service.parse_expiry_text(raw_text)

    if expiry:
        return {
            "success": True,
            "date": expiry,
            "raw_text": raw_text[:1000],
            "message": f"Detected expiry date: {expiry}",
        }
    elif raw_text.strip():
        preview = raw_text.strip()[:100]
        return {
            "success": False,
            "date": None,
            "raw_text": raw_text[:1000],
            "message": f"Text was found but no date could be identified. Text: '{preview}'. Try pointing the camera directly at the expiry date.",
        }
    else:
        return {
            "success": False,
            "date": None,
            "raw_text": "",
            "message": "No text could be detected. Tips: Hold the product closer, ensure good lighting, and point at the date area.",
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
        return {
            "success": False,
            "results": {"matched": [], "unknown": [], "ignored": [], "summary": {"matched_count": 0, "unknown_count": 0, "ignored_count": 0}},
            "raw_text": "", "message": "OCR service is temporarily unavailable. Please try again later.",
        }

    if not raw_text.strip():
        return {
            "success": False,
            "results": {"matched": [], "unknown": [], "ignored": [], "summary": {"matched_count": 0, "unknown_count": 0, "ignored_count": 0}},
            "raw_text": "",
            "message": "No text detected. Try with better lighting, open the door wider, or ensure product labels are visible.",
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
