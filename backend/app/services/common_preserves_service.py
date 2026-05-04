"""Common preserves catalog — curated, generic preservation templates.

Cross-user collection of generic preserve recipes (kimchi, sauerkraut,
quick-pickles, jam, etc.) the preppers feature uses as defaults when a
user starts a batch from a known preset. Mirrors the common-ingredients
collection pattern: top-level Firestore, doc id = name_norm, no barcode,
no per-user state, doesn't count against any user's quota.

Each entry carries default `ready_after_hours` and `shelf_life_days` so
a user starting "kimchi" doesn't have to type those numbers — they can
always override per batch.

Read pattern: full-list dump per /preppers page load. Seed is small
(~25-30 entries), kept in memory client-side after first fetch.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from firebase_admin import firestore

logger = logging.getLogger(__name__)

_COLLECTION = "common_preserves"
SCHEMA_VERSION = 1
# Bump SEED_VERSION whenever the SHAPE of seed data changes (new fields,
# revised defaults, new entries) so the startup hook re-upserts. The
# stored version lives in `common_preserves/_meta`. SCHEMA_VERSION stays
# stable across reseeds (it's the per-document schema, not the seed
# campaign).
#
# Version history:
#   1 — P2 initial seed (31 entries, no ingredients field)
#   2 — P11 added `ingredients` lists per entry
#   3 — P13 added `source` citation field per entry (NCHFP/Ball/Katz/USDA)
SEED_VERSION = 3
_META_DOC_ID = "_meta"

VALID_PREP_TYPES = {
    "ferment",   # kimchi, sauerkraut, kombucha, miso
    "cure",      # bacon, gravlax, salt-cured
    "freeze",    # batch-cooked stews, freezer meals
    "can",       # canned tomatoes, jams in jars (water-bath / pressure)
    "dry",       # dried mushrooms, herbs, jerky
    "pickle",    # quick-pickles in vinegar (different from ferment)
    "jam",       # jams + chutneys
    "infuse",    # infused oils, vinegars, syrups
}


def _db():
    return firestore.client()


def get(name_norm: str) -> Optional[Dict[str, Any]]:
    if not name_norm:
        return None
    doc = _db().collection(_COLLECTION).document(name_norm).get()
    if not doc.exists:
        return None
    data = doc.to_dict() or {}
    data["name_norm"] = doc.id
    return data


def list_all() -> List[Dict[str, Any]]:
    """Return every common preserve as a flat list. Cheap full-collection
    scan — the seed is small (~25-30 entries). The `_meta` version doc
    is filtered out (it's not a preserve)."""
    out: List[Dict[str, Any]] = []
    for doc in _db().collection(_COLLECTION).stream():
        if doc.id == _META_DOC_ID:
            continue
        data = doc.to_dict() or {}
        data["name_norm"] = doc.id
        out.append(data)
    return out


def get_seeded_version() -> int:
    """Return the SEED_VERSION the collection was last seeded with.
    0 if never seeded (or pre-versioning)."""
    doc = _db().collection(_COLLECTION).document(_META_DOC_ID).get()
    if not doc.exists:
        return 0
    return int((doc.to_dict() or {}).get("seeded_version", 0))


def set_seeded_version(version: int) -> None:
    """Mark the collection as seeded with the given version."""
    _db().collection(_COLLECTION).document(_META_DOC_ID).set({
        "seeded_version": int(version),
        "updated_at": datetime.now(timezone.utc),
    })


def upsert(
    name_norm: str,
    display_name: str,
    prep_type: str,
    default_ready_after_hours: int,
    default_shelf_life_days: int,
    description: str = "",
    ingredients: Optional[List[str]] = None,
    source: str = "judgment",
) -> Dict[str, Any]:
    """Idempotent create-or-merge. Used by the seed script.

    `source` is the citation per `.claude/docs/preppers_principles.md` P4
    — one of "nchfp" | "ball" | "katz" | "usda" | "judgment". Future
    audits can grep for "judgment" entries to find what still needs
    primary-source verification.
    """
    if not name_norm:
        raise ValueError("name_norm is required")
    if prep_type not in VALID_PREP_TYPES:
        raise ValueError(f"invalid prep_type {prep_type!r}; must be one of {sorted(VALID_PREP_TYPES)}")
    db = _db()
    ref = db.collection(_COLLECTION).document(name_norm)
    snap = ref.get()
    now = datetime.now(timezone.utc)
    payload = {
        "display_name": display_name,
        "prep_type": prep_type,
        "default_ready_after_hours": int(default_ready_after_hours),
        "default_shelf_life_days": int(default_shelf_life_days),
        "description": description,
        "ingredients": ingredients or [],
        "source": source,
        "updated_at": now,
        "schema_version": SCHEMA_VERSION,
    }
    if snap.exists:
        ref.update(payload)
    else:
        payload.update({
            "name_norm": name_norm,
            "created_at": now,
        })
        ref.set(payload)
    return {"name_norm": name_norm, "created": not snap.exists}


def is_seeded() -> bool:
    """True when ANY preserve doc exists. Doesn't consider version — use
    `get_seeded_version()` to check whether a re-seed is required."""
    for doc in _db().collection(_COLLECTION).limit(2).stream():
        if doc.id != _META_DOC_ID:
            return True
    return False
