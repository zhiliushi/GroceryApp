"""
Admin API routes (JSON).
All endpoints require admin role.
"""

import io
import logging

from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File
from typing import Optional

from app.core.auth import UserInfo, require_admin
from app.schemas.web import DashboardStats, ReviewActionResponse
from app.schemas.auth import UserRoleUpdateRequest
from app.services import (
    user_service,
    inventory_service,
    shopping_list_service,
    contributed_product_service,
    product_service,
    price_record_service,
    config_service,
    ocr_config_service,
    receipt_log_service,
    location_service,
    dispute_service,
    email_config_service,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@router.get("/dashboard", response_model=DashboardStats)
async def dashboard_stats(admin: UserInfo = Depends(require_admin)):
    """Get aggregate stats for the admin dashboard."""
    stats = user_service.get_dashboard_stats()
    return DashboardStats(**stats)


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

@router.get("/users")
async def list_users(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    admin: UserInfo = Depends(require_admin),
):
    """List all users."""
    users = user_service.list_users(limit=limit, offset=offset)
    return {"count": len(users), "users": users}


@router.get("/users/{uid}")
async def get_user(uid: str, admin: UserInfo = Depends(require_admin)):
    """Get a single user profile."""
    user = user_service.get_user(uid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/users/{uid}/role")
async def update_user_role(uid: str, body: UserRoleUpdateRequest, admin: UserInfo = Depends(require_admin)):
    """Set a user's role (admin/user)."""
    if body.role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'user'")
    user_service.update_user_role(uid, body.role)
    return {"success": True, "message": f"User {uid} role set to {body.role}"}


# ---------------------------------------------------------------------------
# User Management (Enhanced)
# ---------------------------------------------------------------------------

@router.put("/users/{uid}/tier")
async def update_user_tier(uid: str, body: dict, admin: UserInfo = Depends(require_admin)):
    """Change a user's subscription tier."""
    tier = body.get("tier")
    if tier not in ("free", "plus", "pro"):
        raise HTTPException(status_code=400, detail="Tier must be 'free', 'plus', or 'pro'")
    success = user_service.update_user_tier(uid, tier, admin.uid)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "message": f"User {uid} tier set to {tier}"}


@router.put("/users/{uid}/status")
async def update_user_status(uid: str, body: dict, admin: UserInfo = Depends(require_admin)):
    """Enable or disable a user."""
    status = body.get("status")
    reason = body.get("reason", "")
    if status not in ("active", "disabled"):
        raise HTTPException(status_code=400, detail="Status must be 'active' or 'disabled'")
    success = user_service.update_user_status(uid, status, reason)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "message": f"User {uid} status set to {status}"}


@router.put("/users/{uid}/approve")
async def approve_user(uid: str, admin: UserInfo = Depends(require_admin)):
    """Approve a pending user."""
    success = user_service.approve_user(uid, admin.uid)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "message": f"User {uid} approved"}


@router.delete("/users/{uid}")
async def delete_user(uid: str, admin: UserInfo = Depends(require_admin)):
    """Delete a user completely (Firestore + Firebase Auth)."""
    success = user_service.delete_user(uid)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete user")
    return {"success": True, "message": f"User {uid} deleted"}


@router.put("/users/{uid}/tools")
async def update_user_tools(uid: str, body: dict, admin: UserInfo = Depends(require_admin)):
    """Update a Smart Cart user's selected tools."""
    tools = body.get("selected_tools", [])
    if not isinstance(tools, list):
        raise HTTPException(status_code=400, detail="selected_tools must be a list")
    success = user_service.update_user_tools(uid, tools)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "message": f"User {uid} tools updated"}


# ---------------------------------------------------------------------------
# App Configuration (Visibility + Tiers)
# ---------------------------------------------------------------------------

@router.get("/config/visibility")
async def get_visibility(admin: UserInfo = Depends(require_admin)):
    """Get page visibility configuration."""
    return config_service.get_visibility()


@router.put("/config/visibility")
async def update_visibility(body: dict, admin: UserInfo = Depends(require_admin)):
    """Update page visibility configuration."""
    config_service.update_visibility(body, admin.uid)
    return {"success": True, "message": "Visibility config updated"}


@router.get("/config/tiers")
async def get_tiers(admin: UserInfo = Depends(require_admin)):
    """Get tier definitions."""
    return config_service.get_tiers()


@router.put("/config/tiers")
async def update_tiers(body: dict, admin: UserInfo = Depends(require_admin)):
    """Update tier definitions."""
    config_service.update_tiers(body)
    return {"success": True, "message": "Tier config updated"}


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------

@router.get("/inventory")
async def list_all_inventory(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None),
    needs_review: Optional[bool] = Query(None),
    location: Optional[str] = Query(None),
    admin: UserInfo = Depends(require_admin),
):
    """List inventory items across all users with filters."""
    items = inventory_service.get_all_items(
        limit=limit, offset=offset,
        status=status, needs_review=needs_review, location=location,
    )
    return {"count": len(items), "items": items}


