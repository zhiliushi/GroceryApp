"""Country service — country definitions + GS1 prefix lookup for barcode country detection.

GS1 prefix ranges source: https://www.gs1.org/standards/id-keys/company-prefix
Only Malaysia-area countries seeded initially; admin can add more.
"""

from __future__ import annotations

import logging
from typing import Optional

from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from app.core.metadata import apply_create_metadata

logger = logging.getLogger(__name__)

_COLLECTION = "countries"


def _db():
    return firestore.client()


# Seed data — essential countries for initial deployment
_SEED_COUNTRIES: list[dict] = [
    {
        "code": "MY",
        "name": "Malaysia",
        "currency": "MYR",
        "currency_symbol": "RM",
        "gs1_prefix_ranges": [{"start": "955", "end": "955"}],
        "flag_emoji": "🇲🇾",
        "locale": "ms-MY",
        "enabled": True,
    },
    {
        "code": "SG",
        "name": "Singapore",
        "currency": "SGD",
        "currency_symbol": "S$",
        "gs1_prefix_ranges": [{"start": "888", "end": "888"}],
        "flag_emoji": "🇸🇬",
        "locale": "en-SG",
        "enabled": True,
    },
    {
        "code": "ID",
        "name": "Indonesia",
        "currency": "IDR",
        "currency_symbol": "Rp",
        "gs1_prefix_ranges": [{"start": "899", "end": "899"}],
        "flag_emoji": "🇮🇩",
        "locale": "id-ID",
        "enabled": True,
    },
    {
        "code": "TH",
        "name": "Thailand",
        "currency": "THB",
        "currency_symbol": "฿",
        "gs1_prefix_ranges": [{"start": "885", "end": "885"}],
        "flag_emoji": "🇹🇭",
        "locale": "th-TH",
        "enabled": True,
    },
    {
        "code": "US",
        "name": "United States",
        "currency": "USD",
        "currency_symbol": "$",
        "gs1_prefix_ranges": [
            {"start": "000", "end": "019"},
            {"start": "030", "end": "039"},
            {"start": "060", "end": "139"},
        ],
        "flag_emoji": "🇺🇸",
        "locale": "en-US",
        "enabled": True,
    },
    {
        "code": "GB",
        "name": "United Kingdom",
        "currency": "GBP",
        "currency_symbol": "£",
        "gs1_prefix_ranges": [{"start": "500", "end": "509"}],
        "flag_emoji": "🇬🇧",
        "locale": "en-GB",
        "enabled": True,
    },
    {
        "code": "CN",
        "name": "China",
        "currency": "CNY",
        "currency_symbol": "¥",
        "gs1_prefix_ranges": [{"start": "690", "end": "699"}],
        "flag_emoji": "🇨🇳",
        "locale": "zh-CN",
        "enabled": True,
    },
    {
        "code": "JP",
        "name": "Japan",
        "currency": "JPY",
        "currency_symbol": "¥",
        "gs1_prefix_ranges": [
            {"start": "450", "end": "459"},
            {"start": "490", "end": "499"},
        ],
        "flag_emoji": "🇯🇵",
        "locale": "ja-JP",
        "enabled": True,
    },
    {
        "code": "KR",
        "name": "South Korea",
        "currency": "KRW",
        "currency_symbol": "₩",
        "gs1_prefix_ranges": [{"start": "880", "end": "880"}],
        "flag_emoji": "🇰🇷",
        "locale": "ko-KR",
        "enabled": True,
    },
    {
        "code": "AU",
        "name": "Australia",
        "currency": "AUD",
        "currency_symbol": "A$",
        "gs1_prefix_ranges": [{"start": "930", "end": "939"}],
        "flag_emoji": "🇦🇺",
        "locale": "en-AU",
        "enabled": True,
    },
]


# In-process cache of prefix → country_code (small, rarely changes)
_prefix_cache: dict[str, str] = {}
_prefix_cache_loaded = False


def _load_prefix_cache() -> None:
    """Load all prefix ranges into in-memory lookup dict. Called lazily."""
    global _prefix_cache, _prefix_cache_loaded
    try:
        countries = _db().collection(_COLLECTION).where(filter=FieldFilter("enabled", "==", True)).stream()
        cache: dict[str, str] = {}
        for doc in countries:
            data = doc.to_dict()
            code = data.get("code", doc.id)
            for rng in data.get("gs1_prefix_ranges", []):
                start = int(rng.get("start", "0"))
                end = int(rng.get("end", "0"))
                for prefix in range(start, end + 1):
                    cache[f"{prefix:03d}"] = code
        _prefix_cache = cache
        _prefix_cache_loaded = True
    except Exception as exc:
        logger.warning("country_service: failed to load prefix cache: %s", exc)


def detect_country_by_barcode(barcode: str) -> Optional[str]:
    """Look up country_code from barcode's 3-digit GS1 prefix.

    Returns country code (e.g. "MY") or None if prefix doesn't match any country.
    """
    if not barcode or len(barcode) < 3:
        return None
    if not _prefix_cache_loaded:
        _load_prefix_cache()
    prefix = barcode[:3]
    return _prefix_cache.get(prefix)


def invalidate_prefix_cache() -> None:
    """Force reload on next lookup. Call after admin modifies countries."""
    global _prefix_cache_loaded
    _prefix_cache_loaded = False


def list_countries(enabled_only: bool = True) -> list[dict]:
    """List all countries from Firestore."""
    query = _db().collection(_COLLECTION)
    if enabled_only:
        query = query.where(filter=FieldFilter("enabled", "==", True))
    return [{**doc.to_dict(), "code": doc.id} for doc in query.stream()]


def get_country(code: str) -> Optional[dict]:
    """Get a single country by code."""
    doc = _db().collection(_COLLECTION).document(code.upper()).get()
    if not doc.exists:
        return None
    return {**doc.to_dict(), "code": doc.id}


def seed_countries() -> int:
    """Seed initial countries. Idempotent — skips existing docs.

    Returns count of newly created country docs.
    """
    created = 0
    for country in _SEED_COUNTRIES:
        code = country["code"]
        doc_ref = _db().collection(_COLLECTION).document(code)
        if doc_ref.get().exists:
            continue
        doc_ref.set(apply_create_metadata(country, uid="system", source="api"))
        created += 1
    if created:
        logger.info("country_service: seeded %d countries", created)
        invalidate_prefix_cache()
    return created


def backfill_country_for_products() -> int:
    """Scan products with missing country_code, fill via barcode prefix. Returns count updated."""
    if not _prefix_cache_loaded:
        _load_prefix_cache()

    updated = 0
    products_ref = _db().collection("products")

    # Iterate — Firestore doesn't support "missing field" queries directly
    for doc in products_ref.stream():
        data = doc.to_dict()
        if data.get("country_code"):
            continue  # already filled
        barcode = doc.id  # products keyed by barcode
        country_code = detect_country_by_barcode(barcode)
        if country_code:
            doc.reference.update({
                "country_code": country_code,
                "country_source": "gs1_prefix",
                "updated_at": firestore.SERVER_TIMESTAMP,
            })
            updated += 1

    if updated:
        logger.info("country_service: backfilled country_code on %d products", updated)
    return updated
