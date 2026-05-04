"""One-time backfill — create `users/{uid}/memberships/{household_id}` subcollection
docs from the legacy single-valued `users/{uid}.household_id` field.

Background: pre-MH-3 the data model was strictly one-household-per-user (a single
`household_id` field on the user doc). The corrected model is asymmetric:
  - At most ONE owned household
  - N joined memberships

This script seeds the `memberships` subcollection from existing data so that read
paths added in MH-3c can prefer it, while the legacy `household_id` field stays
as a write-shadow during the migration window.

Idempotent: re-running is a no-op for users whose memberships subcollection is
already populated. Safe to run multiple times.

Run from `backend/`:

    python -m scripts.backfill_memberships --dry-run
    python -m scripts.backfill_memberships --execute
    python -m scripts.backfill_memberships --execute --limit 100
    python -m scripts.backfill_memberships --execute --uid <specific-uid>

Requires: Firebase Admin SDK initialised (set FIREBASE_CREDENTIALS_PATH or
FIREBASE_CREDENTIALS_JSON env var, or run via `start.bat`).

See `docs/PLAN_ONBOARDING_V2.md` MH-3 (Multi-household support).
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Optional

import firebase_admin
from firebase_admin import credentials, firestore

logger = logging.getLogger(__name__)


def _ensure_firebase_initialised() -> None:
    """Mirror main.py's Firebase init order. See backfill_user_profiles.py for
    rationale; copied here so each script is independently runnable."""
    if firebase_admin._apps:
        return

    from app.core.config import settings

    cred = None
    init_options = {}
    if settings.FIREBASE_DATABASE_URL:
        init_options["databaseURL"] = settings.FIREBASE_DATABASE_URL

    if settings.FIREBASE_CREDENTIALS_JSON:
        import json
        cred = credentials.Certificate(json.loads(settings.FIREBASE_CREDENTIALS_JSON))
        logger.info("Firebase: using FIREBASE_CREDENTIALS_JSON from settings")
    elif settings.FIREBASE_CREDENTIALS_PATH and os.path.exists(settings.FIREBASE_CREDENTIALS_PATH):
        cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
        logger.info("Firebase: using credentials file %s", settings.FIREBASE_CREDENTIALS_PATH)
    else:
        local_default = os.path.join(os.path.dirname(__file__), "..", "serviceAccountKey.json")
        local_default = os.path.abspath(local_default)
        if os.path.exists(local_default):
            cred = credentials.Certificate(local_default)
            logger.info("Firebase: using fallback %s", local_default)

    if cred:
        firebase_admin.initialize_app(cred, init_options or None)
    else:
        firebase_admin.initialize_app()


def _resolve_role(db, uid: str, household_id: str) -> Optional[str]:
    """Return 'owner' if this user owns the household, 'member' if they're a
    member, or None if the household is missing / they aren't in it (orphaned
    legacy reference)."""
    snap = db.collection("households").document(household_id).get()
    if not snap.exists:
        return None
    data = snap.to_dict() or {}
    if data.get("owner_uid") == uid:
        return "owner"
    members = data.get("members") or []
    if any(m.get("uid") == uid for m in members):
        return "member"
    return None


def run(execute: bool = False, limit: Optional[int] = None, only_uid: Optional[str] = None) -> dict:
    """Iterate users and seed each one's memberships subcollection from
    legacy `household_id`.

    Returns a counters dict suitable for printing at the end.
    """
    db = firestore.client()
    counters = {
        "scanned": 0,
        "no_legacy_field": 0,
        "already_migrated": 0,
        "would_write": 0,
        "wrote": 0,
        "orphaned_legacy_ref": 0,
        "errors": 0,
    }

    if only_uid:
        users_iter = [db.collection("users").document(only_uid).get()]
    else:
        users_iter = db.collection("users").stream()

    for user_snap in users_iter:
        if limit is not None and counters["scanned"] >= limit:
            break
        if not user_snap.exists:
            if only_uid:
                logger.warning("User %s not found", only_uid)
                counters["errors"] += 1
            continue

        counters["scanned"] += 1
        uid = user_snap.id
        data = user_snap.to_dict() or {}
        legacy_hid = data.get("household_id")

        if not legacy_hid:
            counters["no_legacy_field"] += 1
            continue

        # Already migrated? Check if the subcollection has this household.
        membership_ref = (
            db.collection("users").document(uid)
            .collection("memberships").document(legacy_hid)
        )
        existing = membership_ref.get()
        if existing.exists:
            counters["already_migrated"] += 1
            continue

        role = _resolve_role(db, uid, legacy_hid)
        if role is None:
            # Orphaned reference — household deleted or user removed but
            # legacy field still set. Don't backfill; leave for manual review.
            counters["orphaned_legacy_ref"] += 1
            logger.warning(
                "Orphaned: user=%s legacy household_id=%s — household missing or user not a member",
                uid, legacy_hid,
            )
            continue

        membership_doc = {
            "household_id": legacy_hid,
            "role": role,
            "joined_at": data.get("created_at") or datetime.now(timezone.utc).isoformat(),
            "frozen": False,
            # Default the migrated user to "this is my active scope".
            # Read paths in MH-3c will respect this; the SPA also persists
            # its own per-user choice in localStorage which can override.
            "active": True,
            "migrated_from_legacy": True,
            "migrated_at": firestore.SERVER_TIMESTAMP,
        }

        if execute:
            try:
                membership_ref.set(membership_doc)
                counters["wrote"] += 1
                logger.info("Wrote membership: user=%s household=%s role=%s", uid, legacy_hid, role)
            except Exception as exc:
                counters["errors"] += 1
                logger.error("Failed to write user=%s household=%s: %s", uid, legacy_hid, exc)
        else:
            counters["would_write"] += 1
            logger.info("DRY-RUN would write: user=%s household=%s role=%s", uid, legacy_hid, role)

    return counters


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-7s %(message)s",
    )
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Default. Report what would be written without touching Firestore.",
    )
    parser.add_argument(
        "--execute", action="store_true",
        help="Actually write the memberships subcollection. Idempotent.",
    )
    parser.add_argument(
        "--limit", type=int, default=None,
        help="Stop after N users. Useful for smoke-testing on prod data.",
    )
    parser.add_argument(
        "--uid", type=str, default=None,
        help="Backfill a specific uid only. Safest first run.",
    )
    args = parser.parse_args()

    if args.dry_run and args.execute:
        parser.error("Pass either --dry-run or --execute, not both.")
    execute = args.execute  # default to dry-run when neither flag set

    _ensure_firebase_initialised()

    print(f"Mode: {'EXECUTE' if execute else 'DRY-RUN'}")
    if args.uid:
        print(f"Scope: single user uid={args.uid}")
    elif args.limit:
        print(f"Scope: first {args.limit} users")
    else:
        print("Scope: all users")
    print()

    counters = run(execute=execute, limit=args.limit, only_uid=args.uid)

    print()
    print("Summary:")
    for k, v in counters.items():
        print(f"  {k:.<30}{v:>6}")

    if counters["errors"]:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
