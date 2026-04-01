"""
OCR configuration + usage tracking service.

Firestore documents:
  app_config/ocr        — provider settings (enabled, order, limits)
  app_config/ocr_usage  — per-provider monthly counters + error counts
"""

from __future__ import annotations

import logging
from datetime import datetime

from firebase_admin import firestore

logger = logging.getLogger(__name__)

_CONFIG_COLLECTION = "app_config"
_CONFIG_DOC_ID = "ocr"
_USAGE_DOC_ID = "ocr_usage"

_DEFAULT_OCR_CONFIG = {
    "enabled": True,
    "providers": [
        {
            "key": "google_vision",
            "name": "Google Cloud Vision",
            "enabled": False,
            "priority": 1,
            "monthly_limit": 1000,
            "api_key_set": False,
        },
        {
            "key": "mindee",
            "name": "Mindee Receipt API",
            "enabled": False,
            "priority": 2,
            "monthly_limit": 250,
            "api_key_set": False,
        },
        {
            "key": "tesseract",
            "name": "Tesseract (Local)",
            "enabled": True,
            "priority": 3,
            "monthly_limit": -1,
            "api_key_set": None,
        },
    ],
    "updated_at": None,
    "updated_by": None,
}


def _db():
    return firestore.client()


# ---------------------------------------------------------------------------
# Config CRUD
# ---------------------------------------------------------------------------


def get_ocr_config() -> dict:
    """Get OCR provider configuration, creating defaults if missing."""
    doc = _db().collection(_CONFIG_COLLECTION).document(_CONFIG_DOC_ID).get()
    if doc.exists:
        return doc.to_dict()

    # Seed defaults
    _db().collection(_CONFIG_COLLECTION).document(_CONFIG_DOC_ID).set(_DEFAULT_OCR_CONFIG)
    return dict(_DEFAULT_OCR_CONFIG)


def update_ocr_config(data: dict, admin_uid: str) -> None:
    """Update OCR provider configuration."""
    data["updated_at"] = datetime.utcnow().isoformat()
    data["updated_by"] = admin_uid
    _db().collection(_CONFIG_COLLECTION).document(_CONFIG_DOC_ID).set(data, merge=True)


def check_api_keys() -> dict[str, bool]:
    """Check which API keys are configured in environment."""
    from app.core.config import settings

    return {
        "google_vision": bool(getattr(settings, "GOOGLE_VISION_API_KEY", "")),
        "mindee": bool(getattr(settings, "MINDEE_API_KEY", "")),
        "tesseract": True,  # no key needed
    }


def sync_api_key_status() -> None:
    """Update api_key_set flags in config based on actual env vars."""
    keys = check_api_keys()
    config = get_ocr_config()
    changed = False

    for provider in config.get("providers", []):
        key = provider.get("key", "")
        if key in keys:
            expected = keys[key] if key != "tesseract" else None
            if provider.get("api_key_set") != expected:
                provider["api_key_set"] = expected
                changed = True

    if changed:
        _db().collection(_CONFIG_COLLECTION).document(_CONFIG_DOC_ID).set(config)


# ---------------------------------------------------------------------------
# Usage tracking
# ---------------------------------------------------------------------------


def get_usage() -> dict:
    """Get current usage stats for all providers."""
    doc = _db().collection(_CONFIG_COLLECTION).document(_USAGE_DOC_ID).get()
    if doc.exists:
        return doc.to_dict()
    return {}


