"""Feature flag system.

Flags stored in Firestore `app_config/features`. Cached 60s in-process to avoid
per-request Firestore reads. Admin toggles propagate within 60s without a deploy.

Usage:
    # Route guard:
    @router.post("/scan", dependencies=[require_flag("receipt_scan")])
    async def scan_receipt(...): ...

    # Scheduler job:
    @feature_flag("reminder_scan")
    def scan_reminders(): ...

    # Inline check:
    if is_enabled("financial_tracking"):
        ...
"""

from __future__ import annotations

import logging
import time
from functools import wraps
from typing import Any, Callable

from fastapi import Depends, HTTPException

logger = logging.getLogger(__name__)

# Defaults applied during first seed (when doc doesn't exist yet).
# Refactor defaults: OCR OFF, user-facing features ON.
DEFAULT_FLAGS: dict[str, Any] = {
    # OCR master switch + children
    "ocr_enabled": False,
    "receipt_scan": False,
    "smart_camera": False,
    "recipe_ocr": False,
    "shelf_audit": False,
    # Product features
    "progressive_nudges": True,
    "financial_tracking": True,
    "insights": True,
    "nl_expiry_parser": True,
    # Background jobs
    "barcode_country_autodetect": True,
    "catalog_cleanup": True,
    "reminder_scan": True,
    "milestone_analytics": True,
    # Legacy endpoint routing — True after migration runs; legacy mobile endpoints
    # then serve via new catalog+purchases model (shape-translated via compat shim).
    # ONE-WAY after D2 (mobile refactor) + 90-day deprecation window: once flipped on
    # and the clock expires, legacy endpoints return 410 Gone. The `False` path is
    # only kept for rollback during the 90-day window.
    "legacy_endpoints_use_new_model": False,
    # Thresholds
    "nudge_thresholds": {"expiry": 5, "price": 10, "volume": 20},
}

_CACHE_TTL = 60.0  # seconds
_cache: dict[str, Any] = {}
_cache_ts: float = 0.0


def _db():
    # Lazy import keeps this module importable without Firebase configured (tests)
    from firebase_admin import firestore
    return firestore.client()


def _refresh_cache() -> None:
    """Read flags from Firestore. Falls back to defaults if doc missing."""
    global _cache, _cache_ts
    try:
        doc = _db().collection("app_config").document("features").get()
        if doc.exists:
            _cache = {**DEFAULT_FLAGS, **(doc.to_dict() or {})}
        else:
            _cache = dict(DEFAULT_FLAGS)
    except Exception as exc:
        # Firestore unreachable — fall back to defaults, log but don't crash
        logger.warning("feature_flags: failed to read Firestore, using defaults: %s", exc)
        _cache = dict(DEFAULT_FLAGS)
    _cache_ts = time.time()


def _ensure_cache() -> None:
    if time.time() - _cache_ts > _CACHE_TTL:
        _refresh_cache()


def is_enabled(flag: str) -> bool:
    """Return True if flag is enabled. Fail-open (True) for unknown flags."""
    _ensure_cache()
    value = _cache.get(flag, True)  # fail-open for unknown keys
    return bool(value)


def get_threshold(name: str, default: int) -> int:
    """Get a nudge threshold value by name. Falls back to default."""
    _ensure_cache()
    thresholds = _cache.get("nudge_thresholds", {})
    if isinstance(thresholds, dict):
        return int(thresholds.get(name, default))
    return default


def get_all_flags() -> dict[str, Any]:
    """Return the full flags dict (cached copy)."""
    _ensure_cache()
    return dict(_cache)


def invalidate_cache() -> None:
    """Force next read to refetch from Firestore. Called by admin PATCH endpoint."""
    global _cache_ts
    _cache_ts = 0.0


def require_flag(flag: str):
    """FastAPI dependency that returns 404 if flag is disabled.

    Using 404 (not 403) hides the feature's existence when disabled.
    """

    def checker():
        if not is_enabled(flag):
            raise HTTPException(status_code=404, detail=f"Feature '{flag}' is not available")

    return Depends(checker)


def feature_flag(flag: str):
    """Decorator for non-route callables (scheduler jobs, services).

    Early-returns None with a log line if flag is disabled.
    """

    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if not is_enabled(flag):
                logger.info("feature_flag: skipping %s (flag '%s' disabled)", fn.__name__, flag)
                return None
            return fn(*args, **kwargs)

        @wraps(fn)
        async def async_wrapper(*args, **kwargs):
            if not is_enabled(flag):
                logger.info("feature_flag: skipping %s (flag '%s' disabled)", fn.__name__, flag)
                return None
            return await fn(*args, **kwargs)

        # Return async wrapper if the wrapped fn is coroutine
        import inspect
        if inspect.iscoroutinefunction(fn):
            return async_wrapper
        return wrapper

    return decorator


def seed_defaults() -> None:
    """Ensure `app_config/features` exists with sensible defaults. Call on app startup."""
    try:
        doc_ref = _db().collection("app_config").document("features")
        snap = doc_ref.get()
        if not snap.exists:
            from .metadata import apply_create_metadata
            doc_ref.set(apply_create_metadata(dict(DEFAULT_FLAGS), uid="system", source="api"))
            logger.info("feature_flags: seeded defaults")
        else:
            # Merge any new default keys not yet in doc (for post-deploy additions)
            existing = snap.to_dict() or {}
            missing = {k: v for k, v in DEFAULT_FLAGS.items() if k not in existing}
            if missing:
                from .metadata import apply_update_metadata
                doc_ref.update(apply_update_metadata(missing))
                logger.info("feature_flags: merged %d new defaults", len(missing))
    except Exception as exc:
        # Don't crash startup if Firestore is unavailable — flags fall back to defaults in-process
        logger.warning("feature_flags: seed_defaults failed (non-fatal): %s", exc)
