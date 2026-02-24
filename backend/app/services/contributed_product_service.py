"""Contributed product review service."""

import logging
import time
from typing import List, Dict, Any, Optional, Tuple

from firebase_admin import firestore

from app.fsm.review_workflow import review_workflow

logger = logging.getLogger(__name__)


def _get_db():
    return firestore.client()


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

def get_pending(limit: int = 50) -> List[Dict[str, Any]]:
    """Get contributed products with status='pending_review'.
    Filters and sorts in Python to avoid composite index requirements."""
    db = _get_db()
    results = []
    try:
        for doc in db.collection("contributed_products").stream():
            data = doc.to_dict()
            if data.get("status") == "pending_review":
                data["barcode"] = doc.id
                results.append(data)
    except Exception as e:
        logger.warning("Failed to query contributed_products: %s", e)
        return []

    results.sort(key=lambda x: x.get("contributed_at", 0), reverse=True)
    return results[:limit]


def get_all(limit: int = 50) -> List[Dict[str, Any]]:
    """Get all contributed products regardless of status."""
    db = _get_db()
    results = []
    try:
        for doc in db.collection("contributed_products").stream():
            data = doc.to_dict()
            data["barcode"] = doc.id
            results.append(data)
    except Exception as e:
        logger.warning("Failed to query contributed_products: %s", e)
        return []

    results.sort(key=lambda x: x.get("contributed_at", 0), reverse=True)
    return results[:limit]


def get_product(barcode: str) -> Optional[Dict[str, Any]]:
    """Get a single contributed product."""
    db = _get_db()
    doc = db.collection("contributed_products").document(barcode).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    data["barcode"] = doc.id
    return data


def list_contributed(
    limit: int = 50,
    offset: int = 0,
    search: Optional[str] = None,
    status: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], int]:
    """List contributed products with filtering, search, and pagination."""
    db = _get_db()
    results = []
    try:
        for doc in db.collection("contributed_products").stream():
            data = doc.to_dict()
            data["barcode"] = doc.id

            if status and data.get("status") != status:
                continue
            if search:
                q = search.lower()
                name = (data.get("product_name") or "").lower()
                brands = (data.get("brands") or "").lower()
                bc = (data.get("barcode") or "").lower()
                if q not in name and q not in brands and q not in bc:
                    continue
            results.append(data)
    except Exception as e:
        logger.warning("Failed to list contributed_products: %s", e)
        return [], 0

    results.sort(key=lambda x: x.get("contributed_at", 0), reverse=True)
    total = len(results)
    return results[offset:offset + limit], total


def get_count_by_status() -> Dict[str, int]:
    """Count contributed products by status."""
    db = _get_db()
    counts: Dict[str, int] = {"pending_review": 0, "approved": 0, "rejected": 0, "total": 0}
    try:
        for doc in db.collection("contributed_products").stream():
            data = doc.to_dict()
            s = data.get("status", "pending_review")
            if s in counts:
                counts[s] += 1
            counts["total"] += 1
    except Exception as e:
        logger.warning("Failed to count contributed_products: %s", e)
    return counts


def delete_product(barcode: str) -> bool:
    """Delete a single contributed product."""
    db = _get_db()
    try:
        db.collection("contributed_products").document(barcode).delete()
        return True
    except Exception as e:
        logger.warning("Failed to delete contributed product %s: %s", barcode, e)
        return False


def delete_products_batch(barcodes: List[str]) -> int:
    """Batch delete contributed products. Returns count deleted."""
    db = _get_db()
    deleted = 0
    batch_size = 500
    for i in range(0, len(barcodes), batch_size):
        chunk = barcodes[i:i + batch_size]
        batch = db.batch()
        for bc in chunk:
            ref = db.collection("contributed_products").document(bc)
            batch.delete(ref)
        try:
            batch.commit()
            deleted += len(chunk)
        except Exception as e:
            logger.warning("Batch delete failed at chunk %d: %s", i, e)
    return deleted


# ---------------------------------------------------------------------------
# Review actions (FSM-driven)
# ---------------------------------------------------------------------------

def approve(barcode: str, reviewer_uid: str) -> bool:
    """Approve: use FSM, copy to products collection, update status."""
    product = get_product(barcode)
    if not product:
        return False

    current_status = product.get("status", "pending_review")
    success, new_state, error = review_workflow.attempt_transition(
        current_state=current_status,
        trigger="approve",
        actor_id=reviewer_uid,
        context={"barcode": barcode},
    )

    if not success:
        logger.warning("FSM approve failed for %s: %s", barcode, error)
        return False

    db = _get_db()
    now = time.time() * 1000

    # Copy to products collection
    db.collection("products").document(barcode).set({
        "barcode": barcode,
        "product_name": product.get("product_name"),
        "brands": product.get("brands"),
        "categories": product.get("categories"),
        "image_url": product.get("image_url"),
        "source": "contributed",
        "cached_at": now,
    })

    # Update contributed product status
    db.collection("contributed_products").document(barcode).update({
        "status": new_state,
        "reviewed_by": reviewer_uid,
        "reviewed_at": now,
    })

    logger.info("Product %s approved by %s", barcode, reviewer_uid)
    return True


def reject(barcode: str, reviewer_uid: str, reason: str = "") -> bool:
    """Reject: use FSM, update status."""
    product = get_product(barcode)
    if not product:
        return False

    current_status = product.get("status", "pending_review")
    success, new_state, error = review_workflow.attempt_transition(
        current_state=current_status,
        trigger="reject",
        actor_id=reviewer_uid,
        context={"barcode": barcode, "reason": reason},
    )

    if not success:
        logger.warning("FSM reject failed for %s: %s", barcode, error)
        return False

    db = _get_db()
    db.collection("contributed_products").document(barcode).update({
        "status": new_state,
        "reviewed_by": reviewer_uid,
        "reviewed_at": time.time() * 1000,
        "rejection_reason": reason,
    })

    logger.info("Product %s rejected by %s: %s", barcode, reviewer_uid, reason)
    return True
