"""GDPR right-to-erasure: cascade delete a single user's data.

Deletes:
  - catalog_entries where user_id == uid      (personal catalog)
  - users/{uid}/purchases/*                   (purchase events)
  - users/{uid}/reminders/*                   (reminders)
  - users/{uid}/insights/*                    (milestone insights)
  - users/{uid}/shopping_lists/*/items/*      (list items)
  - users/{uid}/shopping_lists/*              (shopping lists)
  - users/{uid}/analytics/*                   (analytics events)
  - users/{uid}/price_records/*               (user prices)
  - users/{uid}/receipt_scans/*               (OCR history)
  - users/{uid}/grocery_items/*               (legacy inventory)
  - users/{uid}/cache/*                       (health-score cache, etc.)
  - users/{uid}/sync_meta/*                   (sync metadata)
  - users/{uid}                               (profile doc, LAST)

Mirror of scripts/export_user_data.py shape. Requires --confirm-wipe to run.

Usage:
    python scripts/delete_user_data.py --user UID --confirm-wipe [--keep-profile]
    python scripts/delete_user_data.py --user UID --confirm-wipe --export-first out.json
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.base_query import FieldFilter

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("delete")


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


def _delete_query(query, batch_size: int = 400) -> int:
    """Stream-delete documents matching `query`. Returns count."""
    count = 0
    batch = db.batch()
    batch_count = 0
    for doc in query.stream():
        batch.delete(doc.reference)
        batch_count += 1
        count += 1
        if batch_count >= batch_size:
            batch.commit()
            batch = db.batch()
            batch_count = 0
    if batch_count:
        batch.commit()
    return count


def _delete_subcollection(user_ref, name: str) -> int:
    return _delete_query(user_ref.collection(name))


def delete_user(uid: str, keep_profile: bool = False) -> dict:
    stats: dict[str, int] = {}
    user_ref = db.collection("users").document(uid)
    if not user_ref.get().exists:
        logger.warning("User %s not found — nothing to delete", uid)
        return stats

    # 1. Global catalog entries
    stats["catalog_entries"] = _delete_query(
        db.collection("catalog_entries").where(filter=FieldFilter("user_id", "==", uid))
    )

    # 2. User-scoped subcollections
    for sub in (
        "purchases",
        "reminders",
        "insights",
        "analytics",
        "price_records",
        "receipt_scans",
        "grocery_items",
        "cache",
        "sync_meta",
    ):
        stats[sub] = _delete_subcollection(user_ref, sub)

    # 3. Shopping lists — items subcollections first
    shopping_items = 0
    shopping_lists = 0
    for ls in user_ref.collection("shopping_lists").stream():
        shopping_items += _delete_query(ls.reference.collection("items"))
        ls.reference.delete()
        shopping_lists += 1
    stats["shopping_list_items"] = shopping_items
    stats["shopping_lists"] = shopping_lists

    # 4. Migration metrics — delete per-user lock doc if present
    lock_ref = db.collection("app_config").document("migrations").collection(
        "grocery_items_v1"
    ).document(uid)
    if lock_ref.get().exists:
        lock_ref.delete()
        stats["migration_lock"] = 1

    # 5. User profile (LAST — so partial failures leave the user doc as the beacon)
    if keep_profile:
        logger.info("keep-profile: not deleting users/%s", uid)
    else:
        user_ref.delete()
        stats["user"] = 1

    return stats


def main():
    parser = argparse.ArgumentParser(description="GDPR cascade delete for a single user.")
    parser.add_argument("--user", required=True, help="Firebase UID")
    parser.add_argument("--confirm-wipe", action="store_true", help="Required confirmation flag")
    parser.add_argument("--keep-profile", action="store_true", help="Preserve users/{uid} doc (data only)")
    parser.add_argument("--export-first", default=None, help="Export to JSON before deleting")
    args = parser.parse_args()

    if not args.confirm_wipe:
        raise SystemExit("Refusing to run without --confirm-wipe")

    if args.export_first:
        # Opportunistic export via the sibling script
        logger.info("Running export first → %s", args.export_first)
        import importlib.util

        spec = importlib.util.spec_from_file_location(
            "export_user_data",
            os.path.join(os.path.dirname(__file__), "export_user_data.py"),
        )
        if spec and spec.loader:
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            result = mod.export_user(args.user, include_analytics=True, include_receipts=True)
            with open(args.export_first, "w", encoding="utf-8") as fh:
                json.dump(result, fh, indent=2, ensure_ascii=False)

    stats = delete_user(args.user, keep_profile=args.keep_profile)

    logger.info("=== Delete summary (uid=%s) ===", args.user)
    for k, v in stats.items():
        logger.info("  %s: %d", k, v)
    total = sum(v for v in stats.values() if isinstance(v, int))
    logger.info("Total docs deleted: %d", total)


if __name__ == "__main__":
    main()
