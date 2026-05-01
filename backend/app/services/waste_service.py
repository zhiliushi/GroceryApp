"""Waste service — aggregations + health score computation.

Health score formula (see docs/HEALTH_SCORE.md):
  - 70% weight on current active-item health (by expiry urgency)
  - 30% weight on this-month waste rate (inverted)

Cached per user in users/{uid}/cache/health (5min TTL).
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from app.core.metadata import apply_update_metadata
from app.core.slow_query import timed

logger = logging.getLogger(__name__)

_CACHE_TTL_SEC = 300  # 5 minutes


def _db():
    return firestore.client()


def _user_purchases_ref(user_id: str):
    return _db().collection("users").document(user_id).collection("purchases")


def _period_range(period: str, now: datetime) -> tuple[datetime, datetime, str]:
    """Return (from_date, to_date, normalized_period) for a period string.

    "last_month" was added for the dashboard scoreboard's month-over-month
    comparison — it covers the *previous* full calendar month [first..first
    of current month). Other periods cover up to `now`.
    """
    if period == "week":
        return (now - timedelta(days=7), now, "week")
    if period == "month":
        return (datetime(now.year, now.month, 1, tzinfo=timezone.utc), now, "month")
    if period == "year":
        return (datetime(now.year, 1, 1, tzinfo=timezone.utc), now, "year")
    if period == "all":
        return (datetime(2000, 1, 1, tzinfo=timezone.utc), now, "all")
    if period == "last_month":
        first_of_this = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        prev_month_year = now.year - 1 if now.month == 1 else now.year
        prev_month = 12 if now.month == 1 else now.month - 1
        first_of_prev = datetime(prev_month_year, prev_month, 1, tzinfo=timezone.utc)
        return (first_of_prev, first_of_this, "last_month")
    # Unknown period → fall back to month
    return (datetime(now.year, now.month, 1, tzinfo=timezone.utc), now, "month")


def _user_currency_pref(user_id: str) -> str:
    """User's preferred display currency, default SGD."""
    snap = _db().collection("users").document(user_id).get()
    if not snap.exists:
        return "SGD"
    return (snap.to_dict() or {}).get("currency_preference") or "SGD"


def _user_cache_ref(user_id: str, key: str):
    return _db().collection("users").document(user_id).collection("cache").document(key)


# ---------------------------------------------------------------------------
# Health score
# ---------------------------------------------------------------------------


