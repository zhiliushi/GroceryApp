"""Iterate every user, export their cascade via export_user_data, write all
JSONs into a single tarball.

Designed to run from GitHub Actions on a schedule (.github/workflows/backup.yml).
Output: backups/grocery-backup-YYYY-MM-DD.tar.gz with one user_{uid}.json per user.

Usage:
    python scripts/backup_all_users.py [--out-dir backups] [--include-analytics]
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import tarfile
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# export_user_data._init_firebase() runs at import time
from scripts.export_user_data import db, export_user  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("backup")


def main():
    parser = argparse.ArgumentParser(description="Export every user's data into a single tarball.")
    parser.add_argument("--out-dir", default="backups", help="Output directory")
    parser.add_argument("--include-analytics", action="store_true")
    parser.add_argument("--include-receipts", action="store_true")
    args = parser.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    tar_path = os.path.join(args.out_dir, f"grocery-backup-{today}.tar.gz")

    user_count = 0
    error_count = 0
    total_bytes = 0

    with tarfile.open(tar_path, "w:gz") as tar:
        for user_doc in db.collection("users").stream():
            uid = user_doc.id
            try:
                result = export_user(uid, args.include_analytics, args.include_receipts)
                payload = json.dumps(result, indent=2, ensure_ascii=False).encode("utf-8")

                info = tarfile.TarInfo(name=f"user_{uid}.json")
                info.size = len(payload)
                info.mtime = int(datetime.now(timezone.utc).timestamp())

                import io
                tar.addfile(info, io.BytesIO(payload))

                user_count += 1
                total_bytes += len(payload)
                logger.info("backed up uid=%s (%d bytes)", uid, len(payload))
            except Exception as e:
                error_count += 1
                logger.error("failed uid=%s: %s", uid, e)

    logger.info("=== Backup complete ===")
    logger.info("Users: %d (errors: %d)", user_count, error_count)
    logger.info("Tarball: %s (%d bytes)", tar_path, os.path.getsize(tar_path))
    logger.info("Total raw JSON: %d bytes", total_bytes)

    if error_count > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
