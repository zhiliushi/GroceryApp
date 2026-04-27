"""Business-metrics aggregation service.

Single entrypoint `compute_metrics()` returns the shape consumed by
`/admin/business-metrics`. Designed so future products implement the same
shape and a Luqman Dev Hub tile can aggregate side-by-side.

Data sources (all Firestore):
  - `users/*`                                user signups + roles
  - `users/{uid}/purchases/*`                activation + items added/resolved
  - `users/{uid}/health_history/*`           median health trend
  - `app_config/revenue_log`                 manual revenue entries

Caching: results are cached 5 min in `app_config/business_metrics_cache`
since the per-user iteration is expensive once user count grows.
"""

from __future__ import annotations

import logging
import statistics
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from app.core.metadata import apply_create_metadata, apply_update_metadata
from app.core.slow_query import timed

logger = logging.getLogger(__name__)

_CACHE_TTL_SEC = 300  # 5 minutes
_CACHE_DOC = ("app_config", "business_metrics_cache")
_REVENUE_DOC = ("app_config", "revenue_log")
_PRODUCT_NAME = "GroceryApp"
_GOAL_USD = 200.0
_USD_TO_MYR = 4.7  # rough rate; user can override later if needed


def _db():
    return firestore.client()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _to_dt(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if hasattr(value, "to_datetime"):
        dt = value.to_datetime()
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    return None


# ---------------------------------------------------------------------------
# Revenue log (manual entry — until Stripe webhook lands)
# ---------------------------------------------------------------------------


def list_revenue_entries() -> list[dict]:
    """Return revenue log entries, newest-first."""
    snap = _db().collection(_REVENUE_DOC[0]).document(_REVENUE_DOC[1]).get()
    if not snap.exists:
        return []
    entries = (snap.to_dict() or {}).get("entries", []) or []
    return sorted(
        entries,
        key=lambda e: e.get("date", ""),
        reverse=True,
    )


def add_revenue_entry(
    *,
    actor_uid: str,
    date: str,
    source: str,
    amount_usd: float | None = None,
    amount_myr: float | None = None,
    note: str = "",
) -> dict:
    """Append a revenue entry. Either amount_usd or amount_myr is required;
    the other is computed at the configured rate."""
    if amount_usd is None and amount_myr is None:
        raise ValueError("Provide amount_usd or amount_myr")
    if amount_usd is None:
        amount_usd = round(float(amount_myr) / _USD_TO_MYR, 2)
    if amount_myr is None:
        amount_myr = round(float(amount_usd) * _USD_TO_MYR, 2)

    entry = {
        "id": f"{date}-{int(_now().timestamp())}",
        "date": date,
        "source": source,
        "amount_usd": float(amount_usd),
        "amount_myr": float(amount_myr),
        "note": note,
        "added_by": actor_uid,
        "added_at": _now().isoformat(),
    }

    doc_ref = _db().collection(_REVENUE_DOC[0]).document(_REVENUE_DOC[1])
    snap = doc_ref.get()
    if snap.exists:
        existing = snap.to_dict() or {}
        entries = list(existing.get("entries", []) or [])
        entries.append(entry)
        doc_ref.update(apply_update_metadata({"entries": entries}))
    else:
        doc_ref.set(apply_create_metadata({"entries": [entry]}, actor_uid, source="admin"))

    # Bust the metrics cache so revenue immediately reflects on dashboard
    try:
        _db().collection(_CACHE_DOC[0]).document(_CACHE_DOC[1]).delete()
    except Exception:
        pass

    return entry


def delete_revenue_entry(*, entry_id: str) -> bool:
    """Remove one entry by id. Returns True if deleted."""
    doc_ref = _db().collection(_REVENUE_DOC[0]).document(_REVENUE_DOC[1])
    snap = doc_ref.get()
    if not snap.exists:
        return False
    existing = snap.to_dict() or {}
    entries = [e for e in (existing.get("entries") or []) if e.get("id") != entry_id]
    if len(entries) == len(existing.get("entries") or []):
        return False
    doc_ref.update(apply_update_metadata({"entries": entries}))
    try:
        _db().collection(_CACHE_DOC[0]).document(_CACHE_DOC[1]).delete()
    except Exception:
        pass
    return True


# ---------------------------------------------------------------------------
# Metrics aggregation
# ---------------------------------------------------------------------------


@timed("business_metrics.compute")
def compute_metrics(use_cache: bool = True) -> dict:
    """Compute the full business-metrics payload.

    See docs/MARKET_VALIDATION.md for the framework. Cached 5 min in Firestore.
    """
    if use_cache:
        cached = _db().collection(_CACHE_DOC[0]).document(_CACHE_DOC[1]).get()
        if cached.exists:
            data = cached.to_dict() or {}
            ts = _to_dt(data.get("computed_at"))
            if ts and (_now() - ts).total_seconds() < _CACHE_TTL_SEC:
                return data

    now = _now()
    db = _db()

    # ---- Pass 1: users + signups ----
    users: list[dict] = []
    for doc in db.collection("users").stream():
        d = doc.to_dict() or {}
        users.append({
            "uid": doc.id,
            "created_at": _to_dt(d.get("created_at")),
            "is_admin": d.get("role") == "admin",
        })

    non_admin_users = [u for u in users if not u["is_admin"]]
    total_users = len(non_admin_users)

    # Signups by week (last 12 weeks)
    week_buckets: dict[str, int] = defaultdict(int)
    for u in non_admin_users:
        if not u["created_at"]:
            continue
        week_start = u["created_at"] - timedelta(days=u["created_at"].weekday())
        key = week_start.strftime("%Y-%m-%d")
        week_buckets[key] += 1
    signups_by_week = sorted(
        [{"week": k, "signups": v} for k, v in week_buckets.items()],
        key=lambda x: x["week"],
    )[-12:]

    cutoff_7d = now - timedelta(days=7)
    cutoff_30d = now - timedelta(days=30)
    new_signups_7d = sum(1 for u in non_admin_users if u["created_at"] and u["created_at"] >= cutoff_7d)
    new_signups_30d = sum(1 for u in non_admin_users if u["created_at"] and u["created_at"] >= cutoff_30d)

    # ---- Pass 2: per-user activation + activity ----
    activated_users = 0
    items_added_7d = 0
    items_resolved_7d = 0
    last_active_by_uid: dict[str, datetime | None] = {}
    purchase_count_total = 0
    active_purchase_count_total = 0

    for u in non_admin_users:
        uid = u["uid"]
        purchases_ref = db.collection("users").document(uid).collection("purchases")
        user_has_event = False
        latest_activity: datetime | None = None

        for p in purchases_ref.stream():
            pd = p.to_dict() or {}
            user_has_event = True
            purchase_count_total += 1
            status = pd.get("status", "active")
            if status == "active":
                active_purchase_count_total += 1

            date_bought = _to_dt(pd.get("date_bought"))
            updated_at = _to_dt(pd.get("updated_at")) or date_bought
            consumed_date = _to_dt(pd.get("consumed_date"))

            if updated_at and (latest_activity is None or updated_at > latest_activity):
                latest_activity = updated_at

            if date_bought and date_bought >= cutoff_7d:
                items_added_7d += 1
            if consumed_date and consumed_date >= cutoff_7d and status in ("used", "thrown", "transferred"):
                items_resolved_7d += 1

        if user_has_event:
            activated_users += 1
        last_active_by_uid[uid] = latest_activity

    activation_rate = (activated_users / total_users) if total_users else 0.0

    # ---- WAU / MAU ----
    wau = sum(1 for ts in last_active_by_uid.values() if ts and ts >= cutoff_7d)
    mau = sum(1 for ts in last_active_by_uid.values() if ts and ts >= cutoff_30d)
    wau_mau = (wau / mau) if mau else 0.0

    # ---- Retention (D7) ----
    cutoff_signup_min = now - timedelta(days=14)  # users who signed up at least 7d ago and at most 14d ago
    cutoff_signup_max = now - timedelta(days=7)
    d7_eligible = [
        u for u in non_admin_users
        if u["created_at"] and cutoff_signup_min <= u["created_at"] <= cutoff_signup_max
    ]
    d7_returned = sum(
        1 for u in d7_eligible
        if last_active_by_uid.get(u["uid"]) and last_active_by_uid[u["uid"]] >= cutoff_7d
    )
    d7_retention = (d7_returned / len(d7_eligible)) if d7_eligible else None

    # ---- Health-score median + 30d delta ----
    today_key = now.strftime("%Y-%m-%d")
    cutoff_30d_key = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    today_scores: list[int] = []
    old_scores: list[int] = []

    for u in non_admin_users:
        history_ref = db.collection("users").document(u["uid"]).collection("health_history")
        try:
            today_doc = history_ref.document(today_key).get()
            if today_doc.exists:
                score = (today_doc.to_dict() or {}).get("score")
                if isinstance(score, (int, float)):
                    today_scores.append(int(score))
            old_doc = history_ref.document(cutoff_30d_key).get()
            if old_doc.exists:
                score = (old_doc.to_dict() or {}).get("score")
                if isinstance(score, (int, float)):
                    old_scores.append(int(score))
        except Exception as exc:
            logger.debug("business_metrics.health_history failed uid=%s: %s", u["uid"], exc)

    median_today = int(statistics.median(today_scores)) if today_scores else None
    median_30d_ago = int(statistics.median(old_scores)) if old_scores else None
    health_trend = (
        "up" if median_today is not None and median_30d_ago is not None and median_today > median_30d_ago + 2
        else "down" if median_today is not None and median_30d_ago is not None and median_today < median_30d_ago - 2
        else "flat"
    )

    # ---- Revenue ----
    revenue_entries = list_revenue_entries()
    received_usd = sum(float(e.get("amount_usd") or 0) for e in revenue_entries)
    received_myr = sum(float(e.get("amount_myr") or 0) for e in revenue_entries)
    pct_to_goal = min(received_usd / _GOAL_USD, 1.0) if _GOAL_USD else 0.0

    # Revenue by month (last 12 months)
    by_month: dict[str, float] = defaultdict(float)
    for e in revenue_entries:
        date_str = e.get("date") or ""
        if len(date_str) >= 7:
            by_month[date_str[:7]] += float(e.get("amount_usd") or 0)
    revenue_by_month = sorted(
        [{"month": k, "amount_usd": round(v, 2)} for k, v in by_month.items()],
        key=lambda x: x["month"],
    )[-12:]

    # Forecast — simple last-30-days run-rate projection
    forecast_months_to_goal: float | None = None
    last_30d_revenue = sum(
        float(e.get("amount_usd") or 0)
        for e in revenue_entries
        if e.get("date") and e["date"] >= cutoff_30d.strftime("%Y-%m-%d")
    )
    if last_30d_revenue > 0:
        remaining = max(_GOAL_USD - received_usd, 0)
        forecast_months_to_goal = round(remaining / last_30d_revenue, 1) if last_30d_revenue else None

    last_revenue_date = revenue_entries[0].get("date") if revenue_entries else None
    days_since_last_revenue: int | None = None
    if last_revenue_date:
        try:
            d = datetime.strptime(last_revenue_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            days_since_last_revenue = (now - d).days
        except ValueError:
            pass

    # ---- Signals ----
    signals = _build_signals(
        mau=mau,
        wau=wau,
        wau_mau=wau_mau,
        d7_retention=d7_retention,
        median_today=median_today,
        median_30d_ago=median_30d_ago,
        days_since_last_revenue=days_since_last_revenue,
        revenue_total=received_usd,
        total_users=total_users,
    )

    payload = {
        "product": {
            "name": _PRODUCT_NAME,
            "computed_at": now.isoformat(),
        },
        "acquisition": {
            "total_users": total_users,
            "new_signups_7d": new_signups_7d,
            "new_signups_30d": new_signups_30d,
            "by_week": signups_by_week,
        },
        "activation": {
            "activated_users": activated_users,
            "activation_rate": round(activation_rate, 3),
            "purchase_count_total": purchase_count_total,
            "active_purchase_count_total": active_purchase_count_total,
        },
        "engagement": {
            "wau": wau,
            "mau": mau,
            "wau_mau_ratio": round(wau_mau, 3),
            "items_added_7d": items_added_7d,
            "items_resolved_7d": items_resolved_7d,
            "items_per_wau_7d": round(items_added_7d / wau, 2) if wau else 0.0,
        },
        "retention": {
            "d7": round(d7_retention, 3) if d7_retention is not None else None,
            "d7_eligible_count": len(d7_eligible),
            "d7_returned_count": d7_returned,
        },
        "health": {
            "median_today": median_today,
            "median_30d_ago": median_30d_ago,
            "trend": health_trend,
            "sample_size": len(today_scores),
        },
        "revenue": {
            "goal_usd": _GOAL_USD,
            "goal_myr": round(_GOAL_USD * _USD_TO_MYR, 2),
            "received_usd": round(received_usd, 2),
            "received_myr": round(received_myr, 2),
            "pct_to_goal": round(pct_to_goal, 3),
            "by_month": revenue_by_month,
            "last_30d_usd": round(last_30d_revenue, 2),
            "forecast_months_to_goal": forecast_months_to_goal,
            "days_since_last_entry": days_since_last_revenue,
            "entry_count": len(revenue_entries),
        },
        "signals": signals,
        "computed_at": now,
    }

    # Persist cache
    try:
        _db().collection(_CACHE_DOC[0]).document(_CACHE_DOC[1]).set(
            apply_update_metadata(payload), merge=False
        )
    except Exception as exc:
        logger.warning("business_metrics.cache_write failed: %s", exc)

    # Return-friendly: ISO-string the timestamp
    payload["computed_at"] = now.isoformat()
    return payload


def _build_signals(
    *,
    mau: int,
    wau: int,
    wau_mau: float,
    d7_retention: float | None,
    median_today: int | None,
    median_30d_ago: int | None,
    days_since_last_revenue: int | None,
    revenue_total: float,
    total_users: int,
) -> list[dict]:
    """Return the auto-generated signal cards for the dashboard."""
    out: list[dict] = []

    if total_users == 0:
        out.append({
            "kind": "info",
            "title": "No users yet",
            "text": "Pick 3 friends. Send them the link today. Goal: 5 signups by next Sunday.",
        })
        return out

    if mau < 5:
        out.append({
            "kind": "warn",
            "title": "MAU < 5",
            "text": "Text 3 friends today and ask them to try it. No friend lookups, no excuses.",
        })

    if d7_retention is not None and d7_retention < 0.10:
        out.append({
            "kind": "warn",
            "title": "D7 retention < 10%",
            "text": "Do a 15-min call with 1 churned user this week. Ask: what made you stop?",
        })

    if days_since_last_revenue is not None and days_since_last_revenue > 30 and revenue_total == 0:
        out.append({
            "kind": "warn",
            "title": "30+ days, $0 revenue",
            "text": "Ask 3 active users: 'Would you pay MYR 5/mo for this?' Measure responses, don't sell.",
        })
    elif revenue_total == 0 and total_users >= 3:
        out.append({
            "kind": "info",
            "title": "No revenue yet",
            "text": "Add a Buy Me a Coffee link to Settings page. Cost: 0. Time: 5 min.",
        })

    if median_today is not None and median_30d_ago is not None and median_today > median_30d_ago + 2:
        out.append({
            "kind": "good",
            "title": "Health score rising",
            "text": "Product is working — users waste less. Tell that story to next 3 prospects.",
        })

    if wau_mau >= 0.4 and total_users >= 10:
        out.append({
            "kind": "good",
            "title": "Foundation solid",
            "text": "WAU/MAU > 0.4 and 10+ users. Time to buy domain + plan paid tier.",
        })

    if not out:
        out.append({
            "kind": "info",
            "title": "All quiet",
            "text": "No alarms, no escalations. Keep the weekly review ritual; ship product #2 progress in parallel.",
        })

    return out
