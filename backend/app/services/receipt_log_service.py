"""
Receipt scan log service.

Every scan attempt is recorded in Firestore:
  users/{uid}/receipt_scans/{scan_id}

This enables:
  - User scan history (viewable by the user)
  - Admin monitoring (viewable in OCR settings tab)
  - Error diagnosis (every provider attempt logged with timing + error details)
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from firebase_admin import firestore

logger = logging.getLogger(__name__)


def _db():
    return firestore.client()


def _scans_ref(uid: str):
    return _db().collection("users").document(uid).collection("receipt_scans")


# ---------------------------------------------------------------------------
# Create / Update
# ---------------------------------------------------------------------------


def create_scan_log(
    uid: str,
    scan_id: str,
    image_size_bytes: int,
    attempts: list[dict],
    final_provider: Optional[str],
    final_status: str,
    items_detected: int,
    raw_text: str,
) -> None:
    """Create a new scan log entry after OCR processing completes."""
    _scans_ref(uid).document(scan_id).set({
        "scan_id": scan_id,
        "user_id": uid,
        "created_at": datetime.utcnow().isoformat(),
        "image_size_bytes": image_size_bytes,
        "status": final_status,
        "attempts": attempts,
        "final_provider": final_provider,
        "items_detected": items_detected,
        "raw_text": raw_text[:5000],  # cap raw text at 5KB
        "confirmed": False,
        "confirmed_at": None,
        "destination": None,
        "confirmed_items": None,
        "store_name": None,
        "total_confirmed": None,
    })


def confirm_scan(
    uid: str,
    scan_id: str,
    destination: str,
    confirmed_items: list[dict],
    store_name: Optional[str],
    total: Optional[float],
) -> bool:
    """Mark a scan as confirmed after user reviews and submits.

    Returns False if scan_id not found or already confirmed (idempotent).
    """
    ref = _scans_ref(uid).document(scan_id)
    doc = ref.get()

    if not doc.exists:
        return False

    data = doc.to_dict()

    # Idempotency: already confirmed → return True (not an error)
    if data.get("confirmed"):
        return True

    ref.update({
        "status": "confirmed",
        "confirmed": True,
        "confirmed_at": datetime.utcnow().isoformat(),
        "destination": destination,
        "confirmed_items": confirmed_items,
        "store_name": store_name,
        "total_confirmed": total,
    })
    return True


def mark_abandoned(uid: str, scan_id: str) -> None:
    """Mark a scan as abandoned (user closed modal without confirming)."""
    ref = _scans_ref(uid).document(scan_id)
    if ref.get().exists:
        ref.update({"status": "abandoned"})


# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------


def get_user_history(
    uid: str,
    limit: int = 20,
    offset: int = 0,
) -> list[dict]:
    """Get a user's receipt scan history, newest first."""
    query = (
        _scans_ref(uid)
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .limit(limit)
        .offset(offset)
    )
    return [doc.to_dict() for doc in query.stream()]


def get_scan(uid: str, scan_id: str) -> Optional[dict]:
    """Get a single scan log entry."""
    doc = _scans_ref(uid).document(scan_id).get()
    return doc.to_dict() if doc.exists else None


def get_all_recent_scans(limit: int = 50) -> list[dict]:
    """Admin: get recent scans across all users.

    Uses a collection group query on receipt_scans.
    """
    query = (
        _db()
        .collection_group("receipt_scans")
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .limit(limit)
    )
    return [doc.to_dict() for doc in query.stream()]


def get_recent_errors(limit: int = 20) -> list[dict]:
    """Admin: get recent scans that had errors."""
    query = (
        _db()
        .collection_group("receipt_scans")
        .where("status", "in", ["all_failed", "no_items_parsed"])
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .limit(limit)
    )
    return [doc.to_dict() for doc in query.stream()]


def get_scan_stats() -> dict:
    """Admin: aggregate scan stats for the current month."""
    current_month = datetime.utcnow().strftime("%Y-%m")

    # This is a simple approach — for high volume, use counters instead
    query = (
        _db()
        .collection_group("receipt_scans")
        .where("created_at", ">=", f"{current_month}-01")
        .limit(500)
    )

    total = 0
    confirmed = 0
    failed = 0
    for doc in query.stream():
        total += 1
        data = doc.to_dict()
        status = data.get("status", "")
        if status == "confirmed":
            confirmed += 1
        elif status in ("all_failed", "no_items_parsed"):
            failed += 1

    return {
        "month": current_month,
        "total_scans": total,
        "confirmed": confirmed,
        "failed": failed,
    }
