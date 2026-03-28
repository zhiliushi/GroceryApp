"""Exchange rate service — daily rates from free API, cached in Firestore."""

import logging
import time
from typing import Dict, Any, Optional

import requests
from firebase_admin import firestore

logger = logging.getLogger(__name__)

_RATE_API_URL = "https://open.er-api.com/v6/latest/USD"


def _get_db():
    return firestore.client()


def get_rates() -> Dict[str, Any]:
    """Get cached exchange rates from Firestore."""
    db = _get_db()
    doc = db.collection("app_config").document("exchange_rates").get()
    if doc.exists:
        return doc.to_dict()
    # No cached rates — fetch now
    return fetch_and_cache_rates() or _default_rates()


def fetch_and_cache_rates() -> Optional[Dict[str, Any]]:
    """Fetch latest rates from API and cache in Firestore."""
    try:
        resp = requests.get(_RATE_API_URL, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        if data.get("result") != "success":
            logger.warning("Exchange rate API returned non-success: %s", data.get("result"))
            return None

        all_rates = data.get("rates", {})

        # Filter to supported currencies
        supported = ["MYR", "SGD", "USD", "IDR", "PHP", "THB", "GBP", "EUR", "AUD"]
        rates = {k: all_rates[k] for k in supported if k in all_rates}

        doc = {
            "base": "USD",
            "rates": rates,
            "updated_at": int(time.time() * 1000),
            "source": "open.er-api.com",
        }

        db = _get_db()
        db.collection("app_config").document("exchange_rates").set(doc)
        logger.info("Exchange rates updated: %d currencies", len(rates))
        return doc

    except Exception as e:
        logger.warning("Failed to fetch exchange rates: %s", e)
        return None


def convert(amount: float, from_currency: str, to_currency: str, rates: Optional[Dict] = None) -> Optional[float]:
    """Convert amount between currencies using cached rates.
    Returns None if conversion not possible."""
    if from_currency == to_currency:
        return amount
    if rates is None:
        rates_doc = get_rates()
        rates = rates_doc.get("rates", {})
    from_rate = rates.get(from_currency)
    to_rate = rates.get(to_currency)
    if not from_rate or not to_rate:
        return None
    return round(amount * (to_rate / from_rate), 2)


def _default_rates() -> Dict[str, Any]:
    """Fallback rates if API and cache both fail."""
    return {
        "base": "USD",
        "rates": {
            "MYR": 4.47, "SGD": 1.34, "USD": 1.0,
            "IDR": 15850, "PHP": 56.20, "THB": 34.50,
            "GBP": 0.79, "EUR": 0.92, "AUD": 1.55,
        },
        "updated_at": int(time.time() * 1000),
        "source": "fallback",
    }
