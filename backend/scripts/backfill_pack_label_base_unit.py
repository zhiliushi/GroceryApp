"""Idempotent backfill — populate `pack_label` and `base_unit` on every
purchase event, and coerce legacy `unit_type="container"` on catalog rows
to `"count"`.

UNIT_TYPE_TOUCHPOINT — see `.claude/docs/unit-type-method.md`.

Idempotency: each event/catalog row gets a `_pack_label_v1=true` /
`_unit_type_v1=true` marker. Re-runs skip already-marked docs. Safe to
run on every backend startup; only does work on un-marked docs.

Inference rules for events:
  base_unit = event.base_unit
            ?? event.base_unit_label (when ∈ {ml,L,g,kg,count,pcs,…})
            ?? event.unit (when ∈ {ml,L,g,kg,count})
            ?? "count"
  pack_label = event.pack_label
             ?? "pack" if event.unit == "pack"
             ?? "pack" if pack_size > 1
             ?? "loose"

For catalog rows: unit_type="container" → "count" + marker.

Usage:
  python -m scripts.backfill_pack_label_base_unit --dry-run
  python -m scripts.backfill_pack_label_base_unit --execute
  python -m scripts.backfill_pack_label_base_unit --execute --limit 1000

Auto-run on startup (idempotent): see main.py startup hook. Pass
`max_docs` to bound work per startup so a cold start with millions of
events doesn't stall.
"""

from __future__ import annotations

import argparse
import logging
import sys
from typing import Optional

from firebase_admin import firestore

from app.services import unit_type_service

logger = logging.getLogger(__name__)


_EVENT_MARKER = "_pack_label_v1"
_CATALOG_MARKER = "_unit_type_v1"


def _db():
    return firestore.client()


def _infer_event_fields(data: dict) -> tuple[Optional[str], Optional[str]]:
    """Return (pack_label, base_unit) to set, or (None, None) if both already
    canonical (no work needed).
    """
    existing_pack_label = data.get("pack_label")
    existing_base_unit = data.get("base_unit")

    if existing_pack_label and existing_base_unit:
        return None, None

    pack_size = data.get("pack_size") or 1
    legacy_unit = data.get("unit")
    base_unit_label = data.get("base_unit_label")

    if not existing_base_unit:
        # Read order: base_unit_label (set by Phase B) > unit (legacy mixed)
        # > default. Coerce to canonical via normalize_base_unit.
        seed = base_unit_label or legacy_unit or ""
        # We don't know the catalog row's unit_type from the event alone —
        # pick a sensible default based on the seed string.
        base_unit = unit_type_service.normalize_base_unit(seed, None)
    else:
        base_unit = existing_base_unit

    if not existing_pack_label:
        pack_label = unit_type_service.infer_pack_label(legacy_unit, pack_size)
    else:
        pack_label = existing_pack_label

    return pack_label, base_unit


def backfill_events(execute: bool = False, max_docs: Optional[int] = None) -> dict:
    """Walk users/{uid}/purchases/* and fill in pack_label/base_unit.

    Returns counts dict for logging.
    """
    db = _db()
    counts = {"scanned": 0, "updated": 0, "skipped": 0, "errors": 0}

    try:
        # Use collection_group to walk every user's purchases in one query.
        query = db.collection_group("purchases")
        if max_docs is not None:
            query = query.limit(max_docs)

        for doc in query.stream():
            counts["scanned"] += 1
            data = doc.to_dict() or {}

            if data.get(_EVENT_MARKER):
                counts["skipped"] += 1
                continue

            try:
                pack_label, base_unit = _infer_event_fields(data)
                update = {_EVENT_MARKER: True}
                if pack_label and not data.get("pack_label"):
                    update["pack_label"] = pack_label
                if base_unit and not data.get("base_unit"):
                    update["base_unit"] = base_unit

                if execute:
                    doc.reference.update(update)
                counts["updated"] += 1
            except Exception:
                logger.exception("backfill_events: failed on doc=%s", doc.reference.path)
                counts["errors"] += 1

    except Exception:
        logger.exception("backfill_events: collection_group walk failed")
        counts["errors"] += 1

    return counts


def backfill_catalog(execute: bool = False, max_docs: Optional[int] = None) -> dict:
    """Walk catalog_entries/* and coerce unit_type="container" → "count"."""
    db = _db()
    counts = {"scanned": 0, "updated": 0, "skipped": 0, "errors": 0}

    try:
        query = db.collection("catalog_entries")
        if max_docs is not None:
            query = query.limit(max_docs)

        for doc in query.stream():
            counts["scanned"] += 1
            data = doc.to_dict() or {}

            if data.get(_CATALOG_MARKER):
                counts["skipped"] += 1
                continue

            try:
                update = {_CATALOG_MARKER: True}
                if data.get("unit_type") == "container":
                    update["unit_type"] = "count"
                if execute:
                    doc.reference.update(update)
                counts["updated"] += 1
            except Exception:
                logger.exception("backfill_catalog: failed on doc=%s", doc.reference.path)
                counts["errors"] += 1

    except Exception:
        logger.exception("backfill_catalog: walk failed")
        counts["errors"] += 1

    return counts


def run(execute: bool = False, max_docs: Optional[int] = None) -> dict:
    """Top-level entry point. Returns merged counts."""
    logger.info(
        "backfill_pack_label_base_unit start execute=%s max_docs=%s",
        execute, max_docs,
    )
    event_counts = backfill_events(execute=execute, max_docs=max_docs)
    catalog_counts = backfill_catalog(execute=execute, max_docs=max_docs)

    summary = {
        "events": event_counts,
        "catalog": catalog_counts,
        "executed": execute,
    }
    logger.info("backfill_pack_label_base_unit done summary=%s", summary)
    return summary


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute", action="store_true",
                        help="Apply writes (default: dry run)")
    parser.add_argument("--limit", type=int, default=None,
                        help="Max docs per collection scan")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    # Load Firebase Admin SDK + env (mirrors main.py init).
    from app.core.config import settings  # noqa: F401  (triggers env load)
    import firebase_admin
    if not firebase_admin._apps:
        firebase_admin.initialize_app()

    summary = run(execute=args.execute, max_docs=args.limit)
    print(summary)
    sys.exit(0 if summary["events"]["errors"] == 0 and summary["catalog"]["errors"] == 0 else 1)


if __name__ == "__main__":
    main()
