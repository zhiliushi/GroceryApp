"""
Barcode API routes.

POST /api/barcode/scan       — Lookup barcode (Firebase → OFF → not_found)
GET  /api/barcode/product/:id — Direct product lookup
POST /api/barcode/contribute  — User-contributed product
"""

import logging

import httpx

from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.schemas.barcode import (
    BarcodeScanRequest,
    BarcodeProduct,
    BarcodeContributeRequest,
    BarcodeContributeResponse,
)
from app.services import barcode_service

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Scan
# ---------------------------------------------------------------------------

@router.post("/scan", response_model=BarcodeProduct)
async def scan_barcode(request: BarcodeScanRequest):
    """
    Scan a barcode and return product information.

    Workflow:
    1. Check Firestore products collection (cached OFF results)
    2. Check Firestore contributed_products collection
    3. Query Open Food Facts API (and cache result)
    4. Return not_found if all sources fail (barcode still recorded)
    """
    try:
        product = await barcode_service.lookup_barcode(request.barcode)
        return product
    except Exception as e:
        logger.error("Barcode scan failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Error scanning barcode: {e}")


# ---------------------------------------------------------------------------
# Direct product lookup
# ---------------------------------------------------------------------------

@router.get("/product/{barcode}", response_model=BarcodeProduct)
async def get_product(barcode: str):
    """Get product information by barcode from all sources."""
    try:
        product = await barcode_service.lookup_barcode(barcode)
        if not product.found:
            raise HTTPException(status_code=404, detail="Product not found")
        return product
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Product lookup failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Error fetching product: {e}")


# ---------------------------------------------------------------------------
# Contribute
# ---------------------------------------------------------------------------

@router.post("/contribute", response_model=BarcodeContributeResponse)
async def contribute_product(request: BarcodeContributeRequest):
    """
    Accept user-contributed product data for unknown barcodes.

    Saves to Firestore and best-effort submits to Open Food Facts.
    """
    try:
        await barcode_service.contribute_product(
            barcode=request.barcode,
            name=request.name,
            brand=request.brand,
            category=request.category,
            image_url=request.image_url,
            contributed_by=request.contributed_by,
        )
        return BarcodeContributeResponse(
            success=True,
            message=f"Product {request.barcode} contributed successfully",
        )
    except Exception as e:
        logger.error("Contribution failed: %s", e)
        raise HTTPException(
            status_code=500, detail=f"Error saving contribution: {e}"
        )


# ---------------------------------------------------------------------------
# Item Overview (barcode-level aggregate page)
# ---------------------------------------------------------------------------

@router.get("/item/{barcode}/overview")
async def get_item_overview(barcode: str, user_id: str = ""):
    """Get comprehensive barcode-level overview: stock, history, waste stats.

    Used by /item/:barcode page. Price history and recipes fetched separately.
    """
    if not user_id:
        return {"barcode": barcode, "product": None, "completeness": {"score": 0, "missing": []},
                "current_stock": {"items": [], "total_in_stock": 0}, "usage_history": [], "waste_stats": None}

    from app.services import inventory_service
    try:
        return inventory_service.get_barcode_overview(user_id, barcode)
    except Exception as e:
        logger.error("Item overview failed for %s: %s", barcode, e)
        raise HTTPException(500, f"Failed to load item overview: {e}")


# ---------------------------------------------------------------------------
# Inventory check (for scanner popup: "You Already Have")
# ---------------------------------------------------------------------------

@router.get("/{barcode}/inventory")
async def get_barcode_inventory(barcode: str, user_id: str = ""):
    """Check existing inventory items matching this barcode for the user + household.

    Used by scanner popup to show "You Already Have" section.
    """
    if not user_id:
        return {"barcode": barcode, "items": [], "total_in_stock": 0}

    from app.services import inventory_service
    try:
        return inventory_service.find_items_by_barcode(user_id, barcode)
    except Exception as e:
        logger.error("Inventory check failed for %s: %s", barcode, e)
        return {"barcode": barcode, "items": [], "total_in_stock": 0}


# ---------------------------------------------------------------------------
# Use One (smart consume via scanner)
# ---------------------------------------------------------------------------

@router.post("/{barcode}/use-one")
async def use_one_item(barcode: str, body: dict = {}):
    """Smart consume: find soonest-expiring item with this barcode and decrement/consume.

    FIFO logic: own items first → soonest expiry → lowest qty → oldest added.
    """
    user_id = body.get("user_id", "")
    qty = body.get("quantity", 1)

    if not user_id:
        raise HTTPException(400, "user_id is required")

    from app.services import inventory_service
    try:
        result = inventory_service.use_one_item(user_id, barcode, qty_to_use=qty)
        return result
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        logger.error("use-one failed for %s: %s", barcode, e)
        raise HTTPException(500, f"Failed to consume item: {e}")


# ---------------------------------------------------------------------------
# Add to Inventory (quick-add from barcode scanner)
# ---------------------------------------------------------------------------

