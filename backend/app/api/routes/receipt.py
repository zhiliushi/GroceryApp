"""
Receipt scanning API routes.

POST /api/receipt/scan     — Upload receipt image → cascading OCR → parsed items
POST /api/receipt/confirm  — User-reviewed items → save to inventory/price history
GET  /api/receipt/history  — User's own scan history
"""

import logging
from dataclasses import asdict

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from PIL import Image
import io

from app.core.auth import UserInfo, get_current_user
from app.schemas.receipt import (
    ReceiptScanResponse,
    ReceiptItemResponse,
    ReceiptStoreResponse,
    ProviderAttemptResponse,
    ReceiptConfirmRequest,
    ReceiptConfirmResponse,
)
from app.services.ocr.manager import OcrManager
from app.services import ocr_config_service, receipt_log_service

logger = logging.getLogger(__name__)

router = APIRouter()

# Singleton manager (providers are lazily instantiated)
_ocr_manager = OcrManager()

# Limits
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MIN_IMAGE_DIMENSION = 100


# ---------------------------------------------------------------------------
# POST /api/receipt/scan
# ---------------------------------------------------------------------------


@router.post("/scan", response_model=ReceiptScanResponse)
async def scan_receipt(
    image: UploadFile = File(...),
    user: UserInfo = Depends(get_current_user),
):
    """Upload a receipt image and get parsed items for confirmation.

    The response is unconfirmed — items must be reviewed and submitted
    via POST /api/receipt/confirm before they are saved.
    """
    # --- Validate tier access ---
    _check_receipt_access(user)

    # --- Validate image ---
    if image.content_type and image.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(400, f"Unsupported image type: {image.content_type}. Use JPEG or PNG.")

    image_bytes = await image.read()
    if len(image_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(413, f"Image too large ({len(image_bytes) // 1024}KB). Maximum is 5MB.")

    if len(image_bytes) < 100:
        raise HTTPException(400, "Image file is too small or empty.")

    # Validate it's actually an image
    try:
        img = Image.open(io.BytesIO(image_bytes))
        width, height = img.size
        if width < MIN_IMAGE_DIMENSION or height < MIN_IMAGE_DIMENSION:
            logger.warning("Small image: %dx%d from user %s", width, height, user.uid)
    except Exception:
        raise HTTPException(422, "Could not read image. Please upload a valid JPEG or PNG file.")

    # --- Load OCR config ---
    ocr_config = ocr_config_service.get_ocr_config()
    if not ocr_config.get("enabled", True):
        raise HTTPException(403, "Receipt scanning is currently disabled by admin.")

    usage = ocr_config_service.get_usage()

    # --- Run OCR cascade ---
    result = await _ocr_manager.scan(image_bytes, ocr_config, usage)

    # --- Track usage for the provider that was used ---
    for attempt in result.attempts:
        if attempt.status == "success":
            ocr_config_service.increment_usage(attempt.provider, success=True)
        elif attempt.status == "error":
            ocr_config_service.increment_usage(attempt.provider, success=False)

    # --- Log the scan ---
    final_status = "success" if result.success else "all_failed"
    if result.success and result.data and len(result.data.items) == 0:
        final_status = "no_items_parsed"

    receipt_log_service.create_scan_log(
        uid=user.uid,
        scan_id=result.scan_id,
        image_size_bytes=len(image_bytes),
        attempts=[asdict(a) for a in result.attempts],
        final_provider=result.provider_used,
        final_status=final_status,
        items_detected=len(result.data.items) if result.data else 0,
        raw_text=result.data.raw_text if result.data else "",
    )

    # --- Enrich items with barcode lookups (silent, best-effort) ---
    if result.success and result.data:
        await _enrich_items_with_barcodes(result.data.items)

    # --- Build response ---
    if result.success and result.data:
        data = result.data
        return ReceiptScanResponse(
            success=True,
            scan_id=result.scan_id,
            provider_used=result.provider_used,
            confidence=data.confidence,
            store=ReceiptStoreResponse(name=data.store.name, address=data.store.address),
            items=[
                ReceiptItemResponse(
                    name=item.name,
                    price=item.price,
                    quantity=item.quantity,
                    barcode=item.barcode,
                    confidence=item.confidence,
                    brand=getattr(item, "_brand", None),
                    image_url=getattr(item, "_image_url", None),
                    barcode_source=getattr(item, "_source", None),
                )
                for item in data.items
            ],
            subtotal=data.subtotal,
            tax=data.tax,
            total=data.total,
            date=data.date.isoformat() if data.date else None,
            currency=data.currency,
            raw_text=data.raw_text[:5000],
            attempts=[
                ProviderAttemptResponse(**asdict(a))
                for a in result.attempts
                if not hasattr(a, "_receipt_data") or True  # filter internal attrs
            ],
        )
    else:
        return ReceiptScanResponse(
            success=False,
            scan_id=result.scan_id,
            error=result.error,
            attempts=[
                ProviderAttemptResponse(**{k: v for k, v in asdict(a).items() if not k.startswith("_")})
                for a in result.attempts
            ],
        )


# ---------------------------------------------------------------------------
# POST /api/receipt/confirm
# ---------------------------------------------------------------------------


@router.post("/confirm", response_model=ReceiptConfirmResponse)
async def confirm_receipt(
    body: ReceiptConfirmRequest,
    user: UserInfo = Depends(get_current_user),
):
    """Confirm user-reviewed receipt items and save them.

    Destinations:
      - inventory: creates inventory_items + price_history
      - shopping_list: adds items to specified list
      - price_only: only creates price_history records
    """
    _check_receipt_access(user)

    # Validate scan exists and belongs to user
    scan = receipt_log_service.get_scan(user.uid, body.scan_id)
    if not scan:
        raise HTTPException(404, "Scan not found.")

    if scan.get("confirmed"):
        return ReceiptConfirmResponse(
            success=True,
            message="Already confirmed",
            items_added=len(scan.get("confirmed_items", [])),
            destination=scan.get("destination", ""),
        )

    # --- Save items based on destination ---
    confirmed_items = [item.model_dump() for item in body.items]

    if body.destination == "inventory":
        _save_to_inventory(user.uid, body, confirmed_items)
    elif body.destination == "shopping_list":
        if not body.list_id:
            raise HTTPException(400, "list_id is required for shopping_list destination.")
        _save_to_shopping_list(user.uid, body)
    elif body.destination == "price_only":
        _save_prices_only(user.uid, body, confirmed_items)

    # Update scan log
    receipt_log_service.confirm_scan(
        uid=user.uid,
        scan_id=body.scan_id,
        destination=body.destination,
        confirmed_items=confirmed_items,
        store_name=body.store_name,
        total=body.total,
    )

    return ReceiptConfirmResponse(
        success=True,
        message=f"{len(body.items)} items added to {body.destination}",
        items_added=len(body.items),
        destination=body.destination,
    )


# ---------------------------------------------------------------------------
# GET /api/receipt/history
# ---------------------------------------------------------------------------


@router.get("/history")
async def receipt_history(
    limit: int = 20,
    user: UserInfo = Depends(get_current_user),
):
    """Get the current user's receipt scan history."""
    scans = receipt_log_service.get_user_history(user.uid, limit=limit)
    return {"count": len(scans), "scans": scans}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _enrich_items_with_barcodes(items: list) -> None:
    """Silently look up barcodes through the existing barcode pipeline.

    For each item that has a barcode, call the barcode service to get
    the proper product name, brand, and image. Updates items in-place.
    This runs best-effort — failures are logged but don't block the scan.
    """
    from app.services import barcode_service

    for item in items:
        if not item.barcode:
            continue

        try:
            product = await barcode_service.lookup_barcode(item.barcode)
            if product.found:
                # Enrich with proper product data, but keep OCR price
                if product.product_name:
                    item.name = product.product_name
                if product.brands:
                    item.name = f"{product.product_name} ({product.brands})" if product.product_name else item.name
                # Store lookup metadata on the item for the confirmation form
                item._enriched = True
                item._brand = product.brands
                item._image_url = product.image_url
                item._source = product.source
                logger.info("Enriched barcode %s: %s (%s)", item.barcode, product.product_name, product.source)
        except Exception as e:
            logger.warning("Barcode lookup failed for %s (non-fatal): %s", item.barcode, e)


def _check_receipt_access(user: UserInfo) -> None:
    """Check that the user has access to receipt scanning.

    Admins always have access. For regular users, check that they
    have the receipt_scanning_ocr tool selected (plus tier) or
    are on pro tier (all tools).
    """
    if user.is_admin:
        return

    from app.services import user_service
    profile = user_service.get_user(user.uid) or {}
    tier = profile.get("tier", "free")

    if tier == "pro":
        return  # all tools included

    if tier == "plus":
        tools = profile.get("selected_tools", [])
        if "receipt_scanning_ocr" in tools:
            return

    raise HTTPException(403, "Receipt scanning requires Smart Cart (plus) tier with the tool selected, or Full Fridge (pro) tier.")


def _save_to_inventory(uid: str, body: ReceiptConfirmRequest, items: list[dict]) -> None:
    """Save confirmed receipt items to inventory + price history."""
    from firebase_admin import firestore
    db = firestore.client()

    # Get or create store
    store_id = None
    if body.store_name:
        store_id = _get_or_create_store(uid, body.store_name, body.store_address)

    batch = db.batch()
    inv_ref = db.collection("users").document(uid).collection("grocery_items")
    price_ref = db.collection("users").document(uid).collection("price_history")

    from datetime import datetime
    now = datetime.utcnow().isoformat()

    for item in items:
        # Inventory item
        inv_doc = inv_ref.document()
        batch.set(inv_doc, {
            "name": item["name"],
            "barcode": item.get("barcode"),
            "quantity": item.get("quantity", 1),
            "location": item.get("location", "pantry"),
            "price": item.get("price"),
            "status": "active",
            "added_date": now,
            "purchase_date": body.date or now,
            "synced_to_cloud": True,
            "is_important": False,
            "needs_review": False,
            "source": "receipt_scan",
            "created_at": now,
            "updated_at": now,
        })

        # Price history record
        if item.get("price") and store_id:
            price_doc = price_ref.document()
            batch.set(price_doc, {
                "barcode": item.get("barcode", ""),
                "name": item["name"],
                "store_id": store_id,
                "price": item["price"],
                "purchase_date": body.date or now,
                "user_id": uid,
                "created_at": now,
                "updated_at": now,
            })

    batch.commit()


def _save_to_shopping_list(uid: str, body: ReceiptConfirmRequest) -> None:
    """Add confirmed items to a shopping list."""
    from firebase_admin import firestore
    db = firestore.client()

    items_ref = (
        db.collection("users").document(uid)
        .collection("shopping_lists").document(body.list_id)
        .collection("items")
    )

    from datetime import datetime
    now = datetime.utcnow().isoformat()

    batch = db.batch()
    for item in body.items:
        doc = items_ref.document()
        batch.set(doc, {
            "item_name": item.name,
            "quantity": item.quantity,
            "is_purchased": False,
            "barcode": item.barcode,
            "price": item.price,
            "created_at": now,
            "updated_at": now,
        })
    batch.commit()


def _save_prices_only(uid: str, body: ReceiptConfirmRequest, items: list[dict]) -> None:
    """Only save price history records (no inventory items)."""
    from firebase_admin import firestore
    db = firestore.client()

    store_id = None
    if body.store_name:
        store_id = _get_or_create_store(uid, body.store_name, body.store_address)

    price_ref = db.collection("users").document(uid).collection("price_history")
    from datetime import datetime
    now = datetime.utcnow().isoformat()

    batch = db.batch()
    for item in items:
        if item.get("price"):
            doc = price_ref.document()
            batch.set(doc, {
                "barcode": item.get("barcode", ""),
                "name": item["name"],
                "store_id": store_id or "",
                "price": item["price"],
                "purchase_date": body.date or now,
                "user_id": uid,
                "created_at": now,
                "updated_at": now,
            })
    batch.commit()


def _get_or_create_store(uid: str, name: str, address: str | None = None) -> str:
    """Find existing store by name (case-insensitive) or create new one."""
    from firebase_admin import firestore
    from google.cloud.firestore_v1.base_query import FieldFilter
    db = firestore.client()

    stores_ref = db.collection("users").document(uid).collection("stores")

    # Simple case-insensitive match
    existing = stores_ref.where(filter=FieldFilter("name", "==", name)).limit(1).get()
    for doc in existing:
        return doc.id

    # Also check lowercase
    existing_lower = stores_ref.where(filter=FieldFilter("name", "==", name.lower())).limit(1).get()
    for doc in existing_lower:
        return doc.id

    # Create new store
    from datetime import datetime
    now = datetime.utcnow().isoformat()
    new_doc = stores_ref.document()
    new_doc.set({
        "name": name,
        "address": address,
        "user_id": uid,
        "created_at": now,
        "updated_at": now,
    })
    return new_doc.id
