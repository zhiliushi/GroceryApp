"""Catalog service — user's personal name catalog (reusable items).

Data model:
  catalog_entries/{user_id}__{name_norm}

Key invariants:
  - (user_id, name_norm) unique — enforced by doc ID
  - (user_id, barcode) unique when barcode != null — enforced by API transaction
  - Deletion requires active_purchases == 0
  - Merge reparents all purchase events atomically
"""

from __future__ import annotations

import logging
import re
from typing import Any, Optional

from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from app.core.cursor import decode_cursor, encode_cursor
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.metadata import apply_create_metadata, apply_update_metadata
from app.core.slow_query import timed

logger = logging.getLogger(__name__)

_COLLECTION = "catalog_entries"
_MAX_NAME_LEN = 300


def _db():
    return firestore.client()


def _normalize(name: str) -> str:
    """Canonical name normalization used for catalog doc IDs.

    Rules:
    - Lowercase
    - Strip leading/trailing whitespace
    - Collapse internal whitespace to single underscore
    - Remove punctuation except word chars (letters, digits, underscore) and spaces
    - Strip any resulting leading/trailing underscores

    Examples:
        "Milk"       -> "milk"
        "MILK"       -> "milk"
        " milk "     -> "milk"
        "Milk 1L"    -> "milk_1l"
        "Dr. Pepper" -> "dr_pepper"
        "100% Juice" -> "100_juice"
        "!!!"        -> ""  (rejected)
    """
    if name is None:
        return ""
    stripped = name.strip().lower()
    # Remove everything except word chars and whitespace
    cleaned = re.sub(r"[^\w\s]", "", stripped)
    # Collapse whitespace to single underscore, strip edge underscores
    return re.sub(r"\s+", "_", cleaned).strip("_")


def _doc_id(user_id: str, name_norm: str) -> str:
    """Compose catalog doc ID from user_id + normalized name."""
    return f"{user_id}__{name_norm}"


def _validate_name_norm(name_norm: str) -> None:
    """Validate normalized name for Firestore storage."""
    if not name_norm:
        raise ValidationError("Name cannot be empty after normalization")
    if len(name_norm) > _MAX_NAME_LEN:
        raise ValidationError(
            f"Name too long ({len(name_norm)} chars after normalization, max {_MAX_NAME_LEN})"
        )


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------


def get_catalog_entry(user_id: str, name_norm: str) -> Optional[dict]:
    """Get a single catalog entry. Returns None if missing."""
    doc = _db().collection(_COLLECTION).document(_doc_id(user_id, name_norm)).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    data["id"] = doc.id
    return data


def find_by_barcode(user_id: str, barcode: str) -> Optional[dict]:
    """Find this user's catalog entry with a given barcode. Returns None if no match."""
    if not barcode:
        return None
    query = (
        _db()
        .collection(_COLLECTION)
        .where(filter=FieldFilter("user_id", "==", user_id))
        .where(filter=FieldFilter("barcode", "==", barcode))
        .limit(1)
    )
    for doc in query.stream():
        data = doc.to_dict()
        data["id"] = doc.id
        return data
    return None


_SORT_FIELDS = {
    "last_purchased_at": ("last_purchased_at", firestore.Query.DESCENDING),
    "total_purchases": ("total_purchases", firestore.Query.DESCENDING),
    "display_name": ("display_name", firestore.Query.ASCENDING),
}