@timed("waste.compute_health_score")
def compute_health_score(user_id: str, use_cache: bool = True) -> dict:
    """Compute or fetch cached health score. See docs/HEALTH_SCORE.md."""
    if use_cache:
        cached = _user_cache_ref(user_id, "health").get()
        if cached.exists:
            data = cached.to_dict() or {}
            computed_at = data.get("computed_at")
            if computed_at and hasattr(computed_at, "to_datetime"):
                computed_at = computed_at.to_datetime()
            if computed_at and (datetime.now(timezone.utc) - computed_at.replace(tzinfo=timezone.utc)).total_seconds() < _CACHE_TTL_SEC:
                return data

    # --- Count active items by urgency ---
    now = datetime.now(timezone.utc)
    threshold_3d = now + timedelta(days=3)
    threshold_7d = now + timedelta(days=7)
    age_7d = now - timedelta(days=7)

    active_healthy = 0
    active_expiring_7d = 0
    active_expiring_3d = 0
    active_expired = 0
    active_untracked = 0

    # Query active events (single equality — no composite index required)
    try:
        q = _user_purchases_ref(user_id).where(filter=FieldFilter("status", "==", "active"))
        for doc in q.stream():
            data = doc.to_dict() or {}
            expiry = data.get("expiry_date")
            if hasattr(expiry, "to_datetime"):
                expiry = expiry.to_datetime()
            if expiry is None:
                # Untracked: is it old?
                date_bought = data.get("date_bought")
                if hasattr(date_bought, "to_datetime"):
                    date_bought = date_bought.to_datetime()
                if date_bought and date_bought.replace(tzinfo=timezone.utc) < age_7d:
                    active_untracked += 1
                else:
                    active_healthy += 1  # recent, not a concern yet
                continue

            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)

            if expiry < now:
                active_expired += 1
            elif expiry <= threshold_3d:
                active_expiring_3d += 1
            elif expiry <= threshold_7d:
                active_expiring_7d += 1
            else:
                active_healthy += 1
    except Exception as exc:
        # Don't let a Firestore hiccup sink the whole health score — zero out
        # the active counts, log, keep going so the endpoint returns a score
        # instead of 500ing. "Could not compute health score" banner on the
        # frontend comes from this endpoint throwing; a best-effort 200 is
        # much better than a 500 during dev with un-deployed indexes.
        logger.warning("health_score: active-events query failed (uid=%s): %s", user_id, exc)

    active_total = (
        active_healthy + active_expiring_7d + active_expiring_3d + active_expired + active_untracked
    )

    # --- Monthly waste (used vs thrown this calendar month) ---
    # Uses single-equality queries and filters consumed_date in Python rather
    # than a composite (status, consumed_date) query, so this works without a
    # deployed composite index on the Firestore project.
    start_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    thrown_this_month = 0
    used_this_month = 0

    for status in ("used", "thrown"):
        try:
            q2 = _user_purchases_ref(user_id).where(filter=FieldFilter("status", "==", status))
            for doc in q2.stream():
                data = doc.to_dict() or {}
                consumed = data.get("consumed_date")
                if hasattr(consumed, "to_datetime"):
                    consumed = consumed.to_datetime()
                if not consumed:
                    continue
                if consumed.tzinfo is None:
                    consumed = consumed.replace(tzinfo=timezone.utc)
                if consumed < start_of_month:
                    continue
                # Quantity-based: a partial split that threw 2 of 12 should
                # contribute 2 to waste, not 1 (which would inflate waste-rate
                # against the dozen-egg buy that's still mostly active).
                qty = float(data.get("quantity") or 1)
                if status == "used":
                    used_this_month += qty
                else:
                    thrown_this_month += qty
        except Exception as exc:
            logger.warning(
                "health_score: %s-events query failed (uid=%s): %s", status, user_id, exc,
            )

    total_month = used_this_month + thrown_this_month

    # --- Compute score ---
    if active_total == 0 and total_month == 0:
        score = 100  # brand new user
    else:
        # Active component (0..1)
        if active_total > 0:
            active_component = (
                active_healthy * 1.0
                + active_expiring_7d * 0.8
                + active_expiring_3d * 0.5
                + active_expired * 0.0
                + active_untracked * 0.6
            ) / active_total
        else:
            active_component = 1.0  # no active items, can't be unhealthy

        # Waste component (0..1, inverted)
        if total_month > 0:
            waste_rate = thrown_this_month / total_month
        else:
            waste_rate = 0.0
        waste_component = 1.0 - waste_rate

        score = int(round(100 * (0.7 * active_component + 0.3 * waste_component)))

    # Grade
    if score >= 80:
        grade = "green"
    elif score >= 50:
        grade = "yellow"
    else:
        grade = "red"

    result = {
        "score": score,
        "grade": grade,
        "components": {
            "active_healthy": active_healthy,
            "active_expiring_7d": active_expiring_7d,
            "active_expiring_3d": active_expiring_3d,
            "active_expired": active_expired,
            "active_untracked": active_untracked,
            "thrown_this_month": thrown_this_month,
            "used_this_month": used_this_month,
        },
        "waste_rate_month": round(
            thrown_this_month / max(total_month, 1), 3
        ) if total_month else 0.0,
        "computed_at": now,
    }

    # Cache
    try:
        _user_cache_ref(user_id, "health").set(apply_update_metadata(result), merge=False)
    except Exception as exc:
        logger.warning("waste.cache_write failed: %s", exc)

    return result


# ---------------------------------------------------------------------------
# Health-score history (30-day trend)
# ---------------------------------------------------------------------------


def _user_health_history_ref(user_id: str):
    return (
        _db().collection("users").document(user_id).collection("health_history")
    )


def snapshot_health_score(user_id: str) -> dict:
    """Compute today's score and persist it under users/{uid}/health_history/{YYYY-MM-DD}.

    Idempotent — running twice on the same day overwrites the same doc.
    Called by the scheduler `health_history_snapshot` job.
    """
    score = compute_health_score(user_id, use_cache=False)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    snapshot = {
        "date": today,
        "score": score["score"],
        "grade": score["grade"],
        "components": score["components"],
        "waste_rate_month": score["waste_rate_month"],
        "snapshotted_at": datetime.now(timezone.utc),
    }
    _user_health_history_ref(user_id).document(today).set(snapshot)
    return snapshot


