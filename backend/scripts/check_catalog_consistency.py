"""Pre/post-migration integrity check for catalog_entries ↔ purchases counters.

For each catalog_entries doc, verifies:
  - active_purchases matches count(purchases where status=active + catalog_name_norm=X)
  - total_purchases matches count(all purchases with catalog_name_norm=X)
  - No orphan purchases (events whose catalog_name_norm has no matching entry)

Read-only by default. Pass --fix to rewrite catalog counters to actual counts
(does NOT delete orphan purchases — run fix_orphan_purchases.py for that).

Usage:
    python scripts/check_catalog_consistency.py
    python scripts/check_catalog_consistency.py --user UID
    python scripts/check_catalog_consistency.py --user UID --fix
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.base_query import FieldFilter

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("consistency")


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
        raise SystemExit("Firebase credentials not found (FIREBASE_CREDENTIALS_JSON or FIREBASE_CREDENTIALS_PATH).")
    firebase_admin.initialize_app(cred)


_init_firebase()
db = firestore.client()


def check_user(uid: str, fix: bool = False) -> dict:
    """Verify counter consistency for a single user. Optionally repair."""
    summary = {
        "uid": uid,
        "catalog_entries": 0,
        "counter_mismatches": 0,
        "orphan_purchases": 0,
        "fixed": 0,
    }

    # 1. Load all catalog entries for user
    catalog_docs = list(db.collection("catalog_entries").where(filter=FieldFilter("user_id", "==", uid)).stream())
    summary["catalog_entries"] = len(catalog_docs)
    catalog_by_name: dict[str, dict] = {}
    for doc in catalog_docs:
        data = doc.to_dict() or {}
        catalog_by_name[data.get("name_norm", "")] = {"ref": doc.reference, "data": data}

    # 2. Aggregate purchase event counts by catalog_name_norm
    purchases_ref = db.collection("users").document(uid).collection("purchases")
    active_counts: dict[str, int] = defaultdict(int)
    total_counts: dict[str, int] = defaultdict(int)
    purchase_names: set[str] = set()
    for doc in purchases_ref.stream():
        data = doc.to_dict() or {}
        name = data.get("catalog_name_norm", "")
        purchase_names.add(name)
        total_counts[name] += 1
        if data.get("status") == "active":
            active_counts[name] += 1

    # 3. Compare against stored counters
    for name_norm, info in catalog_by_name.items():
        stored_active = info["data"].get("active_purchases", 0)
        stored_total = info["data"].get("total_purchases", 0)
        actual_active = active_counts.get(name_norm, 0)
        actual_total = total_counts.get(name_norm, 0)
        if stored_active != actual_active or stored_total != actual_total:
            summary["counter_mismatches"] += 1
            logger.warning(
                "MISMATCH uid=%s name=%r: stored active=%d total=%d actual active=%d total=%d",
                uid, name_norm, stored_active, stored_total, actual_active, actual_total,
            )
            if fix:
                info["ref"].update({
                    "active_purchases": actual_active,
                    "total_purchases": actual_total,
                    "updated_at": firestore.SERVER_TIMESTAMP,
                })
                summary["fixed"] += 1

    # 4. Orphan purchases — events whose catalog_name_norm has no matching catalog entry
    orphan_names = purchase_names - set(catalog_by_name.keys())
    if orphan_names:
        for orphan in orphan_names:
            count = total_counts[orphan]
            logger.warning(
                "ORPHAN uid=%s name=%r count=%d (no catalog entry)",
                uid, orphan, count,
            )
            summary["orphan_purchases"] += count

    return summary


def main():
    parser = argparse.ArgumentParser(description="Verify catalog <-> purchases counter consistency.")
    parser.add_argument("--user", type=str, help="Check a single uid only")
    parser.add_argument("--fix", action="store_true", help="Rewrite catalog counters to match actual event counts")
    args = parser.parse_args()

    if args.user:
        users = [args.user]
    else:
        logger.info("No --user given; scanning all users (this may take a while)")
        users = [doc.id for doc in db.collection("users").stream()]

    totals = {"users_checked": 0, "catalog_entries": 0, "counter_mismatches": 0, "orphan_purchases": 0, "fixed": 0}
    for uid in users:
        stats = check_user(uid, fix=args.fix)
        totals["users_checked"] += 1
        for k in ("catalog_entries", "counter_mismatches", "orphan_purchases", "fixed"):
            totals[k] += stats.get(k, 0)

    logger.info("=== consistency summary ===")
    for k, v in totals.items():
        logger.info("  %s: %d", k, v)
    if totals["counter_mismatches"] > 0 and not args.fix:
        logger.info("Re-run with --fix to repair counter drift.")
    if totals["orphan_purchases"] > 0:
        logger.info("%d orphan purchase(s) found — run fix_orphan_purchases.py to repair.", totals["orphan_purchases"])


if __name__ == "__main__":
    main()
