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
from fastapi.responses import RedirectResponse, JSONResponse

from app.api.routes import barcode, analytics, foodbank, admin, web
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

# Static files
app.mount("/static", StaticFiles(directory="static"), name="static")

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

# Web UI Router (must be last — catches page routes)
app.include_router(web.router, tags=["web"])


# ---------------------------------------------------------------------------
# Auth redirect — web pages redirect to /login instead of showing JSON errors
# ---------------------------------------------------------------------------

@app.exception_handler(HTTPException)
async def auth_redirect_handler(request: Request, exc: HTTPException):
    """Redirect to /login for 401/403 on web page routes (non-API)."""
    path = request.url.path
    is_api = path.startswith("/api/") or path == "/health"
    if not is_api and exc.status_code in (401, 403):
        return RedirectResponse("/login", status_code=302)
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


@app.get("/")
async def root():
    return RedirectResponse("/dashboard", status_code=302)


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
    return {
        "authenticated": True,
        "uid": user.uid,
        "email": user.email,
        "role": user.role,
        "display_name": user.display_name,
    }


# ---------------------------------------------------------------------------
# Dev entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