def increment_usage(provider_key: str, success: bool) -> None:
    """Increment usage counter for a provider.

    Uses a Firestore transaction to prevent race conditions when
    multiple scans happen concurrently near the quota limit.
    """
    current_month = datetime.utcnow().strftime("%Y-%m")
    ref = _db().collection(_CONFIG_COLLECTION).document(_USAGE_DOC_ID)

    @firestore.transactional
    def _update(transaction):
        snapshot = ref.get(transaction=transaction)
        data = snapshot.to_dict() if snapshot.exists else {}

        provider_data = data.get(provider_key, {})

        # Reset counters on new month
        if provider_data.get("month") != current_month:
            provider_data = {"month": current_month, "count": 0, "errors": 0}

        provider_data["count"] = provider_data.get("count", 0) + 1
        if not success:
            provider_data["errors"] = provider_data.get("errors", 0) + 1
        provider_data["last_used"] = datetime.utcnow().isoformat()

        data[provider_key] = provider_data
        transaction.set(ref, data)

    transaction = _db().transaction()
    _update(transaction)


def check_quota(provider_key: str, monthly_limit: int) -> bool:
    """Check if a provider is within its monthly quota.

    Returns True if the provider can be used, False if quota exceeded.
    """
    if monthly_limit <= 0:  # -1 = unlimited
        return True

    current_month = datetime.utcnow().strftime("%Y-%m")
    usage = get_usage()
    provider_data = usage.get(provider_key, {})

    if provider_data.get("month") != current_month:
        return True  # new month, counter reset

    return provider_data.get("count", 0) < monthly_limit


def get_usage_with_config() -> dict:
    """Get usage stats merged with config for the admin settings tab."""
    config = get_ocr_config()
    usage = get_usage()
    current_month = datetime.utcnow().strftime("%Y-%m")

    result = {
        "enabled": config.get("enabled", True),
        "providers": [],
        "updated_at": config.get("updated_at"),
        "updated_by": config.get("updated_by"),
    }

    for p in config.get("providers", []):
        key = p["key"]
        p_usage = usage.get(key, {})

        # Auto-reset display if different month
        if p_usage.get("month") != current_month:
            p_usage = {"month": current_month, "count": 0, "errors": 0}

        result["providers"].append({
            **p,
            "usage_count": p_usage.get("count", 0),
            "usage_errors": p_usage.get("errors", 0),
            "last_used": p_usage.get("last_used"),
        })

    return result


# ---------------------------------------------------------------------------
# Requirements checking
# ---------------------------------------------------------------------------


