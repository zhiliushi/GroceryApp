"""
AI Insights service — rule-based heuristics for grocery insights.

Generates actionable recommendations from user analytics and inventory data.
Uses local Ollama or OpenAI when available; falls back to rule-based engine.
"""

import logging
import time
from typing import Any, Dict, List, Optional
from collections import Counter, defaultdict

import httpx

from app.core.config import settings
from app.schemas.analytics import Insight, InsightPriority, InsightCategory

logger = logging.getLogger(__name__)


async def generate_insights(
    events: List[Dict[str, Any]],
    inventory: List[Dict[str, Any]],
) -> List[Insight]:
    """
    Generate insights from analytics events and current inventory.

    1. Try AI service (Ollama / OpenAI) for rich insights
    2. Fall back to rule-based heuristics
    """
    # Try AI-powered insights first
    ai_insights = await _try_ai_insights(events, inventory)
    if ai_insights:
        return ai_insights

    # Fall back to rule-based
    return _rule_based_insights(events, inventory)


# ---------------------------------------------------------------------------
# AI-powered insights (Ollama / OpenAI)
# ---------------------------------------------------------------------------

async def _try_ai_insights(
    events: List[Dict[str, Any]],
    inventory: List[Dict[str, Any]],
) -> Optional[List[Insight]]:
    """Attempt to generate insights via an AI service."""
    if not settings.AI_SERVICE_URL:
        return None

    try:
        summary = _build_data_summary(events, inventory)
        prompt = (
            "You are a grocery management assistant. Based on the following user data, "
            "generate 3-5 actionable insights about their grocery habits. "
            "Focus on: waste reduction, shopping optimization, nutrition balance, and budget.\n\n"
            f"Data Summary:\n{summary}\n\n"
            "Respond with a JSON array of objects, each with: "
            "title (short), description (1-2 sentences), "
            "priority (high/medium/low), category (waste_reduction/shopping_optimization/nutrition/budget/expiry_warning)."
        )

        async with httpx.AsyncClient(timeout=15.0) as client:
            # Try Ollama format first
            resp = await client.post(
                f"{settings.AI_SERVICE_URL}/api/generate",
                json={
                    "model": settings.AI_MODEL_NAME,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json",
                },
            )

        if resp.status_code == 200:
            data = resp.json()
            response_text = data.get("response", "")
            return _parse_ai_response(response_text)

    except Exception as e:
        logger.info("AI insights unavailable, using rule-based: %s", e)

    return None


def _parse_ai_response(text: str) -> Optional[List[Insight]]:
    """Parse AI response into Insight objects."""
    import json
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict) and "insights" in parsed:
            parsed = parsed["insights"]
        if not isinstance(parsed, list):
            return None

        insights = []
        for item in parsed[:5]:
            insights.append(Insight(
                title=item.get("title", "Insight"),
                description=item.get("description", ""),
                priority=InsightPriority(item.get("priority", "medium")),
                category=InsightCategory(item.get("category", "shopping_optimization")),
            ))
        return insights if insights else None
    except (json.JSONDecodeError, ValueError, KeyError):
        return None


