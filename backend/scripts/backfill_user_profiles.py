"""One-time backfill — create Firestore `users/{uid}` for every Firebase Auth
user that doesn't yet have one. Onboarding v2 prerequisite (PLAN_ONBOARDING_V2.md
Phase 0 / Phase 6).

Per Decision #1: existing dev/test users get
    status="active", registration_complete=false
so they hit the registration form on next login (cleaner data over UX bump).
NOT routed to admin pending queue — existing users are already trusted.

Idempotent: skips any UID that already has a Firestore profile. Safe to re-run.
Run from `backend/`:

    python -m scripts.backfill_user_profiles --dry-run
    python -m scripts.backfill_user_profiles --execute
    python -m scripts.backfill_user_profiles --execute --limit 100

Requires: Firebase Admin SDK initialised (set FIREBASE_CREDENTIALS_PATH or
FIREBASE_CREDENTIALS_JSON env var, or run via `start.bat`).
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from typing import Optional

import firebase_admin
from firebase_admin import auth as firebase_auth, credentials, firestore

logger = logging.getLogger(__name__)


def _ensure_firebase_initialised() -> None:
    """Initialise Firebase Admin SDK using the same `settings` object that
    `main.py` uses. Reads from `backend/.env` (pydantic-settings auto-loads it).

    Mirrors main.py initialisation order:
      1. settings.FIREBASE_CREDENTIALS_JSON (cloud / Render)
      2. settings.FIREBASE_CREDENTIALS_PATH (local file)
      3. Application default credentials (fallback — fails if no gcloud auth)
    """
    if firebase_admin._apps:
        return

    # Import here so the script can present a clean error if Pydantic settings
    # itself fails to load (e.g. missing required field).
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
        # Last-chance fallback: same-folder serviceAccountKey.json. The repo
        # convention is to keep this file next to main.py for local dev.
        local_default = os.path.join(os.path.dirname(__file__), "..", "serviceAccountKey.json")
        local_default = os.path.abspath(local_default)
        if os.path.exists(local_default):
            cred = credentials.Certificate(local_default)
            logger.info("Firebase: using fallback %s", local_default)

    if cred:
        firebase_admin.initialize_app(cred, init_options or None)
    else:
        firebase_admin.initialize_app()


def run(execute: bool = False, limit: Optional[int] = None) -> dict:
    """Iterate Firebase Auth users; create missing Firestore profiles.

    Returns counts: {scanned, missing, created, skipped, errors}
    """
    _ensure_firebase_initialised()
    # Import after init so the service's lazy `firestore.client()` works.
    from app.services import user_service

    db = firestore.client()
    counts = {"scanned": 0, "missing": 0, "created": 0, "skipped": 0, "errors": 0}

    page = firebase_auth.list_users()
    while page:
        for u in page.users:
            counts["scanned"] += 1
            if limit and counts["scanned"] > limit:
                logger.info("Limit %d reached; stopping scan", limit)
                page = None
                break

            try:
                doc = db.collection("users").document(u.uid).get()
                if doc.exists:
                    counts["skipped"] += 1
                    continue
                counts["missing"] += 1

                if execute:
                    user_service.create_user_profile(
                        uid=u.uid,
                        email=u.email or "",
                        display_name=u.display_name or "",
                        status="active",
                        invitation_code=None,
                    )
                    counts["created"] += 1
                    logger.info(
                        "Created profile uid=%s email=%s",
                        u.uid, u.email or "(none)",
                    )
                else:
                    logger.info(
                        "[DRY RUN] Would create profile uid=%s email=%s",
                        u.uid, u.email or "(none)",
                    )
            except Exception as e:
                counts["errors"] += 1
                logger.exception("Failed for uid=%s: %s", u.uid, e)

        if page is None:
            break
        page = page.get_next_page()

    return counts


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    parser = argparse.ArgumentParser(
        description="Backfill Firestore user profiles for all Firebase Auth users."
    )
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true",
                      help="Scan and report; do not write.")
    mode.add_argument("--execute", action="store_true",
                      help="Actually create missing profiles.")
    parser.add_argument("--limit", type=int, default=None,
                        help="Stop after scanning N users (testing).")
    args = parser.parse_args()

    counts = run(execute=args.execute, limit=args.limit)

    print("\n=== Backfill summary ===")
    print(f"  Scanned:  {counts['scanned']}")
    print(f"  Missing:  {counts['missing']}")
    print(f"  Created:  {counts['created']}")
    print(f"  Skipped:  {counts['skipped']}  (already had profile)")
    print(f"  Errors:   {counts['errors']}")
    if not args.execute:
        print("\n  (dry-run — no Firestore writes performed)")
    return 0 if counts["errors"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
