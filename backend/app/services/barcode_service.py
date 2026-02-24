"""
Barcode lookup and contribution service.

Lookup workflow:
  1. Check Firestore products collection
  2. Check Firestore contributed_products collection
  3. Query Open Food Facts API
  4. If found in OFF, cache to Firestore for future lookups
  5. Return result with source tag
"""

import logging
import time
from typing import Optional

import httpx
from firebase_admin import firestore

from app.core.config import settings
from app.schemas.barcode import BarcodeProduct

logger = logging.getLogger(__name__)


def _get_db():
    return firestore.client()


# ---------------------------------------------------------------------------
# Lookup
# ---------------------------------------------------------------------------

async def lookup_barcode(barcode: str) -> BarcodeProduct:
    """
    Look up a barcode across all sources.

    Returns a BarcodeProduct with found=True/False and source tag.
    Always returns a valid object (never None).
    """
    # 1. Check Firestore products collection (previously cached OFF results)
    product = _lookup_firebase(barcode)
    if product:
        return product

    # 2. Check contributed_products collection
    product = _lookup_contributed(barcode)
    if product:
        return product

    # 3. Query Open Food Facts
    product = await _lookup_openfoodfacts(barcode)
    if product:
        # Cache to Firestore for future lookups
        _save_to_firebase(barcode, product)
        return product

    # 4. Not found — save unknown barcode for tracking
    _save_unknown_barcode(barcode)
    return BarcodeProduct(barcode=barcode, found=False, source="not_found")


def _lookup_firebase(barcode: str) -> Optional[BarcodeProduct]:
    """Check Firestore products collection."""
    try:
        db = _get_db()
        doc = db.collection("products").document(barcode).get()
        if doc.exists:
            data = doc.to_dict()
            # Skip entries that were saved as unknown (no product data)
            if data.get("source") == "unknown":
                return None
            return BarcodeProduct(
                barcode=barcode,
                product_name=data.get("product_name"),
                brands=data.get("brands"),
                categories=data.get("categories"),
                image_url=data.get("image_url"),
                nutrition_data=data.get("nutrition_data"),
                found=True,
                source="firebase",
            )
    except Exception as e:
        logger.warning("Firebase products lookup failed: %s", e)
    return None


def _lookup_contributed(barcode: str) -> Optional[BarcodeProduct]:
    """Check Firestore contributed_products collection."""
    try:
        db = _get_db()
        doc = db.collection("contributed_products").document(barcode).get()
        if doc.exists:
            data = doc.to_dict()
            return BarcodeProduct(
                barcode=barcode,
                product_name=data.get("product_name"),
                brands=data.get("brands"),
                categories=data.get("categories"),
                image_url=data.get("image_url"),
                found=True,
                source="contributed",
            )
    except Exception as e:
        logger.warning("Firebase contributed lookup failed: %s", e)
    return None


async def _lookup_openfoodfacts(barcode: str) -> Optional[BarcodeProduct]:
    """Query Open Food Facts API."""
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
        return BarcodeProduct(
            barcode=barcode,
            product_name=p.get("product_name"),
            brands=p.get("brands"),
            categories=p.get("categories"),
            image_url=p.get("image_url"),
            nutrition_data=p.get("nutriments"),
            found=True,
            source="openfoodfacts",
        )
    except Exception as e:
        logger.warning("Open Food Facts lookup failed: %s", e)
        return None


def _save_to_firebase(barcode: str, product: BarcodeProduct) -> None:
    """Cache an OFF result to Firestore for future lookups."""
    try:
        db = _get_db()
        db.collection("products").document(barcode).set({
            "barcode": barcode,
            "product_name": product.product_name,
            "brands": product.brands,
            "categories": product.categories,
            "image_url": product.image_url,
            "nutrition_data": product.nutrition_data,
            "source": "openfoodfacts",
            "cached_at": int(time.time() * 1000),
        })
    except Exception as e:
        logger.warning("Failed to cache product to Firebase: %s", e)


def _save_unknown_barcode(barcode: str) -> None:
    """Record an unknown barcode to Firestore for tracking."""
    try:
        db = _get_db()
        db.collection("products").document(barcode).set({
            "barcode": barcode,
            "source": "unknown",
            "cached_at": int(time.time() * 1000),
        }, merge=True)
    except Exception as e:
        logger.warning("Failed to save unknown barcode: %s", e)


# ---------------------------------------------------------------------------
# Contribute
# ---------------------------------------------------------------------------

async def contribute_product(
    barcode: str,
    name: str,
    brand: Optional[str],
    category: Optional[str],
    image_url: Optional[str],
    contributed_by: Optional[str],
) -> None:
    """
    Save a user-contributed product to Firestore and
    best-effort submit to Open Food Facts.
    """
    db = _get_db()
    db.collection("contributed_products").document(barcode).set(
        {
            "barcode": barcode,
            "product_name": name,
            "brands": brand,
            "categories": category,
            "image_url": image_url,
            "contributed_by": contributed_by,
            "contributed_at": int(time.time() * 1000),
            "status": "pending_review",
        },
        merge=True,
    )

    # Best-effort OFF submission
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            off_data = {"code": barcode, "product_name": name}
            if brand:
                off_data["brands"] = brand
            if category:
                off_data["categories"] = category
            await client.post(
                "https://world.openfoodfacts.org/cgi/product_jqm2.pl",
                data=off_data,
            )
    except Exception:
        pass  # non-blocking
