"""Shopping list service.

v1 = read-only admin window into legacy mobile-app shopping lists.
v2 = transit list owned by the user. Item TTL 30d, per-list 50-item cap,
quota separate from catalog.
v3 (beta) = primary + alternatives model.
  - 15 primaries per list
  - 3 alternatives per primary
  - Only alternatives are tickable; checkout is the ticked subset.
  - Quota tied to catalog quota (each primary/alternative add follows
    the existing catalog flow; user_custom rows consume `catalog_quota`).
See `.claude/docs/pages/shopping-lists.md`.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any

from firebase_admin import firestore

from app.core.exceptions import (
    NotFoundError,
    QuotaExceededError,
    ValidationError,
)

logger = logging.getLogger(__name__)


def _get_db():
    return firestore.client()


# ---------------------------------------------------------------------------
# v3 constants (beta — see CLAUDE plan: customer-feedback hook will revisit)
# ---------------------------------------------------------------------------

# Per-list cap on PRIMARY items (intent rows). Shopping list quota was
# previously 50 per list; v3 ties to catalog quota for total user count
# but keeps a per-list cap for visual control during beta.
MAX_PRIMARIES_PER_LIST = 15
# Per-primary cap on ALTERNATIVE entries. Each alt is a candidate purchase
# (brand/store/barcode/price). Total max alternatives per list = 15 * 3 = 45.
MAX_ALTERNATIVES_PER_PRIMARY = 3
# Legacy aliases — keep for any external readers; remove after frontend swap
MAX_ITEMS_PER_LIST = MAX_PRIMARIES_PER_LIST
MAX_PRICES_PER_ITEM = MAX_ALTERNATIVES_PER_PRIMARY

ITEM_TTL_DAYS = 30
SCHEMA_VERSION = 3

_ALLOWED_WEIGHT_UNITS = {"g", "kg", "oz", "lb"}
_ALLOWED_VOLUME_UNITS = {"ml", "l", "fl_oz", "cup"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _norm(name: str) -> str:
    """Lowercase + strip — minimal catalog-matching key."""
    return (name or "").strip().lower()


def _new_metadata(uid: str, source: str = "web_admin") -> Dict[str, Any]:
    now = _now_iso()
    return {
        "created_at": now,
        "updated_at": now,
        "schema_version": SCHEMA_VERSION,
        "created_by": uid,
        "source": source,
    }


# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

def get_user_lists(uid: str) -> List[Dict[str, Any]]:
    """Get all shopping lists for a user."""
    db = _get_db()
    results = []
    try:
        for doc in db.collection("users").document(uid).collection("shopping_lists").stream():
            data = doc.to_dict()
            data["id"] = doc.id
            data["user_id"] = uid
            results.append(data)
    except Exception as e:
        logger.warning("Failed to query shopping lists for %s: %s", uid, e)
        return []

    results.sort(key=lambda x: x.get("createdDate", 0), reverse=True)
    return results


def get_household_lists(uid: str) -> List[Dict[str, Any]]:
    """Get shopping lists for a user AND their household members.

    Merges all members' lists. Each list includes member attribution.
    Falls back to get_user_lists() if user has no household.
    """
    from app.services import household_service

    household = household_service.get_user_household(uid)
    if not household:
        return get_user_lists(uid)

    member_uids = household_service.get_household_member_uids(household["id"])
    if not member_uids:
        return get_user_lists(uid)

    member_map = {}
    for m in household.get("members", []):
        member_map[m["uid"]] = {
            "display_name": m.get("display_name", ""),
            "display_role": m.get("display_role", ""),
            "role_icon": m.get("role_icon", ""),
        }

    db = _get_db()
    all_lists: List[Dict[str, Any]] = []

    for member_uid in member_uids:
        try:
            for doc in db.collection("users").document(member_uid).collection("shopping_lists").stream():
                data = doc.to_dict()
                data["id"] = doc.id
                data["user_id"] = member_uid
                info = member_map.get(member_uid, {})
                data["_member_name"] = info.get("display_name", "")
                data["_member_role"] = info.get("display_role", "")
                data["_member_icon"] = info.get("role_icon", "")
                all_lists.append(data)
        except Exception as e:
            logger.warning("Failed to query lists for member %s: %s", member_uid, e)

    all_lists.sort(key=lambda x: x.get("createdDate", 0), reverse=True)
    return all_lists


def get_list_items(uid: str, list_id: str) -> List[Dict[str, Any]]:
    """Get items in a specific shopping list."""
    db = _get_db()
    col = db.collection("users").document(uid).collection("shopping_lists").document(list_id).collection("items")
    results = []
    for doc in col.stream():
        data = doc.to_dict()
        data["id"] = doc.id
        results.append(data)
    return results


def get_all_lists(limit: int = 50) -> List[Dict[str, Any]]:
    """Admin: get lists across all users."""
    db = _get_db()
    results = []

    try:
        users = db.collection("users").select([]).stream()
        for user_doc in users:
            uid = user_doc.id
            for doc in db.collection("users").document(uid).collection("shopping_lists").stream():
                data = doc.to_dict()
                data["id"] = doc.id
                data["user_id"] = uid
                results.append(data)
    except Exception as e:
        logger.warning("Failed to query shopping lists: %s", e)
        return []

    results.sort(key=lambda x: x.get("createdDate", 0), reverse=True)
    return results[:limit]


def get_list(uid: str, list_id: str) -> Optional[Dict[str, Any]]:
    """Get a single shopping list."""
    db = _get_db()
    doc = db.collection("users").document(uid).collection("shopping_lists").document(list_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    data["id"] = doc.id
    data["user_id"] = uid
    return data


def get_list_or_404(uid: str, list_id: str) -> Dict[str, Any]:
    """Read-or-raise. Used by mutation helpers and routes."""
    data = get_list(uid, list_id)
    if not data:
        raise NotFoundError(f"Shopping list {list_id} not found")
    return data


# ---------------------------------------------------------------------------
# v2 — Lists
# ---------------------------------------------------------------------------

def create_list(uid: str, name: str) -> Dict[str, Any]:
    """Create a new shopping list."""
    name = (name or "").strip()
    if not name:
        raise ValidationError("List name is required")
    if len(name) > 80:
        raise ValidationError("List name must be ≤ 80 characters")

    db = _get_db()
    col = db.collection("users").document(uid).collection("shopping_lists")
    doc = col.document()
    payload = {
        "name": name,
        "item_count": 0,
        **_new_metadata(uid),
    }
    doc.set(payload)
    return {"id": doc.id, "user_id": uid, **payload}


def update_list(
    uid: str,
    list_id: str,
    *,
    name: Optional[str] = None,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Update mutable list fields (name, notes).

    Pass `notes=""` to clear; pass `None` to leave unchanged.
    Tier-gating of `notes` (plus only) lives in the frontend via
    useVisibility('trip_notes'); the service stores whatever is sent.
    """
    get_list_or_404(uid, list_id)

    updates: Dict[str, Any] = {"updated_at": _now_iso()}
    if name is not None:
        name = name.strip()
        if not name:
            raise ValidationError("List name cannot be empty")
        if len(name) > 80:
            raise ValidationError("List name must be ≤ 80 characters")
        updates["name"] = name
    if notes is not None:
        if len(notes) > 1000:
            raise ValidationError("Notes must be ≤ 1000 characters")
        updates["notes"] = notes

    db = _get_db()
    db.collection("users").document(uid).collection("shopping_lists").document(list_id).update(updates)
    return get_list_or_404(uid, list_id)