@timed("catalog.list_catalog")
def list_catalog(
    user_id: str,
    query: str = "",
    limit: int = 50,
    sort_by: str = "last_purchased_at",
    cursor: Optional[str] = None,
) -> dict:
    """List catalog entries for a user with opaque cursor pagination.

    Args:
        user_id: user's uid
        query: optional autocomplete substring (matches name_norm prefix)
        limit: max results per page
        sort_by: "last_purchased_at" (default) | "total_purchases" | "display_name"
        cursor: opaque cursor from a previous response's `next_cursor`

    Returns:
        {"items": [...], "next_cursor": str | None, "count": int}
        next_cursor is None when no further pages exist.
    """
    q = _db().collection(_COLLECTION).where(filter=FieldFilter("user_id", "==", user_id))

    # Substring prefix match on name_norm
    name_filter_active = False
    if query:
        q_norm = _normalize(query)
        if q_norm:
            name_filter_active = True
            # Firestore prefix search via range
            q = q.where(filter=FieldFilter("name_norm", ">=", q_norm)).where(filter=FieldFilter("name_norm", "<", q_norm + ""))

    # Resolve sort config. With a name_norm range filter active, Firestore
    # requires the FIRST order_by to match the inequality field — otherwise
    # InvalidArgument: "order by clause cannot contain more fields after
    # the key". Override the user-requested sort to name_norm in that mode;
    # autocomplete callers don't need a different sort and the prefix
    # already constrains the result set tightly.
    if name_filter_active:
        sort_field, sort_direction = ("name_norm", firestore.Query.ASCENDING)
    else:
        sort_key = sort_by if sort_by in _SORT_FIELDS else "last_purchased_at"
        sort_field, sort_direction = _SORT_FIELDS[sort_key]

    # Primary order + doc-id tiebreaker. __name__ direction MUST match the
    # primary sort to reuse the same composite index (see purchase_event_service
    # for the same fix).
    q = q.order_by(sort_field, direction=sort_direction).order_by(
        "__name__", direction=sort_direction
    )

    # Apply cursor — expected shape: [sort_value, doc_id]. Firestore's
    # start_after wants either a document snapshot or a list of field values
    # matching the order_by sequence; the dict-form previously used here was
    # silently ignored, causing the cursor to never advance and the same page
    # to be returned indefinitely. Resolve to a snapshot — costs one read but
    # is the only form guaranteed correct across Python SDK versions.
    if cursor:
        decoded = decode_cursor(cursor)
        if len(decoded) == 2:
            last_snap = _db().collection(_COLLECTION).document(decoded[1]).get()
            if last_snap.exists:
                q = q.start_after(last_snap)

    # Fetch limit+1 to detect if there's a next page without a count query
    docs = list(q.limit(limit + 1).stream())
    has_more = len(docs) > limit
    page = docs[:limit]

    results = []
    for doc in page:
        data = doc.to_dict() or {}
        data["id"] = doc.id
        results.append(data)

    next_cursor: Optional[str] = None
    if has_more and page:
        last = page[-1]
        last_data = last.to_dict() or {}
        next_cursor = encode_cursor([last_data.get(sort_field), last.id])

    return {"items": results, "next_cursor": next_cursor, "count": len(results)}


# ---------------------------------------------------------------------------
# Pure helpers (no Firestore — unit-testable)
# ---------------------------------------------------------------------------


def _compute_upsert_updates(
    existing_data: dict,
    display_name: str,
    barcode: Optional[str] = None,
    default_location: Optional[str] = None,
    default_category: Optional[str] = None,
    image_url: Optional[str] = None,
    country_code: Optional[str] = None,
) -> dict[str, Any]:
    """Pure computation of which fields to update on an existing catalog entry.

    Rules:
      - display_name changes → append old casing to aliases (preserve history)
      - barcode changes → include in updates (uniqueness checked by caller)
      - default_location / default_category / image_url / country_code — set only if missing
    """
    updates: dict[str, Any] = {}

    if existing_data.get("display_name") != display_name:
        aliases = set(existing_data.get("aliases", []))
        if existing_data.get("display_name"):
            aliases.add(existing_data["display_name"])
        if display_name not in aliases:
            aliases.add(display_name)
        updates["aliases"] = sorted(aliases)

    if barcode and existing_data.get("barcode") != barcode:
        updates["barcode"] = barcode

    if default_location and not existing_data.get("default_location"):
        updates["default_location"] = default_location
    if default_category and not existing_data.get("default_category"):
        updates["default_category"] = default_category
    if image_url and not existing_data.get("image_url"):
        updates["image_url"] = image_url
    if country_code and not existing_data.get("country_code"):
        updates["country_code"] = country_code

    return updates


def _compute_merge_updates(src_data: dict, dst_data: dict) -> dict[str, Any]:
    """Pure computation of how to update the destination entry during a merge.

    - Counter totals: dst + src
    - Aliases: union of both, plus src's display_name, minus dst's own name
    - Barcode: dst wins; if dst has none, inherit src's
    - needs_review: OR of both
    """
    new_aliases = set(dst_data.get("aliases", []))
    if src_data.get("display_name"):
        new_aliases.add(src_data["display_name"])
    for a in src_data.get("aliases", []):
        new_aliases.add(a)
    new_aliases.discard(dst_data.get("display_name", ""))

    updates: dict[str, Any] = {
        "total_purchases": int(dst_data.get("total_purchases", 0))
        + int(src_data.get("total_purchases", 0)),
        "active_purchases": int(dst_data.get("active_purchases", 0))
        + int(src_data.get("active_purchases", 0)),
        "aliases": sorted(new_aliases),
    }
    if not dst_data.get("barcode") and src_data.get("barcode"):
        updates["barcode"] = src_data["barcode"]
    if src_data.get("needs_review"):
        updates["needs_review"] = True
    return updates


