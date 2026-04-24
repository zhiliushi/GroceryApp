"""GDPR data-portability export for a single user.

Exports the user's cascade state into one JSON file:
  - users/{uid}                                 (profile)
  - catalog_entries where user_id == uid        (personal catalog)
  - users/{uid}/purchases/*                     (purchase events)
  - users/{uid}/reminders/*                     (reminders)
  - users/{uid}/insights/*                      (milestone insights)
  - users/{uid}/shopping_lists/*                (incl. items subcollection)
  - users/{uid}/analytics/*                     (optional, flag-gated by --include-analytics)
  - users/{uid}/price_records/*                 (prices the user reported)
  - users/{uid}/receipt_scans/*                 (OCR history, flag-gated)

Usage:
    python scripts/export_user_data.py --user UID [--out file.json] [--include-analytics]

Output format is a single top-level dict with each collection as a key. Timestamps
are serialized as ISO strings. Admin SDK bypasses Firestore security rules.

Caller responsibility: handle the output file with care — contains PII.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from datetime import datetime
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import firebase_admin
from firebase_admin import credentials, firestore

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("export")


def _init_firebase():
    if firebase_admin._apps:
        return
    creds_json = os.environ.get("FIREBASE_CREDENTIALS_JSON")
    creds_path = os.environ.get("FIREBASE_CREDENTIALS_PATH")
    if creds_json:
        cred = credentials.Certificate(json.loads(creds_json))
    elif creds_path and os.path.exists(creds_path):
        cred = credentials.Certificate(creds_path)
    else:
        raise SystemExit("Firebase credentials not found.")
    firebase_admin.initialize_app(cred)


_init_firebase()
db = firestore.client()


def _serialize(obj: Any) -> Any:
    """Make Firestore-returned dict JSON-safe (datetimes → ISO)."""
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_serialize(v) for v in obj]
    if isinstance(obj, datetime):
        return obj.isoformat()
    if hasattr(obj, "to_datetime"):  # firestore Timestamp
        return obj.to_datetime().isoformat()
    return obj


def _collect(query) -> list[dict]:
    results = []
    for doc in query.stream():
        data = doc.to_dict() or {}
        data["_id"] = doc.id
        results.append(_serialize(data))
    return results


def export_user(uid: str, include_analytics: bool = False, include_receipts: bool = False) -> dict:
    logger.info("Exporting user=%s", uid)

    user_doc = db.collection("users").document(uid).get()
    if not user_doc.exists:
        raise SystemExit(f"User {uid} not found")

    data: dict[str, Any] = {
        "uid": uid,
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "schema_version": 1,
    }

    data["user"] = _serialize(user_doc.to_dict() or {})
    data["catalog_entries"] = _collect(
        db.collection("catalog_entries").where("user_id", "==", uid)
    )
    data["purchases"] = _collect(db.collection("users").document(uid).collection("purchases"))
    data["reminders"] = _collect(db.collection("users").document(uid).collection("reminders"))
    data["insights"] = _collect(db.collection("users").document(uid).collection("insights"))
    data["price_records"] = _collect(
        db.collection("users").document(uid).collection("price_records")
    )

    # Shopping lists + their items subcollection
    shopping_lists = []
    for ls in db.collection("users").document(uid).collection("shopping_lists").stream():
        ls_data = _serialize(ls.to_dict() or {})
        ls_data["_id"] = ls.id
        ls_data["items"] = _collect(ls.reference.collection("items"))
        shopping_lists.append(ls_data)
    data["shopping_lists"] = shopping_lists

    # Legacy grocery_items — export even if migrated, user may want history
    data["grocery_items_legacy"] = _collect(
        db.collection("users").document(uid).collection("grocery_items")
    )

    if include_analytics:
        data["analytics"] = _collect(
            db.collection("users").document(uid).collection("analytics")
        )
    if include_receipts:
        data["receipt_scans"] = _collect(
            db.collection("users").document(uid).collection("receipt_scans")
        )

    # Counts summary for quick verification
    data["_counts"] = {
        k: len(v) if isinstance(v, list) else 1
        for k, v in data.items()
        if not k.startswith("_") and k not in ("uid", "exported_at", "schema_version", "user")
    }
    return data


def main():
    parser = argparse.ArgumentParser(description="GDPR data-portability export for a single user.")
    parser.add_argument("--user", required=True, help="Firebase UID")
    parser.add_argument("--out", default=None, help="Output file (default: user_{uid}_export.json)")
    parser.add_argument("--include-analytics", action="store_true", help="Include analytics events")
    parser.add_argument("--include-receipts", action="store_true", help="Include OCR scan history")
    args = parser.parse_args()

    out_path = args.out or f"user_{args.user}_export.json"
    result = export_user(args.user, args.include_analytics, args.include_receipts)

    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2, ensure_ascii=False)

    logger.info("=== Export summary (uid=%s) ===", args.user)
    for k, v in result.get("_counts", {}).items():
        logger.info("  %s: %d", k, v)
    logger.info("Written to %s (%d bytes)", out_path, os.path.getsize(out_path))


if __name__ == "__main__":
    main()
