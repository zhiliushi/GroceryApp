"""
Email provider configuration service.

Firestore: app_config/email — provider settings
           app_config/email_usage — daily counters
"""

from __future__ import annotations

import logging
from datetime import datetime

from firebase_admin import firestore

from app.core.config import settings

logger = logging.getLogger(__name__)

_COLLECTION = "app_config"
_CONFIG_DOC = "email"
_USAGE_DOC = "email_usage"

_DEFAULT_CONFIG = {
    "enabled": True,
    "providers": [
        {"key": "resend", "name": "Resend.com", "enabled": False, "priority": 1, "api_key_set": False, "daily_limit": 100},
        {"key": "sendgrid", "name": "SendGrid", "enabled": False, "priority": 2, "api_key_set": False, "daily_limit": 100},
        {"key": "smtp", "name": "Custom SMTP", "enabled": False, "priority": 3, "api_key_set": None, "daily_limit": -1},
    ],
    "updated_at": None,
}


def _db():
    return firestore.client()


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------


def get_email_config() -> dict:
    """Get email config, seeding defaults if needed."""
    doc = _db().collection(_COLLECTION).document(_CONFIG_DOC).get()
    if doc.exists:
        return doc.to_dict()
    _db().collection(_COLLECTION).document(_CONFIG_DOC).set(_DEFAULT_CONFIG)
    return dict(_DEFAULT_CONFIG)


def update_email_config(data: dict, admin_uid: str) -> None:
    """Update email provider config."""
    data["updated_at"] = datetime.utcnow().isoformat()
    data["updated_by"] = admin_uid
    _db().collection(_COLLECTION).document(_CONFIG_DOC).set(data, merge=True)


def sync_api_key_status() -> None:
    """Update api_key_set flags based on actual env vars."""
    config = get_email_config()
    changed = False
    for p in config.get("providers", []):
        key = p["key"]
        if key == "resend":
            expected = bool(settings.RESEND_API_KEY)
        elif key == "sendgrid":
            expected = bool(settings.SENDGRID_API_KEY)
        elif key == "smtp":
            expected = bool(settings.SMTP_HOST)
        else:
            continue
        if p.get("api_key_set") != expected:
            p["api_key_set"] = expected
            changed = True
    if changed:
        _db().collection(_COLLECTION).document(_CONFIG_DOC).set(config)


def get_config_with_usage() -> dict:
    """Get config merged with usage stats for admin display."""
    config = get_email_config()
    usage = get_usage()
    today = datetime.utcnow().strftime("%Y-%m-%d")

    result = {
        "enabled": config.get("enabled", True),
        "providers": [],
        "updated_at": config.get("updated_at"),
    }

    for p in config.get("providers", []):
        key = p["key"]
        day_usage = usage.get(key, {})
        if day_usage.get("date") != today:
            day_usage = {"date": today, "count": 0, "errors": 0}
        result["providers"].append({
            **p,
            "usage_today": day_usage.get("count", 0),
            "errors_today": day_usage.get("errors", 0),
            "last_sent": day_usage.get("last_sent"),
        })

    return result


# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------


def get_usage() -> dict:
    doc = _db().collection(_COLLECTION).document(_USAGE_DOC).get()
    return doc.to_dict() if doc.exists else {}


def increment_usage(provider_key: str, success: bool) -> None:
    today = datetime.utcnow().strftime("%Y-%m-%d")
    ref = _db().collection(_COLLECTION).document(_USAGE_DOC)

    @firestore.transactional
    def _update(transaction):
        snapshot = ref.get(transaction=transaction)
        data = snapshot.to_dict() if snapshot.exists else {}
        p = data.get(provider_key, {})
        if p.get("date") != today:
            p = {"date": today, "count": 0, "errors": 0}
        p["count"] = p.get("count", 0) + 1
        if not success:
            p["errors"] = p.get("errors", 0) + 1
        p["last_sent"] = datetime.utcnow().isoformat()
        data[provider_key] = p
        transaction.set(ref, data)

    transaction = _db().transaction()
    _update(transaction)