@router.get("/inventory/{uid}/{item_id}")
async def get_inventory_item(uid: str, item_id: str, admin: UserInfo = Depends(require_admin)):
    """Get a single inventory item."""
    item = inventory_service.get_item(uid, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.put("/inventory/{uid}/{item_id}")
async def update_inventory_item(uid: str, item_id: str, body: dict, admin: UserInfo = Depends(require_admin)):
    """Update an inventory item."""
    inventory_service.update_item(uid, item_id, body)
    return {"success": True, "message": "Item updated"}


# ---------------------------------------------------------------------------
# Shopping Lists
# ---------------------------------------------------------------------------

@router.get("/shopping-lists")
async def list_all_shopping_lists(
    limit: int = Query(50, ge=1, le=200),
    admin: UserInfo = Depends(require_admin),
):
    """List shopping lists across all users."""
    lists = shopping_list_service.get_all_lists(limit=limit)
    return {"count": len(lists), "lists": lists}


@router.get("/shopping-lists/{uid}/{list_id}")
async def get_shopping_list(uid: str, list_id: str, admin: UserInfo = Depends(require_admin)):
    """Get a shopping list with its items."""
    sl = shopping_list_service.get_list(uid, list_id)
    if not sl:
        raise HTTPException(status_code=404, detail="Shopping list not found")
    items = shopping_list_service.get_list_items(uid, list_id)
    return {"list": sl, "items": items}


# ---------------------------------------------------------------------------
# Contributed Products (Review Queue)
# ---------------------------------------------------------------------------

@router.get("/contributed")
async def list_contributed(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    admin: UserInfo = Depends(require_admin),
):
    """List contributed products with filtering and pagination."""
    records, total = contributed_product_service.list_contributed(limit, offset, search, status)
    counts = contributed_product_service.get_count_by_status()
    return {"records": records, "total": total, "counts": counts}


@router.get("/contributed/counts")
async def contributed_counts(admin: UserInfo = Depends(require_admin)):
    """Get contributed product counts by status."""
    return contributed_product_service.get_count_by_status()


@router.post("/contributed/{barcode}/approve", response_model=ReviewActionResponse)
async def approve_contributed(barcode: str, admin: UserInfo = Depends(require_admin)):
    """Approve a contributed product."""
    success = contributed_product_service.approve(barcode, admin.uid)
    if not success:
        raise HTTPException(status_code=404, detail="Product not found or cannot be approved")
    return ReviewActionResponse(success=True, message=f"Product {barcode} approved")


@router.post("/contributed/{barcode}/reject", response_model=ReviewActionResponse)
async def reject_contributed(
    barcode: str,
    reason: str = Query("", description="Rejection reason"),
    admin: UserInfo = Depends(require_admin),
):
    """Reject a contributed product."""
    success = contributed_product_service.reject(barcode, admin.uid, reason)
    if not success:
        raise HTTPException(status_code=404, detail="Product not found or cannot be rejected")
    return ReviewActionResponse(success=True, message=f"Product {barcode} rejected")


@router.delete("/contributed/{barcode}")
async def delete_contributed(barcode: str, admin: UserInfo = Depends(require_admin)):
    """Delete a single contributed product."""
    success = contributed_product_service.delete_product(barcode)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete contributed product")
    return {"success": True}


@router.post("/contributed/batch-delete")
async def batch_delete_contributed(body: dict, admin: UserInfo = Depends(require_admin)):
    """Batch delete contributed products."""
    barcodes = body.get("barcodes", [])
    if not barcodes:
        raise HTTPException(status_code=400, detail="No barcodes specified")
    deleted = contributed_product_service.delete_products_batch(barcodes)
    return {"success": True, "deleted": deleted}


# ---------------------------------------------------------------------------
# Needs Review
# ---------------------------------------------------------------------------

@router.get("/needs-review")
async def list_needs_review(
    limit: int = Query(50, ge=1, le=200),
    admin: UserInfo = Depends(require_admin),
):
    """Get inventory items flagged for review."""
    items = inventory_service.get_needs_review_items(limit=limit)
    return {"count": len(items), "items": items}


# ---------------------------------------------------------------------------
# Products (Database Management)
# ---------------------------------------------------------------------------

@router.get("/products/lookup/{barcode}")
async def lookup_product_off(barcode: str, admin: UserInfo = Depends(require_admin)):
    """Lookup a barcode on Open Food Facts for pre-filling the form."""
    result = await product_service.lookup_openfoodfacts(barcode)
    if not result:
        raise HTTPException(status_code=404, detail="Product not found on Open Food Facts")
    return result


@router.get("/products")
async def list_products(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None),
    admin: UserInfo = Depends(require_admin),
):
    """List all products in the database."""
    products = product_service.list_products(limit=limit, offset=offset, search=search)
    return {"count": len(products), "products": products}


@router.get("/products/{barcode}")
async def get_product(barcode: str, admin: UserInfo = Depends(require_admin)):
    """Get a single product."""
    product = product_service.get_product(barcode)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("/products")
async def create_product(body: dict, admin: UserInfo = Depends(require_admin)):
    """Create a new product."""
    barcode = body.get("barcode")
    if not barcode:
        raise HTTPException(status_code=400, detail="Barcode is required")
    product_service.create_product(barcode, body)
    return {"success": True, "message": f"Product {barcode} created"}


@router.put("/products/{barcode}")
async def update_product(barcode: str, body: dict, admin: UserInfo = Depends(require_admin)):
    """Update an existing product."""
    existing = product_service.get_product(barcode)
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    product_service.update_product(barcode, body)
    return {"success": True, "message": f"Product {barcode} updated"}


@router.delete("/products/{barcode}")
async def delete_product(barcode: str, admin: UserInfo = Depends(require_admin)):
    """Delete a product."""
    existing = product_service.get_product(barcode)
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    product_service.delete_product(barcode)
    return {"success": True, "message": f"Product {barcode} deleted"}


# ---------------------------------------------------------------------------
# Price Records
# ---------------------------------------------------------------------------

@router.get("/price-records")
async def list_price_records(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None),
    barcode: Optional[str] = Query(None),
    admin: UserInfo = Depends(require_admin),
):
    """List price records across all users."""
    records, total = price_record_service.list_price_records(limit, offset, search, barcode)
    return {"count": len(records), "total": total, "records": records}