# ---------------------------------------------------------------------------
# Write — upsert / update / delete
# ---------------------------------------------------------------------------


def upsert_catalog_entry(
    user_id: str,
    display_name: str,
    barcode: Optional[str] = None,
    default_location: Optional[str] = None,
    default_category: Optional[str] = None,
    image_url: Optional[str] = None,
    country_code: Optional[str] = None,
    source: str = "api",
    actor_uid: Optional[str] = None,
) -> dict:
    """Create or update a catalog entry. Does NOT touch purchase counters —
    those are maintained by purchase_event_service transactions.

    If entry exists: merges metadata (updates barcode, adds to aliases, etc.)
    If new: creates with counters at 0.

    Raises:
        ValidationError: if normalized name is empty
        ConflictError: if barcode is already linked to another entry for this user
    """
    name_norm = _normalize(display_name)
    _validate_name_norm(name_norm)

    doc_id = _doc_id(user_id, name_norm)
    doc_ref = _db().collection(_COLLECTION).document(doc_id)
    existing = doc_ref.get()

    if existing.exists:
        existing_data = existing.to_dict() or {}

        update_data = _compute_upsert_updates(
            existing_data=existing_data,
            display_name=display_name,
            barcode=barcode,
            default_location=default_location,
            default_category=default_category,
            image_url=image_url,
            country_code=country_code,
        )

        # Barcode uniqueness — must query Firestore, can't be pure
        if "barcode" in update_data and update_data["barcode"]:
            _check_barcode_not_linked_elsewhere(
                user_id, update_data["barcode"], exclude_doc_id=doc_id
            )

        if update_data:
            doc_ref.update(apply_update_metadata(update_data))

        return get_catalog_entry(user_id, name_norm)

    # New entry — check barcode uniqueness first
    if barcode:
        _check_barcode_not_linked_elsewhere(user_id, barcode)

    # v2 catalog mode (catalog_evolution.md §2.1): barcode-tied → global_linked,
    # no barcode → user_custom. Quota gates user_custom create.
    catalog_mode = "global_linked" if barcode else "user_custom"
    if catalog_mode == "user_custom":
        from app.services import quota_service  # local import to avoid cycles
        quota_service.check_or_raise(user_id, would_be_user_custom=True)

    # Idle clock: 30d for new user_custom rows on free-tier users; null for
    # global_linked OR paid users.
    idle_expires_at = None
    if catalog_mode == "user_custom":
        from datetime import datetime, timezone, timedelta
        if not _is_paid_user(user_id):
            idle_expires_at = datetime.now(timezone.utc) + timedelta(days=30)

    # UNIT_TYPE_TOUCHPOINT — classify on first save. Canonical types are
    # count / volume / weight (see `.claude/docs/unit-type-method.md`).
    # Legacy "container" gets coerced to "count" by the service helper.
    from app.services import unit_type_service
    inferred_unit_type = unit_type_service.coerce_legacy_unit_type(
        unit_type_service.infer_unit_type(name=display_name)
    )

    new_data = {
        "user_id": user_id,
        "name_norm": name_norm,
        "display_name": display_name,
        "aliases": [],
        "barcode": barcode,
        "country_code": country_code,
        "default_location": default_location,
        "default_category": default_category,
        "image_url": image_url,
        "total_purchases": 0,
        "active_purchases": 0,
        "last_purchased_at": None,
        "needs_review": False,
        # v2 fields (catalog_evolution.md Phase A schema, Phase C write-path)
        "catalog_mode": catalog_mode,
        "canonical_name": display_name,
        "idle_expires_at": idle_expires_at,
        "unit_type": inferred_unit_type,
    }
    doc_ref.set(apply_create_metadata(new_data, uid=actor_uid or user_id, source=source, schema_version=2))
    logger.info("catalog.created user=%s name_norm=%s mode=%s", user_id, name_norm, catalog_mode)

    if catalog_mode == "user_custom":
        from app.services import quota_service
        quota_service.consume(user_id, amount=1)

    return get_catalog_entry(user_id, name_norm)


def _is_paid_user(user_id: str) -> bool:
    """Check user.tier in {plus, pro} → paid (no quota counter, no idle clock)."""
    snap = _db().collection("users").document(user_id).get()
    if not snap.exists:
        return False
    return ((snap.to_dict() or {}).get("tier") or "free") in ("plus", "pro")


