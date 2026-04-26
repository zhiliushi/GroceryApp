"""Repair orphan purchase events — events whose catalog_name_norm points to a
non-existent catalog_entries doc.

Strategy (for each orphan): recreate the catalog entry with display_name derived
from `catalog_display` on the orphan event and counters aggregated from all
matching events. Preserves the user's purchase history even when catalog was
accidentally deleted (e.g. aggressive cleanup, rollback race, manual delete).

Read-only by default; pass --fix to actually write.

Usage:
    python scripts/fix_orphan_purchases.py --user UID
    python scripts/fix_orphan_purchases.py --user UID --fix
    python scripts/fix_orphan_purchases.py --all --fix
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.base_query import FieldFilter

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("orphans")


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


def fix_user(uid: str, fix: bool = False) -> dict:
    """Find orphan purchase events for uid. Optionally recreate missing catalog entries."""
    stats = {"uid": uid, "orphan_names": 0, "recreated": 0, "events_covered": 0}

    # Existing catalog names for the user
    existing_names = {
        (doc.to_dict() or {}).get("name_norm", "")
        for doc in db.collection("catalog_entries").where(filter=FieldFilter("user_id", "==", uid)).stream()
    }

    # Aggregate purchase data by catalog_name_norm
    aggregates: dict[str, dict] = defaultdict(
        lambda: {
            "display": None,
            "barcode": None,
            "country_code": None,
            "active": 0,
            "total": 0,
            "last_purchased_at": None,
            "default_location": None,
        }
    )
    for doc in db.collection("users").document(uid).collection("purchases").stream():
        data = doc.to_dict() or {}
        name = data.get("catalog_name_norm", "")
        if not name:
            continue
        agg = aggregates[name]
        if agg["display"] is None:
            agg["display"] = data.get("catalog_display") or name
        if not agg["barcode"] and data.get("barcode"):
            agg["barcode"] = data["barcode"]
        if not agg["country_code"] and data.get("country_code"):
            agg["country_code"] = data["country_code"]
        if not agg["default_location"] and data.get("location"):
            agg["default_location"] = data["location"]
        agg["total"] += 1
        if data.get("status") == "active":
            agg["active"] += 1
        dt = data.get("date_bought")
        if dt and hasattr(dt, "to_datetime"):
            dt = dt.to_datetime()
        if isinstance(dt, datetime) and (agg["last_purchased_at"] is None or dt > agg["last_purchased_at"]):
            agg["last_purchased_at"] = dt

    # Orphans — names in aggregates but not in existing_names
    for name_norm, agg in aggregates.items():
        if name_norm in existing_names:
            continue
        stats["orphan_names"] += 1
        stats["events_covered"] += agg["total"]
        logger.warning(
            "ORPHAN uid=%s name=%r display=%r events=%d (active=%d)",
            uid, name_norm, agg["display"], agg["total"], agg["active"],
        )
        if not fix:
            continue
        doc_id = f"{uid}__{name_norm}"
        db.collection("catalog_entries").document(doc_id).set({
            "user_id": uid,
            "name_norm": name_norm,
            "display_name": agg["display"] or name_norm,
            "aliases": [],
            "barcode": agg["barcode"],
            "country_code": agg["country_code"],
            "default_location": agg["default_location"],
            "default_category": None,
            "image_url": None,
            "total_purchases": agg["total"],
            "active_purchases": agg["active"],
            "last_purchased_at": agg["last_purchased_at"] or datetime.now(timezone.utc),
            "needs_review": True,  # flag for admin review — was orphan
            "created_at": firestore.SERVER_TIMESTAMP,
            "updated_at": firestore.SERVER_TIMESTAMP,
            "schema_version": 1,
            "created_by": "system",
            "source": "orphan_repair",
        })
        stats["recreated"] += 1
        logger.info("RECREATED uid=%s name=%r (needs_review=true)", uid, name_norm)

    return stats


def main():
    parser = argparse.ArgumentParser(description="Repair orphan purchase events.")
    parser.add_argument("--user", type=str, help="Single user")
    parser.add_argument("--all", action="store_true", help="All users")
    parser.add_argument("--fix", action="store_true", help="Write repairs (default: dry-run)")
    args = parser.parse_args()

    if args.user:
        users = [args.user]
    elif args.all:
        users = [doc.id for doc in db.collection("users").stream()]
    else:
        raise SystemExit("Specify --user UID or --all")

    totals = {"users": 0, "orphan_names": 0, "recreated": 0, "events_covered": 0}
    for uid in users:
        r = fix_user(uid, fix=args.fix)
        totals["users"] += 1
        for k in ("orphan_names", "recreated", "events_covered"):
            totals[k] += r[k]

    logger.info("=== orphan repair summary ===")
    for k, v in totals.items():
        logger.info("  %s: %d", k, v)
    if not args.fix and totals["orphan_names"] > 0:
        logger.info("Dry-run — re-run with --fix to recreate missing catalog entries.")


if __name__ == "__main__":
    main()
