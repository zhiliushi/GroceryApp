"""Admin catalog analysis — cross-user aggregations.

Used by admin to:
- Detect naming inconsistencies (same barcode, different user names)
- Find unnamed scanned barcodes (candidates for global products entry)
- See popular unbranded items (user names without barcodes)
- Preview catalog cleanup

Results cached in app_config/catalog_analysis_cache. Scheduler refreshes weekly.
"""

from __future__ import annotations

import logging
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from app.core.exceptions import NotFoundError
from app.core.metadata import apply_update_metadata

logger = logging.getLogger(__name__)

_CACHE_DOC = "catalog_analysis_cache"


def _db():
    return firestore.client()


# ---------------------------------------------------------------------------
# Aggregation queries
# ---------------------------------------------------------------------------


def aggregate_barcode_to_names() -> list[dict]:
    """For each barcode used across users, list distinct display_names + counts."""
    by_barcode: dict[str, dict[str, Any]] = {}

    entries = (
        _db().collection("catalog_entries")
        .where(filter=FieldFilter("barcode", "!=", None))
        .stream()
    )

    for doc in entries:
        data = doc.to_dict() or {}
        bc = data.get("barcode")
        if not bc:
            continue
        if bc not in by_barcode:
            by_barcode[bc] = {
                "barcode": bc,
                "country_code": data.get("country_code"),
                "names": Counter(),
                "user_count": 0,
                "user_ids": set(),
            }
        name = data.get("display_name") or data.get("name_norm") or ""
        if name:
            by_barcode[bc]["names"][name] += 1
        uid = data.get("user_id")
        if uid:
            by_barcode[bc]["user_ids"].add(uid)

    result = []
    for bc, info in by_barcode.items():
        info["user_count"] = len(info["user_ids"])
        names_sorted = [{"name": n, "count": c} for n, c in info["names"].most_common()]
        result.append({
            "barcode": bc,
            "country_code": info["country_code"],
            "user_count": info["user_count"],
            "consistent": len(info["names"]) == 1,
            "names": names_sorted,
        })
    # Sort: most diverse first (highest distinct names), then most users
    result.sort(key=lambda r: (len(r["names"]), r["user_count"]), reverse=True)
    return result


def aggregate_no_barcode_names() -> list[dict]:
    """User-entered names without barcodes, counted across users."""
    by_name: dict[str, dict[str, Any]] = {}

    entries = (
        _db().collection("catalog_entries")
        .where(filter=FieldFilter("barcode", "==", None))
        .stream()
    )

    for doc in entries:
        data = doc.to_dict() or {}
        name_norm = data.get("name_norm") or ""
        if not name_norm:
            continue
        if name_norm not in by_name:
            by_name[name_norm] = {
                "name_norm": name_norm,
                "display_names": Counter(),
                "user_count": 0,
                "user_ids": set(),
                "total_purchases": 0,
            }
        display = data.get("display_name") or name_norm
        by_name[name_norm]["display_names"][display] += 1
        uid = data.get("user_id")
        if uid:
            by_name[name_norm]["user_ids"].add(uid)
        by_name[name_norm]["total_purchases"] += data.get("total_purchases", 0)

    result = []
    for name_norm, info in by_name.items():
        info["user_count"] = len(info["user_ids"])
        displays_sorted = [{"name": n, "count": c} for n, c in info["display_names"].most_common()]
        result.append({
            "name_norm": name_norm,
            "display_names": displays_sorted,
            "user_count": info["user_count"],
            "total_purchases": info["total_purchases"],
        })
    # Sort: most users first
    result.sort(key=lambda r: (r["user_count"], r["total_purchases"]), reverse=True)
    return result[:200]  # cap at 200


