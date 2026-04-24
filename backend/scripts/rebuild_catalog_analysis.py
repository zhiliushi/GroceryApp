"""Script form of `POST /api/admin/catalog-analysis/refresh`.

Rebuilds the admin catalog-analysis cache without needing an admin HTTP session.
Useful for ops runbooks (e.g. cron job + log forward).

Plan: referenced as `scripts/rebuild_catalog_analysis.py` under "Admin/Operational Tooling".

Usage:
    python scripts/rebuild_catalog_analysis.py
"""

from __future__ import annotations

import json
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import firebase_admin
from firebase_admin import credentials

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("rebuild-analysis")


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


def main():
    _init_firebase()
    from app.services import catalog_analysis_service

    logger.info("Rebuilding catalog_analysis_cache…")
    result = catalog_analysis_service.refresh_cache()

    logger.info("=== Summary ===")
    logger.info("  barcode_to_names: %d", len(result.get("barcode_to_names") or []))
    logger.info("  no_barcode_names: %d", len(result.get("no_barcode_names") or []))
    logger.info("  cleanup_preview: %d", len(result.get("cleanup_preview") or []))
    logger.info("Persisted to app_config/catalog_analysis_cache.")


if __name__ == "__main__":
    main()
