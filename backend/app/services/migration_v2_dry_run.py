"""Phase 0 — pre-migration audit dry-run for catalog evolution v2.

Plan: F:\\ClaudeProjects\\GroceryApp\\.claude\\docs\\plans\\catalog_evolution.md §4.1.

Read-only. Predicts every doc change the v2 migration will make WITHOUT writing.
Outputs counts + sample diffs + ambiguous-row flags so the operator can decide
whether to proceed with the actual migration in Phase A.

Pass criterion (per the plan): total ambiguous percentage < 5% across catalog +
events. Higher than that = pause migration, triage the ambiguities first.

Migration defaults applied (mirror of plan §4.2):
  catalog_entry:
    catalog_mode = "global_linked" if barcode else "user_custom"
    canonical_name = existing display_name
    idle_expires_at = null if global_linked or user.is_paid else now+60d
  purchase_event:
    pack_size = 1
    base_unit_label = inferred from name regex; else "unit"
    currency = existing or user.currency_preference (default "SGD")
    display_amount = amount; display_currency = currency
    fx_rate_at_save = 1.0
    unit_price = amount / quantity / pack_size  (if amount + quantity present)
    store_id = "unknown"
    contributes_to_logical_count = (split_from_event_id is None)
  user:
    is_paid = (tier in {"plus","pro"})
    currency_preference = "SGD" (default)
    catalog_quota_used = count of predicted user_custom catalog rows
    catalog_quota_limit = 50
    store_quota_used = 1; store_quota_limit = 30
  store_catalog: one auto-created "unknown" store per user
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

logger = logging.getLogger(__name__)

_CATALOG_COLLECTION = "catalog_entries"
_USER_COLLECTION = "users"
_PAID_TIERS = {"plus", "pro"}
_DEFAULT_CURRENCY = "SGD"
_GRACE_DAYS = 60
_AMBIGUOUS_PASS_THRESHOLD_PCT = 5.0

# Hard flags = data shape the migration cannot safely auto-handle. These are
# the only flags that count toward `ambiguous_count` / `ambiguous_pct` and
# gate the pass-threshold check. Soft flags (e.g., "currency_defaulted",
# "very_short_display_name") get surfaced in the per-row report for human
# review, but applying their default is part of the documented migration plan
# and not an ambiguity.
_HARD_FLAGS_CATALOG = {"missing_display_name", "garbage_row"}
_HARD_FLAGS_EVENT = {"missing_quantity", "non_numeric_price_or_quantity", "orphan_event"}


# Regex-based base_unit_label inference. Order matters — more specific first.
_UNIT_HINTS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\begg(s)?\b", re.IGNORECASE), "egg"),
    (re.compile(r"\bkg\b|\bkilogram", re.IGNORECASE), "kg"),
    (re.compile(r"\bml\b|\bmillilitre|\bmilliliter", re.IGNORECASE), "ml"),
    (re.compile(r"\b(\d+\s*)?L\b|\blitre|\bliter", re.IGNORECASE), "L"),
    (re.compile(r"\bgram(s)?\b|\b\d+\s*g\b", re.IGNORECASE), "g"),
    (re.compile(r"\bpack(s|et)?\b", re.IGNORECASE), "pack"),
    (re.compile(r"\bbox(es)?\b", re.IGNORECASE), "box"),
    (re.compile(r"\bbottle(s)?\b", re.IGNORECASE), "bottle"),
    (re.compile(r"\bcan(s)?\b", re.IGNORECASE), "can"),
    (re.compile(r"\bjar(s)?\b", re.IGNORECASE), "jar"),
    (re.compile(r"\bbag(s)?\b", re.IGNORECASE), "bag"),
    (re.compile(r"\bslice(s)?\b", re.IGNORECASE), "slice"),
    (re.compile(r"\bloaf|loaves\b", re.IGNORECASE), "loaf"),
]


def _db():
    return firestore.client()


def _user_purchases_ref(user_id: str):
    return _db().collection("users").document(user_id).collection("purchases")


def _infer_base_unit_label(catalog_name: str) -> tuple[str, bool]:
    """Return (label, was_inferred). Falls back to ('unit', False) if no hint matches."""
    if not catalog_name:
        return "unit", False
    for pattern, label in _UNIT_HINTS:
        if pattern.search(catalog_name):
            return label, True
    return "unit", False


def _classify_catalog_row(cat: dict) -> tuple[str, list[str]]:
    """Predict catalog_mode + collect ambiguity flags. Returns (mode, flags)."""
    flags: list[str] = []
    barcode = cat.get("barcode")
    display = (cat.get("display_name") or "").strip()

    if not display:
        flags.append("missing_display_name")
    elif len(display) < 2:
        flags.append("very_short_display_name")  # soft — surfaces in report but doesn't block

    if barcode:
        return "global_linked", flags
    if not barcode and not display:
        flags.append("garbage_row")
    return "user_custom", flags


def _is_paid_user(user: Optional[dict]) -> bool:
    if not user:
        return False
    tier = user.get("tier") or "free"
    return tier in _PAID_TIERS


def dry_run_for_user(user_id: str) -> dict[str, Any]:
    """Predict every doc change v2 migration will make for one user.

    Returns the full predicted-diff report. Read-only; no writes.
    """
    db = _db()
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    # --- User profile (for is_paid + tier-driven defaults) ---
    user_doc = db.collection(_USER_COLLECTION).document(user_id).get()
    user_data = user_doc.to_dict() if user_doc.exists else None
    is_paid = _is_paid_user(user_data)
    user_currency_pref = (user_data or {}).get("currency_preference") or _DEFAULT_CURRENCY

    # --- Catalog rows ---
    catalog_q = (
        db.collection(_CATALOG_COLLECTION)
        .where(filter=FieldFilter("user_id", "==", user_id))
    )
    cat_rows: list[dict] = []
    for snap in catalog_q.stream():
        d = snap.to_dict() or {}
        d["__doc_id"] = snap.id
        cat_rows.append(d)

    cat_predictions: list[dict] = []
    cat_global_linked = 0
    cat_user_custom_with_barcode = 0
    cat_user_custom_no_barcode = 0
    cat_ambiguous: list[dict] = []

    for cat in cat_rows:
        mode, flags = _classify_catalog_row(cat)
        if mode == "global_linked":
            cat_global_linked += 1
        elif cat.get("barcode"):
            cat_user_custom_with_barcode += 1
        else:
            cat_user_custom_no_barcode += 1

        idle_expires_at = (
            None
            if mode == "global_linked" or is_paid
            else (now + timedelta(days=_GRACE_DAYS)).isoformat()
        )

        prediction = {
            "name_norm": cat.get("name_norm"),
            "display_name": cat.get("display_name"),
            "barcode": cat.get("barcode"),
            "predicted_catalog_mode": mode,
            "predicted_canonical_name": cat.get("display_name"),
            "predicted_idle_expires_at": idle_expires_at,
            "schema_version_target": 2,
            "ambiguity_flags": flags,
        }
        cat_predictions.append(prediction)
        if any(f in _HARD_FLAGS_CATALOG for f in flags):
            cat_ambiguous.append(prediction)

    cat_total = len(cat_rows)
    cat_user_custom = cat_user_custom_with_barcode + cat_user_custom_no_barcode
    cat_ambiguous_pct = (len(cat_ambiguous) / cat_total * 100) if cat_total else 0.0

    # --- Purchase events ---
    ev_predictions_sample: list[dict] = []
    ev_total = 0
    ev_pack_size_default = 0  # always = total in this default path
    ev_unit_inferred = 0
    ev_unit_default = 0
    ev_currency_set = 0
    ev_currency_default = 0
    ev_no_price = 0
    ev_no_quantity = 0
    ev_splits = 0
    ev_logical = 0
    ev_currencies_seen: dict[str, int] = {}
    ev_ambiguous: list[dict] = []
    # Cache catalog-display lookup for unit inference
    name_by_norm = {c.get("name_norm"): (c.get("display_name") or "") for c in cat_rows}

    for snap in _user_purchases_ref(user_id).stream():
        ev = snap.to_dict() or {}
        ev_id = snap.id
        ev_total += 1

        flags: list[str] = []

        nn = ev.get("catalog_name_norm")
        cat_name = name_by_norm.get(nn) or ev.get("catalog_display") or ""
        unit_label, inferred = _infer_base_unit_label(cat_name)
        if inferred:
            ev_unit_inferred += 1
        else:
            ev_unit_default += 1

        currency = ev.get("currency")
        if currency:
            ev_currency_set += 1
            ev_currencies_seen[currency] = ev_currencies_seen.get(currency, 0) + 1
        else:
            ev_currency_default += 1
            currency = user_currency_pref

        amount = ev.get("price")
        quantity = ev.get("quantity")

        if amount is None:
            ev_no_price += 1
            unit_price = None
        elif quantity is None or quantity == 0:
            ev_no_quantity += 1
            unit_price = None
            flags.append("missing_quantity")
        else:
            try:
                unit_price = float(amount) / float(quantity)  # pack_size = 1
            except (TypeError, ValueError):
                unit_price = None
                flags.append("non_numeric_price_or_quantity")

        if amount is not None and not ev.get("currency"):
            flags.append("currency_defaulted")

        is_split = ev.get("split_from_event_id") is not None
        if is_split:
            ev_splits += 1
        else:
            ev_logical += 1

        nn_orphan = nn and (nn not in name_by_norm)
        if nn_orphan:
            flags.append("orphan_event")

        prediction = {
            "event_id": ev_id,
            "catalog_name_norm": nn,
            "catalog_display": ev.get("catalog_display"),
            "predicted_pack_size": 1,
            "predicted_base_unit_label": unit_label,
            "base_unit_inferred": inferred,
            "predicted_currency": currency,
            "predicted_display_amount": amount,
            "predicted_display_currency": user_currency_pref,
            "predicted_fx_rate_at_save": 1.0 if currency == user_currency_pref else None,
            "predicted_unit_price": unit_price,
            "predicted_store_id": "unknown",
            "predicted_contributes_to_logical_count": not is_split,
            "schema_version_target": 2,
            "ambiguity_flags": flags,
        }
        if any(f in _HARD_FLAGS_EVENT for f in flags):
            ev_ambiguous.append(prediction)
        if len(ev_predictions_sample) < 10:
            ev_predictions_sample.append(prediction)

    ev_ambiguous_pct = (len(ev_ambiguous) / ev_total * 100) if ev_total else 0.0
    multi_currency = len(ev_currencies_seen) > 1

    # --- User doc predicted updates ---
    user_predicted = {
        "predicted_is_paid": is_paid,
        "predicted_currency_preference": user_currency_pref,
        "predicted_catalog_quota_used": cat_user_custom,
        "predicted_catalog_quota_limit": 50,
        "predicted_store_quota_used": 1,
        "predicted_store_quota_limit": 30,
        "predicted_schema_version": 2,
        "quota_at_or_above_limit": cat_user_custom >= 50,
    }

    # --- Stores predicted ---
    stores_predicted = {
        "will_create_unknown_store": ev_total > 0,
        "auto_created_store_doc": {
            "store_id": "unknown",
            "name": "Unknown",
            "auto_created": True,
            "use_count": ev_total,
        } if ev_total > 0 else None,
    }

    total_writes = (
        cat_total          # catalog rows updated
        + ev_total         # event rows updated
        + (1 if user_data else 0)  # user doc updated
        + (1 if ev_total > 0 else 0)  # store_catalog seeded
    )

    total_units = max(cat_total + ev_total, 1)
    total_ambiguous_pct = (
        (len(cat_ambiguous) + len(ev_ambiguous)) / total_units * 100
    )

    pass_threshold = total_ambiguous_pct < _AMBIGUOUS_PASS_THRESHOLD_PCT

    sample_diff_catalog = cat_predictions[0] if cat_predictions else None
    sample_diff_event = ev_predictions_sample[0] if ev_predictions_sample else None

    logger.info(
        "migration_v2.dry_run user=%s cat=%d ev=%d ambig_pct=%.2f pass=%s",
        user_id, cat_total, ev_total, total_ambiguous_pct, pass_threshold,
    )

    return {
        "user_id": user_id,
        "computed_at": now_iso,
        "schema_version_target": 2,
        "is_paid": is_paid,
        "user_tier": (user_data or {}).get("tier"),
        "catalog": {
            "total": cat_total,
            "predicted_global_linked": cat_global_linked,
            "predicted_user_custom_with_barcode": cat_user_custom_with_barcode,
            "predicted_user_custom_no_barcode": cat_user_custom_no_barcode,
            "ambiguous": cat_ambiguous[:50],
            "ambiguous_count": len(cat_ambiguous),
            "ambiguous_pct": round(cat_ambiguous_pct, 2),
        },
        "events": {
            "total": ev_total,
            "pack_size_default_count": ev_total,
            "base_unit_inferred_count": ev_unit_inferred,
            "base_unit_default_count": ev_unit_default,
            "currency_set_count": ev_currency_set,
            "currency_default_count": ev_currency_default,
            "currencies_seen": ev_currencies_seen,
            "multi_currency_user": multi_currency,
            "no_price_count": ev_no_price,
            "no_quantity_count": ev_no_quantity,
            "split_event_count": ev_splits,
            "logical_event_count": ev_logical,
            "ambiguous": ev_ambiguous[:50],
            "ambiguous_count": len(ev_ambiguous),
            "ambiguous_pct": round(ev_ambiguous_pct, 2),
        },
        "user": user_predicted,
        "stores": stores_predicted,
        "totals": {
            "total_writes_predicted": total_writes,
            "total_ambiguous_pct": round(total_ambiguous_pct, 2),
            "pass_threshold_pct": _AMBIGUOUS_PASS_THRESHOLD_PCT,
            "pass_threshold_met": pass_threshold,
        },
        "sample_diffs": {
            "catalog": sample_diff_catalog,
            "event": sample_diff_event,
        },
        "events_sample": ev_predictions_sample,
    }


def dry_run_all_users() -> dict[str, Any]:
    """Aggregate dry-run across every user. Compact per-user summaries only.

    For Shahir's small user base this is fine; would need pagination + async
    at higher scale.
    """
    db = _db()
    now_iso = datetime.now(timezone.utc).isoformat()

    user_ids: list[str] = [u.id for u in db.collection(_USER_COLLECTION).stream()]

    per_user: list[dict] = []
    agg_cat_total = 0
    agg_cat_global_linked = 0
    agg_cat_user_custom = 0
    agg_cat_ambiguous = 0
    agg_ev_total = 0
    agg_ev_ambiguous = 0
    agg_ev_split = 0
    agg_ev_logical = 0
    agg_unit_inferred = 0
    agg_unit_default = 0
    multi_currency_users = 0
    over_quota_users = 0

    for uid in user_ids:
        try:
            r = dry_run_for_user(uid)
        except Exception as e:
            logger.warning("dry_run_for_user failed user=%s err=%s", uid, e)
            per_user.append({"user_id": uid, "error": str(e)})
            continue

        per_user.append({
            "user_id": uid,
            "user_tier": r["user_tier"],
            "is_paid": r["is_paid"],
            "catalog_total": r["catalog"]["total"],
            "catalog_global_linked": r["catalog"]["predicted_global_linked"],
            "catalog_user_custom": (
                r["catalog"]["predicted_user_custom_with_barcode"]
                + r["catalog"]["predicted_user_custom_no_barcode"]
            ),
            "catalog_ambiguous_count": r["catalog"]["ambiguous_count"],
            "events_total": r["events"]["total"],
            "events_ambiguous_count": r["events"]["ambiguous_count"],
            "events_split": r["events"]["split_event_count"],
            "events_logical": r["events"]["logical_event_count"],
            "multi_currency": r["events"]["multi_currency_user"],
            "quota_at_or_above_limit": r["user"]["quota_at_or_above_limit"],
            "ambiguous_pct": r["totals"]["total_ambiguous_pct"],
            "pass_threshold_met": r["totals"]["pass_threshold_met"],
        })

        agg_cat_total += r["catalog"]["total"]
        agg_cat_global_linked += r["catalog"]["predicted_global_linked"]
        agg_cat_user_custom += (
            r["catalog"]["predicted_user_custom_with_barcode"]
            + r["catalog"]["predicted_user_custom_no_barcode"]
        )
        agg_cat_ambiguous += r["catalog"]["ambiguous_count"]
        agg_ev_total += r["events"]["total"]
        agg_ev_ambiguous += r["events"]["ambiguous_count"]
        agg_ev_split += r["events"]["split_event_count"]
        agg_ev_logical += r["events"]["logical_event_count"]
        agg_unit_inferred += r["events"]["base_unit_inferred_count"]
        agg_unit_default += r["events"]["base_unit_default_count"]
        if r["events"]["multi_currency_user"]:
            multi_currency_users += 1
        if r["user"]["quota_at_or_above_limit"]:
            over_quota_users += 1

    total_units = max(agg_cat_total + agg_ev_total, 1)
    overall_ambig_pct = (agg_cat_ambiguous + agg_ev_ambiguous) / total_units * 100

    return {
        "computed_at": now_iso,
        "schema_version_target": 2,
        "user_count": len(user_ids),
        "aggregate": {
            "catalog_total": agg_cat_total,
            "catalog_global_linked": agg_cat_global_linked,
            "catalog_user_custom": agg_cat_user_custom,
            "catalog_ambiguous": agg_cat_ambiguous,
            "events_total": agg_ev_total,
            "events_ambiguous": agg_ev_ambiguous,
            "events_split": agg_ev_split,
            "events_logical": agg_ev_logical,
            "base_unit_inferred": agg_unit_inferred,
            "base_unit_default": agg_unit_default,
            "multi_currency_users": multi_currency_users,
            "over_quota_users": over_quota_users,
            "overall_ambiguous_pct": round(overall_ambig_pct, 2),
            "pass_threshold_pct": _AMBIGUOUS_PASS_THRESHOLD_PCT,
            "pass_threshold_met": overall_ambig_pct < _AMBIGUOUS_PASS_THRESHOLD_PCT,
        },
        "per_user": per_user,
    }
