"""Common ingredients catalog — global, curated, generic recipe building blocks.

Distinct from the per-user `catalog_entries` collection (which holds
specific products with prices, expiries, locations) and from the future
global-products pool (barcoded, admin-curated). This collection holds
~150-200 generic ingredient names ("egg", "santan", "kicap manis") used
to auto-link recipe ingredients at write time so cook flows can deduct
matched stock.

Firestore: top-level collection `common_ingredients/{name_norm}`.
- Doc ID == name_norm (kept globally unique by construction)
- No barcode field by design — generic ingredients aren't products
- Doesn't count against any user's quota

Read pattern: full-list dump per recipe save (~150 entries, ~one query)
is cheap; no need for prefix queries.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from firebase_admin import firestore

logger = logging.getLogger(__name__)

_COLLECTION = "common_ingredients"
SCHEMA_VERSION = 1


def _db():
    return firestore.client()


def get(name_norm: str) -> Optional[Dict[str, Any]]:
    """Fetch a single common ingredient by its name_norm (== doc id)."""
    if not name_norm:
        return None
    doc = _db().collection(_COLLECTION).document(name_norm).get()
    if not doc.exists:
        return None
    data = doc.to_dict() or {}
    data["name_norm"] = doc.id
    return data


def list_all() -> List[Dict[str, Any]]:
    """Return every common ingredient as a flat list. Cheap full-collection
    scan — the seed is intentionally small (~150-200 entries)."""
    out: List[Dict[str, Any]] = []
    for doc in _db().collection(_COLLECTION).stream():
        data = doc.to_dict() or {}
        data["name_norm"] = doc.id
        out.append(data)
    return out


def upsert(
    name_norm: str,
    display_name: str,
    default_category: str = "",
    aliases: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Idempotent create-or-merge. Used by the seed script and any future
    admin tooling. Does NOT clobber `created_at` on re-runs — only
    refreshes mutable fields and `updated_at`."""
    if not name_norm:
        raise ValueError("name_norm is required")
    db = _db()
    ref = db.collection(_COLLECTION).document(name_norm)
    snap = ref.get()
    now = datetime.now(timezone.utc)
    if snap.exists:
        ref.update({
            "display_name": display_name,
            "default_category": default_category,
            "aliases": aliases or [],
            "updated_at": now,
            "schema_version": SCHEMA_VERSION,
        })
    else:
        ref.set({
            "name_norm": name_norm,
            "display_name": display_name,
            "default_category": default_category,
            "aliases": aliases or [],
            "created_at": now,
            "updated_at": now,
            "schema_version": SCHEMA_VERSION,
            "source": "seed",
        })
    return {"name_norm": name_norm, "created": not snap.exists}


def is_seeded() -> bool:
    """Cheap probe — true if the collection has any entries.

    Used by the seed script's auto-startup variant to skip work when the
    catalog already exists. Reads only one doc.
    """
    docs = list(_db().collection(_COLLECTION).limit(1).stream())
    return bool(docs)