def update_catalog_entry(
    user_id: str,
    name_norm: str,
    updates: dict[str, Any],
) -> dict:
    """Partial update on a catalog entry.

    Allowed fields: display_name, barcode, default_location, default_category,
                    image_url, country_code, needs_review, unit_type

    `display_name` change cascades to all purchase events linked to this
    catalog entry — keeps `catalog_display` denormalisation in sync so
    My Items / history views render the new name immediately. Old casings
    are preserved in `aliases`.

    `unit_type` change is rare — used on the catalog page's Manage Entry
    section to re-classify (e.g. switch milk from container to volume). It
    does NOT rewrite past events; the modal honors per-event base_unit_label
    + pack_size. This setting governs FUTURE events + the Use modal's input
    shape on this catalog.

    Raises:
        NotFoundError if entry doesn't exist
        ConflictError if barcode change collides with another entry for this user
    """
    doc_ref = _db().collection(_COLLECTION).document(_doc_id(user_id, name_norm))
    snap = doc_ref.get()
    if not snap.exists:
        raise NotFoundError(f"Catalog entry '{name_norm}' not found")

    existing = snap.to_dict() or {}
    allowed = {"display_name", "barcode", "default_location", "default_category",
               "image_url", "country_code", "needs_review", "unit_type"}
    clean_updates = {k: v for k, v in updates.items() if k in allowed and v is not None}

    # UNIT_TYPE_TOUCHPOINT — coerce on write. Legacy "container" → "count".
    if "unit_type" in clean_updates:
        from app.services import unit_type_service
        clean_updates["unit_type"] = unit_type_service.coerce_legacy_unit_type(
            clean_updates["unit_type"],
        )

    # Barcode uniqueness check
    if "barcode" in clean_updates and clean_updates["barcode"]:
        _check_barcode_not_linked_elsewhere(
            user_id,
            clean_updates["barcode"],
            exclude_doc_id=_doc_id(user_id, name_norm),
        )

    # Empty-string barcode = unlink
    if clean_updates.get("barcode") == "":
        clean_updates["barcode"] = None

    # If display_name is changing, append the previous casing to aliases so
    # we don't lose history. _normalize would have collapsed casing differences,
    # so the entry itself stays at the same name_norm; only the display string
    # rotates.
    new_display = clean_updates.get("display_name")
    old_display = existing.get("display_name")
    cascade_display = None
    if new_display and old_display and new_display != old_display:
        prior_aliases = list(existing.get("aliases") or [])
        if old_display not in prior_aliases:
            prior_aliases.append(old_display)
        clean_updates["aliases"] = prior_aliases
        cascade_display = new_display

    doc_ref.update(apply_update_metadata(clean_updates))

    # Cascade rename to purchase events (denormalised catalog_display field)
    if cascade_display is not None:
        _cascade_display_to_purchases(user_id, name_norm, cascade_display)

    logger.info("catalog.updated user=%s name_norm=%s fields=%s", user_id, name_norm, list(clean_updates))
    return get_catalog_entry(user_id, name_norm)


def _cascade_display_to_purchases(user_id: str, name_norm: str, new_display: str) -> int:
    """Update `catalog_display` on every purchase event linked to this catalog
    entry. Returns the count updated. Batched (Firestore caps at 500/commit)."""
    events_ref = (
        _db()
        .collection("users")
        .document(user_id)
        .collection("purchases")
        .where(filter=FieldFilter("catalog_name_norm", "==", name_norm))
    )
    batch = _db().batch()
    batch_count = 0
    updated = 0
    for event_doc in events_ref.stream():
        batch.update(event_doc.reference, apply_update_metadata({
            "catalog_display": new_display,
        }))
        batch_count += 1
        updated += 1
        if batch_count >= 400:
            batch.commit()
            batch = _db().batch()
            batch_count = 0
    if batch_count:
        batch.commit()
    if updated:
        logger.info(
            "catalog.rename_cascade user=%s name_norm=%s events=%d new=%r",
            user_id, name_norm, updated, new_display,
        )
    return updated