def get_health_history(user_id: str, days: int = 30) -> list[dict]:
    """Return up to `days` most-recent daily snapshots, oldest first.

    Missing days are absent from the list (no interpolation) — frontend chart
    fills gaps with the previous score.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    docs = (
        _user_health_history_ref(user_id)
        .where(filter=FieldFilter("date", ">=", cutoff))
        .order_by("date")
        .stream()
    )
    out = []
    for doc in docs:
        data = doc.to_dict() or {}
        out.append({
            "date": data.get("date"),
            "score": data.get("score"),
            "grade": data.get("grade"),
        })
    return out


# ---------------------------------------------------------------------------
# Waste summary
# ---------------------------------------------------------------------------


@timed("waste.get_waste_summary")
def get_waste_summary(user_id: str, period: str = "month") -> dict:
    """Aggregate thrown items for a period.

    Args:
        period: "month" (default) | "week" | "last_month" | "year" | "all"

    Waste filter (validation-stage rule, set by user 2026-05):
      Only `status='thrown'` events with `consumed_reason ∈ {expired,
      unexpected_event}` count as waste. `gift` and `used_up` thrown
      events don't count (e.g. you marked something thrown but the
      reason was "gave to neighbour" — that's not waste).

      For backward compatibility: pre-existing 'bad' reason (legacy
      enum) is normalised into 'unexpected_event' here so old data
      still counts as waste.

    Values are converted to the user's current currency_preference at
    read time.
    """
    from app.services import currency_service
    from app.schemas.purchase import WASTE_REASONS

    now = datetime.now(timezone.utc)
    from_date, to_date, period = _period_range(period, now)
    user_pref = _user_currency_pref(user_id)

    q = (
        _user_purchases_ref(user_id)
        .where(filter=FieldFilter("status", "==", "thrown"))
        .where(filter=FieldFilter("consumed_date", ">=", from_date))
        .where(filter=FieldFilter("consumed_date", "<", to_date))
    )

    by_catalog: dict[str, dict[str, Any]] = {}
    thrown_count = 0
    thrown_value = 0.0

    for doc in q.stream():
        data = doc.to_dict() or {}
        # Waste-reason filter — see docstring. Legacy 'bad' coerces to
        # 'unexpected_event' so old waste totals don't disappear.
        raw_reason = (data.get("consumed_reason") or "").lower()
        if raw_reason == "bad":
            raw_reason = "unexpected_event"
        if raw_reason not in WASTE_REASONS:
            continue
        name_norm = data.get("catalog_name_norm", "(unknown)")
        display = data.get("catalog_display", name_norm)
        amount = currency_service.display_amount_for_user(data, user_pref) or 0.0
        qty = float(data.get("quantity") or 1)

        if name_norm not in by_catalog:
            by_catalog[name_norm] = {
                "catalog_name_norm": name_norm,
                "display_name": display,
                "count": 0,
                "total_value": 0.0,
            }
        # `count` here is units thrown, not number of throw events. A partial
        # split that threw 2 of 12 contributes 2 units, not 1 event.
        by_catalog[name_norm]["count"] += qty
        by_catalog[name_norm]["total_value"] += amount
        thrown_count += qty
        thrown_value += amount

    for row in by_catalog.values():
        row["total_value"] = round(row["total_value"], 2)
    # Sort by value descending — "most expensive items thrown" is the
    # actionable framing for the dashboard scoreboard. Two items thrown
    # at RM 12 each is more useful to surface than ten items thrown at
    # RM 0.50 each. Tie-break by count.
    top_wasted = sorted(
        by_catalog.values(),
        key=lambda x: (x["total_value"], x["count"]),
        reverse=True,
    )[:10]

    return {
        "period": period,
        "from_date": from_date,
        "to_date": to_date,
        "display_currency": user_pref,
        "thrown_count": thrown_count,
        "thrown_value": round(thrown_value, 2),
        "top_wasted": top_wasted,
    }


@timed("waste.get_financial_summary")
def get_financial_summary(user_id: str, period: str = "month") -> dict:
    """Per-catalog spending vs wasted-money comparison for a period.

    Gated by the `financial_tracking` flag at the route layer. Returns a list of
    rows (one per catalog entry purchased in the period) with total_spent,
    thrown_value, waste_pct, etc. Sorted by thrown_value DESC so high-waste
    items surface first.

    Args:
        period: "month" | "week" | "year" | "all"
    """
    now = datetime.now(timezone.utc)
    if period == "week":
        from_date = now - timedelta(days=7)
    elif period == "month":
        from_date = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    elif period == "year":
        from_date = datetime(now.year, 1, 1, tzinfo=timezone.utc)
    elif period == "all":
        from_date = datetime(2000, 1, 1, tzinfo=timezone.utc)
    else:
        from_date = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        period = "month"

    q = (
        _user_purchases_ref(user_id)
        .where(filter=FieldFilter("date_bought", ">=", from_date))
    )

    rows: dict[str, dict[str, Any]] = {}
    grand_spent = 0.0
    grand_wasted = 0.0

    for doc in q.stream():
        data = doc.to_dict() or {}
        name_norm = data.get("catalog_name_norm", "(unknown)")
        display = data.get("catalog_display", name_norm)
        price = float(data.get("price") or 0.0)
        status = data.get("status", "active")
        qty = float(data.get("quantity") or 1)

        row = rows.setdefault(
            name_norm,
            {
                "catalog_name_norm": name_norm,
                "display_name": display,
                "total_purchases": 0,
                "total_spent": 0.0,
                "active_count": 0,
                "used_count": 0,
                "thrown_count": 0,
                "thrown_value": 0.0,
            },
        )
        # All counts are unit-based (sum of event.quantity) so waste_pct
        # reflects "units thrown / units bought", not "throw events / buy
        # events" — a partial split of 2 from 12 reads as 2/12, not 1/2.
        row["total_purchases"] += qty
        row["total_spent"] += price
        grand_spent += price
        if status == "active":
            row["active_count"] += qty
        elif status == "used":
            row["used_count"] += qty
        elif status == "thrown":
            # Waste-reason filter (validation-stage rule): only `expired`
            # + `unexpected_event` count as waste. Legacy `bad` coerces.
            from app.schemas.purchase import WASTE_REASONS
            raw_reason = (data.get("consumed_reason") or "").lower()
            if raw_reason == "bad":
                raw_reason = "unexpected_event"
            if raw_reason in WASTE_REASONS:
                row["thrown_count"] += qty
                row["thrown_value"] += price
                grand_wasted += price

    # Derived per-row metrics
    for row in rows.values():
        total = row["total_purchases"]
        row["waste_pct"] = round(row["thrown_count"] / total, 3) if total else 0.0
        spent = row["total_spent"]
        row["waste_value_pct"] = round(row["thrown_value"] / spent, 3) if spent else 0.0
        row["total_spent"] = round(row["total_spent"], 2)
        row["thrown_value"] = round(row["thrown_value"], 2)

    sorted_rows = sorted(
        rows.values(),
        key=lambda r: (r["thrown_value"], r["total_spent"]),
        reverse=True,
    )

    return {
        "period": period,
        "from_date": from_date,
        "to_date": now,
        "grand_total_spent": round(grand_spent, 2),
        "grand_total_wasted": round(grand_wasted, 2),
        "grand_waste_pct": round(grand_wasted / grand_spent, 3) if grand_spent else 0.0,
        "rows": sorted_rows,
    }


@timed("waste.get_spending_summary")
def get_spending_summary(user_id: str, period: str = "month") -> dict:
    """Aggregate spending (cash vs card) for a period.

    Args:
        period: "month" (default) | "week" | "last_month" | "year" | "all"

    Read-time currency conversion: amounts are returned in the user's
    current currency_preference, not the display_amount locked at save.
    """
    from app.services import currency_service

    now = datetime.now(timezone.utc)
    from_date, to_date, period = _period_range(period, now)
    user_pref = _user_currency_pref(user_id)

    q = (
        _user_purchases_ref(user_id)
        .where(filter=FieldFilter("date_bought", ">=", from_date))
        .where(filter=FieldFilter("date_bought", "<", to_date))
    )

    cash_total = 0.0
    card_total = 0.0
    other_total = 0.0  # has price, no payment_method recorded
    untracked = 0      # has no price at all
    items: list[dict[str, Any]] = []

    for doc in q.stream():
        data = doc.to_dict() or {}
        amount = currency_service.display_amount_for_user(data, user_pref)
        if amount is None:
            untracked += 1
            continue
        method = data.get("payment_method")
        if method == "cash":
            cash_total += amount
        elif method == "card":
            card_total += amount
        else:
            other_total += amount
        items.append({
            "id": doc.id,
            "catalog_name_norm": data.get("catalog_name_norm"),
            "display_name": data.get("catalog_display") or data.get("catalog_name_norm") or "(unknown)",
            "amount": round(amount, 2),
            "quantity": float(data.get("quantity") or 1),
            "date_bought": data.get("date_bought"),
        })

    # Top-5 most expensive purchase events for the period — drives the
    # dashboard scoreboard's per-card expand. We rank by display-currency
    # amount so the ordering matches what the user sees on screen.
    items.sort(key=lambda x: x["amount"], reverse=True)
    top_items = items[:5]

    return {
        "period": period,
        "from_date": from_date,
        "to_date": to_date,
        "display_currency": user_pref,
        "cash_total": round(cash_total, 2),
        "card_total": round(card_total, 2),
        "other_total": round(other_total, 2),
        # grand_total now sums ALL price-bearing events regardless of payment
        # method — events without a price are the only thing that "untracked"
        # really means now.
        "grand_total": round(cash_total + card_total + other_total, 2),
        "untracked_count": untracked,
        "top_items": top_items,
    }
