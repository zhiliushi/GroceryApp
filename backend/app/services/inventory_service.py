"""Inventory service — cross-user inventory queries for web admin."""

import logging
import time
from typing import Optional, List, Dict, Any

from firebase_admin import firestore

logger = logging.getLogger(__name__)


def _get_db():
    return firestore.client()


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

def get_all_items(
    limit: int = 50,
    offset: int = 0,
    status: Optional[str] = None,
    needs_review: Optional[bool] = None,
    location: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Admin: list items across ALL users using collection group query.
    Filters and sorts in Python to avoid Firestore composite index requirements."""
    db = _get_db()
    query = db.collection_group("grocery_items")

    results = []
    try:
        for doc in query.stream():
            data = doc.to_dict()
            # Apply filters in Python
            if status and data.get("status") != status:
                continue
            if needs_review is not None and data.get("needsReview") != needs_review:
                continue
            if location and data.get("location") != location:
                continue
            data["id"] = doc.id
            # Extract user_id from path: users/{uid}/grocery_items/{item_id}
            path_parts = doc.reference.path.split("/")
            if len(path_parts) >= 2:
                data["user_id"] = path_parts[1]
            results.append(data)
    except Exception as e:
        logger.warning("Failed to query grocery_items collection group: %s", e)
        return []

    # Sort by updatedAt descending in Python
    results.sort(key=lambda x: x.get("updatedAt", 0), reverse=True)
    # Apply offset/limit
    return results[offset:offset + limit]


def get_user_items(
    uid: str,
    limit: int = 50,
    offset: int = 0,
    status: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """User: list own items with optional filters."""
    db = _get_db()
    query = db.collection("users").document(uid).collection("grocery_items")

    results = []
    try:
        for doc in query.stream():
            data = doc.to_dict()
            if status and data.get("status") != status:
                continue
            data["id"] = doc.id
            data["user_id"] = uid
            results.append(data)
    except Exception as e:
        logger.warning("Failed to query user items for %s: %s", uid, e)
        return []

    results.sort(key=lambda x: x.get("updatedAt", 0), reverse=True)
    return results[offset:offset + limit]


def get_item(uid: str, item_id: str) -> Optional[Dict[str, Any]]:
    """Get a single item."""
    db = _get_db()
    doc = db.collection("users").document(uid).collection("grocery_items").document(item_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    data["id"] = doc.id
    data["user_id"] = uid
    return data


# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------

def update_item(uid: str, item_id: str, data: Dict[str, Any]) -> None:
    """Update item fields."""
    db = _get_db()
    data["updatedAt"] = time.time() * 1000  # epoch ms
    db.collection("users").document(uid).collection("grocery_items").document(item_id).update(data)


# ---------------------------------------------------------------------------
# Needs review
# ---------------------------------------------------------------------------

def get_needs_review_items(limit: int = 50) -> List[Dict[str, Any]]:
    """Admin: get items with needsReview=true across all users."""
    return get_all_items(limit=limit, needs_review=True)