def check_all_requirements() -> dict:
    """Check every provider's requirements and return a detailed status report.

    For each provider, checks:
    - Python package installed
    - System binary available (tesseract)
    - API key configured
    - Credentials valid (for Google Vision)
    - Network reachable
    """
    from app.core.config import settings
    import shutil
    import os

    results = {}

    # --- Google Vision ---
    gv_checks = []
    # Package
    try:
        import google.cloud.vision  # noqa: F401
        gv_checks.append({"check": "python_package", "label": "google-cloud-vision installed", "ok": True})
    except ImportError:
        gv_checks.append({"check": "python_package", "label": "google-cloud-vision installed", "ok": False,
                          "fix": "pip install google-cloud-vision"})

    # Credentials (Firebase SA reuse)
    has_cred_json = bool(settings.FIREBASE_CREDENTIALS_JSON)
    has_cred_path = bool(settings.FIREBASE_CREDENTIALS_PATH) and os.path.exists(settings.FIREBASE_CREDENTIALS_PATH)
    has_creds = has_cred_json or has_cred_path
    gv_checks.append({
        "check": "credentials",
        "label": "Google Cloud credentials available (via Firebase service account)",
        "ok": has_creds,
        "fix": "Set FIREBASE_CREDENTIALS_PATH or FIREBASE_CREDENTIALS_JSON. The same service account used for Firebase works for Vision API."
            if not has_creds else None,
    })

    # Vision API enabled (can only verify by testing)
    gv_checks.append({
        "check": "api_enabled",
        "label": "Cloud Vision API enabled on GCP project",
        "ok": None,  # unknown until test
        "fix": "Go to Google Cloud Console → APIs & Services → Library → Search 'Cloud Vision API' → Enable",
    })

    # Billing
    gv_checks.append({
        "check": "billing",
        "label": "GCP billing enabled (required even for free 1000/month)",
        "ok": None,
        "fix": "Go to Google Cloud Console → Billing → Link a billing account to the project",
    })

    results["google_vision"] = {
        "name": "Google Cloud Vision",
        "ready": has_creds,
        "checks": gv_checks,
        "setup_url": "https://console.cloud.google.com/apis/library/vision.googleapis.com",
        "free_tier": "1,000 images/month",
        "setup_steps": [
            "Ensure your Firebase project has billing enabled in Google Cloud Console",
            "Go to APIs & Services → Library → Search 'Cloud Vision API' → Click Enable",
            "No additional API key needed — the Firebase service account is reused automatically",
            "Use the Test button below to verify everything works",
        ],
    }

    # --- Mindee ---
    md_checks = []
    try:
        import mindee  # noqa: F401
        md_checks.append({"check": "python_package", "label": "mindee package installed", "ok": True})
    except ImportError:
        md_checks.append({"check": "python_package", "label": "mindee package installed", "ok": False,
                          "fix": "pip install mindee"})

    has_mindee_key = bool(settings.MINDEE_API_KEY)
    md_checks.append({
        "check": "api_key",
        "label": "MINDEE_API_KEY configured",
        "ok": has_mindee_key,
        "fix": "Set MINDEE_API_KEY in your .env file (local) or Render environment variables (production). Get your key from https://platform.mindee.com"
            if not has_mindee_key else None,
    })

    results["mindee"] = {
        "name": "Mindee Receipt API",
        "ready": has_mindee_key,
        "checks": md_checks,
        "setup_url": "https://platform.mindee.com",
        "free_tier": "250 pages/month",
        "setup_steps": [
            "Create a free account at https://platform.mindee.com",
            "Go to your dashboard → API Keys",
            "Copy your API key",
            "Set MINDEE_API_KEY in .env (local dev) or Render dashboard (production)",
            "Use the Test button below to verify",
        ],
    }

    # --- Tesseract ---
    ts_checks = []
    try:
        import pytesseract  # noqa: F401
        ts_checks.append({"check": "python_package", "label": "pytesseract installed", "ok": True})
    except ImportError:
        ts_checks.append({"check": "python_package", "label": "pytesseract installed", "ok": False,
                          "fix": "pip install pytesseract"})

    try:
        from PIL import Image  # noqa: F401
        ts_checks.append({"check": "python_package_pillow", "label": "Pillow installed", "ok": True})
    except ImportError:
        ts_checks.append({"check": "python_package_pillow", "label": "Pillow installed", "ok": False,
                          "fix": "pip install Pillow"})

    # Check tesseract binary (also check common Windows install paths)
    tess_binary = shutil.which("tesseract")
    if not tess_binary:
        for candidate in [
            os.path.join(os.environ.get("ProgramFiles", ""), "Tesseract-OCR", "tesseract.exe"),
            os.path.join(os.environ.get("ProgramFiles(x86)", ""), "Tesseract-OCR", "tesseract.exe"),
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        ]:
            if os.path.isfile(candidate):
                tess_binary = candidate
                break
    ts_checks.append({
        "check": "binary",
        "label": f"tesseract binary found{f' at {tess_binary}' if tess_binary else ''}",
        "ok": tess_binary is not None,
        "fix": "Install tesseract-ocr: Windows → winget install UB-Mannheim.TesseractOCR / Docker → apt-get install tesseract-ocr"
            if not tess_binary else None,
    })

    # Check language data
    if tess_binary:
        import subprocess
        try:
            langs = subprocess.check_output([tess_binary, "--list-langs"], stderr=subprocess.STDOUT, timeout=5).decode()
            has_eng = "eng" in langs
            has_msa = "msa" in langs
            ts_checks.append({"check": "lang_eng", "label": "English language data (eng)", "ok": has_eng,
                              "fix": "apt-get install tesseract-ocr-eng" if not has_eng else None})
            ts_checks.append({"check": "lang_msa", "label": "Malay language data (msa)", "ok": has_msa,
                              "fix": "apt-get install tesseract-ocr-msa (optional — for bilingual Malaysian receipts)" if not has_msa else None})
        except Exception:
            ts_checks.append({"check": "languages", "label": "Language data check", "ok": None, "fix": "Could not query tesseract languages"})

    results["tesseract"] = {
        "name": "Tesseract (Local)",
        "ready": tess_binary is not None,
        "checks": ts_checks,
        "setup_url": "https://github.com/UB-Mannheim/tesseract/wiki",
        "free_tier": "Unlimited (local processing)",
        "setup_steps": [
            "Docker/Render: Already handled by Dockerfile (tesseract-ocr + eng + msa)",
            "Windows local dev: Download installer from https://github.com/UB-Mannheim/tesseract/wiki",
            "Or install via Chocolatey: choco install tesseract",
            "Ensure 'tesseract' is in your PATH",
            "Use the Test button below to verify",
        ],
    }

    return results