@router.post("/{barcode}/add-to-inventory")
async def add_to_inventory(barcode: str, body: dict = {}):
    """Quick-add item to inventory from barcode scanner.

    Creates a new grocery_item document in the user's collection.
    Unlike receipt/confirm, this doesn't require a prior scan log.
    """
    user_id = body.get("user_id", "")
    if not user_id:
        raise HTTPException(400, "user_id is required")

    name = body.get("name", barcode)
    location = body.get("location", "pantry")
    quantity = body.get("quantity", 1)

    from firebase_admin import firestore
    from datetime import datetime

    db = firestore.client()
    now = datetime.utcnow().isoformat()

    try:
        doc_ref = db.collection("users").document(user_id).collection("grocery_items").document()
        doc_ref.set({
            "name": name,
            "barcode": barcode,
            "quantity": quantity,
            "location": location,
            "status": "active",
            "added_date": now,
            "source": "barcode_scan",
            "synced_to_cloud": True,
            "is_important": False,
            "needs_review": False,
            "created_at": now,
            "updated_at": now,
        })
        return {"success": True, "item_id": doc_ref.id, "message": f"Added {name} to {location}"}
    except Exception as e:
        logger.error("add-to-inventory failed for %s: %s", barcode, e)
        raise HTTPException(500, f"Failed to add item: {e}")


# ---------------------------------------------------------------------------
# Dispute (user-facing)
# ---------------------------------------------------------------------------

@router.post("/dispute")
async def submit_dispute(body: dict):
    """Submit a product dispute (any authenticated user)."""
    from app.services import dispute_service

    barcode = body.get("barcode", "").strip()
    dispute_type = body.get("type", "").strip()
    current_value = body.get("current_value", "")
    suggested_value = body.get("suggested_value", "").strip()
    notes = body.get("notes", "")
    submitted_by = body.get("submitted_by", "anonymous")

    if not barcode:
        raise HTTPException(400, "barcode is required")
    if not dispute_type:
        raise HTTPException(400, "type is required (wrong_name, wrong_brand, wrong_category, other)")
    if not suggested_value:
        raise HTTPException(400, "suggested_value is required")

    try:
        result = dispute_service.submit_dispute(
            barcode=barcode,
            dispute_type=dispute_type,
            current_value=current_value,
            suggested_value=suggested_value,
            notes=notes,
            submitted_by=submitted_by,
        )
        is_update = "updated_at" in result and result.get("submitted_at") != result.get("updated_at")
        return {
            "success": True,
            "message": "Report updated" if is_update else "Dispute submitted for admin review",
            "dispute": result,
        }
    except Exception as e:
        logger.error("Dispute submission failed: %s", e)
        raise HTTPException(500, f"Failed to submit dispute: {e}")


@router.get("/dispute/{barcode}")
async def get_my_dispute(barcode: str, user_id: str = ""):
    """Get the user's existing dispute for a barcode (for edit mode)."""
    from app.services import dispute_service

    if not user_id:
        return {"dispute": None}

    existing = dispute_service.get_user_dispute(barcode, user_id)
    return {"dispute": existing}


# ---------------------------------------------------------------------------
# Price Summary
# ---------------------------------------------------------------------------

@router.get("/{barcode}/prices")
async def get_price_summary(barcode: str):
    """Get aggregated price data for a barcode.

    Returns own prices (free tier) or all prices (paid tier).
    Filtered by user's country.
    """
    from app.services import price_record_service

    try:
        summary = price_record_service.get_price_summary(barcode)
        return summary
    except Exception as e:
        logger.error("Price summary failed for %s: %s", barcode, e)
        raise HTTPException(500, f"Failed to get price summary: {e}")


# ---------------------------------------------------------------------------
# Reverse Geocoding
# ---------------------------------------------------------------------------

@router.post("/geocode/reverse")
async def reverse_geocode(body: dict):
    """Reverse geocode GPS coordinates using Google Places + Geocoding APIs."""
    lat = body.get("lat")
    lng = body.get("lng")
    if lat is None or lng is None:
        raise HTTPException(status_code=400, detail="lat and lng are required")

    api_key = settings.GOOGLE_MAPS_API_KEY
    if not api_key:
        return {"place_name": None, "address": None}

    place_name = None
    address = None

    async with httpx.AsyncClient(timeout=5.0) as client:
        # 1. Try Google Places Nearby Search for store name
        try:
            places_url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
            places_resp = await client.get(places_url, params={
                "location": f"{lat},{lng}",
                "radius": 100,
                "type": "store",
                "key": api_key,
            })
            places_data = places_resp.json()
            if places_data.get("results"):
                top = places_data["results"][0]
                place_name = top.get("name")
                address = top.get("vicinity")
        except Exception as e:
            logger.warning("Places API failed: %s", e)

        # 2. Fallback: Google Geocoding API for address
        if not address:
            try:
                geocode_url = "https://maps.googleapis.com/maps/api/geocode/json"
                geo_resp = await client.get(geocode_url, params={
                    "latlng": f"{lat},{lng}",
                    "key": api_key,
                })
                geo_data = geo_resp.json()
                if geo_data.get("results"):
                    address = geo_data["results"][0].get("formatted_address")
            except Exception as e:
                logger.warning("Geocoding API failed: %s", e)

    return {"place_name": place_name, "address": address}
