"""App configuration service — visibility rules and tier definitions."""

import logging
import time
from typing import Dict, Any, Optional

from firebase_admin import firestore

logger = logging.getLogger(__name__)


def _get_db():
    return firestore.client()


# ---------------------------------------------------------------------------
# Visibility config
# ---------------------------------------------------------------------------

_DEFAULT_VISIBILITY = {
    "pages": {
        "dashboard": {
            "enabled": True, "minTier": "free",
            "sections": {
                "stats_cards": {"enabled": True, "minTier": "free"},
                "recent_activity": {"enabled": True, "minTier": "free"},
                "quick_actions": {"enabled": True, "minTier": "free"},
                "receipt_scanning": {"enabled": True, "minTier": "plus"},
            },
        },
        "inventory": {
            "enabled": True, "minTier": "free",
            "sections": {
                "filters": {"enabled": True, "minTier": "free"},
                "bulk_actions": {"enabled": True, "minTier": "plus"},
                "receipt_scanning": {"enabled": True, "minTier": "plus"},
                "export": {"enabled": False, "minTier": "pro"},
            },
        },
        "shopping_lists": {
            "enabled": True, "minTier": "free",
            "sections": {
                "checkout_flow": {"enabled": True, "minTier": "plus"},
                "trip_notes": {"enabled": True, "minTier": "plus"},
                "receipt_scanning": {"enabled": True, "minTier": "plus"},
            },
        },
        "foodbanks": {
            "enabled": True, "minTier": "free", "alwaysFree": True,
            "sections": {
                "map_view": {"enabled": True, "minTier": "free"},
                "sources_panel": {"enabled": True, "minTier": "admin"},
            },
        },
        "analytics": {
            "enabled": True, "minTier": "plus",
            "sections": {
                "stats_overview": {"enabled": True, "minTier": "plus"},
                "status_chart": {"enabled": True, "minTier": "plus"},
                "location_chart": {"enabled": True, "minTier": "plus"},
                "expiry_chart": {"enabled": True, "minTier": "pro"},
            },
        },
        "price_tracking": {
            "enabled": True, "minTier": "plus",
            "sections": {
                "price_history": {"enabled": True, "minTier": "plus"},
                "price_comparison": {"enabled": True, "minTier": "pro"},
            },
        },
        "settings": {
            "enabled": True, "minTier": "free",
            "sections": {},
        },
    },
    "updated_at": None,
    "updated_by": None,
}


_DEFAULT_TIERS = {
    "tiers": {
        "free": {
            "key": "free",
            "name": "Basic Basket",
            "price": 0, "currency": "MYR", "billing": None,
            "limits": {"max_items": 50, "max_lists": 3, "data_retention_days": 90, "max_scans_per_day": 20},
            "features": ["barcode_scan", "manual_entry", "basic_inventory", "shopping_lists"],
            "selectable_tools": 0,
            "description": "Basic grocery tracking",
        },
        "plus": {
            "key": "plus",
            "name": "Smart Cart",
            "price": 5.99, "currency": "MYR", "billing": "monthly",
            "limits": {"max_items": -1, "max_lists": -1, "data_retention_days": 365, "max_scans_per_day": -1},
            "features": ["barcode_scan", "manual_entry", "basic_inventory", "shopping_lists"],
            "selectable_tools": 3,
            "tool_menu": [
                "cloud_sync_multi_device", "price_tracking", "checkout_flow",
                "basic_analytics", "advanced_analytics", "price_comparison",
                "export", "receipt_scanning_ocr",
            ],
            "description": "Pick 3 tools from the menu",
        },
        "pro": {
            "key": "pro",
            "name": "Full Fridge",
            "price": 12.99, "currency": "MYR", "billing": "monthly",
            "limits": {"max_items": -1, "max_lists": -1, "data_retention_days": -1, "max_scans_per_day": -1},
            "features": [
                "barcode_scan", "manual_entry", "basic_inventory", "shopping_lists",
                "cloud_sync_multi_device", "price_tracking", "checkout_flow",
                "basic_analytics", "advanced_analytics", "price_comparison",
                "export", "receipt_scanning_ocr",
            ],
            "selectable_tools": -1,
            "description": "Everything unlocked, no limits",
        },
    },
    "always_free": ["foodbank_finder"],
    "admin_only": ["contribute_products"],
    "separate_addons": {
        "ai_chef": {
            "name": "AI Chef",
            "price": None,
            "features": ["ai_suggestions", "smart_shopping_list", "recipe_suggestions"],
            "note": "Pricing TBD — depends on LLM API costs",
        },
    },
    "updated_at": None,
}