def delete_list(uid: str, list_id: str) -> None:
    """Delete a list and cascade-delete its items.

    Firestore doesn't auto-cascade subcollections; we batch-delete items
    then the list doc. For lists at the 50-item cap this is one batch.
    """
    get_list_or_404(uid, list_id)

    db = _get_db()
    list_ref = db.collection("users").document(uid).collection("shopping_lists").document(list_id)
    items_ref = list_ref.collection("items")

    batch = db.batch()
    n = 0
    for snap in items_ref.stream():
        batch.delete(snap.reference)
        n += 1
        # Firestore batch hard cap = 500 ops; flush early to be safe.
        if n % 400 == 0:
            batch.commit()
            batch = db.batch()
    batch.delete(list_ref)
    batch.commit()


# ---------------------------------------------------------------------------
# v2 — Items
# ---------------------------------------------------------------------------

def _validate_item_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize + validate add/update item payload. Returns cleaned dict.

    Required: item_name (non-empty).
    Optional: quantity, unit, weight_value/weight_unit pair, volume_value/volume_unit pair,
              notes, barcode, source_catalog_name_norm.
    Validation: only ONE of (count+unit, weight, volume) carries dimensional info,
                but we don't reject mixed input — the buy flow chooses one.
    """
    name = (payload.get("item_name") or "").strip()
    if not name:
        raise ValidationError("item_name is required")
    if len(name) > 120:
        raise ValidationError("item_name must be ≤ 120 characters")

    cleaned: Dict[str, Any] = {
        "item_name": name,
        "name_norm": _norm(name),
    }

    if (q := payload.get("quantity")) is not None:
        try:
            qf = float(q)
        except (TypeError, ValueError):
            raise ValidationError("quantity must be a number")
        if qf <= 0:
            raise ValidationError("quantity must be > 0")
        cleaned["quantity"] = qf

    if (u := payload.get("unit")):
        cleaned["unit"] = str(u)[:16]

    wv, wu = payload.get("weight_value"), payload.get("weight_unit")
    if wv is not None or wu is not None:
        if wv is None or wu is None:
            raise ValidationError("weight_value and weight_unit must both be set")
        try:
            wvf = float(wv)
        except (TypeError, ValueError):
            raise ValidationError("weight_value must be a number")
        if wvf <= 0:
            raise ValidationError("weight_value must be > 0")
        if wu not in _ALLOWED_WEIGHT_UNITS:
            raise ValidationError(f"weight_unit must be one of {sorted(_ALLOWED_WEIGHT_UNITS)}")
        cleaned["weight_value"] = wvf
        cleaned["weight_unit"] = wu

    vv, vu = payload.get("volume_value"), payload.get("volume_unit")
    if vv is not None or vu is not None:
        if vv is None or vu is None:
            raise ValidationError("volume_value and volume_unit must both be set")
        try:
            vvf = float(vv)
        except (TypeError, ValueError):
            raise ValidationError("volume_value must be a number")
        if vvf <= 0:
            raise ValidationError("volume_value must be > 0")
        if vu not in _ALLOWED_VOLUME_UNITS:
            raise ValidationError(f"volume_unit must be one of {sorted(_ALLOWED_VOLUME_UNITS)}")
        cleaned["volume_value"] = vvf
        cleaned["volume_unit"] = vu

    if (notes := payload.get("notes")):
        cleaned["notes"] = str(notes)[:500]
    if (bc := payload.get("barcode")):
        cleaned["barcode"] = str(bc).strip()
    if (src := payload.get("source_catalog_name_norm")):
        cleaned["source_catalog_name_norm"] = str(src).strip()

    return cleaned


def _count_items(uid: str, list_id: str) -> int:
    db = _get_db()
    col = (
        db.collection("users").document(uid)
        .collection("shopping_lists").document(list_id)
        .collection("items")
    )
    # Live count — small lists (≤50), so the stream cost is acceptable.
    return sum(1 for _ in col.stream())


def add_item(uid: str, list_id: str, payload: Dict[str, Any], *, source: str = "manual") -> Dict[str, Any]:
    """Add a PRIMARY (intent row) to a list. Enforces beta cap of 15 primaries.

    `source` distinguishes entry points for analytics: 'manual' | 'catalog' |
    'scan' | 'receipt' | 'cross_page'. Persisted as `source` on the item doc.

    Catalog quota (P1 — catalog is source of truth for IDENTITY):
    every primary references a catalog entry. If the caller didn't supply
    `source_catalog_name_norm`, this routes through `catalog_service.
    upsert_catalog_entry`, which fires the standard quota check (free-tier
    50 user_custom rows; QuotaExceededError on cap hit). Existing matches
    consume zero quota; new free-text custom names consume 1 slot.
    Frontend's CatalogAutocomplete + scan path normally pre-resolves
    `source_catalog_name_norm`, so this fallback only fires when the
    caller skipped catalog matching.
    """
    get_list_or_404(uid, list_id)
    cleaned = _validate_item_payload(payload)

    used = _count_items(uid, list_id)
    if used >= MAX_PRIMARIES_PER_LIST:
        raise QuotaExceededError(
            f"Shopping list cap reached ({MAX_PRIMARIES_PER_LIST} primaries — beta limit)",
            details={
                "used": used,
                "limit": MAX_PRIMARIES_PER_LIST,
                "scope": "shopping_list_primaries",
            },
        )

    # P1 enforcement: route through catalog flow when no ref provided.
    # `upsert_catalog_entry` raises QuotaExceededError if the user hits
    # their catalog cap. We let it bubble up to the route layer.
    if not cleaned.get("source_catalog_name_norm"):
        from app.services import catalog_service
        # `source` on the catalog row is the originating flow (must be in
        # VALID_SOURCES). The shopping-list-item's own `source` field
        # already captures the entry-point detail (manual/scan/catalog/...).
        catalog_entry = catalog_service.upsert_catalog_entry(
            user_id=uid,
            display_name=cleaned["item_name"],
            barcode=cleaned.get("barcode"),
            source="shopping_list_v3",
            actor_uid=uid,
        )
        cleaned["source_catalog_name_norm"] = catalog_entry["name_norm"]

    db = _get_db()
    list_ref = db.collection("users").document(uid).collection("shopping_lists").document(list_id)
    items_ref = list_ref.collection("items")

    now = _now_iso()
    doc = items_ref.document()
    item_payload = {
        **cleaned,
        "alternatives": [],          # v3 alias for prices[] — kept for clarity
        "prices": [],                # legacy field name; mirrors alternatives[]
        "added_at": now,
        **_new_metadata(uid, source=source),
    }
    item_payload["updated_at"] = now

    batch = db.batch()
    batch.set(doc, item_payload)
    # Bump denormalized counter on the list doc for cheap reads.
    batch.update(list_ref, {"item_count": used + 1, "updated_at": now})
    batch.commit()

    # P1 + B (ref counting): bump transit_ref_count on the catalog row so
    # eager GC at delete time can short-circuit the cross-collection scan.
    if cleaned.get("source_catalog_name_norm"):
        from app.services import catalog_service
        catalog_service.increment_transit_ref(uid, cleaned["source_catalog_name_norm"], 1)

    return {"id": doc.id, **item_payload}


def update_item(uid: str, list_id: str, item_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Edit an item in place. Pass only fields you want to update."""
    db = _get_db()
    item_ref = (
        db.collection("users").document(uid)
        .collection("shopping_lists").document(list_id)
        .collection("items").document(item_id)
    )
    snap = item_ref.get()
    if not snap.exists:
        raise NotFoundError(f"Item {item_id} not found")

    # Re-validate the merged payload so partial updates can't bypass rules
    merged = {**snap.to_dict(), **payload}
    cleaned = _validate_item_payload(merged)
    cleaned["updated_at"] = _now_iso()
    item_ref.update(cleaned)

    out = snap.to_dict() or {}
    out.update(cleaned)
    out["id"] = item_id
    return out