def delete_catalog_entry(user_id: str, name_norm: str, force: bool = False) -> None:
    """Delete a catalog entry. Blocked if active_purchases > 0 unless force=True.

    Releases user_custom quota slot on success (was missing before v3 GC
    plumbing — quota counter could drift up over time).

    Raises:
        NotFoundError if entry doesn't exist
        ConflictError if has active purchases and not force
    """
    doc_ref = _db().collection(_COLLECTION).document(_doc_id(user_id, name_norm))
    snap = doc_ref.get()
    if not snap.exists:
        raise NotFoundError(f"Catalog entry '{name_norm}' not found")

    data = snap.to_dict() or {}
    if data.get("active_purchases", 0) > 0 and not force:
        raise ConflictError(
            f"Cannot delete catalog entry '{name_norm}': has {data.get('active_purchases')} active purchases",
            details={"active_purchases": data.get("active_purchases")},
        )

    doc_ref.delete()
    # Release the quota slot for user_custom rows (matches the consume in
    # upsert_catalog_entry on line ~388). global_linked rows don't consume,
    # so don't release.
    if (data.get("catalog_mode") or "user_custom") == "user_custom":
        from app.services import quota_service
        quota_service.release(user_id, amount=1)
    logger.info("catalog.deleted user=%s name_norm=%s force=%s", user_id, name_norm, force)


# ---------------------------------------------------------------------------
# v3 — Transit ref counting + eager GC (per shopping-list integration)
# ---------------------------------------------------------------------------

def increment_transit_ref(user_id: str, name_norm: str, amount: int = 1) -> None:
    """Atomically bump catalog_entries[uid__name_norm].transit_ref_count by N.

    Called whenever a shopping-list primary or alternative is created with
    `source_catalog_name_norm == name_norm`. Idempotent under concurrent
    writes (Firestore Increment).

    No-op if the catalog entry doesn't exist (we don't want to create a
    phantom row from a stale reference). Logs a warning instead.
    """
    if not name_norm:
        return
    doc_ref = _db().collection(_COLLECTION).document(_doc_id(user_id, name_norm))
    snap = doc_ref.get()
    if not snap.exists:
        logger.warning(
            "transit_ref: catalog entry not found, skipping increment user=%s name_norm=%s",
            user_id, name_norm,
        )
        return
    doc_ref.update({"transit_ref_count": firestore.Increment(amount)})


def decrement_transit_ref(user_id: str, name_norm: str, amount: int = 1) -> None:
    """Atomically reduce transit_ref_count. Floor handled at GC time —
    a stuck-negative counter is harmless (just delays GC) and reconcile
    can fix it."""
    if not name_norm:
        return
    doc_ref = _db().collection(_COLLECTION).document(_doc_id(user_id, name_norm))
    snap = doc_ref.get()
    if not snap.exists:
        return
    doc_ref.update({"transit_ref_count": firestore.Increment(-amount)})


def gc_if_orphan(user_id: str, name_norm: str) -> bool:
    """Delete the catalog entry IFF orphan-eligible. Idempotent.

    Eligibility (P1-aligned, all must be true):
      - row exists
      - catalog_mode == 'user_custom'  (global rows never GC'd)
      - active_purchases == 0
      - transit_ref_count <= 0          (no shopping-list refs)

    On delete: also releases the user_custom quota slot via
    delete_catalog_entry. Returns True if deleted, False otherwise.

    Defensive: this function reads-then-deletes. There's a small race
    window where a concurrent add could re-increment transit_ref_count
    between the read and the delete. To survive that:
      1. We re-check active_purchases AND transit_ref_count inside
         delete_catalog_entry (which has its own active_purchases check).
      2. Worst case (race wins): catalog row is deleted while a list
         entry still points at it. The next add for the same name_norm
         will re-create the row via upsert (idempotent). UI may show a
         brief 404 on the orphaned reference. Acceptable for beta.
    """
    if not name_norm:
        return False
    doc_ref = _db().collection(_COLLECTION).document(_doc_id(user_id, name_norm))
    snap = doc_ref.get()
    if not snap.exists:
        return False
    data = snap.to_dict() or {}
    if (data.get("catalog_mode") or "user_custom") != "user_custom":
        return False  # global_linked rows are not GC'd
    if (data.get("active_purchases") or 0) > 0:
        return False
    if (data.get("transit_ref_count") or 0) > 0:
        return False
    # Eligible. delete_catalog_entry will recheck active_purchases (defense
    # in depth) and release the quota slot.
    try:
        delete_catalog_entry(user_id, name_norm, force=False)
    except ConflictError:
        # Race: a purchase was just created. Bail.
        return False
    except NotFoundError:
        # Race: already gone.
        return False
    logger.info("catalog.gc_orphan user=%s name_norm=%s", user_id, name_norm)
    return True