def get_visibility() -> Dict[str, Any]:
    """Get page visibility config. Seeds defaults if not exists."""
    db = _get_db()
    doc = db.collection("app_config").document("visibility").get()
    if doc.exists:
        return doc.to_dict()
    # Seed defaults
    seed_defaults()
    return _DEFAULT_VISIBILITY.copy()


def update_visibility(config: Dict[str, Any], admin_uid: str) -> None:
    """Update page visibility config."""
    db = _get_db()
    config["updated_at"] = int(time.time() * 1000)
    config["updated_by"] = admin_uid
    db.collection("app_config").document("visibility").set(config)
    logger.info("Visibility config updated by %s", admin_uid)


def get_tiers() -> Dict[str, Any]:
    """Get tier definitions. Seeds defaults if not exists."""
    db = _get_db()
    doc = db.collection("app_config").document("tiers").get()
    if doc.exists:
        return doc.to_dict()
    seed_defaults()
    return _DEFAULT_TIERS.copy()


def update_tiers(config: Dict[str, Any]) -> None:
    """Update tier definitions."""
    db = _get_db()
    config["updated_at"] = int(time.time() * 1000)
    db.collection("app_config").document("tiers").set(config)
    logger.info("Tier config updated")


def get_public_config() -> Dict[str, Any]:
    """Get combined config for client apps (visibility + tiers)."""
    return {
        "visibility": get_visibility(),
        "tiers": get_tiers(),
    }


# ---------------------------------------------------------------------------
# System config (user limits, registration)
# ---------------------------------------------------------------------------

_DEFAULT_SYSTEM = {
    "max_active_users": 50,
    "registration_open": True,
    # Onboarding v2 — Phase 0 schema additions. Defaults preserve current
    # behaviour: empty URL means email-sending paths raise WebUrlNotConfiguredError
    # once they're wired (Phase 2/5); maintenance_mode=False is the existing UX.
    "web_public_url": "",
    "maintenance_mode": False,
    "maintenance_message": "",
    "updated_at": None,
    "updated_by": None,
}


def get_system_config() -> Dict[str, Any]:
    """Get system config. Seeds defaults if not exists.

    For docs created before the v2 schema additions, `set(merge=True)` is used
    on the seeding path so missing keys get filled without overwriting existing
    operator-set values. The legacy `set(...)` (no merge) is preserved for the
    truly-missing case (initial install).
    """
    db = _get_db()
    doc = db.collection("app_config").document("system").get()
    if doc.exists:
        data = doc.to_dict() or {}
        # Backfill missing v2 keys in-memory so callers always see the full shape.
        # Persist only if any key was missing (one-time per doc).
        missing = {k: v for k, v in _DEFAULT_SYSTEM.items() if k not in data}
        if missing:
            db.collection("app_config").document("system").set(missing, merge=True)
            data.update(missing)
        return data
    db.collection("app_config").document("system").set(_DEFAULT_SYSTEM)
    return _DEFAULT_SYSTEM.copy()


# ---------------------------------------------------------------------------
# Web URL gate (Onboarding v2 — Decision #5)
# ---------------------------------------------------------------------------


def get_web_url_or_raise() -> str:
    """Return the configured public web URL, or raise WebUrlNotConfiguredError.

    Called by every email-sending path that includes a link. If the admin
    hasn't configured `web_public_url` (or it doesn't start with `https://`),
    the calling endpoint surfaces a 503 with an admin-facing message.

    Per Decision #5: ALL outbound emails containing links route through this
    gate — invitation, password reset, email-verification resend, admin
    pending-signup notification, account-status notifications.
    """
    from app.core.exceptions import WebUrlNotConfiguredError

    config = get_system_config()
    url = (config.get("web_public_url") or "").strip().rstrip("/")
    if not url:
        raise WebUrlNotConfiguredError(
            "Public web URL not configured. Admin: set this in Settings → System "
            "before flows that send links can run."
        )
    if not url.startswith("https://"):
        raise WebUrlNotConfiguredError(
            "Public web URL must start with https:// — current value is invalid."
        )
    return url