def delete_item(uid: str, list_id: str, item_id: str) -> None:
    db = _get_db()
    list_ref = db.collection("users").document(uid).collection("shopping_lists").document(list_id)
    item_ref = list_ref.collection("items").document(item_id)
    snap = item_ref.get()
    if not snap.exists:
        raise NotFoundError(f"Item {item_id} not found")

    item_data = snap.to_dict() or {}
    primary_ref = item_data.get("source_catalog_name_norm")
    alt_refs = [
        a.get("source_catalog_name_norm")
        for a in (item_data.get("prices") or [])
        if a.get("source_catalog_name_norm")
    ]

    batch = db.batch()
    batch.delete(item_ref)
    # Decrement counter; floor at 0.
    list_snap = list_ref.get()
    cur = (list_snap.to_dict() or {}).get("item_count", 0)
    batch.update(list_ref, {"item_count": max(0, cur - 1), "updated_at": _now_iso()})
    batch.commit()

    # B + eager GC: decrement transit_ref_count for every catalog ref this
    # item carried (primary + each alternative), then probe each unique
    # name_norm for orphan-eligibility. dedup so promote-inherited cases
    # only check the catalog row once.
    from app.services import catalog_service
    all_refs: List[str] = ([primary_ref] if primary_ref else []) + list(alt_refs)
    seen: set[str] = set()
    for ref in all_refs:
        catalog_service.decrement_transit_ref(uid, ref, 1)
    for ref in all_refs:
        if ref in seen:
            continue
        seen.add(ref)
        catalog_service.gc_if_orphan(uid, ref)