@router.delete("/price-records/{user_id}/{record_id}")
async def delete_price_record(user_id: str, record_id: str, admin: UserInfo = Depends(require_admin)):
    """Delete a single price record."""
    success = price_record_service.delete_record(user_id, record_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete record")
    return {"success": True}


@router.post("/price-records/batch-delete")
async def batch_delete_price_records(body: dict, admin: UserInfo = Depends(require_admin)):
    """Batch delete price records."""
    records = body.get("records", [])
    if not records:
        raise HTTPException(status_code=400, detail="No records specified")
    deleted = price_record_service.delete_records_batch(records)
    return {"success": True, "deleted": deleted}


# ---------------------------------------------------------------------------
# Storage Locations
# ---------------------------------------------------------------------------

@router.get("/config/locations")
async def get_locations(admin: UserInfo = Depends(require_admin)):
    """Get all storage locations."""
    return {"locations": location_service.get_locations()}


@router.put("/config/locations")
async def update_locations(body: dict, admin: UserInfo = Depends(require_admin)):
    """Update locations (reorder, rename, add/remove)."""
    locations = body.get("locations", [])
    location_service.update_locations(locations, admin.uid)
    return {"success": True, "message": "Locations updated"}


@router.post("/config/locations")
async def add_location(body: dict, admin: UserInfo = Depends(require_admin)):
    """Add a new storage location."""
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(400, "Location name is required")
    icon = body.get("icon", "📍")
    color = body.get("color", "#6B7280")
    try:
        loc = location_service.add_location(name, icon, color)
        return {"success": True, "location": loc}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.delete("/config/locations/{key}")
async def delete_location(key: str, admin: UserInfo = Depends(require_admin)):
    """Delete a storage location (blocked if items exist there)."""
    count = location_service.count_items_at_location(key)
    if count > 0:
        raise HTTPException(
            400,
            f"Cannot delete: {count} items are stored in this location. Move them first.",
        )
    if not location_service.remove_location(key):
        raise HTTPException(404, "Location not found")
    return {"success": True}


# ---------------------------------------------------------------------------
# Product Disputes
# ---------------------------------------------------------------------------

@router.get("/disputes")
async def list_disputes(
    status: Optional[str] = Query(None),
    barcode: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    admin: UserInfo = Depends(require_admin),
):
    """List product disputes with optional filters."""
    disputes = dispute_service.list_disputes(status=status, barcode=barcode, limit=limit)
    counts = dispute_service.count_disputes_by_status()
    return {"count": len(disputes), "disputes": disputes, "counts": counts}


@router.put("/disputes/{dispute_id}")
async def resolve_dispute(
    dispute_id: str,
    body: dict,
    admin: UserInfo = Depends(require_admin),
):
    """Resolve a dispute (accept or dismiss)."""
    action = body.get("action", "")
    if action not in ("accept", "dismiss"):
        raise HTTPException(400, "Action must be 'accept' or 'dismiss'")
    note = body.get("resolution_note", "")
    if not dispute_service.resolve_dispute(dispute_id, action, admin.uid, note):
        raise HTTPException(404, "Dispute not found")
    return {"success": True, "message": f"Dispute {action}ed"}


# ---------------------------------------------------------------------------
# Product Re-check OFF
# ---------------------------------------------------------------------------

@router.post("/products/{barcode}/recheck")
async def recheck_product_off(barcode: str, admin: UserInfo = Depends(require_admin)):
    """Re-check a product on Open Food Facts and update if found."""
    import time
    from app.services import product_service

    # Check rate limit (1 hour cooldown)
    existing = product_service.get_product(barcode)
    if existing:
        last_check = existing.get("last_checked_off", 0)
        if last_check and (time.time() * 1000 - last_check) < 3600000:  # 1 hour
            return {"success": False, "found": False, "message": "Re-checked less than 1 hour ago. Try later."}

    # Lookup on OFF
    off_data = await product_service.lookup_openfoodfacts(barcode)

    if off_data:
        # Update product with OFF data
        product_service.create_product(barcode, {
            **off_data,
            "source": "openfoodfacts",
            "last_checked_off": int(time.time() * 1000),
        })
        return {"success": True, "found": True, "message": "Found on Open Food Facts!", "product": off_data}
    else:
        # Record the check attempt
        from firebase_admin import firestore
        db = firestore.client()
        db.collection("products").document(barcode).set(
            {"last_checked_off": int(time.time() * 1000)},
            merge=True,
        )
        return {"success": True, "found": False, "message": "Still not found on Open Food Facts."}


# ---------------------------------------------------------------------------
# OCR Configuration
# ---------------------------------------------------------------------------

@router.get("/config/ocr")
async def get_ocr_config(admin: UserInfo = Depends(require_admin)):
    """Get OCR provider config with usage stats merged in."""
    try:
        ocr_config_service.sync_api_key_status()
    except Exception as e:
        logger.warning("sync_api_key_status failed (non-fatal): %s", e)
    try:
        return ocr_config_service.get_usage_with_config()
    except Exception as e:
        logger.exception("Failed to get OCR config")
        raise HTTPException(status_code=500, detail=f"Failed to load OCR config: {e}")


@router.put("/config/ocr")
async def update_ocr_config(body: dict, admin: UserInfo = Depends(require_admin)):
    """Update OCR provider configuration (order, enabled, limits)."""
    try:
        ocr_config_service.update_ocr_config(body, admin.uid)
        return {"success": True, "message": "OCR config updated"}
    except Exception as e:
        logger.exception("Failed to update OCR config")
        raise HTTPException(status_code=500, detail=f"Failed to update OCR config: {e}")


@router.get("/config/ocr/requirements")
async def get_ocr_requirements(admin: UserInfo = Depends(require_admin)):
    """Check provider requirements — what's configured, what's missing."""
    try:
        return ocr_config_service.check_all_requirements()
    except Exception as e:
        logger.exception("Failed to check OCR requirements")
        raise HTTPException(status_code=500, detail=f"Failed to check requirements: {e}")


@router.post("/config/ocr/test/{provider_key}")
async def test_ocr_provider(provider_key: str, admin: UserInfo = Depends(require_admin)):
    """Test a single OCR provider with a synthetic image."""
    try:
        return await ocr_config_service.test_provider(provider_key)
    except Exception as e:
        logger.exception("Failed to test provider %s", provider_key)
        return {"success": False, "provider": provider_key, "duration_ms": 0,
                "error_type": type(e).__name__, "error_message": str(e),
                "message": f"Test failed: {e}"}


# ---------------------------------------------------------------------------
# System Configuration (user limits, registration)
# ---------------------------------------------------------------------------

@router.get("/config/system")
async def get_system_config(admin: UserInfo = Depends(require_admin)):
    """Get system config with active user count and capacity."""
    return config_service.get_system_status()


@router.put("/config/system")
async def update_system_config(body: dict, admin: UserInfo = Depends(require_admin)):
    """Update system config (max_active_users, registration_open)."""
    config_service.update_system_config(body, admin.uid)
    return {"success": True, "message": "System config updated"}


# ---------------------------------------------------------------------------
# Email Configuration
# ---------------------------------------------------------------------------

@router.get("/config/email")
async def get_email_config(admin: UserInfo = Depends(require_admin)):
    """Get email provider config with usage stats."""
    try:
        email_config_service.sync_api_key_status()
    except Exception as e:
        logger.warning("Email sync_api_key_status failed: %s", e)
    return email_config_service.get_config_with_usage()


@router.put("/config/email")
async def update_email_config(body: dict, admin: UserInfo = Depends(require_admin)):
    """Update email provider config."""
    email_config_service.update_email_config(body, admin.uid)
    return {"success": True, "message": "Email config updated"}


@router.post("/config/email/test")
async def test_email(body: dict, admin: UserInfo = Depends(require_admin)):
    """Send a test email to verify provider."""
    to = body.get("to") or admin.email
    if not to:
        raise HTTPException(400, "Email address required")
    from app.services import email_service
    result = await email_service.send_test_email(to)
    return result


# ---------------------------------------------------------------------------
# Receipt Scans (Admin view)
# ---------------------------------------------------------------------------

@router.get("/receipt-scans")
async def list_receipt_scans(
    limit: int = Query(50, ge=1, le=200),
    admin: UserInfo = Depends(require_admin),
):
    """List recent receipt scans across all users."""
    scans = receipt_log_service.get_all_recent_scans(limit=limit)
    stats = receipt_log_service.get_scan_stats()
    return {"count": len(scans), "scans": scans, "stats": stats}


@router.get("/receipt-scans/errors")
async def list_receipt_errors(
    limit: int = Query(20, ge=1, le=100),
    admin: UserInfo = Depends(require_admin),
):
    """List recent receipt scan errors for debugging."""
    errors = receipt_log_service.get_recent_errors(limit=limit)
    return {"count": len(errors), "errors": errors}


# ---------------------------------------------------------------------------
# Manual Stores (admin-managed store pins for map)
# ---------------------------------------------------------------------------


def _get_stores_doc():
    from firebase_admin import firestore
    return firestore.client().collection("app_config").document("stores")


def _get_map_doc():
    from firebase_admin import firestore
    return firestore.client().collection("app_config").document("map")


@router.get("/stores")
async def get_stores(admin: UserInfo = Depends(require_admin)):
    """Get all manually added stores."""
    doc = _get_stores_doc().get()
    stores = doc.to_dict().get("stores", []) if doc.exists else []
    return {"stores": stores}


@router.post("/stores")
async def add_store(body: dict, admin: UserInfo = Depends(require_admin)):
    """Add a manual store pin."""
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Store name is required")

    from datetime import datetime
    import uuid
    store = {
        "id": f"s_{uuid.uuid4().hex[:8]}",
        "name": name,
        "address": (body.get("address") or "").strip(),
        "lat": float(body.get("lat", 0)),
        "lng": float(body.get("lng", 0)),
        "type": body.get("type", "supermarket"),
        "opening_hours": (body.get("opening_hours") or "").strip(),
        "notes": (body.get("notes") or "").strip(),
        "created_at": datetime.utcnow().isoformat(),
    }

    doc = _get_stores_doc()
    snap = doc.get()
    stores = snap.to_dict().get("stores", []) if snap.exists else []
    stores.append(store)
    doc.set({"stores": stores, "updated_at": datetime.utcnow().isoformat()})
    return {"success": True, "store": store}


@router.put("/stores/{store_id}")
async def update_store(store_id: str, body: dict, admin: UserInfo = Depends(require_admin)):
    """Update a manual store."""
    from datetime import datetime
    doc = _get_stores_doc()
    snap = doc.get()
    stores = snap.to_dict().get("stores", []) if snap.exists else []

    found = False
    for i, s in enumerate(stores):
        if s.get("id") == store_id:
            stores[i] = {**s, **{k: v for k, v in body.items() if k != "id"}, "id": store_id}
            found = True
            break

    if not found:
        raise HTTPException(404, "Store not found")

    doc.set({"stores": stores, "updated_at": datetime.utcnow().isoformat()})
    return {"success": True}


@router.delete("/stores/{store_id}")
async def delete_store(store_id: str, admin: UserInfo = Depends(require_admin)):
    """Delete a manual store."""
    from datetime import datetime
    doc = _get_stores_doc()
    snap = doc.get()
    stores = snap.to_dict().get("stores", []) if snap.exists else []
    filtered = [s for s in stores if s.get("id") != store_id]
    if len(filtered) == len(stores):
        raise HTTPException(404, "Store not found")
    doc.set({"stores": filtered, "updated_at": datetime.utcnow().isoformat()})
    return {"success": True}


# ---------------------------------------------------------------------------
# Map Config (admin-managed default center)
# ---------------------------------------------------------------------------


@router.get("/config/map")
async def get_map_config(admin: UserInfo = Depends(require_admin)):
    """Get map configuration."""
    doc = _get_map_doc().get()
    if doc.exists:
        return doc.to_dict()
    return {"center_lat": 3.139, "center_lng": 101.687, "default_zoom": 13}


@router.put("/config/map")
async def update_map_config(body: dict, admin: UserInfo = Depends(require_admin)):
    """Update map default center and zoom."""
    from datetime import datetime
    _get_map_doc().set({
        "center_lat": float(body.get("center_lat", 3.139)),
        "center_lng": float(body.get("center_lng", 101.687)),
        "default_zoom": int(body.get("default_zoom", 13)),
        "updated_by": admin.uid,
        "updated_at": datetime.utcnow().isoformat(),
    })
    return {"success": True}


# ---------------------------------------------------------------------------
# OCR Test Scanner (admin tool — visual box-level OCR)
# ---------------------------------------------------------------------------


@router.post("/ocr/test-scan")
async def ocr_test_scan(
    image: UploadFile = File(...),
    admin: UserInfo = Depends(require_admin),
):
    """Run Tesseract OCR with bounding box data for visual debugging.

    Returns per-region boxes with coordinates (percentages), text, and confidence.
    Smart merge groups words into logical text regions.
    Uses the same improved preprocessing as TesseractProvider.
    """
    import time

    # --- Validate ---
    allowed = {"image/jpeg", "image/png", "image/webp"}
    if image.content_type and image.content_type not in allowed:
        raise HTTPException(400, f"Unsupported format: {image.content_type}. Use JPEG or PNG.")

    image_bytes = await image.read()
    if len(image_bytes) > 5 * 1024 * 1024:
        raise HTTPException(413, f"Image too large ({len(image_bytes) // 1024}KB). Max 5MB.")

    # --- Import and detect Tesseract ---
    try:
        import pytesseract
        from PIL import Image, ImageOps
    except ImportError as e:
        raise HTTPException(500, f"Required package not installed: {e}")

    from app.services.ocr.tesseract_provider import preprocess_for_ocr, detect_tesseract, get_ocr_lang

    detect_tesseract()

    # --- Get original dimensions (before preprocessing) ---
    import io
    try:
        orig_img = Image.open(io.BytesIO(image_bytes))
    except Exception:
        raise HTTPException(422, "Could not read image.")
    orig_img = ImageOps.exif_transpose(orig_img) or orig_img
    orig_w, orig_h = orig_img.size

    if orig_w < 100 or orig_h < 100:
        raise HTTPException(400, f"Image too small ({orig_w}x{orig_h}). Use at least 300px.")

    # --- Preprocess (shared with TesseractProvider) ---
    proc = preprocess_for_ocr(image_bytes)
    lang = get_ocr_lang()
    ocr_config = "--psm 3 --oem 1 --dpi 300"

    # --- Run OCR with box data ---
    start = time.time()
    try:
        data = pytesseract.image_to_data(proc, lang=lang, config=ocr_config, output_type=pytesseract.Output.DICT)
        raw_text = pytesseract.image_to_string(proc, lang=lang, config=ocr_config)
    except Exception as e:
        raise HTTPException(500, f"Tesseract failed: {e}")
    duration_ms = int((time.time() - start) * 1000)

    # --- Smart merge words into logical boxes ---
    # Use preprocessed image dimensions for box coordinates (Tesseract returns pixel coords relative to the image it processed)
    proc_w, proc_h = proc.size
    boxes = _merge_ocr_words(data, proc_w, proc_h)

    return {
        "success": True,
        "image_width": orig_w,
        "image_height": orig_h,
        "boxes": boxes,
        "raw_text": raw_text[:10000],
        "duration_ms": duration_ms,
        "lang": lang,
    }


@router.post("/ocr/preview-scan")
async def ocr_preview_scan(
    image: UploadFile = File(...),
    admin: UserInfo = Depends(require_admin),
):
    """Quick low-res OCR preview — returns word count + confidence estimate.

    Designed to complete in <1s by using a 500px image with minimal preprocessing.
    """
    import io
    import time

    allowed = {"image/jpeg", "image/png", "image/webp"}
    if image.content_type and image.content_type not in allowed:
        raise HTTPException(400, f"Unsupported format: {image.content_type}")

    image_bytes = await image.read()
    if len(image_bytes) > 5 * 1024 * 1024:
        raise HTTPException(413, "Image too large (max 5MB)")

    try:
        import pytesseract
        from PIL import Image, ImageOps
    except ImportError as e:
        raise HTTPException(500, f"Required package not installed: {e}")

    from app.services.ocr.tesseract_provider import detect_tesseract, get_ocr_lang
    detect_tesseract()

    try:
        img = Image.open(io.BytesIO(image_bytes))
    except Exception:
        raise HTTPException(422, "Could not read image")

    img = ImageOps.exif_transpose(img) or img

    # Lightweight preprocessing: shrink to 500px, grayscale, autocontrast only
    w, h = img.size
    if w > 500:
        scale = 500 / w
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    img = img.convert("L")
    img = ImageOps.autocontrast(img, cutoff=1)

    lang = get_ocr_lang()

    start = time.time()
    try:
        data = pytesseract.image_to_data(
            img, lang=lang, config="--psm 6 --oem 1",
            output_type=pytesseract.Output.DICT,
        )
    except Exception as e:
        raise HTTPException(500, f"Tesseract failed: {e}")
    duration_ms = int((time.time() - start) * 1000)

    # Count valid words and compute average confidence
    words = []
    for i in range(len(data.get("text", []))):
        text = (data["text"][i] or "").strip()
        conf = float(data["conf"][i]) if str(data["conf"][i]) != "-1" else 0
        if text and conf > 30:
            words.append({"text": text, "conf": conf})

    word_count = len(words)
    avg_confidence = round(sum(w["conf"] for w in words) / word_count, 1) if words else 0
    preview_text = " ".join(w["text"] for w in words[:30])[:200]

    if word_count == 0:
        quality = "empty"
    elif avg_confidence > 60 and word_count > 5:
        quality = "good"
    elif avg_confidence > 40 or word_count > 2:
        quality = "fair"
    else:
        quality = "poor"

    return {
        "word_count": word_count,
        "avg_confidence": avg_confidence,
        "quality": quality,
        "preview_text": preview_text,
        "duration_ms": duration_ms,
    }


@router.post("/ocr/email-results")
async def ocr_email_results(
    image: UploadFile = File(...),
    email: str = "",
    scan_data: str = "{}",
    admin: UserInfo = Depends(require_admin),
):
    """Email OCR scan results (image + parsed data) for record-keeping."""
    import base64
    import json
    from PIL import Image, ImageOps

    if not email or "@" not in email:
        raise HTTPException(400, "Valid email address is required")

    # Read and resize image for email (max 800px wide)
    image_bytes = await image.read()
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img = ImageOps.exif_transpose(img) or img
        if img.width > 800:
            scale = 800 / img.width
            img = img.resize((int(img.width * scale), int(img.height * scale)), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=75)
        img_b64 = base64.b64encode(buf.getvalue()).decode()
    except Exception:
        img_b64 = None

    # Parse scan data
    try:
        data = json.loads(scan_data)
    except Exception:
        data = {}

    quality = data.get("quality", "unknown")
    box_count = data.get("box_count", 0)
    duration_ms = data.get("duration_ms", 0)
    raw_text = data.get("raw_text", "")[:2000]
    mapped_fields = data.get("mapped_fields", {})

    status_badge = {
        "good": "background:#22c55e;color:white",
        "fair": "background:#f59e0b;color:white",
        "poor": "background:#ef4444;color:white",
        "empty": "background:#6b7280;color:white",
    }.get(quality, "background:#6b7280;color:white")

    # Build HTML email
    fields_html = ""
    if mapped_fields:
        rows = "".join(
            f"<tr><td style='padding:4px 8px;font-weight:bold'>{k}</td><td style='padding:4px 8px'>{v}</td></tr>"
            for k, v in mapped_fields.items() if v
        )
        if rows:
            fields_html = f"<h3>Mapped Fields</h3><table border='1' cellpadding='0' cellspacing='0' style='border-collapse:collapse;border-color:#e5e7eb'>{rows}</table>"

    img_html = f'<img src="data:image/jpeg;base64,{img_b64}" style="max-width:100%;border-radius:8px" />' if img_b64 else "<p>(Image not available)</p>"

    html_body = f"""
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto">
        <h2>OCR Scan Results</h2>
        <p><span style="padding:3px 8px;border-radius:4px;font-size:12px;{status_badge}">{quality.upper()}</span>
        &nbsp; {box_count} boxes &nbsp; {duration_ms}ms</p>
        {img_html}
        {fields_html}
        <h3>Raw OCR Text</h3>
        <pre style="background:#f3f4f6;padding:12px;border-radius:8px;font-size:12px;white-space:pre-wrap;max-height:400px;overflow:auto">{raw_text or '(no text detected)'}</pre>
        <p style="font-size:11px;color:#9ca3af;margin-top:16px">Sent from GroceryApp OCR Test Scanner</p>
    </div>
    """

    from app.services import email_service
    try:
        provider = await email_service.send_email(email, "OCR Scan Results — GroceryApp", html_body)
        return {"success": True, "message": f"Results emailed to {email} via {provider}"}
    except email_service.EmailDeliveryFailed as e:
        raise HTTPException(500, f"Email delivery failed: {e}")


def _merge_ocr_words(data: dict, img_w: int, img_h: int) -> list[dict]:
    """Merge Tesseract word-level data into smart text region boxes.

    Pipeline:
    1. Group words by (block_num, line_num)
    2. Within each line, split on large horizontal gaps (>3× avg word spacing)
    3. Merge adjacent lines in same block if close vertically and not standalone data
    4. Filter garbage (low conf, empty, single char)
    5. Convert to percentage coordinates
    """
    import re

    n = len(data.get("text", []))
    if n == 0:
        return []

    # Patterns for standalone data fields (should NOT be merged with neighbors)
    PRICE_RE = re.compile(r"^(?:RM\s*)?\d+[.,]\d{2}$", re.IGNORECASE)
    DATE_RE = re.compile(r"\d{1,2}[/\-.]?\d{1,2}[/\-.]?\d{2,4}")
    BARCODE_RE = re.compile(r"^\d{8,13}$")

    def is_data_field(text: str) -> bool:
        t = text.strip()
        return bool(PRICE_RE.match(t) or BARCODE_RE.match(t) or (DATE_RE.match(t) and len(t) >= 6))

    # Step 1: Collect valid words
    words = []
    for i in range(n):
        text = (data["text"][i] or "").strip()
        conf = float(data["conf"][i]) if data["conf"][i] != "-1" else 0
        if not text or conf < 20:
            continue
        words.append({
            "text": text,
            "conf": conf,
            "left": int(data["left"][i]),
            "top": int(data["top"][i]),
            "width": int(data["width"][i]),
            "height": int(data["height"][i]),
            "block": int(data["block_num"][i]),
            "line": int(data["line_num"][i]),
        })

    if not words:
        return []

    # Step 2: Group by (block, line)
    from collections import defaultdict
    lines: dict[tuple[int, int], list[dict]] = defaultdict(list)
    for w in words:
        lines[(w["block"], w["line"])].append(w)

    # Sort words within each line by horizontal position
    for key in lines:
        lines[key].sort(key=lambda w: w["left"])

    # Step 3: Within each line, split on large horizontal gaps
    line_groups: list[dict] = []  # {text, conf, left, top, right, bottom, block, line, word_count}

    for (block, line), line_words in sorted(lines.items()):
        if len(line_words) == 1:
            w = line_words[0]
            line_groups.append({
                "text": w["text"],
                "conf": w["conf"],
                "left": w["left"],
                "top": w["top"],
                "right": w["left"] + w["width"],
                "bottom": w["top"] + w["height"],
                "block": block,
                "line": line,
                "word_count": 1,
            })
            continue

        # Calculate inter-word gaps
        gaps = []
        for j in range(1, len(line_words)):
            gap = line_words[j]["left"] - (line_words[j - 1]["left"] + line_words[j - 1]["width"])
            gaps.append(max(gap, 0))

        avg_gap = sum(gaps) / len(gaps) if gaps else 0
        split_threshold = max(avg_gap * 3, 40)  # at least 40px gap to split

        # Build sub-groups within the line
        current_group = [line_words[0]]
        for j in range(1, len(line_words)):
            gap = line_words[j]["left"] - (line_words[j - 1]["left"] + line_words[j - 1]["width"])
            if gap > split_threshold:
                # Flush current group
                line_groups.append(_make_group(current_group, block, line))
                current_group = [line_words[j]]
            else:
                current_group.append(line_words[j])
        if current_group:
            line_groups.append(_make_group(current_group, block, line))

    # Step 4: Merge adjacent lines in same block (if close and not standalone data)
    line_groups.sort(key=lambda g: (g["block"], g["line"], g["left"]))
    merged: list[dict] = []
    i = 0
    while i < len(line_groups):
        current = dict(line_groups[i])  # copy
        # Try to merge with next groups in same block
        while i + 1 < len(line_groups):
            nxt = line_groups[i + 1]
            if nxt["block"] != current["block"]:
                break
            # Check vertical proximity
            current_h = current["bottom"] - current["top"]
            gap_v = nxt["top"] - current["bottom"]
            if gap_v > current_h * 1.5:
                break  # too far apart
            # Don't merge if either is a standalone data field
            if is_data_field(current["text"]) or is_data_field(nxt["text"]):
                break
            # Merge
            current["text"] = current["text"] + " " + nxt["text"]
            current["conf"] = (current["conf"] + nxt["conf"]) / 2
            current["left"] = min(current["left"], nxt["left"])
            current["top"] = min(current["top"], nxt["top"])
            current["right"] = max(current["right"], nxt["right"])
            current["bottom"] = max(current["bottom"], nxt["bottom"])
            current["word_count"] += nxt["word_count"]
            i += 1
        merged.append(current)
        i += 1

    # Step 5: Filter and convert to percentage coordinates
    boxes = []
    for idx, g in enumerate(merged):
        text = g["text"].strip()
        if len(text) < 2:
            continue
        w_pct = (g["right"] - g["left"]) / img_w * 100
        h_pct = (g["bottom"] - g["top"]) / img_h * 100
        if w_pct < 0.5 or h_pct < 0.3:
            continue  # too small

        boxes.append({
            "id": f"b_{idx}",
            "text": text,
            "confidence": round(g["conf"], 1),
            "x": round(max(0, g["left"] / img_w * 100), 2),
            "y": round(max(0, g["top"] / img_h * 100), 2),
            "w": round(min(w_pct, 100), 2),
            "h": round(min(h_pct, 100), 2),
            "word_count": g["word_count"],
        })

    return boxes


def _make_group(words: list[dict], block: int, line: int) -> dict:
    """Create a line group from a list of words."""
    return {
        "text": " ".join(w["text"] for w in words),
        "conf": sum(w["conf"] for w in words) / len(words),
        "left": min(w["left"] for w in words),
        "top": min(w["top"] for w in words),
        "right": max(w["left"] + w["width"] for w in words),
        "bottom": max(w["top"] + w["height"] for w in words),
        "block": block,
        "line": line,
        "word_count": len(words),
    }


# ---------------------------------------------------------------------------
# Feature Flags (refactor Phase 2)
# ---------------------------------------------------------------------------

@router.get("/features")
async def get_feature_flags(admin: UserInfo = Depends(require_admin)):
    """Return all feature flags (merged with defaults)."""
    from app.core import feature_flags
    return {"flags": feature_flags.get_all_flags()}


@router.patch("/features")
async def update_feature_flags(body: dict, admin: UserInfo = Depends(require_admin)):
    """Update one or more feature flags. Body is a dict of {flag_name: value}.

    Cache invalidated immediately so change takes effect on next request.
    """
    from firebase_admin import firestore as _fs
    from app.core import feature_flags
    from app.core.metadata import apply_update_metadata

    if not isinstance(body, dict) or not body:
        raise HTTPException(status_code=400, detail="Body must be a non-empty dict of flag updates")

    known = set(feature_flags.DEFAULT_FLAGS.keys())
    unknown = [k for k in body.keys() if k not in known]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown flags: {unknown}")

    db = _fs.client()
    doc_ref = db.collection("app_config").document("features")
    payload = apply_update_metadata({**body, "updated_by": admin.uid})
    doc_ref.set(payload, merge=True)
    feature_flags.invalidate_cache()
    logger.info("feature_flags.updated admin=%s fields=%s", admin.uid, list(body.keys()))
    return {"success": True, "flags": feature_flags.get_all_flags()}


# ---------------------------------------------------------------------------
# Catalog Analysis (refactor Phase 2)
# ---------------------------------------------------------------------------

@router.get("/catalog-analysis")
async def get_catalog_analysis(
    refresh: bool = Query(False, description="force rebuild"),
    admin: UserInfo = Depends(require_admin),
):
    """Aggregated cross-user catalog view (barcode→names, unnamed, cleanup preview).

    Uses cached doc unless refresh=true. Cache refreshed weekly by scheduler.
    """
    from app.services import catalog_analysis_service
    from app.core.exceptions import NotFoundError

    if refresh:
        return catalog_analysis_service.refresh_cache()
    try:
        return catalog_analysis_service.get_cached_analysis()
    except NotFoundError:
        # First run — build cache on demand
        return catalog_analysis_service.refresh_cache()


@router.post("/catalog-analysis/promote")
async def promote_to_global(body: dict, admin: UserInfo = Depends(require_admin)):
    """Promote a user-named catalog entry to the global products collection.

    Body: {"barcode": "9555012345678", "canonical_name": "Milk"}
    """
    from app.services import catalog_analysis_service

    barcode = (body or {}).get("barcode", "").strip()
    canonical_name = (body or {}).get("canonical_name", "").strip()
    if not barcode or not canonical_name:
        raise HTTPException(status_code=400, detail="barcode and canonical_name are required")
    return catalog_analysis_service.promote_to_global(barcode, canonical_name, admin.uid)


@router.post("/catalog-analysis/flag-spam")
async def flag_spam(body: dict, admin: UserInfo = Depends(require_admin)):
    """Flag a barcode as spam in the global products catalog.

    Body: {"barcode": "9555012345678", "reason": "optional free text"}
    """
    from app.services import catalog_analysis_service

    barcode = (body or {}).get("barcode", "").strip()
    reason = (body or {}).get("reason", "")
    if not barcode:
        raise HTTPException(status_code=400, detail="barcode is required")
    return catalog_analysis_service.flag_spam(barcode, admin.uid, reason=reason)


# ---------------------------------------------------------------------------
# Test data seed (admin-only, marked source="test_seed" for clean teardown)
# ---------------------------------------------------------------------------

@router.post("/seed-test-data")
async def seed_test_data(admin: UserInfo = Depends(require_admin)):
    """Create a mixed-state set of purchase events for the calling admin user.

    Items are tagged source="test_seed" and span all groups: fresh active,
    expiring soon, expired, thrown, used. Locations span all four. Use the
    DELETE counterpart to tear down.
    """
    from datetime import datetime, timedelta, timezone
    from firebase_admin import firestore
    from app.services import purchase_event_service

    db = firestore.client()
    now = datetime.now(timezone.utc)

    # Idempotency — clear existing seed events first so re-running doesn't pile up
    existing = (
        db.collection("users").document(admin.uid).collection("purchases")
        .where("source", "==", "test_seed").stream()
    )
    cleared = 0
    for doc in existing:
        doc.reference.delete()
        cleared += 1

    # Seed plan — 20 items across all states/locations
    seed_specs = [
        # (name, location, expiry_offset_days_from_now, status, reason, days_ago_bought, qty, price)
        ("Milk",       "fridge",  3,    "active",      None,        1,  1,   3.50),
        ("Eggs",       "fridge",  10,   "active",      None,        2,  12,  6.20),
        ("Cheddar",    "fridge",  21,   "active",      None,        4,  1,   8.90),
        ("Yogurt",     "fridge",  -2,   "active",      None,        9,  1,   4.10),  # expired, still active
        ("Butter",     "fridge",  60,   "active",      None,        7,  1,   5.50),
        ("Chicken",    "freezer", 90,   "active",      None,        3,  1,   12.00),
        ("Frozen peas","freezer", 180,  "active",      None,        14, 1,   3.20),
        ("Ice cream",  "freezer", 1,    "active",      None,        2,  1,   7.50),  # urgent
        ("Bread",      "counter", 2,    "active",      None,        1,  1,   3.00),  # urgent
        ("Bananas",    "counter", -1,   "active",      None,        6,  6,   2.40),  # expired
        ("Apples",     "counter", 5,    "active",      None,        2,  4,   4.80),  # expiring soon
        ("Rice",       "pantry",  365,  "active",      None,        20, 1,   8.50),  # fresh, far expiry
        ("Pasta",      "pantry",  300,  "active",      None,        18, 2,   4.20),
        ("Coffee",     "pantry",  120,  "active",      None,        10, 1,   15.00),
        ("Crackers",   "pantry",  None, "active",      None,        3,  1,   None),  # no expiry tracked
        # Terminal states — for history/insights views
        ("Tomatoes",   "counter", -3,   "thrown",      "expired",   10, 3,   3.00),
        ("Lettuce",    "fridge",  -5,   "thrown",      "bad",       11, 1,   2.80),
        ("Strawberries","fridge", -1,   "thrown",      "bad",       8,  1,   5.50),
        ("Carrots",    "fridge",  None, "used",        "used_up",   12, 1,   2.20),
        ("Onions",     "pantry",  None, "used",        "used_up",   15, 3,   1.80),
    ]

    created = 0
    for (
        name, location, expiry_off, target_status, reason,
        days_ago, qty, price,
    ) in seed_specs:
        date_bought = now - timedelta(days=days_ago)
        expiry_date = (now + timedelta(days=expiry_off)) if expiry_off is not None else None

        event = purchase_event_service.create_purchase(
            user_id=admin.uid,
            name=name,
            quantity=float(qty),
            expiry_date=expiry_date,
            price=price,
            currency="MYR" if price else None,
            payment_method=None,
            date_bought=date_bought,
            location=location,
            source="test_seed",
        )

        # If the spec calls for a terminal status, transition right after creation.
        if target_status != "active":
            purchase_event_service.update_status(
                user_id=admin.uid,
                event_id=event["id"],
                status=target_status,
                reason=reason,
            )

        created += 1

    return {
        "success": True,
        "cleared_previous": cleared,
        "created": created,
        "uid": admin.uid,
        "message": f"Seeded {created} test items (cleared {cleared} prior).",
    }


@router.delete("/seed-test-data")
async def clear_test_data(admin: UserInfo = Depends(require_admin)):
    """Delete every purchase event in the admin's account tagged source='test_seed'.

    Catalog entries are left in place — the catalog cleanup scheduler prunes
    zero-purchase entries automatically.
    """
    from firebase_admin import firestore

    db = firestore.client()
    existing = (
        db.collection("users").document(admin.uid).collection("purchases")
        .where("source", "==", "test_seed").stream()
    )
    deleted = 0
    for doc in existing:
        doc.reference.delete()
        deleted += 1

    return {"success": True, "deleted": deleted, "uid": admin.uid}
