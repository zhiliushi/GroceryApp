"""FX rate service — Firestore-cached, frankfurter.app-fetched, 7d stale fallback.

Plan: catalog_evolution.md §5. Frankfurter.app is a free public ECB-rate API
that requires no key. Cache one Firestore doc per (from, to, YYYY-MM-DD) triple,
populated lazily. If the API fails, fall back to the most recent cached rate
within the last 7 days and mark `is_stale: true` so callers can surface the
approximation.

Synchronous on purpose — called from the synchronous purchase write path.
5-second timeout caps any hang.
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

logger = logging.getLogger(__name__)

_COLLECTION = "fx_rates"
_API_BASE = "https://api.frankfurter.app"
_STALE_DAYS = 7
_HTTP_TIMEOUT_S = 5.0

# Pairs the daily refresh keeps warm. A pair appearing in this list means the
# cron job calls get_rate(from, to, today) once a day so the first user-driven
# conversion of the day hits a warm cache instead of the ~200ms HTTP fetch.
# Both directions of common SE-Asia pairs + the major world reserves are
# included since most users have a profile pref in one of these.
_COMMON_PAIRS: tuple[tuple[str, str], ...] = (
    ("SGD", "MYR"), ("MYR", "SGD"),
    ("USD", "SGD"), ("SGD", "USD"),
    ("USD", "MYR"), ("MYR", "USD"),
    ("EUR", "SGD"), ("SGD", "EUR"),
    ("EUR", "MYR"), ("MYR", "EUR"),
    ("GBP", "SGD"), ("GBP", "MYR"),
    ("AUD", "SGD"), ("AUD", "MYR"),
    ("JPY", "SGD"), ("JPY", "MYR"),
    ("CNY", "SGD"), ("CNY", "MYR"),
    ("IDR", "SGD"), ("IDR", "MYR"),
    ("THB", "SGD"), ("THB", "MYR"),
)


def _db():
    return firestore.client()


def _doc_id(from_currency: str, to_currency: str, date_str: str) -> str:
    return f"{from_currency}_{to_currency}_{date_str}"


def get_rate(
    from_currency: str,
    to_currency: str,
    date: Optional[datetime] = None,
) -> dict:
    """Resolve an FX rate via cache → API → stale-fallback.

    Args:
        from_currency: 3-letter ISO source code (e.g. "MYR")
        to_currency: 3-letter ISO target code (e.g. "SGD")
        date: target date for the rate; defaults to today UTC

    Returns:
        {
          rate: float | None,         # None if no rate could be resolved
          from, to, date,
          source: "identity" | "cache" | "frankfurter" | "stale_cache" | "none",
          is_stale: bool,
          fetched_at?: ISO string,
        }
    """
    target_date = date or datetime.now(timezone.utc)
    date_str = target_date.strftime("%Y-%m-%d")

    if from_currency == to_currency:
        return {
            "rate": 1.0,
            "from": from_currency,
            "to": to_currency,
            "date": date_str,
            "source": "identity",
            "is_stale": False,
        }

    db = _db()
    doc_id = _doc_id(from_currency, to_currency, date_str)
    cached = db.collection(_COLLECTION).document(doc_id).get()
    if cached.exists:
        d = cached.to_dict() or {}
        # Override source on read so the refresh job's classifier can tell
        # cache-hit ("cache") from a fresh fetch ("frankfurter") regardless of
        # what was originally written to the doc.
        d["source"] = "cache"
        return d

    # Cache miss — try API
    try:
        rate = _fetch_rate(from_currency, to_currency, date_str)
        result = {
            "rate": rate,
            "from": from_currency,
            "to": to_currency,
            "date": date_str,
            "source": "frankfurter",
            "is_stale": False,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            db.collection(_COLLECTION).document(doc_id).set(result)
        except Exception as cache_err:
            logger.warning("FX cache write failed doc=%s err=%s", doc_id, cache_err)
        return result
    except Exception as e:
        logger.warning(
            "FX fetch failed from=%s to=%s date=%s err=%s",
            from_currency, to_currency, date_str, e,
        )

    # Stale fallback — most recent cached rate for this pair within window
    cutoff = (target_date - timedelta(days=_STALE_DAYS)).strftime("%Y-%m-%d")
    fallback_q = (
        db.collection(_COLLECTION)
        .where(filter=FieldFilter("from", "==", from_currency))
        .where(filter=FieldFilter("to", "==", to_currency))
        .where(filter=FieldFilter("date", ">=", cutoff))
        .order_by("date", direction=firestore.Query.DESCENDING)
        .limit(1)
    )
    for snap in fallback_q.stream():
        d = snap.to_dict() or {}
        return {**d, "source": "stale_cache", "is_stale": True}

    # No rate at all
    return {
        "rate": None,
        "from": from_currency,
        "to": to_currency,
        "date": date_str,
        "source": "none",
        "is_stale": False,
    }


def _fetch_rate(from_currency: str, to_currency: str, date_str: str) -> float:
    """Synchronous fetch from frankfurter.app. Raises on any failure."""
    url = f"{_API_BASE}/{date_str}?from={from_currency}&to={to_currency}"
    with urllib.request.urlopen(url, timeout=_HTTP_TIMEOUT_S) as resp:
        body = resp.read()
    data = json.loads(body)
    rates = data.get("rates", {})
    rate = rates.get(to_currency)
    if rate is None:
        raise ValueError(f"No rate for {to_currency} in response: {data}")
    return float(rate)


# ---------------------------------------------------------------------------
# Admin inspection
# ---------------------------------------------------------------------------


def list_recent(limit: int = 50) -> list[dict]:
    """List recently-cached FX rates. Newest fetch first."""
    db = _db()
    docs = (
        db.collection(_COLLECTION)
        .order_by("fetched_at", direction=firestore.Query.DESCENDING)
        .limit(limit)
        .stream()
    )
    out = []
    for snap in docs:
        d = snap.to_dict() or {}
        d["doc_id"] = snap.id
        out.append(d)
    return out


def evict_cache(from_currency: Optional[str] = None, to_currency: Optional[str] = None) -> int:
    """Admin tool: evict cached rates matching the optional filter. Returns count."""
    db = _db()
    q = db.collection(_COLLECTION)
    if from_currency:
        q = q.where(filter=FieldFilter("from", "==", from_currency))
    if to_currency:
        q = q.where(filter=FieldFilter("to", "==", to_currency))
    deleted = 0
    for snap in q.stream():
        snap.reference.delete()
        deleted += 1
    return deleted


# ---------------------------------------------------------------------------
# Periodic refresh
# ---------------------------------------------------------------------------


def common_pairs() -> list[tuple[str, str]]:
    """Pairs the cron job pre-warms each day. Static + derived from user prefs.

    Static list covers SE-Asia common moves + world-reserve pairs.
    Dynamic add-ons: any (event.currency → user.currency_preference) pair the
    refresh job sees in the live data, so users with niche currencies get
    their conversions cached too.
    """
    pairs: set[tuple[str, str]] = set(_COMMON_PAIRS)

    db = _db()
    user_prefs: set[str] = set()
    try:
        for snap in db.collection("users").stream():
            d = snap.to_dict() or {}
            pref = (d.get("currency_preference") or "").upper()
            if pref:
                user_prefs.add(pref)
    except Exception as e:
        logger.warning("FX refresh: could not list users — %s", e)

    # For each user pref, ensure all common originating currencies → pref
    # are in the refresh set.
    common_origins = ("SGD", "MYR", "USD", "EUR", "GBP", "AUD", "JPY", "CNY", "IDR", "THB")
    for pref in user_prefs:
        for origin in common_origins:
            if origin == pref:
                continue
            pairs.add((origin, pref))

    return sorted(pairs)


def refresh_common_rates() -> dict[str, Any]:
    """Pre-warm today's rate for every common pair.

    Calls `get_rate` for each pair (which fetches from frankfurter.app and
    caches on miss). Returns a per-pair status dict so the admin endpoint
    or the scheduler log can show what was refreshed vs failed.

    Safe to run multiple times per day — calls that hit cache are no-ops.
    """
    started_at = datetime.now(timezone.utc)
    pairs = common_pairs()
    refreshed = 0
    cached = 0
    failed = 0
    failures: list[dict[str, str]] = []
    for from_c, to_c in pairs:
        try:
            r = get_rate(from_c, to_c)
            source = r.get("source")
            if source == "frankfurter":
                refreshed += 1
            elif source in ("cache", "identity"):
                cached += 1
            elif source == "stale_cache":
                cached += 1  # at least we have something
            else:
                failed += 1
                failures.append({"from": from_c, "to": to_c, "reason": source or "unknown"})
        except Exception as e:
            failed += 1
            failures.append({"from": from_c, "to": to_c, "reason": str(e)})
            logger.warning("FX refresh failed for %s→%s: %s", from_c, to_c, e)

    completed_at = datetime.now(timezone.utc)
    elapsed_s = (completed_at - started_at).total_seconds()
    summary = {
        "started_at": started_at.isoformat(),
        "completed_at": completed_at.isoformat(),
        "elapsed_s": round(elapsed_s, 2),
        "pairs_attempted": len(pairs),
        "newly_fetched": refreshed,
        "already_cached": cached,
        "failed": failed,
        "failures": failures[:20],  # cap payload
    }
    logger.info(
        "fx.refresh_complete attempted=%d fetched=%d cached=%d failed=%d elapsed=%.2fs",
        summary["pairs_attempted"],
        refreshed,
        cached,
        failed,
        elapsed_s,
    )
    return summary
