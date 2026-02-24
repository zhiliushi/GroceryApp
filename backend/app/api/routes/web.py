"""
Web page routes (Jinja2 HTML).
All pages require authentication unless noted.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Request, Depends
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from app.core.auth import UserInfo, get_optional_user, get_current_user, require_admin
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()
templates = Jinja2Templates(directory="templates")


def _ctx(request: Request, user: UserInfo, active_page: str, **extra):
    """Build base template context."""
    return {
        "request": request,
        "user": user,
        "active_page": active_page,
        "firebase_config": {
            "api_key": settings.FIREBASE_WEB_API_KEY,
            "auth_domain": settings.FIREBASE_WEB_AUTH_DOMAIN,
            "project_id": settings.FIREBASE_WEB_PROJECT_ID,
        },
        **extra,
    }


# ---------------------------------------------------------------------------
# Public
# ---------------------------------------------------------------------------

@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request, user: Optional[UserInfo] = Depends(get_optional_user)):
    if user:
        return RedirectResponse("/dashboard", status_code=302)
    return templates.TemplateResponse("login.html", {
        "request": request,
        "user": None,
        "firebase_config": {
            "api_key": settings.FIREBASE_WEB_API_KEY,
            "auth_domain": settings.FIREBASE_WEB_AUTH_DOMAIN,
            "project_id": settings.FIREBASE_WEB_PROJECT_ID,
        },
    })


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page(request: Request, user: UserInfo = Depends(get_current_user)):
    return templates.TemplateResponse("dashboard.html", _ctx(request, user, "dashboard"))


# ---------------------------------------------------------------------------
# Users (admin)
# ---------------------------------------------------------------------------

@router.get("/users", response_class=HTMLResponse)
async def users_page(request: Request, user: UserInfo = Depends(require_admin)):
    return templates.TemplateResponse("users.html", _ctx(request, user, "users"))


@router.get("/users/{uid}", response_class=HTMLResponse)
async def user_detail_page(uid: str, request: Request, user: UserInfo = Depends(require_admin)):
    return templates.TemplateResponse("user_detail.html", _ctx(request, user, "users", target_uid=uid))


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------

@router.get("/inventory", response_class=HTMLResponse)
async def inventory_page(request: Request, user: UserInfo = Depends(get_current_user)):
    return templates.TemplateResponse("inventory.html", _ctx(request, user, "inventory"))


@router.get("/inventory/{uid}/{item_id}", response_class=HTMLResponse)
async def inventory_detail_page(uid: str, item_id: str, request: Request, user: UserInfo = Depends(get_current_user)):
    return templates.TemplateResponse("inventory_detail.html", _ctx(request, user, "inventory", target_uid=uid, item_id=item_id))


# ---------------------------------------------------------------------------
# Shopping Lists
# ---------------------------------------------------------------------------

@router.get("/shopping-lists", response_class=HTMLResponse)
async def shopping_lists_page(request: Request, user: UserInfo = Depends(get_current_user)):
    return templates.TemplateResponse("shopping_lists.html", _ctx(request, user, "shopping_lists"))


@router.get("/shopping-lists/{uid}/{list_id}", response_class=HTMLResponse)
async def shopping_list_detail_page(uid: str, list_id: str, request: Request, user: UserInfo = Depends(get_current_user)):
    return templates.TemplateResponse("shopping_list_detail.html", _ctx(request, user, "shopping_lists", target_uid=uid, list_id=list_id))


# ---------------------------------------------------------------------------
# Foodbanks
# ---------------------------------------------------------------------------

@router.get("/foodbanks", response_class=HTMLResponse)
async def foodbanks_page(request: Request, user: UserInfo = Depends(get_current_user)):
    return templates.TemplateResponse("foodbanks.html", _ctx(request, user, "foodbanks"))


@router.get("/foodbanks/new", response_class=HTMLResponse)
async def foodbank_create_page(request: Request, user: UserInfo = Depends(require_admin)):
    return templates.TemplateResponse("foodbank_form.html", _ctx(request, user, "foodbanks", foodbank_id=None))


@router.get("/foodbanks/{foodbank_id}/edit", response_class=HTMLResponse)
async def foodbank_edit_page(foodbank_id: str, request: Request, user: UserInfo = Depends(require_admin)):
    return templates.TemplateResponse("foodbank_form.html", _ctx(request, user, "foodbanks", foodbank_id=foodbank_id))


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

@router.get("/analytics", response_class=HTMLResponse)
async def analytics_page(request: Request, user: UserInfo = Depends(get_current_user)):
    return templates.TemplateResponse("analytics.html", _ctx(request, user, "analytics"))


# ---------------------------------------------------------------------------
# Admin: Products (Database Management)
# ---------------------------------------------------------------------------

@router.get("/products", response_class=HTMLResponse)
async def products_page(request: Request, user: UserInfo = Depends(require_admin)):
    return templates.TemplateResponse("products.html", _ctx(request, user, "products"))


@router.get("/products/new", response_class=HTMLResponse)
async def product_create_page(request: Request, user: UserInfo = Depends(require_admin)):
    return templates.TemplateResponse("product_form.html", _ctx(request, user, "products", product_barcode=None))


@router.get("/products/{barcode}/edit", response_class=HTMLResponse)
async def product_edit_page(barcode: str, request: Request, user: UserInfo = Depends(require_admin)):
    return templates.TemplateResponse("product_form.html", _ctx(request, user, "products", product_barcode=barcode))


# ---------------------------------------------------------------------------
# Admin: Contributed Products
# ---------------------------------------------------------------------------

@router.get("/contributed-products", response_class=HTMLResponse)
async def contributed_page(request: Request, user: UserInfo = Depends(require_admin)):
    return templates.TemplateResponse("contributed_products.html", _ctx(request, user, "contributed"))


# ---------------------------------------------------------------------------
# Admin: Needs Review
# ---------------------------------------------------------------------------

@router.get("/needs-review", response_class=HTMLResponse)
async def needs_review_page(request: Request, user: UserInfo = Depends(require_admin)):
    return templates.TemplateResponse("needs_review.html", _ctx(request, user, "needs_review"))


# ---------------------------------------------------------------------------
# Admin: Price Records
# ---------------------------------------------------------------------------

@router.get("/price-records", response_class=HTMLResponse)
async def price_records_page(request: Request, user: UserInfo = Depends(require_admin)):
    return templates.TemplateResponse("price_records.html", _ctx(request, user, "price_records"))


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

@router.get("/settings", response_class=HTMLResponse)
async def settings_page(request: Request, user: UserInfo = Depends(get_current_user)):
    return templates.TemplateResponse("settings.html", _ctx(request, user, "settings"))