# ---------------------------------------------------------------------------
# v3 — Alternatives (candidate purchases under each primary)
#
# An alternative is a concrete buyable variant: a specific brand/store/barcode
# combination at a specific price + qty. Each primary can have ≤3 alternatives
# (beta cap). Only alternatives are tickable; checkout is the ticked subset.
# Stored as `prices[]` array on the parent item doc — name kept for backward
# compatibility, but the schema is richer now.
# ---------------------------------------------------------------------------

def _validate_alternative_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize + validate an alternative entry. Price is optional (per F3 —
    user can list a candidate without a price; the no-price tag in UI nudges
    them to add one before ticking)."""
    out: Dict[str, Any] = {}

    if (p := payload.get("price")) is not None:
        try:
            pf = float(p)
        except (TypeError, ValueError):
            raise ValidationError("price must be a number")
        if pf <= 0:
            raise ValidationError("price must be > 0")
        out["price"] = pf

    out["currency"] = (payload.get("currency") or "SGD")[:8]
    out["brand"] = (payload.get("brand") or None)
    out["store_name"] = (payload.get("store_name") or None)
    out["barcode"] = (payload.get("barcode") or None)
    out["candidate_name"] = (payload.get("candidate_name") or None)

    # pack_count × pack_size = total qty contribution at checkout
    if (pc := payload.get("pack_count")) is not None:
        try:
            pcf = float(pc)
        except (TypeError, ValueError):
            raise ValidationError("pack_count must be a number")
        if pcf <= 0:
            raise ValidationError("pack_count must be > 0")
        out["pack_count"] = pcf
    if (ps := payload.get("pack_size")) is not None:
        try:
            psf = float(ps)
        except (TypeError, ValueError):
            raise ValidationError("pack_size must be a number")
        if psf <= 0:
            raise ValidationError("pack_size must be > 0")
        out["pack_size"] = psf

    # weight / volume pair (optional, must come together if present)
    wv, wu = payload.get("weight_value"), payload.get("weight_unit")
    if wv is not None or wu is not None:
        if wv is None or wu is None:
            raise ValidationError("weight_value and weight_unit must both be set")
        if wu not in _ALLOWED_WEIGHT_UNITS:
            raise ValidationError(f"weight_unit must be one of {sorted(_ALLOWED_WEIGHT_UNITS)}")
        try:
            wvf = float(wv)
        except (TypeError, ValueError):
            raise ValidationError("weight_value must be a number")
        if wvf <= 0:
            raise ValidationError("weight_value must be > 0")
        out["weight_value"] = wvf
        out["weight_unit"] = wu

    vv, vu = payload.get("volume_value"), payload.get("volume_unit")
    if vv is not None or vu is not None:
        if vv is None or vu is None:
            raise ValidationError("volume_value and volume_unit must both be set")
        if vu not in _ALLOWED_VOLUME_UNITS:
            raise ValidationError(f"volume_unit must be one of {sorted(_ALLOWED_VOLUME_UNITS)}")
        try:
            vvf = float(vv)
        except (TypeError, ValueError):
            raise ValidationError("volume_value must be a number")
        if vvf <= 0:
            raise ValidationError("volume_value must be > 0")
        out["volume_value"] = vvf
        out["volume_unit"] = vu

    if (src := payload.get("source_catalog_name_norm")):
        out["source_catalog_name_norm"] = str(src).strip()

    return out


def add_price(
    uid: str,
    list_id: str,
    item_id: str,
    *,
    price: Optional[float] = None,
    brand: Optional[str] = None,
    currency: str = "SGD",
    store_name: Optional[str] = None,
    barcode: Optional[str] = None,
    candidate_name: Optional[str] = None,
    pack_count: Optional[float] = None,
    pack_size: Optional[float] = None,
    weight_value: Optional[float] = None,
    weight_unit: Optional[str] = None,
    volume_value: Optional[float] = None,
    volume_unit: Optional[str] = None,
    source_catalog_name_norm: Optional[str] = None,
    auto_promoted: bool = False,
) -> Dict[str, Any]:
    """Append an alternative (candidate purchase) to a primary. Cap = 3 (beta).

    Price is optional — F3-B carries through: user can list candidates without
    prices; the no-price tag in UI flags missing data.
    """
    cleaned = _validate_alternative_payload({
        "price": price,
        "brand": brand,
        "currency": currency,
        "store_name": store_name,
        "barcode": barcode,
        "candidate_name": candidate_name,
        "pack_count": pack_count,
        "pack_size": pack_size,
        "weight_value": weight_value,
        "weight_unit": weight_unit,
        "volume_value": volume_value,
        "volume_unit": volume_unit,
        "source_catalog_name_norm": source_catalog_name_norm,
    })

    db = _get_db()
    item_ref = (
        db.collection("users").document(uid)
        .collection("shopping_lists").document(list_id)
        .collection("items").document(item_id)
    )
    snap = item_ref.get()
    if not snap.exists:
        raise NotFoundError(f"Item {item_id} not found")

    data = snap.to_dict() or {}
    prices: List[Dict[str, Any]] = list(data.get("prices") or [])
    if len(prices) >= MAX_ALTERNATIVES_PER_PRIMARY:
        raise QuotaExceededError(
            f"Alternative cap reached ({MAX_ALTERNATIVES_PER_PRIMARY} per primary — beta limit)",
            details={
                "used": len(prices),
                "limit": MAX_ALTERNATIVES_PER_PRIMARY,
                "scope": "shopping_list_alternatives",
            },
        )

    # P1 enforcement: when an alternative carries a custom candidate_name
    # or a barcode that hasn't yet been resolved to a catalog entry, route
    # through the catalog flow so user_custom rows consume catalog quota.
    # Promote-to-alternative skips this (auto_promoted=True) because it
    # inherits the primary's already-resolved catalog ref.
    if (
        not auto_promoted
        and not cleaned.get("source_catalog_name_norm")
        and (cleaned.get("candidate_name") or cleaned.get("barcode"))
    ):
        from app.services import catalog_service
        # Fall back to primary's name when alternative carries only barcode
        display_name = cleaned.get("candidate_name") or data.get("item_name")
        if display_name:
            catalog_entry = catalog_service.upsert_catalog_entry(
                user_id=uid,
                display_name=display_name,
                barcode=cleaned.get("barcode"),
                source="shopping_list_v3",
                actor_uid=uid,
            )
            cleaned["source_catalog_name_norm"] = catalog_entry["name_norm"]

    entry = {
        "id": str(uuid.uuid4()),
        "added_at": _now_iso(),
        "ticked": False,        # v3 tick state lives on the alternative
        "ticked_at": None,
        "auto_promoted": auto_promoted,
        **cleaned,
    }
    prices.append(entry)
    item_ref.update({"prices": prices, "updated_at": _now_iso()})

    # B: bump transit_ref_count for the alt's catalog ref. The promote
    # helper inherits the primary's source_catalog_name_norm, so this
    # increments TWICE for the same name_norm (primary + alt) — that's
    # correct: when both are deleted, both decrements bring the counter
    # back to zero and GC kicks in.
    if cleaned.get("source_catalog_name_norm"):
        from app.services import catalog_service
        catalog_service.increment_transit_ref(uid, cleaned["source_catalog_name_norm"], 1)

    return entry


def tick_alternative(
    uid: str,
    list_id: str,
    item_id: str,
    alt_id: str,
    *,
    ticked: bool,
) -> Dict[str, Any]:
    """Set or clear the tick on a single alternative. Idempotent.

    Multi-device + concurrent-edit safe: last-write-wins semantics
    (per g7 — concurrent ticks both succeed; concurrent tick+untick =
    last writer wins, no errors).
    """
    db = _get_db()
    item_ref = (
        db.collection("users").document(uid)
        .collection("shopping_lists").document(list_id)
        .collection("items").document(item_id)
    )
    snap = item_ref.get()
    if not snap.exists:
        raise NotFoundError(f"Item {item_id} not found")

    data = snap.to_dict() or {}
    prices: List[Dict[str, Any]] = list(data.get("prices") or [])
    found = False
    for entry in prices:
        if entry.get("id") == alt_id:
            entry["ticked"] = bool(ticked)
            entry["ticked_at"] = _now_iso() if ticked else None
            found = True
            break
    if not found:
        raise NotFoundError(f"Alternative {alt_id} not found")

    item_ref.update({"prices": prices, "updated_at": _now_iso()})
    return next((e for e in prices if e.get("id") == alt_id), {})


def promote_primary_to_alternative(
    uid: str,
    list_id: str,
    item_id: str,
) -> Dict[str, Any]:
    """Helper for the I5 'Use as alternative' flow — creates a single
    alternative carrying the primary's name + qty so the user can tick + buy
    without comparing brands. Subject to the 3-alternative cap.

    Defaults per F2:
      candidate_name = primary.item_name
      pack_count = 1
      pack_size = primary.quantity if set, else 1
      weight_*  = primary.weight_*  if set
      volume_*  = primary.volume_*  if set
      barcode = primary.barcode if set
      source_catalog_name_norm = primary.source_catalog_name_norm
      auto_promoted = True
    """
    db = _get_db()
    item_ref = (
        db.collection("users").document(uid)
        .collection("shopping_lists").document(list_id)
        .collection("items").document(item_id)
    )
    snap = item_ref.get()
    if not snap.exists:
        raise NotFoundError(f"Item {item_id} not found")
    primary = snap.to_dict() or {}

    return add_price(
        uid,
        list_id,
        item_id,
        candidate_name=primary.get("item_name"),
        pack_count=1,
        pack_size=primary.get("quantity") or 1,
        weight_value=primary.get("weight_value"),
        weight_unit=primary.get("weight_unit"),
        volume_value=primary.get("volume_value"),
        volume_unit=primary.get("volume_unit"),
        barcode=primary.get("barcode"),
        source_catalog_name_norm=primary.get("source_catalog_name_norm"),
        auto_promoted=True,
    )


def confirm_checkout(
    uid: str,
    list_id: str,
    *,
    store_id: Optional[str] = None,
    date: Optional[str] = None,
    default_location: Optional[str] = None,
) -> Dict[str, Any]:
    """Atomic confirm of all currently-ticked alternatives.

    For each ticked alternative:
      - Creates a purchase event (via purchase_event_service.create_purchase)
        at `default_location` (falls back to user.default_grocery_storage,
        then to '_unsorted' / null = unsorted bucket).
      - Stamps `trip_id` (one uuid per confirm batch) on the event doc
        via a follow-up Firestore update.
      - When `record_purchase_patterns=true` (per user setting), also
        stamps selected_candidate_id + selected_brand + selected_store_name.
    Cascade per F8: primary + ALL its alternatives are removed. Untouched
    primaries (zero ticks across alternatives) stay.
    """
    from app.services import purchase_event_service

    get_list_or_404(uid, list_id)
    items = get_list_items(uid, list_id)

    db = _get_db()
    user_snap = db.collection("users").document(uid).get()
    user = (user_snap.to_dict() if user_snap.exists else {}) or {}
    record_patterns = bool(user.get("record_purchase_patterns", False))
    fallback_storage = user.get("default_grocery_storage") or "_unsorted"
    # '_unsorted' is GroceryApp's convention for "no location"; pass null in
    # that case so the bucket math in storage views works as expected.
    location: Optional[str] = (
        None if (default_location or fallback_storage) == "_unsorted"
        else (default_location or fallback_storage)
    )

    trip_id = str(uuid.uuid4())
    purchases_created: List[Dict[str, Any]] = []
    items_to_remove: List[str] = []

    for item in items:
        prices = item.get("prices") or []
        ticked_alts = [a for a in prices if a.get("ticked")]
        if not ticked_alts:
            continue

        for alt in ticked_alts:
            pack_count = float(alt.get("pack_count") or 1)
            pack_size = float(alt.get("pack_size") or 1)
            qty_total = pack_count * pack_size
            display_name = (
                alt.get("candidate_name")
                or item.get("item_name")
                or "(unnamed)"
            )
            base_unit = _resolve_base_unit(alt, item)

            try:
                pe = purchase_event_service.create_purchase(
                    user_id=uid,
                    name=display_name,
                    barcode=alt.get("barcode") or item.get("barcode"),
                    quantity=qty_total,
                    base_unit=base_unit,
                    base_unit_label=base_unit,
                    pack_size=int(pack_size) if pack_size.is_integer() else 1,
                    pack_label="loose",
                    price=alt.get("price"),
                    currency=alt.get("currency") if alt.get("price") else None,
                    store_id=store_id,
                    location=location,
                    source="shopping_list_checkout",
                )
                # Stamp trip + (optional) analytics fields
                try:
                    event_id = pe.get("id")
                    if event_id:
                        annotations: Dict[str, Any] = {
                            "trip_id": trip_id,
                            "shopping_list_id": list_id,
                        }
                        if record_patterns:
                            annotations.update({
                                "selected_candidate_id": alt.get("id"),
                                "selected_brand": alt.get("brand"),
                                "selected_store_name": alt.get("store_name"),
                                "auto_promoted_candidate": bool(alt.get("auto_promoted")),
                            })
                        db.collection("users").document(uid).collection(
                            "purchase_events"
                        ).document(event_id).update(annotations)
                except Exception as ann_err:
                    logger.warning(
                        "checkout: trip_id annotation failed for %s: %s",
                        display_name, ann_err,
                    )
                purchases_created.append({"id": pe.get("id"), "name": display_name})
            except Exception as exc:
                logger.exception(
                    "checkout: failed to create purchase for %s: %s", display_name, exc
                )

        items_to_remove.append(item["id"])

    # Cascade-delete primaries + all their alternatives (F8)
    for item_id in items_to_remove:
        try:
            delete_item(uid, list_id, item_id)
        except NotFoundError:
            pass

    return {
        "trip_id": trip_id,
        "date": date or _now_iso(),
        "default_location": location,
        "purchases_created": purchases_created,
        "items_removed": items_to_remove,
        "total_purchases": len(purchases_created),
    }


def _resolve_base_unit(alt: Dict[str, Any], item: Dict[str, Any]) -> str:
    """Pick the base unit for the resulting purchase.
    weight > volume > primary.unit > 'count'.
    """
    if alt.get("weight_unit"):
        return alt["weight_unit"]
    if alt.get("volume_unit"):
        return alt["volume_unit"]
    if item.get("weight_unit"):
        return item["weight_unit"]
    if item.get("volume_unit"):
        return item["volume_unit"]
    return item.get("unit") or "count"


def delete_price(uid: str, list_id: str, item_id: str, price_id: str) -> None:
    db = _get_db()
    item_ref = (
        db.collection("users").document(uid)
        .collection("shopping_lists").document(list_id)
        .collection("items").document(item_id)
    )
    snap = item_ref.get()
    if not snap.exists:
        raise NotFoundError(f"Item {item_id} not found")

    data = snap.to_dict() or {}
    prices: List[Dict[str, Any]] = list(data.get("prices") or [])
    removed = next((p for p in prices if p.get("id") == price_id), None)
    new_prices = [p for p in prices if p.get("id") != price_id]
    if removed is None:
        raise NotFoundError(f"Price entry {price_id} not found")
    item_ref.update({"prices": new_prices, "updated_at": _now_iso()})

    # B + eager GC: decrement counter on the alt's catalog ref + probe.
    removed_ref = removed.get("source_catalog_name_norm")
    if removed_ref:
        from app.services import catalog_service
        catalog_service.decrement_transit_ref(uid, removed_ref, 1)
        catalog_service.gc_if_orphan(uid, removed_ref)


# ---------------------------------------------------------------------------
# v2 — TTL sweep (called by scheduler daily)
# ---------------------------------------------------------------------------

def sweep_expired_items(now: Optional[datetime] = None) -> Dict[str, int]:
    """Delete items where `added_at < now - 30 days`. Returns counts.

    Scope: across ALL users. Iterates `users/*/shopping_lists/*/items/*`.
    Idempotent and safe — re-running it after a partial sweep just keeps
    going. Logs a summary at INFO so the scheduler trail is visible.
    """
    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(days=ITEM_TTL_DAYS)
    cutoff_iso = cutoff.isoformat()

    db = _get_db()
    deleted_items = 0
    affected_lists = 0
    gc_attempted = 0
    gc_deleted = 0
    list_decrements: Dict[str, int] = {}
    # Per-user accumulator of (name_norm, count) pairs to dec + GC after the
    # main delete batch commits. Done out-of-batch because gc_if_orphan
    # reads-then-deletes (not batch-friendly).
    catalog_ref_decs: Dict[str, Dict[str, int]] = {}  # uid → {name_norm: count}

    try:
        items = db.collection_group("items").where(
            "added_at", "<", cutoff_iso
        ).stream()

        batch = db.batch()
        n = 0
        for snap in items:
            parent = snap.reference.parent.parent  # the list doc
            if parent is None or "shopping_lists" not in parent.path:
                continue
            # Walk up to the user doc: users/{uid}/shopping_lists/{listId}
            user_ref = parent.parent.parent
            uid = user_ref.id if user_ref else None

            # Collect catalog refs from this item before deleting it
            data = snap.to_dict() or {}
            primary_ref = data.get("source_catalog_name_norm")
            if uid:
                user_bucket = catalog_ref_decs.setdefault(uid, {})
                if primary_ref:
                    user_bucket[primary_ref] = user_bucket.get(primary_ref, 0) + 1
                for alt in (data.get("prices") or []):
                    alt_ref = alt.get("source_catalog_name_norm")
                    if alt_ref:
                        user_bucket[alt_ref] = user_bucket.get(alt_ref, 0) + 1

            batch.delete(snap.reference)
            list_decrements[parent.path] = list_decrements.get(parent.path, 0) + 1
            deleted_items += 1
            n += 1
            if n % 400 == 0:
                batch.commit()
                batch = db.batch()

        for list_path, dec in list_decrements.items():
            list_ref = db.document(list_path)
            list_snap = list_ref.get()
            cur = (list_snap.to_dict() or {}).get("item_count", 0)
            batch.update(list_ref, {
                "item_count": max(0, cur - dec),
                "updated_at": now.isoformat(),
            })
            affected_lists += 1
            n += 1
            if n % 400 == 0:
                batch.commit()
                batch = db.batch()

        batch.commit()

        # Eager catalog GC for orphan rows freed by the sweep. Runs after
        # the delete batch so transit_ref_count reads see the post-delete
        # world. Defensive: each call is wrapped — a single failure
        # doesn't stop the sweep.
        from app.services import catalog_service
        for uid, ref_counts in catalog_ref_decs.items():
            for name_norm, count in ref_counts.items():
                try:
                    catalog_service.decrement_transit_ref(uid, name_norm, count)
                except Exception as exc:
                    logger.warning("ttl_sweep: dec_ref failed user=%s name=%s: %s", uid, name_norm, exc)
                gc_attempted += 1
                try:
                    if catalog_service.gc_if_orphan(uid, name_norm):
                        gc_deleted += 1
                except Exception as exc:
                    logger.warning("ttl_sweep: gc_if_orphan failed user=%s name=%s: %s", uid, name_norm, exc)

    except Exception as e:
        logger.exception("sweep_expired_items failed: %s", e)
        return {"deleted_items": deleted_items, "affected_lists": affected_lists, "error": str(e)}

    logger.info(
        "shopping_list TTL sweep: items=%d lists=%d gc_attempted=%d gc_deleted=%d (cutoff=%s)",
        deleted_items, affected_lists, gc_attempted, gc_deleted, cutoff_iso,
    )
    return {
        "deleted_items": deleted_items,
        "affected_lists": affected_lists,
        "catalog_gc_attempted": gc_attempted,
        "catalog_gc_deleted": gc_deleted,
    }
