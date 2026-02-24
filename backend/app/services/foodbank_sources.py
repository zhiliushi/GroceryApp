"""
Foodbank source registry — tracks external data sources with health/cooldown.

Each source is stored in Firestore `foodbank_sources` collection:
  {
    id, name, url, country, status ("healthy"|"cooldown"|"disabled"),
    last_success, last_error, error_message, cooldown_until, cooldown_hours
  }

Built-in sources are auto-seeded on first list() call.
"""

import logging
import time
from typing import Optional, List, Dict, Any

import httpx
from firebase_admin import firestore

from app.services import foodbank_service

logger = logging.getLogger(__name__)

COLLECTION = "foodbank_sources"

BUILTIN_SOURCES: List[Dict[str, Any]] = [
    {
        "id": "yfbm",
        "name": "Yayasan Food Bank Malaysia",
        "url": "https://www.yfbm.org.my",
        "country": "MY",
    },
    {
        "id": "foodaid",
        "name": "Food Aid Foundation",
        "url": "https://www.foodaidfoundation.org",
        "country": "MY",
    },
    {
        "id": "lostfood",
        "name": "The Lost Food Project",
        "url": "https://www.thelostfoodproject.org",
        "country": "MY",
    },
    {
        "id": "kechara",
        "name": "Kechara Soup Kitchen",
        "url": "https://www.thesoupkitchen.org.my",
        "country": "MY",
    },
]

DEFAULT_COOLDOWN_HOURS = 6


def _get_db():
    return firestore.client()


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

def list_sources() -> List[Dict[str, Any]]:
    """Get all sources. Seeds built-in sources if collection is empty."""
    db = _get_db()
    docs = list(db.collection(COLLECTION).stream())

    if not docs:
        _seed_builtin_sources(db)
        docs = list(db.collection(COLLECTION).stream())

    results = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        results.append(data)
    results.sort(key=lambda x: x.get("name", ""))
    return results


def get_source(source_id: str) -> Optional[Dict[str, Any]]:
    """Get a single source by ID."""
    db = _get_db()
    doc = db.collection(COLLECTION).document(source_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    data["id"] = doc.id
    return data


def _seed_builtin_sources(db) -> None:
    """Seed the built-in sources into Firestore."""
    now = time.time()
    for src in BUILTIN_SOURCES:
        db.collection(COLLECTION).document(src["id"]).set({
            "name": src["name"],
            "url": src["url"],
            "country": src["country"],
            "status": "healthy",
            "last_success": None,
            "last_error": None,
            "error_message": None,
            "cooldown_until": None,
            "cooldown_hours": DEFAULT_COOLDOWN_HOURS,
            "created_at": now,
        })
    logger.info("Seeded %d built-in foodbank sources", len(BUILTIN_SOURCES))


# ---------------------------------------------------------------------------
# Cooldown logic
# ---------------------------------------------------------------------------

def is_in_cooldown(source: Dict[str, Any]) -> bool:
    """Check whether a source is currently in cooldown."""
    cooldown_until = source.get("cooldown_until")
    if cooldown_until is None:
        return False
    return time.time() < cooldown_until


def _enter_cooldown(source_id: str, error_message: str) -> None:
    """Put a source into cooldown after an error."""
    db = _get_db()
    source = get_source(source_id)
    hours = source.get("cooldown_hours", DEFAULT_COOLDOWN_HOURS) if source else DEFAULT_COOLDOWN_HOURS
    now = time.time()
    db.collection(COLLECTION).document(source_id).update({
        "status": "cooldown",
        "last_error": now,
        "error_message": error_message,
        "cooldown_until": now + (hours * 3600),
    })


def reset_cooldown(source_id: str) -> bool:
    """Admin: clear cooldown, set status back to healthy."""
    db = _get_db()
    doc = db.collection(COLLECTION).document(source_id).get()
    if not doc.exists:
        return False
    db.collection(COLLECTION).document(source_id).update({
        "status": "healthy",
        "cooldown_until": None,
        "error_message": None,
    })
    return True


# ---------------------------------------------------------------------------
# Enable / Disable
# ---------------------------------------------------------------------------

def disable_source(source_id: str) -> bool:
    """Disable a source so it's skipped during scheduled fetches."""
    db = _get_db()
    doc = db.collection(COLLECTION).document(source_id).get()
    if not doc.exists:
        return False
    db.collection(COLLECTION).document(source_id).update({"status": "disabled"})
    return True


def enable_source(source_id: str) -> bool:
    """Re-enable a disabled source."""
    db = _get_db()
    doc = db.collection(COLLECTION).document(source_id).get()
    if not doc.exists:
        return False
    db.collection(COLLECTION).document(source_id).update({
        "status": "healthy",
        "cooldown_until": None,
        "error_message": None,
    })
    return True


# ---------------------------------------------------------------------------
# Fetch
# ---------------------------------------------------------------------------

def fetch_source(source_id: str) -> Dict[str, Any]:
    """
    Attempt to fetch data from a single source.

    Returns: {"success": bool, "new_count": int, "error": str|None}
    """
    source = get_source(source_id)
    if not source:
        return {"success": False, "new_count": 0, "error": "Source not found"}

    if source.get("status") == "disabled":
        return {"success": False, "new_count": 0, "error": "Source is disabled"}

    url = source.get("url", "")
    try:
        # Attempt HTTP GET to check if source is reachable
        with httpx.Client(timeout=15.0, follow_redirects=True) as client:
            resp = client.get(url, headers={
                "User-Agent": "GroceryApp/1.0 FoodbankFetcher",
            })

        if resp.status_code >= 400:
            err = f"HTTP {resp.status_code} from {url}"
            _enter_cooldown(source_id, err)
            return {"success": False, "new_count": 0, "error": err}

        # Source is reachable — update foodbanks matching this source_name
        # For now, we refresh timestamps on existing entries from this source
        new_count = _refresh_source_entries(source_id, source)

        # Mark success
        db = _get_db()
        db.collection(COLLECTION).document(source_id).update({
            "status": "healthy",
            "last_success": time.time(),
            "cooldown_until": None,
            "error_message": None,
        })

        return {"success": True, "new_count": new_count, "error": None}

    except Exception as e:
        err = str(e)
        logger.warning("Fetch failed for source %s: %s", source_id, err)
        _enter_cooldown(source_id, err)
        return {"success": False, "new_count": 0, "error": err}


def _refresh_source_entries(source_id: str, source: Dict[str, Any]) -> int:
    """
    Refresh all foodbank entries that belong to this source.
    Returns count of entries refreshed.
    """
    db = _get_db()
    source_name = source.get("name", "")

    # Find foodbanks with matching source_name
    docs = list(
        db.collection("foodbanks")
        .where("source_name", "==", _source_id_to_name(source_id))
        .stream()
    )

    now = time.time()
    count = 0
    for doc in docs:
        doc.reference.update({
            "last_refreshed": now,
            "updated_at": now,
        })
        count += 1

    logger.info("Refreshed %d entries for source %s", count, source_id)
    return count


def _source_id_to_name(source_id: str) -> str:
    """Map source ID to the source_name used in foodbank entries."""
    mapping = {
        "yfbm": "YFBM",
        "foodaid": "FoodAidFoundation",
        "lostfood": "TheLostFoodProject",
        "kechara": "KecharaSoupKitchen",
    }
    return mapping.get(source_id, source_id)
