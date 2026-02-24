"""Product database service — CRUD for Firestore products collection."""

import logging
import time
from typing import Optional, List, Dict, Any

import httpx
from firebase_admin import firestore

from app.core.config import settings

logger = logging.getLogger(__name__)


def _get_db():
    return firestore.client()


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

def list_products(
    limit: int = 50,
    offset: int = 0,
    search: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """List products from the products collection.
    If search is provided, filters in Python (case-insensitive on barcode, product_name, brands)."""
    db = _get_db()
    results = []
    try:
        for doc in db.collection("products").stream():
            data = doc.to_dict()
            data["barcode"] = doc.id

            if search:
                q = search.lower()
                name = (data.get("product_name") or "").lower()
                brands = (data.get("brands") or "").lower()
                barcode = doc.id.lower()
                if q not in name and q not in brands and q not in barcode:
                    continue

            results.append(data)
    except Exception as e:
        logger.warning("Failed to list products: %s", e)
        return []

    results.sort(key=lambda x: x.get("cached_at", 0), reverse=True)
    return results[offset:offset + limit]


def get_product(barcode: str) -> Optional[Dict[str, Any]]:
    """Get a single product by barcode."""
    db = _get_db()
    doc = db.collection("products").document(barcode).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    data["barcode"] = doc.id
    return data


def count_products() -> int:
    """Count total products."""
    db = _get_db()
    docs = list(db.collection("products").select([]).stream())
    return len(docs)


# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------

def create_product(barcode: str, data: Dict[str, Any]) -> None:
    """Create or overwrite a product in the products collection."""
    db = _get_db()
    doc_data = {
        "barcode": barcode,
        "product_name": data.get("product_name"),
        "brands": data.get("brands"),
        "categories": data.get("categories"),
        "image_url": data.get("image_url"),
        "nutrition_data": data.get("nutrition_data"),
        "source": data.get("source", "manual"),
        "cached_at": int(time.time() * 1000),
    }
    db.collection("products").document(barcode).set(doc_data)
    logger.info("Product %s created (source=%s)", barcode, doc_data["source"])


def update_product(barcode: str, data: Dict[str, Any]) -> None:
    """Update an existing product."""
    db = _get_db()
    data["updated_at"] = int(time.time() * 1000)
    db.collection("products").document(barcode).update(data)
    logger.info("Product %s updated", barcode)


def delete_product(barcode: str) -> None:
    """Delete a product."""
    db = _get_db()
    db.collection("products").document(barcode).delete()
    logger.info("Product %s deleted", barcode)


# ---------------------------------------------------------------------------
# Open Food Facts lookup (for form pre-fill)
# ---------------------------------------------------------------------------

async def lookup_openfoodfacts(barcode: str) -> Optional[Dict[str, Any]]:
    """Query Open Food Facts and return raw dict for form pre-fill."""
    try:
        url = f"{settings.OPEN_FOOD_FACTS_API}/product/{barcode}.json"
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, headers={
                "User-Agent": "GroceryApp/1.0 (https://groceryapp.example.com)",
            })

        if resp.status_code != 200:
            return None

        data = resp.json()
        if data.get("status") != 1:
            return None

        p = data.get("product", {})
        return {
            "barcode": barcode,
            "product_name": p.get("product_name"),
            "brands": p.get("brands"),
            "categories": p.get("categories"),
            "image_url": p.get("image_url"),
            "nutrition_data": p.get("nutriments"),
        }
    except Exception as e:
        logger.warning("Open Food Facts lookup failed for %s: %s", barcode, e)
        return None
