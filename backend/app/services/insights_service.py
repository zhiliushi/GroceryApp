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
