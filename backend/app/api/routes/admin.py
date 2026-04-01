"""
Admin API routes (JSON).
All endpoints require admin role.
"""

import logging

from fastapi import APIRouter, HTTPException, Depends, Query
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
