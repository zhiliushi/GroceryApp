"""
Storage location service — dynamic locations managed in Firestore.

Document: app_config/locations

Locations are shared across web + mobile. The mobile app's settingsStore
already supports custom locations as strings; this service provides the
canonical list with metadata (icon, color, sort order).
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Optional

from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

logger = logging.getLogger(__name__)

_COLLECTION = "app_config"
_DOC_ID = "locations"

_DEFAULT_LOCATIONS = [
    {"key": "fridge", "name": "Fridge", "icon": "🧊", "color": "#3B82F6", "sort": 0},
    {"key": "freezer", "name": "Freezer", "icon": "❄️", "color": "#06B6D4", "sort": 1},
    {"key": "pantry", "name": "Pantry", "icon": "🏠", "color": "#F59E0B", "sort": 2},
]


def _db():
    return firestore.client()


def _ref():
    return _db().collection(_COLLECTION).document(_DOC_ID)


def _slugify(name: str) -> str:
    """Convert a name to a URL-safe key."""
    slug = re.sub(r"[^\w\s-]", "", name.lower().strip())
    return re.sub(r"[\s-]+", "-", slug).strip("-") or "location"


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------


def get_locations() -> list[dict]:
    """Get all locations, seeding defaults if document doesn't exist."""
    doc = _ref().get()
    if doc.exists:
        data = doc.to_dict()
        locations = data.get("locations", [])
        # Sort by sort field
        return sorted(locations, key=lambda x: x.get("sort", 99))

    # Seed defaults
    _ref().set({
        "locations": _DEFAULT_LOCATIONS,
        "updated_at": datetime.utcnow().isoformat(),
    })
    return list(_DEFAULT_LOCATIONS)


def get_location_map() -> dict[str, dict]:
    """Get locations as a dict keyed by location key for quick lookup."""
    return {loc["key"]: loc for loc in get_locations()}


# ---------------------------------------------------------------------------
# Write (admin only)
# ---------------------------------------------------------------------------


def add_location(name: str, icon: str = "📍", color: str = "#6B7280") -> dict:
    """Add a new location. Returns the created location dict."""
    locations = get_locations()

    # Validate uniqueness
    key = _slugify(name)
    existing_keys = {loc["key"] for loc in locations}
    existing_names = {loc["name"].lower() for loc in locations}

    if key in existing_keys or name.lower() in existing_names:
        raise ValueError(f"Location '{name}' already exists")

    # Ensure unique key
    base_key = key
    counter = 1
    while key in existing_keys:
        key = f"{base_key}-{counter}"
        counter += 1

    new_loc = {
        "key": key,
        "name": name.strip(),
        "icon": icon,
        "color": color,
        "sort": max((loc.get("sort", 0) for loc in locations), default=-1) + 1,
    }

    locations.append(new_loc)
    _ref().set({
        "locations": locations,
        "updated_at": datetime.utcnow().isoformat(),
    })
    return new_loc


def update_locations(locations: list[dict], admin_uid: Optional[str] = None) -> None:
    """Replace the entire locations list (for reordering, bulk edits)."""
    # Ensure each has required fields
    for i, loc in enumerate(locations):
        if not loc.get("key"):
            loc["key"] = _slugify(loc.get("name", f"location-{i}"))
        if "sort" not in loc:
            loc["sort"] = i

    _ref().set({
        "locations": locations,
        "updated_at": datetime.utcnow().isoformat(),
        "updated_by": admin_uid,
    })


def remove_location(key: str) -> bool:
    """Remove a location by key. Returns False if not found."""
    locations = get_locations()
    filtered = [loc for loc in locations if loc["key"] != key]
    if len(filtered) == len(locations):
        return False

    _ref().set({
        "locations": filtered,
        "updated_at": datetime.utcnow().isoformat(),
    })
    return True


def count_items_at_location(key: str) -> int:
    """Count how many inventory items are stored at this location (across all users)."""
    db = _db()
    try:
        count = 0
        for doc in db.collection_group("grocery_items").where(filter=FieldFilter("location", "==", key)).stream():
            count += 1
        return count
    except Exception as e:
        logger.warning("Failed to count items at location %s: %s", key, e)
        return 0