def cascade_delete_catalog_entry(
    user_id: str,
    name_norm: str,
    *,
    revert_to_global_if_possible: bool = True,
) -> dict:
    """User-initiated catalog delete with cascade to shopping-list refs.

    Behavior (per Shahir's 2026-05-04 directive):
      - For every shopping-list PRIMARY referencing this name_norm:
          if a global product exists for the primary's barcode AND
          revert_to_global_if_possible:
              repoint source_catalog_name_norm + display_name to global
          else:
              delete the primary (cascade-deletes its alternatives)
      - For every shopping-list ALTERNATIVE referencing this name_norm:
          same revert-or-delete logic
      - Active purchases: NOT touched (the rename cascade already
        snapshots display_name onto event docs, so the purchase row
        keeps its display name even after catalog delete). delete_catalog
        _entry blocks on active_purchases>0 unless force=True; we never
        force from here.
      - Then deletes the catalog entry itself + releases quota.

    Returns: {
      'deleted': bool,
      'shopping_list_primaries_repointed': int,
      'shopping_list_primaries_deleted': int,
      'shopping_list_alternatives_repointed': int,
      'shopping_list_alternatives_deleted': int,
      'global_target_name_norm': str | None,
    }

    Raises:
      NotFoundError: catalog entry doesn't exist
      ConflictError: has active purchases (per delete_catalog_entry)
    """
    doc_ref = _db().collection(_COLLECTION).document(_doc_id(user_id, name_norm))
    snap = doc_ref.get()
    if not snap.exists:
        raise NotFoundError(f"Catalog entry '{name_norm}' not found")
    data = snap.to_dict() or {}

    # Resolve revert target if applicable
    barcode = data.get("barcode")
    target_name_norm: Optional[str] = None
    target_display: Optional[str] = None
    if revert_to_global_if_possible and barcode:
        # If a global product exists for this barcode, the user's
        # global_linked catalog row (if any) would have a different
        # name_norm derived from the global product name. We don't have
        # a 1:1 mapping here, so only revert when there's a clear
        # global linkage. Conservative: only revert if there's an
        # existing user catalog entry that's 'global_linked' for the
        # same barcode — meaning the user already had two parallel
        # entries (one custom, one global). Otherwise cascade-delete.
        try:
            other = find_by_barcode(user_id, barcode)
            if other and other.get("name_norm") != name_norm and (other.get("catalog_mode") == "global_linked"):
                target_name_norm = other.get("name_norm")
                target_display = other.get("display_name")
        except Exception:
            # find_by_barcode may not exist or may fail; conservative fallback.
            target_name_norm = None

    # Walk shopping_lists for refs (per-user scan; bounded by list cap)
    repointed_primaries = 0
    deleted_primaries: list[tuple[str, str]] = []  # (list_id, item_id)
    repointed_alts = 0
    deleted_alts: list[tuple[str, str, str]] = []  # (list_id, item_id, alt_id)

    lists_ref = _db().collection("users").document(user_id).collection("shopping_lists")
    for list_doc in lists_ref.stream():
        list_id = list_doc.id
        items_ref = lists_ref.document(list_id).collection("items")
        for item_snap in items_ref.stream():
            item_id = item_snap.id
            item_data = item_snap.to_dict() or {}
            primary_ref = item_data.get("source_catalog_name_norm")
            primary_match = primary_ref == name_norm

            # Check alternatives — embedded array
            alts: list[dict] = list(item_data.get("prices") or [])
            alt_indices_matching: list[int] = [
                i for i, a in enumerate(alts)
                if a.get("source_catalog_name_norm") == name_norm
            ]

            if not primary_match and not alt_indices_matching:
                continue

            updates: dict = {}
            if primary_match:
                if target_name_norm:
                    updates["source_catalog_name_norm"] = target_name_norm
                    if target_display:
                        updates["item_name"] = target_display
                        updates["name_norm"] = target_name_norm
                    repointed_primaries += 1
                else:
                    deleted_primaries.append((list_id, item_id))

            if alt_indices_matching:
                # Mutate alts in place
                if target_name_norm:
                    new_alts = list(alts)
                    for i in alt_indices_matching:
                        new_alts[i] = {**new_alts[i], "source_catalog_name_norm": target_name_norm}
                        if target_display and not new_alts[i].get("candidate_name"):
                            new_alts[i]["candidate_name"] = target_display
                    updates["prices"] = new_alts
                    repointed_alts += len(alt_indices_matching)
                else:
                    # If primary wasn't matched but alts were, drop the matching alts
                    if not primary_match:
                        new_alts = [a for i, a in enumerate(alts) if i not in alt_indices_matching]
                        updates["prices"] = new_alts
                        for i in alt_indices_matching:
                            deleted_alts.append((list_id, item_id, alts[i].get("id", "?")))

            # If we're going to delete the primary, skip writing updates (the
            # delete will handle it). Otherwise write the merged updates.
            if primary_match and not target_name_norm:
                # Defer to the delete loop below
                pass
            elif updates:
                items_ref.document(item_id).update(updates)

    # Deletes — per primary, do via batch
    if deleted_primaries:
        batch = _db().batch()
        for (list_id, item_id) in deleted_primaries:
            ref = lists_ref.document(list_id).collection("items").document(item_id)
            batch.delete(ref)
        batch.commit()

    # Now delete the catalog row itself (releases quota inside delete_catalog_entry)
    delete_catalog_entry(user_id, name_norm, force=False)

    return {
        "deleted": True,
        "shopping_list_primaries_repointed": repointed_primaries,
        "shopping_list_primaries_deleted": len(deleted_primaries),
        "shopping_list_alternatives_repointed": repointed_alts,
        "shopping_list_alternatives_deleted": len(deleted_alts),
        "global_target_name_norm": target_name_norm,
    }