def _build_data_summary(
    events: List[Dict[str, Any]],
    inventory: List[Dict[str, Any]],
) -> str:
    """Build a text summary of user data for the AI prompt."""
    # Count event types
    event_counts = Counter(e.get("event_type", "unknown") for e in events)

    # Count inventory status
    active = sum(1 for i in inventory if i.get("status") == "active")
    expired = sum(1 for i in inventory if i.get("status") == "expired")
    consumed = sum(1 for i in inventory if i.get("status") == "consumed")

    # Count categories
    categories = Counter(i.get("categoryId", "unknown") for i in inventory)

    lines = [
        f"Total events: {len(events)}",
        f"Event breakdown: {dict(event_counts)}",
        f"Active inventory items: {active}",
        f"Expired items: {expired}",
        f"Consumed items: {consumed}",
        f"Category distribution: {dict(categories)}",
    ]

    # Expiry warnings
    now_ms = int(time.time() * 1000)
    three_days_ms = 3 * 24 * 60 * 60 * 1000
    expiring_soon = [
        i for i in inventory
        if i.get("status") == "active"
        and i.get("expiryDate")
        and isinstance(i.get("expiryDate"), (int, float))
        and 0 < (i["expiryDate"] - now_ms) < three_days_ms
    ]
    if expiring_soon:
        names = [i.get("name", "unknown") for i in expiring_soon[:10]]
        lines.append(f"Items expiring within 3 days: {names}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Rule-based insights (fallback)
# ---------------------------------------------------------------------------

def _rule_based_insights(
    events: List[Dict[str, Any]],
    inventory: List[Dict[str, Any]],
) -> List[Insight]:
    """Generate insights using deterministic rules."""
    insights: List[Insight] = []

    _check_waste(events, inventory, insights)
    _check_shopping_frequency(events, insights)
    _check_expiry_warnings(inventory, insights)
    _check_nutrition_balance(inventory, insights)
    _check_budget(events, insights)

    # Sort by priority (high first)
    priority_order = {InsightPriority.HIGH: 0, InsightPriority.MEDIUM: 1, InsightPriority.LOW: 2}
    insights.sort(key=lambda i: priority_order.get(i.priority, 1))

    return insights[:5]


def _check_waste(
    events: List[Dict[str, Any]],
    inventory: List[Dict[str, Any]],
    insights: List[Insight],
) -> None:
    """Check waste levels."""
    expired_count = sum(
        1 for e in events
        if e.get("event_type") == "item_consumed"
        and e.get("event_data", {}).get("reason") in ("expired", "discarded")
    )
    total_consumed = sum(
        1 for e in events if e.get("event_type") == "item_consumed"
    )

    if total_consumed > 0:
        waste_pct = expired_count / total_consumed * 100
        if waste_pct > 20:
            # Find most wasted category
            wasted_categories = Counter(
                e.get("event_data", {}).get("categoryId", "unknown")
                for e in events
                if e.get("event_type") == "item_consumed"
                and e.get("event_data", {}).get("reason") in ("expired", "discarded")
            )
            top_cat = wasted_categories.most_common(1)
            cat_hint = f" Most waste is in your {top_cat[0][0]} category." if top_cat else ""

            insights.append(Insight(
                title="High food waste detected",
                description=f"{waste_pct:.0f}% of your items were wasted.{cat_hint} "
                            f"Consider buying smaller quantities or planning meals ahead.",
                priority=InsightPriority.HIGH,
                category=InsightCategory.WASTE,
            ))
    elif len(inventory) == 0 and len(events) == 0:
        insights.append(Insight(
            title="Start tracking your groceries",
            description="Add items to your inventory to get personalized insights "
                        "about your shopping habits and reduce food waste.",
            priority=InsightPriority.LOW,
            category=InsightCategory.SHOPPING,
        ))


def _check_shopping_frequency(
    events: List[Dict[str, Any]],
    insights: List[Insight],
) -> None:
    """Analyze shopping trip frequency."""
    # Count unique purchase dates
    purchase_days = set()
    for e in events:
        if e.get("event_type") == "item_added":
            ts = e.get("timestamp")
            if ts and isinstance(ts, (int, float)):
                day = int(ts) // (24 * 60 * 60 * 1000)
                purchase_days.add(day)

    if len(purchase_days) >= 3:
        sorted_days = sorted(purchase_days)
        intervals = [sorted_days[i + 1] - sorted_days[i] for i in range(len(sorted_days) - 1)]
        avg_interval = sum(intervals) / len(intervals)

        if avg_interval < 2:
            insights.append(Insight(
                title="Frequent shopping trips",
                description="You're shopping almost every day. Planning weekly trips "
                            "could save time and reduce impulse purchases.",
                priority=InsightPriority.MEDIUM,
                category=InsightCategory.SHOPPING,
            ))


def _check_expiry_warnings(
    inventory: List[Dict[str, Any]],
    insights: List[Insight],
) -> None:
    """Warn about items expiring soon."""
    now_ms = int(time.time() * 1000)
    three_days_ms = 3 * 24 * 60 * 60 * 1000

    expiring = []
    for item in inventory:
        if item.get("status") != "active":
            continue
        exp = item.get("expiryDate")
        if not exp or not isinstance(exp, (int, float)):
            continue
        remaining = exp - now_ms
        if 0 < remaining < three_days_ms:
            expiring.append(item.get("name", "Unknown item"))

    if expiring:
        names = ", ".join(expiring[:5])
        extra = f" and {len(expiring) - 5} more" if len(expiring) > 5 else ""
        insights.append(Insight(
            title=f"{len(expiring)} item{'s' if len(expiring) != 1 else ''} expiring soon",
            description=f"Use {names}{extra} before they expire to reduce waste.",
            priority=InsightPriority.HIGH,
            category=InsightCategory.EXPIRY,
        ))


def _check_nutrition_balance(
    inventory: List[Dict[str, Any]],
    insights: List[Insight],
) -> None:
    """Check diversity of food categories."""
    active_items = [i for i in inventory if i.get("status") == "active"]
    if not active_items:
        return

    food_categories = {"Dairy", "Produce", "Meat", "Bakery", "Beverages", "Frozen", "Snacks"}
    categories_present = set()

    for item in active_items:
        cat = item.get("categoryId", "")
        # categoryId is a UUID — use name field fallback or map
        cat_name = item.get("category_name", cat)
        if cat_name in food_categories:
            categories_present.add(cat_name)

    coverage = len(categories_present) / len(food_categories) * 100

    if coverage < 40:
        missing = food_categories - categories_present
        missing_list = ", ".join(sorted(missing)[:3])
        insights.append(Insight(
            title="Limited food variety",
            description=f"Your inventory covers {coverage:.0f}% of food groups. "
                        f"Consider adding {missing_list} for a more balanced diet.",
            priority=InsightPriority.MEDIUM,
            category=InsightCategory.NUTRITION,
        ))


def _check_budget(
    events: List[Dict[str, Any]],
    insights: List[Insight],
) -> None:
    """Check spending trends."""
    # Group spending by week
    weekly_spend: Dict[int, float] = defaultdict(float)
    for e in events:
        if e.get("event_type") == "item_added":
            price = e.get("event_data", {}).get("price")
            ts = e.get("timestamp")
            if price and isinstance(price, (int, float)) and ts:
                week = int(ts) // (7 * 24 * 60 * 60 * 1000)
                weekly_spend[week] += float(price)

    if len(weekly_spend) >= 2:
        sorted_weeks = sorted(weekly_spend.keys())
        recent = weekly_spend[sorted_weeks[-1]]
        previous = weekly_spend[sorted_weeks[-2]]

        if previous > 0:
            change_pct = (recent - previous) / previous * 100
            if change_pct > 20:
                insights.append(Insight(
                    title="Spending increase",
                    description=f"Your grocery spending increased {change_pct:.0f}% this week "
                                f"compared to last week. Review your shopping list for savings.",
                    priority=InsightPriority.MEDIUM,
                    category=InsightCategory.BUDGET,
                ))


# ---------------------------------------------------------------------------
# Milestone check (Phase 3 scheduler entry point + Phase 5 rich content)
# ---------------------------------------------------------------------------

MILESTONES = (50, 100, 500, 1000)
WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _aggregate_user_stats(db, uid: str) -> Dict[str, Any]:
    """Aggregate everything needed for a milestone insight in one pass.

    Reads: catalog_entries (user-scoped), users/{uid}/purchases (all).
    Returns aggregate dict used by `_build_milestone_doc`.
    """
    from datetime import datetime as _dt

    # Catalog entries → top_purchased + avoid_list
    catalog_entries: List[Dict[str, Any]] = []
    for doc in db.collection("catalog_entries").where("user_id", "==", uid).stream():
        data = doc.to_dict() or {}
        catalog_entries.append(data)

    total_purchases = sum(int(e.get("total_purchases", 0)) for e in catalog_entries)

    top_purchased = sorted(
        [
            {
                "name": e.get("display_name") or e.get("name_norm", "(unknown)"),
                "name_norm": e.get("name_norm", ""),
                "count": int(e.get("total_purchases", 0)),
            }
            for e in catalog_entries
        ],
        key=lambda x: x["count"],
        reverse=True,
    )[:10]

    # Purchase events → waste_breakdown, spending, frequency
    cash = 0.0
    card = 0.0
    dates_bought: List[_dt] = []
    waste_by_name: Dict[str, Dict[str, Any]] = {}
    status_counts: Dict[str, int] = defaultdict(int)
    per_catalog_counts: Dict[str, Dict[str, int]] = defaultdict(lambda: {"total": 0, "thrown": 0})

    for doc in db.collection("users").document(uid).collection("purchases").stream():
        data = doc.to_dict() or {}
        status = data.get("status", "active")
        status_counts[status] += 1
        price = data.get("price")
        method = data.get("payment_method")
        if price is not None and method == "cash":
            cash += float(price)
        elif price is not None and method == "card":
            card += float(price)

        db_date = data.get("date_bought")
        if hasattr(db_date, "to_datetime"):
            db_date = db_date.to_datetime()
        if isinstance(db_date, _dt):
            dates_bought.append(db_date)

        name_norm = data.get("catalog_name_norm", "")
        display = data.get("catalog_display") or name_norm
        per_catalog_counts[name_norm]["total"] += 1
        if status == "thrown":
            per_catalog_counts[name_norm]["thrown"] += 1
            if name_norm not in waste_by_name:
                waste_by_name[name_norm] = {
                    "name": display,
                    "name_norm": name_norm,
                    "count": 0,
                    "value": 0.0,
                }
            waste_by_name[name_norm]["count"] += 1
            if price is not None:
                waste_by_name[name_norm]["value"] += float(price)

    waste_breakdown = sorted(
        [
            {**v, "value": round(v["value"], 2)}
            for v in waste_by_name.values()
        ],
        key=lambda x: x["count"],
        reverse=True,
    )[:10]

    # Avoid list: catalog entries with waste_rate > 30% and at least 3 thrown
    avoid_list: List[Dict[str, Any]] = []
    for nm, counts in per_catalog_counts.items():
        if counts["total"] < 3:
            continue
        rate = counts["thrown"] / counts["total"]
        if rate >= 0.3 and counts["thrown"] >= 3:
            entry = next((e for e in catalog_entries if e.get("name_norm") == nm), None)
            avoid_list.append(
                {
                    "name": entry.get("display_name", nm) if entry else nm,
                    "name_norm": nm,
                    "waste_rate": round(rate, 3),
                    "thrown": counts["thrown"],
                    "total": counts["total"],
                }
            )
    avoid_list.sort(key=lambda x: x["waste_rate"], reverse=True)
    avoid_list = avoid_list[:10]

    # Shopping frequency: sort dates, compute gaps, find peak weekday
    avg_days_between: Optional[float] = None
    peak_day: Optional[str] = None
    if len(dates_bought) >= 2:
        sorted_dates = sorted(dates_bought)
        gaps = [
            (sorted_dates[i] - sorted_dates[i - 1]).days
            for i in range(1, len(sorted_dates))
            if (sorted_dates[i] - sorted_dates[i - 1]).days > 0
        ]
        if gaps:
            avg_days_between = round(sum(gaps) / len(gaps), 1)
    if dates_bought:
        weekday_counts = Counter(d.weekday() for d in dates_bought)
        if weekday_counts:
            peak_wd = weekday_counts.most_common(1)[0][0]
            peak_day = WEEKDAY_NAMES[peak_wd]

    return {
        "total_purchases": total_purchases,
        "top_purchased": top_purchased,
        "waste_breakdown": waste_breakdown,
        "spending": {
            "cash": round(cash, 2),
            "card": round(card, 2),
            "total": round(cash + card, 2),
        },
        "shopping_frequency": {
            "avg_days_between": avg_days_between,
            "peak_day": peak_day,
        },
        "avoid_list": avoid_list,
        "status_counts": dict(status_counts),
    }


def _narrative(milestone: int, stats: Dict[str, Any]) -> str:
    """Rule-based summary text. LLM polish is a future enhancement."""
    total = stats["total_purchases"]
    used = stats["status_counts"].get("used", 0)
    thrown = stats["status_counts"].get("thrown", 0)
    terminal = used + thrown
    waste_rate = (thrown / terminal) if terminal else 0.0

    pieces = [f"You've crossed {milestone} purchases."]
    if stats["top_purchased"]:
        top = stats["top_purchased"][0]
        pieces.append(f"Your most-bought item is {top['name']} ({top['count']}×).")
    if terminal:
        pieces.append(
            f"So far you've used {used} and thrown {thrown} "
            f"({int(waste_rate * 100)}% waste rate)."
        )
    freq = stats["shopping_frequency"]
    if freq.get("avg_days_between") and freq.get("peak_day"):
        pieces.append(
            f"You shop about every {freq['avg_days_between']} days, most often on {freq['peak_day']}."
        )
    if stats["avoid_list"]:
        worst = stats["avoid_list"][0]
        pieces.append(
            f"Consider buying less {worst['name']} — you've thrown "
            f"{int(worst['waste_rate'] * 100)}% of what you bought."
        )
    return " ".join(pieces)


def _build_milestone_doc(milestone: int, stats: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "kind": "milestone",
        "milestone": milestone,
        "total_purchases_at_trigger": stats["total_purchases"],
        "status": "ready",
        "title": f"You've bought {milestone} items!",
        "description": _narrative(milestone, stats),
        "top_purchased": stats["top_purchased"],
        "waste_breakdown": stats["waste_breakdown"],
        "spending": stats["spending"],
        "shopping_frequency": stats["shopping_frequency"],
        "avoid_list": stats["avoid_list"],
    }


def check_user_milestones(uid: str) -> int:
    """Single-user milestone check. Idempotent (skips if doc already exists).

    Called from POST /api/purchases via BackgroundTasks for near-realtime triggering.
    Returns count of milestone docs emitted.
    """
    from firebase_admin import firestore
    from app.core.feature_flags import is_enabled
    from app.core.metadata import apply_create_metadata

    if not is_enabled("milestone_analytics"):
        return 0

    db = firestore.client()

    # Cheap first pass: aggregate total from catalog counters only.
    total = 0
    for doc in db.collection("catalog_entries").where("user_id", "==", uid).stream():
        total += int((doc.to_dict() or {}).get("total_purchases", 0))

    # Which milestones are due?
    due = [m for m in MILESTONES if total >= m]
    if not due:
        return 0

    # Filter out already-emitted
    not_emitted: List[int] = []
    for m in due:
        if not db.collection("users").document(uid).collection("insights").document(f"milestone_{m}").get().exists:
            not_emitted.append(m)
    if not_emitted:
        # Heavy pass only when we actually need to emit
        stats = _aggregate_user_stats(db, uid)
    else:
        return 0

    created = 0
    for m in not_emitted:
        insight_ref = (
            db.collection("users").document(uid)
            .collection("insights").document(f"milestone_{m}")
        )
        insight_ref.set(
            apply_create_metadata(
                _build_milestone_doc(m, stats),
                uid="system",
                source="scheduler",
            )
        )
        created += 1
        logger.info("insights.milestone user=%s milestone=%d", uid, m)
    return created


def check_milestones() -> int:
    """All-users scheduler entry point. Iterates every user, calls check_user_milestones.

    Returns count of milestone docs created this run.
    """
    from firebase_admin import firestore
    from app.core.feature_flags import is_enabled

    if not is_enabled("milestone_analytics"):
        logger.info("insights.check_milestones: skipped (flag off)")
        return 0

    db = firestore.client()
    # Aggregate users who have catalog entries
    users = set()
    for doc in db.collection("catalog_entries").stream():
        uid = (doc.to_dict() or {}).get("user_id")
        if uid:
            users.add(uid)

    created = 0
    for uid in users:
        try:
            created += check_user_milestones(uid)
        except Exception as exc:
            logger.exception("insights.check_milestones user=%s failed: %s", uid, exc)

    if created:
        logger.info("insights.check_milestones created=%d users=%d", created, len(users))
    return created