def aggregate_cleanup_preview() -> list[dict]:
    """Catalog entries that would be deleted by next cleanup run.

    Criteria: no barcode + 0 active_purchases + last_purchased_at > 365 days ago.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=365)

    # Firestore needs composite index for this; fallback to client-side filter
    query = (
        _db().collection("catalog_entries")
        .where(filter=FieldFilter("active_purchases", "==", 0))
        .where(filter=FieldFilter("last_purchased_at", "<", cutoff))
    )

    result = []
    for doc in query.stream():
        data = doc.to_dict() or {}
        if data.get("barcode"):
            continue
        result.append({
            "catalog_id": doc.id,
            "user_id": data.get("user_id"),
            "name_norm": data.get("name_norm"),
            "display_name": data.get("display_name"),
            "last_purchased_at": data.get("last_purchased_at"),
            "total_purchases": data.get("total_purchases", 0),
        })
    return result


# ---------------------------------------------------------------------------
# Cache management
# ---------------------------------------------------------------------------


def refresh_cache() -> dict:
    """Rebuild all admin aggregations and persist to app_config/catalog_analysis_cache.

    Returns the fresh analysis dict.
    """
    logger.info("catalog_analysis: refreshing cache")
    analysis = {
        "barcode_to_names": aggregate_barcode_to_names(),
        "no_barcode_names": aggregate_no_barcode_names(),
        "cleanup_preview": aggregate_cleanup_preview(),
        "computed_at": datetime.now(timezone.utc),
    }

    _db().collection("app_config").document(_CACHE_DOC).set(
        apply_update_metadata({**analysis, "schema_version": 1})
    )
    logger.info(
        "catalog_analysis: cache refreshed barcode_to_names=%d no_barcode=%d cleanup=%d",
        len(analysis["barcode_to_names"]),
        len(analysis["no_barcode_names"]),
        len(analysis["cleanup_preview"]),
    )
    return analysis


def get_cached_analysis() -> dict:
    """Read cached analysis. Raises NotFoundError if never computed."""
    doc = _db().collection("app_config").document(_CACHE_DOC).get()
    if not doc.exists:
        raise NotFoundError("Catalog analysis not yet computed. Call refresh_cache() first.")
    return doc.to_dict() or {}


# ---------------------------------------------------------------------------
# Admin actions
# ---------------------------------------------------------------------------


def promote_to_global(barcode: str, canonical_name: str, admin_uid: str) -> dict:
    """Write the admin-chosen canonical name to products/{barcode} for global consistency.

    Updates existing product record or creates a new one. Audit-logged.
    """
    from app.core.metadata import apply_create_metadata

    products_ref = _db().collection("products").document(barcode)
    snap = products_ref.get()

    if snap.exists:
        products_ref.update(apply_update_metadata({
            "product_name": canonical_name,
            "source": "admin_promoted",
            "verified": True,
            "last_verified_at": firestore.SERVER_TIMESTAMP,
        }))
    else:
        products_ref.set(apply_create_metadata({
            "barcode": barcode,
            "product_name": canonical_name,
            "brands": None,
            "categories": None,
            "image_url": None,
            "source": "admin_promoted",
            "verified": True,
            "last_verified_at": firestore.SERVER_TIMESTAMP,
        }, uid=admin_uid, source="admin"))

    # Audit log
    _db().collection("app_config").document("catalog_analysis_audit").collection("entries").add(
        apply_create_metadata({
            "action": "promote",
            "admin_uid": admin_uid,
            "barcode": barcode,
            "canonical_name": canonical_name,
        }, uid=admin_uid, source="admin")
    )
    logger.info(
        "catalog_analysis.promote admin=%s barcode=%s name=%r",
        admin_uid, barcode, canonical_name,
    )
    return {"barcode": barcode, "canonical_name": canonical_name}


def flag_spam(barcode: str, admin_uid: str, reason: str = "") -> dict:
    """Flag a barcode's product as spam. Adds products/{barcode}.flagged=True."""
    from app.core.metadata import apply_create_metadata

    products_ref = _db().collection("products").document(barcode)
    if not products_ref.get().exists:
        products_ref.set(apply_create_metadata({
            "barcode": barcode,
            "flagged": True,
            "flag_reason": reason,
            "product_name": "(flagged)",
            "source": "admin_flagged",
        }, uid=admin_uid, source="admin"))
    else:
        products_ref.update(apply_update_metadata({
            "flagged": True,
            "flag_reason": reason,
        }))

    # Audit log
    _db().collection("app_config").document("catalog_analysis_audit").collection("entries").add(
        apply_create_metadata({
            "action": "flag_spam",
            "admin_uid": admin_uid,
            "barcode": barcode,
            "reason": reason,
        }, uid=admin_uid, source="admin")
    )
    logger.info("catalog_analysis.flag_spam admin=%s barcode=%s", admin_uid, barcode)
    return {"barcode": barcode, "flagged": True}