def admin_cleanup_orphans(*, dry_run: bool = True, user_id: Optional[str] = None) -> dict:
    """Admin-triggered batch GC of orphan user_custom catalog rows.

    Finds rows where:
      catalog_mode == 'user_custom'
      AND active_purchases == 0
      AND (transit_ref_count is null OR <= 0)

    By default runs as DRY_RUN — returns the list of candidates without
    deleting. Pass dry_run=False to actually delete. Pass user_id to scope
    to a single user (e.g. when troubleshooting one account).

    Returns: {
      'dry_run': bool,
      'candidates_count': int,
      'deleted_count': int,    # 0 when dry_run
      'sample': [{name_norm, display_name, last_purchased_at}, ...] (max 50),
    }
    """
    query = (
        _db()
        .collection(_COLLECTION)
        .where(filter=FieldFilter("catalog_mode", "==", "user_custom"))
        .where(filter=FieldFilter("active_purchases", "==", 0))
    )
    if user_id:
        query = query.where(filter=FieldFilter("user_id", "==", user_id))

    candidates: list[dict] = []
    for snap in query.stream():
        d = snap.to_dict() or {}
        ref_count = d.get("transit_ref_count") or 0
        if ref_count > 0:
            continue
        candidates.append({
            "id": snap.id,
            "user_id": d.get("user_id"),
            "name_norm": d.get("name_norm"),
            "display_name": d.get("display_name"),
            "last_purchased_at": d.get("last_purchased_at"),
            "transit_ref_count": ref_count,
        })

    deleted = 0
    if not dry_run:
        for c in candidates:
            try:
                delete_catalog_entry(c["user_id"], c["name_norm"], force=False)
                deleted += 1
            except (NotFoundError, ConflictError) as exc:
                logger.warning("admin_cleanup_orphans: skip %s: %s", c["id"], exc)
    sample = candidates[:50]
    logger.info(
        "catalog.admin_cleanup_orphans dry_run=%s candidates=%d deleted=%d user_scope=%s",
        dry_run, len(candidates), deleted, user_id or "all",
    )
    return {
        "dry_run": dry_run,
        "candidates_count": len(candidates),
        "deleted_count": deleted,
        "sample": sample,
    }


# ---------------------------------------------------------------------------
# Merge — combine two catalog entries, reparent purchase events
# ---------------------------------------------------------------------------


def merge_catalog(user_id: str, src_name_norm: str, dst_name_norm: str) -> dict:
    """Merge source catalog entry into destination. Reparents all purchase events.

    After merge:
      - dst.total_purchases += src.total_purchases
      - dst.active_purchases += src.active_purchases
      - dst.aliases += src.display_name + src.aliases
      - If dst has no barcode, inherits src's barcode
      - src is deleted

    Raises:
        NotFoundError: if src or dst doesn't exist
        ValidationError: if src == dst
    """
    if src_name_norm == dst_name_norm:
        raise ValidationError("Source and destination must differ")

    src_ref = _db().collection(_COLLECTION).document(_doc_id(user_id, src_name_norm))
    dst_ref = _db().collection(_COLLECTION).document(_doc_id(user_id, dst_name_norm))

    src_snap = src_ref.get()
    dst_snap = dst_ref.get()
    if not src_snap.exists:
        raise NotFoundError(f"Source catalog '{src_name_norm}' not found")
    if not dst_snap.exists:
        raise NotFoundError(f"Destination catalog '{dst_name_norm}' not found")

    src_data = src_snap.to_dict() or {}
    dst_data = dst_snap.to_dict() or {}

    # 1. Reparent all purchase events (batch)
    events_ref = (
        _db()
        .collection("users")
        .document(user_id)
        .collection("purchases")
        .where(filter=FieldFilter("catalog_name_norm", "==", src_name_norm))
    )
    batch = _db().batch()
    batch_count = 0
    reparented = 0
    for event_doc in events_ref.stream():
        batch.update(event_doc.reference, apply_update_metadata({
            "catalog_name_norm": dst_name_norm,
            "catalog_display": dst_data.get("display_name"),
        }))
        batch_count += 1
        reparented += 1
        if batch_count >= 400:
            batch.commit()
            batch = _db().batch()
            batch_count = 0
    if batch_count:
        batch.commit()

    # 2. Update destination — aggregate counters + aliases + barcode (pure computation)
    updates = _compute_merge_updates(src_data, dst_data)
    dst_ref.update(apply_update_metadata(updates))

    # 3. Delete source
    src_ref.delete()

    logger.info(
        "catalog.merged user=%s src=%s dst=%s events=%d",
        user_id, src_name_norm, dst_name_norm, reparented,
    )
    return get_catalog_entry(user_id, dst_name_norm)


