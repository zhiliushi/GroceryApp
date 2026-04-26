"""Rollback the grocery_items → catalog_entries + purchases migration.

Deletes catalog_entries + purchases for specified users and clears _migrated
markers on source grocery_items. Requires --confirm-wipe flag to run.

Usage:
    python scripts/rollback_purchases_migration.py --user UID --confirm-wipe
    python scripts/rollback_purchases_migration.py --all --confirm-wipe

See docs/MIGRATION_GUIDE.md.
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
logger = logging.getLogger("rollback")


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


def rollback_user(uid: str) -> dict:
    stats = {"uid": uid, "catalog_deleted": 0, "purchases_deleted": 0, "grocery_items_cleared": 0}

    # 1. Delete catalog_entries where user_id == uid
    q = db.collection("catalog_entries").where(filter=FieldFilter("user_id", "==", uid))
    batch = db.batch()
    count = 0
    for doc in q.stream():
        batch.delete(doc.reference)
        count += 1
        if count >= 400:
            batch.commit()
            batch = db.batch()
            count = 0
        stats["catalog_deleted"] += 1
    if count:
        batch.commit()

    # 2. Delete purchases
    purchases_ref = db.collection("users").document(uid).collection("purchases")
    batch = db.batch()
    count = 0
    for doc in purchases_ref.stream():
        batch.delete(doc.reference)
        count += 1
        if count >= 400:
            batch.commit()
            batch = db.batch()
            count = 0
        stats["purchases_deleted"] += 1
    if count:
        batch.commit()

    # 3. Clear _migrated markers
    items_ref = (
        db.collection("users").document(uid).collection("grocery_items")
        .where(filter=FieldFilter("_migrated", "==", True))
    )
    batch = db.batch()
    count = 0
    for doc in items_ref.stream():
        batch.update(doc.reference, {
            "_migrated": firestore.DELETE_FIELD,
            "_migrated_purchase_id": firestore.DELETE_FIELD,
            "_migrated_at": firestore.DELETE_FIELD,
        })
        count += 1
        if count >= 400:
            batch.commit()
            batch = db.batch()
            count = 0
        stats["grocery_items_cleared"] += 1
    if count:
        batch.commit()

    # 4. Clear migration metrics doc
    metrics_ref = (
        db.collection("app_config").document("migrations")
        .collection("grocery_items_v1").document(uid)
    )
    if metrics_ref.get().exists:
        metrics_ref.delete()

    return stats


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--user", type=str, help="Rollback single user")
    parser.add_argument("--all", action="store_true", help="Rollback ALL users")
    parser.add_argument("--confirm-wipe", action="store_true", help="Required confirmation flag")
    args = parser.parse_args()

    if not args.confirm_wipe:
        raise SystemExit("Refusing to run without --confirm-wipe")

    if args.user:
        users = [args.user]
    elif args.all:
        users = [doc.id for doc in db.collection("users").stream()]
    else:
        raise SystemExit("Specify --user UID or --all")

    logger.info("Rollback mode, users=%d", len(users))

    totals = {"catalog_deleted": 0, "purchases_deleted": 0, "grocery_items_cleared": 0}
    for i, uid in enumerate(users, 1):
        logger.info("[%d/%d] rollback user=%s", i, len(users), uid)
        stats = rollback_user(uid)
        for k, v in stats.items():
            if isinstance(v, int):
                totals[k] = totals.get(k, 0) + v

    logger.info("\n=== Rollback summary ===")
    for k, v in totals.items():
        logger.info("  %s: %d", k, v)


if __name__ == "__main__":
    main()
