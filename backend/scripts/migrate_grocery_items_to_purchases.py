"""Migration script: grocery_items -> catalog_entries + purchases.

Idempotent. Dry-run by default. Preserves source docs (marks `_migrated: true`).

Usage:
    python scripts/migrate_grocery_items_to_purchases.py                   # dry-run all users
    python scripts/migrate_grocery_items_to_purchases.py --user UID        # dry-run one user
    python scripts/migrate_grocery_items_to_purchases.py --limit 10        # dry-run first 10 users
    python scripts/migrate_grocery_items_to_purchases.py --execute         # actually migrate ALL
    python scripts/migrate_grocery_items_to_purchases.py --execute --user UID

See docs/MIGRATION_GUIDE.md for full procedure.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from typing import Any

# Add parent dir to path so `app.*` imports work when run as a script
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import firebase_admin
from firebase_admin import credentials, firestore

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("migrate")


# --- Firebase init (supports both creds paths + creds JSON env) ---

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
        raise SystemExit(
            "Firebase credentials not found. Set FIREBASE_CREDENTIALS_JSON or FIREBASE_CREDENTIALS_PATH."
        )
    firebase_admin.initialize_app(cred)


_init_firebase()
from app.services.catalog_service import _normalize, _doc_id  # noqa: E402
from app.core.metadata import apply_create_metadata, SERVER_TIMESTAMP  # noqa: E402

db = firestore.client()


# --- Migration logic ---

STATUS_MAP = {
    "active": ("active", None),
    "consumed": ("used", "used_up"),
    "expired": ("thrown", "expired"),
    "discarded": ("thrown", "bad"),
}


def _mode(values: list) -> Any:
    """Return the most common non-null value, or None if empty."""
    filtered = [v for v in values if v is not None and v != ""]
    if not filtered:
        return None
    return Counter(filtered).most_common(1)[0][0]


def _ms_to_dt(ms: Any) -> datetime | None:
    if ms is None:
        return None
    if isinstance(ms, datetime):
        return ms
    try:
        return datetime.fromtimestamp(float(ms) / 1000.0, tz=timezone.utc)
    except (TypeError, ValueError):
        return None


def migrate_user(uid: str, dry_run: bool = True) -> dict:
    """Migrate one user's grocery_items. Returns stats dict.

    Idempotent — source items marked `_migrated: true` are skipped on re-run.
    """
    stats = {
        "uid": uid,
        "items_scanned": 0,
        "items_skipped": 0,
        "items_invalid_name": 0,
        "catalog_created": 0,
        "catalog_merged": 0,
        "events_created": 0,
        "errors": [],
    }

    # Lock (only when executing)
    lock_ref = db.collection("app_config").document("migrations") \
        .collection("grocery_items_v1").document(f"lock_{uid}")
    if not dry_run:
        lock_snap = lock_ref.get()
        if lock_snap.exists:
            logger.warning("migrate_user: lock exists for %s — skipping", uid)
            stats["errors"].append("lock_exists")
            return stats
        lock_ref.set({"started_at": SERVER_TIMESTAMP, "pid": os.getpid()})

    try:
        # --- Group by name_norm ---
        by_name: dict[str, list[Any]] = {}
        items_ref = db.collection("users").document(uid).collection("grocery_items")
        for item_snap in items_ref.stream():
            stats["items_scanned"] += 1
            item_data = item_snap.to_dict() or {}
            if item_data.get("_migrated"):
                stats["items_skipped"] += 1
                continue
            name = item_data.get("name", "")
            name_norm = _normalize(name)
            if not name_norm:
                stats["items_invalid_name"] += 1
                continue
            by_name.setdefault(name_norm, []).append((item_snap, item_data))

        # --- Process each normalized name ---
        for name_norm, source_items in by_name.items():
            try:
                _migrate_one_catalog(uid, name_norm, source_items, stats, dry_run)
            except Exception as exc:
                logger.exception("migrate_user: failed for %s / %s: %s", uid, name_norm, exc)
                stats["errors"].append(f"{name_norm}: {exc}")

    finally:
        if not dry_run:
            lock_ref.delete()
            # Write per-user metrics
            db.collection("app_config").document("migrations") \
                .collection("grocery_items_v1").document(uid).set({
                    "uid": uid,
                    "finished_at": SERVER_TIMESTAMP,
                    **{k: v for k, v in stats.items() if k != "uid"},
                })

    return stats


def _migrate_one_catalog(
    uid: str,
    name_norm: str,
    source_items: list,
    stats: dict,
    dry_run: bool,
) -> None:
    """Migrate all source items with the same name_norm into one catalog entry + N events."""
    first_data = source_items[0][1]
    display_name = first_data.get("name", name_norm)

    # Aggregate catalog fields
    aliases = sorted({item[1].get("name", "") for item in source_items
                      if item[1].get("name") and item[1].get("name") != display_name})
    barcodes = [item[1].get("barcode") for item in source_items if item[1].get("barcode")]
    barcode = barcodes[0] if barcodes else None

    default_location = _mode([item[1].get("location") for item in source_items])
    default_category = _mode([item[1].get("category") for item in source_items])

    active_count = sum(1 for item in source_items if item[1].get("status") == "active")
    total_count = len(source_items)

    last_purchased_ms = max(
        (item[1].get("purchaseDate") or item[1].get("addedDate") or 0 for item in source_items),
        default=0,
    )
    last_purchased_at = _ms_to_dt(last_purchased_ms) if last_purchased_ms else None

    needs_review = any(item[1].get("needsReview") for item in source_items)

    # --- Catalog upsert ---
    catalog_ref = db.collection("catalog_entries").document(_doc_id(uid, name_norm))
    catalog_data = {
        "user_id": uid,
        "name_norm": name_norm,
        "display_name": display_name,
        "aliases": aliases,
        "barcode": barcode,
        "country_code": None,
        "default_location": default_location,
        "default_category": default_category,
        "active_purchases": active_count,
        "total_purchases": total_count,
        "last_purchased_at": last_purchased_at,
        "needs_review": needs_review,
    }
    if dry_run:
        logger.info("[DRY] catalog_entries/%s: active=%d total=%d barcode=%s",
                    _doc_id(uid, name_norm), active_count, total_count, barcode)
    else:
        catalog_ref.set(
            apply_create_metadata(catalog_data, uid="migration", source="migration"),
            merge=True,
        )
    stats["catalog_created"] += 1

    # --- Create purchase events ---
    batch = db.batch()
    batch_writes = 0
    for item_snap, item_data in source_items:
        src_status = item_data.get("status", "active")
        new_status, reason = STATUS_MAP.get(src_status, ("active", None))

        expiry_ms = item_data.get("expiryDate") or item_data.get("expiry_date")
        expiry_dt = _ms_to_dt(expiry_ms)

        date_bought_ms = item_data.get("purchaseDate") or item_data.get("addedDate") or 0
        date_bought_dt = _ms_to_dt(date_bought_ms) or datetime.now(timezone.utc)

        consumed_ms = item_data.get("consumed_date") or item_data.get("consumedDate")
        consumed_dt = _ms_to_dt(consumed_ms)

        event_data = {
            "catalog_name_norm": name_norm,
            "catalog_display": display_name,
            "barcode": item_data.get("barcode"),
            "country_code": None,
            "quantity": float(item_data.get("quantity") or 1),
            "unit": None,
            "expiry_date": expiry_dt,
            "expiry_source": "user" if expiry_dt else None,
            "expiry_raw": None,
            "price": item_data.get("price"),
            "currency": None,
            "payment_method": None,
            "date_bought": date_bought_dt,
            "location": item_data.get("location"),
            "status": new_status,
            "consumed_date": consumed_dt,
            "consumed_reason": reason,
            "transferred_to": None,
            "reminder_stage": 0,
            "last_reminded_at": None,
            "household_id": None,
            "source_ref": item_snap.id,
        }

        event_ref = db.collection("users").document(uid).collection("purchases").document()

        if dry_run:
            logger.info("[DRY]   event: status=%s expiry=%s price=%s", new_status, expiry_dt, item_data.get("price"))
        else:
            batch.set(event_ref, apply_create_metadata(event_data, uid="migration", source="migration"))
            batch.update(item_snap.reference, {
                "_migrated": True,
                "_migrated_purchase_id": event_ref.id,
                "_migrated_at": SERVER_TIMESTAMP,
            })
            batch_writes += 2

            # Commit every 400 writes
            if batch_writes >= 400:
                batch.commit()
                batch = db.batch()
                batch_writes = 0

        stats["events_created"] += 1

    if not dry_run and batch_writes > 0:
        batch.commit()


def list_all_users() -> list[str]:
    """Return all user UIDs. Iterates `users` collection."""
    uids = []
    for doc in db.collection("users").stream():
        uids.append(doc.id)
    return uids


def _persist_metrics(
    totals: Counter,
    per_user: dict[str, dict],
    errors: list[dict],
    dry_run: bool,
    started_at: datetime,
    finished_at: datetime,
) -> None:
    """Write aggregate + per-user metrics to app_config/migrations/grocery_items_v1.metrics.

    Plan observability spec: "Migration metrics: per-user success/failure, total migrated,
    errors list — persisted to `app_config/migrations/grocery_items_v1.metrics`".
    """
    if dry_run:
        logger.info("metrics: skipped persist (dry-run)")
        return
    try:
        ref = db.collection("app_config").document("migrations").collection("grocery_items_v1").document("metrics")
        ref.set(
            {
                "started_at": started_at,
                "finished_at": finished_at,
                "duration_sec": (finished_at - started_at).total_seconds(),
                "users_processed": len(per_user),
                "totals": dict(totals),
                "per_user": per_user,
                "errors": errors,
                "updated_at": firestore.SERVER_TIMESTAMP,
            }
        )
        logger.info("metrics: persisted to app_config/migrations/grocery_items_v1/metrics")
    except Exception as exc:
        logger.warning("metrics: failed to persist (non-fatal): %s", exc)


def main():
    parser = argparse.ArgumentParser(description="Migrate grocery_items → catalog_entries + purchases")
    parser.add_argument("--execute", action="store_true", help="Actually write to Firestore (default: dry-run)")
    parser.add_argument("--user", type=str, default=None, help="Migrate only this single user")
    parser.add_argument("--limit", type=int, default=None, help="Limit to first N users (smoke test)")
    args = parser.parse_args()

    dry_run = not args.execute

    if args.user:
        users = [args.user]
    else:
        users = list_all_users()
        if args.limit:
            users = users[: args.limit]

    logger.info("Migration: mode=%s users=%d", "EXECUTE" if args.execute else "DRY-RUN", len(users))

    started_at = datetime.now(timezone.utc)
    totals = Counter()
    per_user: dict[str, dict] = {}
    errors: list[dict] = []

    for i, uid in enumerate(users, 1):
        logger.info("[%d/%d] user=%s", i, len(users), uid)
        try:
            stats = migrate_user(uid, dry_run=dry_run)
            per_user[uid] = {k: v for k, v in stats.items() if isinstance(v, (int, str))}
            for k, v in stats.items():
                if isinstance(v, int):
                    totals[k] += v
        except Exception as exc:
            logger.exception("user=%s migration failed: %s", uid, exc)
            errors.append({"uid": uid, "error": str(exc), "type": type(exc).__name__})
            per_user[uid] = {"error": str(exc)}

    finished_at = datetime.now(timezone.utc)

    logger.info("\n=== Summary ===")
    for k, v in totals.items():
        logger.info("  %s: %d", k, v)
    if errors:
        logger.warning("  errors: %d users failed", len(errors))

    _persist_metrics(totals, per_user, errors, dry_run, started_at, finished_at)

    if dry_run:
        logger.info("\nDRY-RUN complete. Re-run with --execute to apply.")


if __name__ == "__main__":
    main()