# ---------------------------------------------------------------------------
# Maintenance mode (Onboarding v2 — Decision #3)
# ---------------------------------------------------------------------------

# 5-second in-process TTL cache for the maintenance_mode flag. Without this,
# every non-GET request would do a Firestore read in the middleware, which
# burns the daily quota fast.
_MAINT_CACHE: Dict[str, Any] = {"value": None, "expires_at": 0.0}
_MAINT_TTL_SEC = 5.0


def is_maintenance_mode_cached() -> bool:
    """Return current maintenance_mode flag, cached with 5s TTL.

    Used by MaintenanceModeMiddleware (added in Phase 5). Read-side helper —
    writes go through `update_system_config` which evicts the cache.
    """
    now = time.time()
    if _MAINT_CACHE["expires_at"] > now and _MAINT_CACHE["value"] is not None:
        return bool(_MAINT_CACHE["value"])
    config = get_system_config()
    value = bool(config.get("maintenance_mode", False))
    _MAINT_CACHE["value"] = value
    _MAINT_CACHE["expires_at"] = now + _MAINT_TTL_SEC
    return value


def _evict_maint_cache() -> None:
    """Force the next is_maintenance_mode_cached() call to re-read Firestore."""
    _MAINT_CACHE["value"] = None
    _MAINT_CACHE["expires_at"] = 0.0


def update_system_config(config: Dict[str, Any], admin_uid: str) -> None:
    """Update system config (max users, registration toggle, web URL, maintenance).

    Validates `web_public_url` and `maintenance_message` if present.
    Evicts the maintenance-mode cache so the new value is picked up immediately.
    """
    if "web_public_url" in config:
        url = (config.get("web_public_url") or "").strip()
        if url and not url.startswith("https://"):
            raise ValueError("web_public_url must start with https:// or be empty")
        config["web_public_url"] = url.rstrip("/") if url else ""
    if "maintenance_message" in config:
        msg = (config.get("maintenance_message") or "").strip()
        if len(msg) > 500:
            raise ValueError("maintenance_message must be 500 characters or fewer")
        config["maintenance_message"] = msg
    db = _get_db()
    config["updated_at"] = int(time.time() * 1000)
    config["updated_by"] = admin_uid
    db.collection("app_config").document("system").set(config, merge=True)
    _evict_maint_cache()
    logger.info("System config updated by %s", admin_uid)


def get_active_user_count() -> int:
    """Count active users (status != disabled)."""
    db = _get_db()
    count = 0
    try:
        for doc in db.collection("users").stream():
            data = doc.to_dict()
            if data.get("status", "active") != "disabled":
                count += 1
    except Exception as e:
        logger.warning("Failed to count active users: %s", e)
    return count


def check_registration_allowed() -> tuple[bool, str]:
    """Check if new user registration is allowed.

    Returns (allowed, reason).
    """
    config = get_system_config()

    if not config.get("registration_open", True):
        return False, "Registration is currently closed. Contact admin."

    max_users = config.get("max_active_users", 50)
    if max_users > 0:
        current = get_active_user_count()
        if current >= max_users:
            return False, f"User limit reached ({current}/{max_users}). Contact admin."

    return True, ""


def get_system_status() -> Dict[str, Any]:
    """Get system status for admin dashboard."""
    config = get_system_config()
    active_count = get_active_user_count()
    max_users = config.get("max_active_users", 50)

    percent = (active_count / max_users * 100) if max_users > 0 else 0

    return {
        **config,
        "active_users": active_count,
        "capacity_percent": round(percent, 1),
        "capacity_level": (
            "critical" if percent >= 90
            else "warning" if percent >= 80
            else "normal"
        ),
    }


def seed_defaults() -> None:
    """Create default visibility and tier config if they don't exist."""
    db = _get_db()
    now = int(time.time() * 1000)

    vis_ref = db.collection("app_config").document("visibility")
    if not vis_ref.get().exists:
        defaults = _DEFAULT_VISIBILITY.copy()
        defaults["updated_at"] = now
        defaults["updated_by"] = "system"
        vis_ref.set(defaults)
        logger.info("Seeded default visibility config")

    tier_ref = db.collection("app_config").document("tiers")
    if not tier_ref.get().exists:
        defaults = _DEFAULT_TIERS.copy()
        defaults["updated_at"] = now
        tier_ref.set(defaults)
        logger.info("Seeded default tier config")
