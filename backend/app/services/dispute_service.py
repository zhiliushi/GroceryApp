"""
Product dispute service — users report wrong product data for admin review.

Firestore collection: product_disputes/{auto-id}

Rules:
- One active dispute per user per barcode per 30 days (edit existing, don't create new)
- Admin can resolve (accept → update product, or dismiss)
- Dispute history preserved for audit
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

logger = logging.getLogger(__name__)

THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000


def _db():
    return firestore.client()


def _collection():
    return _db().collection("product_disputes")


# ---------------------------------------------------------------------------
# Create / Update
# ---------------------------------------------------------------------------


def submit_dispute(
    barcode: str,
    dispute_type: str,
    current_value: str,
    suggested_value: str,
    notes: str,
    submitted_by: str,
) -> Dict[str, Any]:
    """Submit or update a dispute.

    If the user already has an active dispute for this barcode within 30 days,
    updates it instead of creating a new one. Returns the dispute dict.
    """
    # Check for existing dispute from same user within 30 days
    existing = get_user_dispute(barcode, submitted_by)
    if existing:
        # Update existing dispute
        ref = _collection().document(existing["id"])
        updates = {
            "type": dispute_type,
            "suggested_value": suggested_value,
            "notes": notes,
            "updated_at": datetime.utcnow().isoformat(),
            "status": "pending",  # re-open if previously resolved
        }
        ref.update(updates)
        existing.update(updates)
        return existing

    # Create new dispute
    now = datetime.utcnow().isoformat()
    data = {
        "barcode": barcode,
        "type": dispute_type,
        "current_value": current_value,
        "suggested_value": suggested_value,
        "notes": notes,
        "submitted_by": submitted_by,
        "submitted_at": now,
        "updated_at": now,
        "status": "pending",
        "resolved_by": None,
        "resolved_at": None,
        "resolution_note": None,
    }
    ref = _collection().document()
    ref.set(data)
    data["id"] = ref.id
    return data


def get_user_dispute(barcode: str, user_id: str) -> Optional[Dict[str, Any]]:
    """Get the user's active dispute for a barcode within 30 days."""
    cutoff_ms = int((time.time() - 30 * 24 * 60 * 60) * 1000)
    cutoff_iso = datetime.utcfromtimestamp(cutoff_ms / 1000).isoformat()

    try:
        docs = (
            _collection()
            .where(filter=FieldFilter("barcode", "==", barcode))
            .where(filter=FieldFilter("submitted_by", "==", user_id))
            .order_by("submitted_at", direction=firestore.Query.DESCENDING)
            .limit(1)
            .get()
        )
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            # Check if within 30 days
            if data.get("submitted_at", "") >= cutoff_iso:
                return data
    except Exception as e:
        logger.warning("Failed to query user dispute: %s", e)
    return None


# ---------------------------------------------------------------------------
# Admin: List / Resolve
# ---------------------------------------------------------------------------


def list_disputes(
    status: Optional[str] = None,
    barcode: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """List disputes with optional filters."""
    query = _collection()
    results = []

    try:
        for doc in query.stream():
            data = doc.to_dict()
            data["id"] = doc.id
            if status and data.get("status") != status:
                continue
            if barcode and data.get("barcode") != barcode:
                continue
            results.append(data)
    except Exception as e:
        logger.warning("Failed to list disputes: %s", e)
        return []

    results.sort(key=lambda x: x.get("submitted_at", ""), reverse=True)
    return results[:limit]


def count_disputes_by_status() -> Dict[str, int]:
    """Count disputes by status."""
    counts = {"pending": 0, "resolved": 0, "dismissed": 0}
    try:
        for doc in _collection().stream():
            status = doc.to_dict().get("status", "pending")
            counts[status] = counts.get(status, 0) + 1
    except Exception as e:
        logger.warning("Failed to count disputes: %s", e)
    return counts


def count_pending_for_barcode(barcode: str) -> int:
    """Count pending disputes for a specific barcode."""
    count = 0
    try:
        docs = _collection().where(filter=FieldFilter("barcode", "==", barcode)).where(filter=FieldFilter("status", "==", "pending")).get()
        count = len(list(docs))
    except Exception as e:
        logger.warning("Failed to count disputes for %s: %s", barcode, e)
    return count


def resolve_dispute(
    dispute_id: str,
    action: str,
    admin_uid: str,
    resolution_note: str = "",
) -> bool:
    """Resolve a dispute.

    action: "accept" (apply suggested value to product) or "dismiss"
    Returns False if dispute not found.
    """
    ref = _collection().document(dispute_id)
    doc = ref.get()
    if not doc.exists:
        return False

    data = doc.to_dict()
    now = datetime.utcnow().isoformat()

    new_status = "resolved" if action == "accept" else "dismissed"
    ref.update({
        "status": new_status,
        "resolved_by": admin_uid,
        "resolved_at": now,
        "resolution_note": resolution_note,
    })

    # If accepted, update the product
    if action == "accept" and data.get("barcode") and data.get("suggested_value"):
        _apply_dispute_to_product(data)

    return True


def _apply_dispute_to_product(dispute: Dict[str, Any]) -> None:
    """Apply a dispute's suggested value to the product."""
    barcode = dispute["barcode"]
    dispute_type = dispute.get("type", "")
    suggested = dispute.get("suggested_value", "")

    if not suggested:
        return

    field_map = {
        "wrong_name": "product_name",
        "wrong_brand": "brands",
        "wrong_category": "categories",
    }

    field = field_map.get(dispute_type)
    if not field:
        return

    try:
        db = _db()
        ref = db.collection("products").document(barcode)
        if ref.get().exists:
            ref.update({
                field: suggested,
                "updated_at": int(time.time() * 1000),
                "manually_edited": True,
            })
            logger.info("Applied dispute to product %s: %s = %s", barcode, field, suggested)
    except Exception as e:
        logger.warning("Failed to apply dispute to product %s: %s", barcode, e)
