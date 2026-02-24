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
