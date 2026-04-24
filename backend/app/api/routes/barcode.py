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
# Scan Info (unified scan result — new model)
# ---------------------------------------------------------------------------

@router.get("/{barcode}/scan-info")
async def get_scan_info(barcode: str, user_id: str = ""):
    """Unified scan-result endpoint for the new catalog+purchases model.

    Returns:
        {
          "barcode": str,
          "country_code": str | None,
          "user_catalog_match": CatalogEntry | None,  # this user's existing entry for the barcode
          "global_product": ProductDict | None,       # shared products/{barcode} record
          "user_history": {                           # aggregated stats from purchase events
              "count_purchased": int,
              "active_stock": int,
              "last_bought": datetime | None,
              "avg_price": float | None,
              "waste_rate": float,                    # 0..1 — thrown / total
              "active_items": [...]                   # FIFO-sorted active events
          },
          "suggested_actions": [                      # state-driven hints
              {"action": "add_purchase", "label": "..."},
              ...
          ]
        }
    """
    from app.services import (
        catalog_service,
        country_service,
        barcode_service,
        purchase_event_service,
    )

    country_code = country_service.detect_country_by_barcode(barcode)

    # Global product (may be None)
    try:
        product = await barcode_service.lookup_barcode(barcode)
        global_product = product.model_dump() if product.found else None
    except Exception as exc:
        logger.warning("scan-info: global lookup failed for %s: %s", barcode, exc)
        global_product = None

    user_catalog_match = None
    user_history = {
        "count_purchased": 0,
        "active_stock": 0,
        "last_bought": None,
        "avg_price": None,
        "waste_rate": 0.0,
        "active_items": [],
    }

    if user_id:
        user_catalog_match = catalog_service.find_by_barcode(user_id, barcode)
        active = purchase_event_service.find_purchases_by_barcode(user_id, barcode)
        user_history["active_stock"] = active["total_in_stock"]
        user_history["active_items"] = active["items"]

        if user_catalog_match:
            user_history["count_purchased"] = user_catalog_match.get("total_purchases", 0)
            user_history["last_bought"] = user_catalog_match.get("last_purchased_at")

            name_norm = user_catalog_match.get("name_norm")
            if name_norm:
                all_events = purchase_event_service.list_purchases(
                    user_id=user_id,
                    catalog_name_norm=name_norm,
                    limit=200,
                )["items"]
                prices = [e["price"] for e in all_events if e.get("price") is not None]
                if prices:
                    user_history["avg_price"] = round(sum(prices) / len(prices), 2)
                thrown = sum(1 for e in all_events if e.get("status") == "thrown")
                total_terminal = sum(
                    1 for e in all_events if e.get("status") in ("used", "thrown", "transferred")
                )
                if total_terminal:
                    user_history["waste_rate"] = round(thrown / total_terminal, 3)

    # Suggested actions — state-driven hints for the client
    suggested: list[dict] = []
    if user_catalog_match:
        suggested.append({
            "action": "add_purchase",
            "label": f"Add new purchase of '{user_catalog_match.get('display_name')}'",
        })
        if user_history["active_stock"] > 0:
            suggested.append({"action": "mark_used", "label": "Mark one as used (FIFO)"})
            suggested.append({"action": "move_location", "label": "Move to different location"})
        suggested.append({
            "action": "view_catalog",
            "label": f"View catalog entry ({user_history['count_purchased']} total purchases)",
        })
    elif global_product:
        suggested.append({
            "action": "name_and_add",
            "label": f"Add as '{global_product.get('product_name', 'Unnamed product')}'",
        })
        suggested.append({"action": "name_custom", "label": "Give it your own name"})
    else:
        suggested.append({"action": "name_custom", "label": "What do you call this?"})

    return {
        "barcode": barcode,
        "country_code": country_code,
        "user_catalog_match": user_catalog_match,
        "global_product": global_product,
        "user_history": user_history,
        "suggested_actions": suggested,
    }


# ---------------------------------------------------------------------------
# Inventory check (for scanner popup: "You Already Have")
# ---------------------------------------------------------------------------

@router.get("/{barcode}/inventory")
async def get_barcode_inventory(barcode: str, user_id: str = ""):
    """Check existing inventory items matching this barcode for the user + household.

    Used by scanner popup to show "You Already Have" section.

    When `legacy_endpoints_use_new_model` is on, results come from the new
    purchase events (shape-translated via compat shim).
    """
    if not user_id:
        return {"barcode": barcode, "items": [], "total_in_stock": 0}

    from app.core import feature_flags

    if feature_flags.is_enabled("legacy_endpoints_use_new_model"):
        from app.services import purchase_event_service
        from app.services.compat.legacy_item_shim import new_event_to_legacy_item
        try:
            result = purchase_event_service.find_purchases_by_barcode(user_id, barcode)
            items = []
            for event in result["items"]:
                event["user_id"] = user_id
                items.append(new_event_to_legacy_item(event))
            return {"barcode": barcode, "items": items, "total_in_stock": result["total_in_stock"]}
        except Exception as e:
            logger.error("Inventory check (new model) failed for %s: %s", barcode, e)
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

    When `legacy_endpoints_use_new_model` is on, routes to purchase_event_service:
    finds the user's catalog entry by barcode and consumes the oldest-expiry active event.
    """
    user_id = body.get("user_id", "")
    qty = body.get("quantity", 1)

    if not user_id:
        raise HTTPException(400, "user_id is required")

    from app.core import feature_flags

    if feature_flags.is_enabled("legacy_endpoints_use_new_model"):
        from app.services import catalog_service, purchase_event_service
        from app.core.exceptions import NotFoundError
        try:
            entry = catalog_service.find_by_barcode(user_id, barcode)
            if not entry:
                raise HTTPException(404, f"No catalog entry for barcode {barcode}")
            return purchase_event_service.consume_one_by_catalog(
                user_id, entry["name_norm"], quantity=qty
            )
        except NotFoundError as e:
            raise HTTPException(404, str(e))
        except HTTPException:
            raise
        except Exception as e:
            logger.error("use-one (new model) failed for %s: %s", barcode, e)
            raise HTTPException(500, f"Failed to consume item: {e}")

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

    When `legacy_endpoints_use_new_model` is on, routes to purchase_event_service
    which transactionally upserts the catalog entry + creates a purchase event.
    """
    user_id = body.get("user_id", "")
    if not user_id:
        raise HTTPException(400, "user_id is required")

    name = body.get("name", barcode)
    location = body.get("location", "pantry")
    quantity = body.get("quantity", 1)

    from app.core import feature_flags

    if feature_flags.is_enabled("legacy_endpoints_use_new_model"):
        from app.services import purchase_event_service
        from app.core.exceptions import ConflictError, ValidationError
        try:
            event = purchase_event_service.create_purchase(
                user_id=user_id,
                name=name,
                barcode=barcode,
                quantity=float(quantity),
                location=location,
                source="barcode_scan",
            )
            return {
                "success": True,
                "item_id": event["id"],
                "message": f"Added {name} to {location}",
            }
        except (ConflictError, ValidationError) as e:
            raise HTTPException(e.http_status, e.message)
        except Exception as e:
            logger.error("add-to-inventory (new model) failed for %s: %s", barcode, e)
            raise HTTPException(500, f"Failed to add item: {e}")

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
