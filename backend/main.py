"""
GroceryApp API — FastAPI backend for barcode scanning, analytics, and foodbanks.

Endpoints:
  POST /api/barcode/scan           — Barcode lookup (Firebase → OFF)
  GET  /api/barcode/product/{id}   — Direct product lookup
  POST /api/barcode/contribute     — User-contributed product
  POST /api/analytics/batch        — Batch event sync
  POST /api/analytics/sync         — Legacy sync (backward compat)
  GET  /api/analytics/stats/{uid}  — Aggregated stats
  GET  /api/analytics/insights/{uid} — AI insights
  GET  /api/foodbanks              — List foodbanks (optional ?country=MY)
  GET  /api/foodbanks/{id}         — Get single foodbank
  POST /api/foodbanks/seed         — Seed Malaysia data
  POST /api/foodbanks/refresh      — Manual refresh
  GET  /health                     — Health check
"""

import json
import logging
import os

import firebase_admin
from firebase_admin import credentials
from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, JSONResponse, FileResponse

from app.api.routes import barcode, analytics, foodbank, admin, receipt, household, meals, scan
from app.core.config import settings
from app.services import scheduler

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO if settings.ENVIRONMENT == "production" else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Firebase Admin SDK initialization
# ---------------------------------------------------------------------------

if not firebase_admin._apps:
    cred = None
    init_options = {"databaseURL": settings.FIREBASE_DATABASE_URL or None}

    # Priority 1: JSON credentials from environment (for cloud deployment)
    if settings.FIREBASE_CREDENTIALS_JSON:
        try:
            creds_dict = json.loads(settings.FIREBASE_CREDENTIALS_JSON)
            cred = credentials.Certificate(creds_dict)
            logger.info("Firebase initialized with JSON credentials from env")
        except json.JSONDecodeError as e:
            logger.error("Failed to parse FIREBASE_CREDENTIALS_JSON: %s", e)

    # Priority 2: File path (for local development)
    elif settings.FIREBASE_CREDENTIALS_PATH and os.path.exists(settings.FIREBASE_CREDENTIALS_PATH):
        cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
        logger.info("Firebase initialized with service account file: %s", settings.FIREBASE_CREDENTIALS_PATH)

    # Initialize Firebase
    if cred:
        firebase_admin.initialize_app(cred, init_options)
    else:
        # Fallback: Application Default Credentials
        firebase_admin.initialize_app()
        logger.info("Firebase initialized with Application Default Credentials")

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="GroceryApp API",
    description="Backend API for GroceryApp — barcode scanning, analytics, and AI insights",
    version="2.2.0",
)

# Static files (legacy templates + SPA assets)
app.mount("/static", StaticFiles(directory="static"), name="static")

# SPA assets (Vite build output)
_spa_dir = os.path.join(os.path.dirname(__file__), "static", "spa")
if os.path.isdir(os.path.join(_spa_dir, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(_spa_dir, "assets")), name="spa-assets")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
app.include_router(barcode.router, prefix="/api/barcode", tags=["barcode"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(foodbank.router, prefix="/api/foodbanks", tags=["foodbanks"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(receipt.router, prefix="/api/receipt", tags=["receipt"])
app.include_router(household.router, prefix="/api/household", tags=["household"])
app.include_router(meals.router, prefix="/api/meals", tags=["meals"])
app.include_router(scan.router, prefix="/api/scan", tags=["scan"])

# SPA catch-all (serves React app for all non-API routes)
# Replaces the old Jinja2 web.router


# ---------------------------------------------------------------------------
# Auth redirect — web pages redirect to /login instead of showing JSON errors
# ---------------------------------------------------------------------------

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Return JSON for all HTTP exceptions (SPA handles auth redirects client-side)."""
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


# ---------------------------------------------------------------------------
# Root & Health
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def on_startup():
    scheduler.start()
    logger.info("Background scheduler started")


@app.on_event("shutdown")
async def on_shutdown():
    scheduler.stop()
    logger.info("Background scheduler stopped")


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/api/me")
async def get_current_user_info(request: Request):
    """Return current authenticated user info (uid, email, role).
    Useful for initial setup to find your Firebase UID."""
    from app.core.auth import get_optional_user
    user = await get_optional_user(request)
    if not user:
        return {"authenticated": False}
    # Enrich with Firestore profile data (tier, status, tools, country)
    from app.services import user_service, config_service
    profile = user_service.get_user(user.uid)

    # New user check: if no profile exists and registration is closed, block
    if not profile:
        allowed, reason = config_service.check_registration_allowed()
        if not allowed:
            return {"authenticated": True, "uid": user.uid, "registration_blocked": True, "reason": reason}

    profile = profile or {}
    return {
        "authenticated": True,
        "uid": user.uid,
        "email": user.email,
        "role": user.role,
        "display_name": user.display_name,
        "tier": profile.get("tier", "free"),
        "status": profile.get("status", "active"),
        "selected_tools": profile.get("selected_tools", []),
        "country": profile.get("country"),
        "currency": profile.get("currency"),
    }


@app.get("/api/inventory/my")
async def get_my_inventory(request: Request):
    """User-facing inventory: returns user's own items + household members' items.

    Household-aware — if user is in a household, merges all members' items
    with member attribution. Falls back to solo if no household."""
    from app.core.auth import get_current_user
    from app.services import inventory_service
    user = await get_current_user(request)
    items = inventory_service.get_household_items(user.uid, limit=500)
    return {"count": len(items), "items": items}


@app.get("/api/config")
async def get_public_config():
    """Public app config — visibility rules + tier definitions.
    No auth required. Used by mobile app and web SPA on startup."""
    from app.services import config_service
    return config_service.get_public_config()


@app.get("/api/config/locations")
async def get_locations():
    """Public storage locations config. No auth required."""
    from app.services import location_service
    return {"locations": location_service.get_locations()}


@app.get("/api/exchange-rates")
async def get_exchange_rates():
    """Public exchange rates. No auth required."""
    from app.services import exchange_rate_service
    return exchange_rate_service.get_rates()


# ---------------------------------------------------------------------------
# SPA fallback — middleware serves index.html for non-API 404s
# This runs AFTER all API routes have been tried, so /api/* is never caught
# ---------------------------------------------------------------------------

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse


class SPAFallbackMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> StarletteResponse:
        response = await call_next(request)
        path = request.url.path
        # Only serve SPA for non-API GET requests that would 404
        if (
            response.status_code == 404
            and request.method == "GET"
            and not path.startswith("/api/")
            and not path.startswith("/static/")
            and path != "/health"
        ):
            index_path = os.path.join(_spa_dir, "index.html")
            if os.path.isfile(index_path):
                return FileResponse(index_path)
        return response


app.add_middleware(SPAFallbackMiddleware)


# ---------------------------------------------------------------------------
# Dev entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
