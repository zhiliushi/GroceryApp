"""
Barcode lookup and contribution service.

Lookup workflow:
  0. Detect in-store / variable-weight labels (02xx, 200-299) — these are NOT
     globally unique (every supermarket reuses them for deli stickers, fresh
     produce labels, butcher cuts). Short-circuit: return found=False with
     source="in_store_label" so the SPA forces per-user naming and does NOT
     write to the global products cache or submit to OFF.
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


def is_in_store_label(barcode: str) -> bool:
    """True if the barcode falls in a GS1-reserved in-store / variable-weight
    range. Such codes are reused by every retailer for store-internal labels
    (deli, butcher, fresh produce) and CANNOT be used as a global product key.

    Reserved ranges (GS1 General Specifications):
      - EAN-13 starting "02"     — variable-measure items, store-internal
      - EAN-13 / UPC starting "2" with 200-299 — same family, in-store labels
      - 13-digit codes starting "20" through "29" inclusive
    """
    if not barcode:
        return False
    bc = barcode.strip()
    if not bc.isdigit():
        return False
    # 13-digit EAN: 02xxx... or 20xxx...29xxx... → in-store
    if len(bc) >= 2 and bc[:2] in ("02",):
        return True
    if len(bc) >= 3 and bc[:1] == "2" and bc[1:3].isdigit():
        prefix = int(bc[:3])
        if 200 <= prefix <= 299:
            return True
    return False


# ---------------------------------------------------------------------------
# Lookup
# ---------------------------------------------------------------------------

async def lookup_barcode(barcode: str) -> BarcodeProduct:
    """
    Look up a barcode across all sources.

    Returns a BarcodeProduct with found=True/False and source tag.
    Always returns a valid object (never None).

    In-store labels (02xx, 200-299) bypass the global lookup chain entirely
    — they're NOT globally unique, so caching one would corrupt the global
    catalog. Caller must handle source="in_store_label" by forcing the user
    to name the item locally only.
    """
    if is_in_store_label(barcode):
        logger.info("barcode.in_store_label barcode=%s — skipping global lookup", barcode)
        return BarcodeProduct(barcode=barcode, found=False, source="in_store_label")

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