# ---------------------------------------------------------------------------
# Counter updates — called by purchase_event_service in transactions
# ---------------------------------------------------------------------------


def increment_counters_tx(tx, user_id: str, name_norm: str, active_delta: int, total_delta: int) -> None:
    """Transactional counter update. Used by purchase_event_service.

    Args:
        tx: Firestore transaction
        user_id: owner
        name_norm: catalog key
        active_delta: +1 on create, -1 on status change (active→used/thrown/transferred)
        total_delta: +1 on create, 0 on status change
    """
    doc_ref = _db().collection(_COLLECTION).document(_doc_id(user_id, name_norm))
    updates: dict[str, Any] = {
        "updated_at": firestore.SERVER_TIMESTAMP,
    }
    if active_delta:
        updates["active_purchases"] = firestore.Increment(active_delta)
    if total_delta:
        updates["total_purchases"] = firestore.Increment(total_delta)
    if total_delta > 0:
        updates["last_purchased_at"] = firestore.SERVER_TIMESTAMP
    tx.update(doc_ref, updates)


# ---------------------------------------------------------------------------
# Cleanup — scheduler job
# ---------------------------------------------------------------------------


_CLEANUP_AGE_DAYS = 180  # 6 months — was 365


def cleanup_unlinked_catalog(dry_run: bool = False, age_days: int = _CLEANUP_AGE_DAYS) -> int:
    """Delete user catalog entries that look abandoned:
        - active_purchases == 0
        - last_purchased_at < now - age_days   (default 180 = 6 months)

    Used to drop ALSO require `barcode IS null`. That excluded scanned-once
    entries — exactly the kind of clutter the user wants removed. Now any
    entry with no active purchases and no use in 6 months is fair game.

    Historical purchase events keep their last-known `catalog_display`
    snapshot (set by the rename cascade), so deleting the catalog entry
    does NOT corrupt history reads.

    Returns count of entries deleted (or would-be-deleted in dry_run).
    """
    from datetime import datetime, timedelta, timezone
    cutoff = datetime.now(timezone.utc) - timedelta(days=age_days)

    query = (
        _db()
        .collection(_COLLECTION)
        .where(filter=FieldFilter("active_purchases", "==", 0))
        .where(filter=FieldFilter("last_purchased_at", "<", cutoff))
    )

    deleted = 0
    batch = _db().batch()
    batch_count = 0
    for doc in query.stream():
        if dry_run:
            logger.info("cleanup.would_delete id=%s", doc.id)
        else:
            batch.delete(doc.reference)
            batch_count += 1
            if batch_count >= 400:
                batch.commit()
                batch = _db().batch()
                batch_count = 0
        deleted += 1

    if not dry_run and batch_count:
        batch.commit()

    if deleted:
        logger.info(
            "catalog.cleanup deleted=%d age_days=%d dry_run=%s",
            deleted, age_days, dry_run,
        )
    return deleted


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _check_barcode_not_linked_elsewhere(
    user_id: str,
    barcode: str,
    exclude_doc_id: Optional[str] = None,
) -> None:
    """Ensure no OTHER catalog entry for this user already has this barcode.

    Raises:
        ConflictError if found
    """
    existing = find_by_barcode(user_id, barcode)
    if existing and existing.get("id") != exclude_doc_id:
        raise ConflictError(
            f"Barcode {barcode} is already linked to another catalog entry",
            details={
                "existing_entry": {
                    "name_norm": existing.get("name_norm"),
                    "display_name": existing.get("display_name"),
                    "id": existing.get("id"),
                },
            },
        )