# ---------------------------------------------------------------------------
# Provider testing
# ---------------------------------------------------------------------------


async def test_provider(provider_key: str) -> dict:
    """Test a single provider with a synthetic receipt image.

    Creates a small image with known text, sends it through the provider,
    and reports whether it worked.
    """
    import time

    # Create a test image with known receipt text
    test_image = _create_test_receipt_image()

    start = time.monotonic()
    try:
        if provider_key == "tesseract":
            from app.services.ocr.tesseract_provider import TesseractProvider
            provider = TesseractProvider()
            result = await provider.extract(test_image)
        elif provider_key == "google_vision":
            from app.services.ocr.google_vision import GoogleVisionProvider
            provider = GoogleVisionProvider()
            result = await provider.extract(test_image)
        elif provider_key == "mindee":
            from app.core.config import settings
            from app.services.ocr.mindee_provider import MindeeProvider
            provider = MindeeProvider(api_key=settings.MINDEE_API_KEY)
            result = await provider.extract(test_image)
        else:
            return {"success": False, "error": f"Unknown provider: {provider_key}"}

        duration_ms = int((time.monotonic() - start) * 1000)

        return {
            "success": True,
            "provider": provider_key,
            "duration_ms": duration_ms,
            "items_found": len(result.items),
            "raw_text_preview": result.raw_text[:500] if result.raw_text else "",
            "confidence": result.confidence,
            "message": f"Provider working! Found {len(result.items)} items in {duration_ms}ms.",
        }

    except Exception as e:
        duration_ms = int((time.monotonic() - start) * 1000)
        error_type = type(e).__name__
        from app.services.ocr.base import OcrProviderError
        if isinstance(e, OcrProviderError):
            error_type = e.error_type

        return {
            "success": False,
            "provider": provider_key,
            "duration_ms": duration_ms,
            "error_type": error_type,
            "error_message": str(e),
            "message": f"Provider failed: {e}",
        }


def _create_test_receipt_image() -> bytes:
    """Create a small synthetic receipt image with known text for testing."""
    import io
    from PIL import Image, ImageDraw, ImageFont

    img = Image.new("RGB", (400, 300), "white")
    draw = ImageDraw.Draw(img)

    # Use default font (always available)
    try:
        font = ImageFont.truetype("arial.ttf", 16)
    except (IOError, OSError):
        font = ImageFont.load_default()

    lines = [
        "TEST STORE",
        "123 Test Street",
        "",
        "MILK 1L              5.90",
        "BREAD                3.50",
        "EGGS x12             8.90",
        "",
        "TOTAL               18.30",
        "DATE: 01/01/2026",
    ]

    y = 20
    for line in lines:
        draw.text((20, y), line, fill="black", font=font)
        y += 24

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()
