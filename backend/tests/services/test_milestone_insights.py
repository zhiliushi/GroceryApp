"""Unit tests for milestone insight narrative + doc builder (pure computation)."""

from __future__ import annotations

from app.services import insights_service


def _base_stats(**overrides):
    stats = {
        "total_purchases": 50,
        "top_purchased": [],
        "waste_breakdown": [],
        "spending": {"cash": 0, "card": 0, "total": 0},
        "shopping_frequency": {"avg_days_between": None, "peak_day": None},
        "avoid_list": [],
        "status_counts": {},
    }
    stats.update(overrides)
    return stats


def test_narrative_minimum_mentions_milestone():
    text = insights_service._narrative(50, _base_stats())
    assert "50" in text


def test_narrative_includes_top_item():
    stats = _base_stats(top_purchased=[{"name": "Milk", "count": 12}])
    text = insights_service._narrative(100, stats)
    assert "Milk" in text
    assert "12" in text


def test_narrative_includes_waste_rate():
    stats = _base_stats(status_counts={"used": 40, "thrown": 10})
    text = insights_service._narrative(50, stats)
    assert "40" in text and "10" in text
    assert "20%" in text or "20 %" in text  # 10/50 = 20%


def test_narrative_includes_shopping_frequency():
    stats = _base_stats(
        shopping_frequency={"avg_days_between": 7.0, "peak_day": "Saturday"},
    )
    text = insights_service._narrative(100, stats)
    assert "7" in text
    assert "Saturday" in text


def test_narrative_includes_avoid_item_when_high_waste():
    stats = _base_stats(
        avoid_list=[{"name": "Bread", "waste_rate": 0.6, "thrown": 6, "total": 10}]
    )
    text = insights_service._narrative(50, stats)
    assert "Bread" in text
    assert "60%" in text


def test_narrative_no_avoid_list_when_empty():
    stats = _base_stats()  # no avoid_list
    text = insights_service._narrative(50, stats)
    assert "Consider buying less" not in text


def test_build_milestone_doc_has_expected_fields():
    stats = _base_stats(
        total_purchases=123,
        top_purchased=[{"name": "Eggs", "count": 20}],
        waste_breakdown=[{"name": "Yogurt", "count": 3, "value": 11.5}],
        spending={"cash": 120, "card": 230, "total": 350},
        shopping_frequency={"avg_days_between": 5.5, "peak_day": "Friday"},
        avoid_list=[],
        status_counts={"used": 100, "thrown": 10, "active": 13},
    )
    doc = insights_service._build_milestone_doc(100, stats)
    assert doc["kind"] == "milestone"
    assert doc["milestone"] == 100
    assert doc["status"] == "ready"
    assert doc["total_purchases_at_trigger"] == 123
    assert doc["spending"] == {"cash": 120, "card": 230, "total": 350}
    assert doc["shopping_frequency"]["avg_days_between"] == 5.5
    assert doc["top_purchased"][0]["name"] == "Eggs"
    assert "title" in doc and "description" in doc


def test_milestones_order():
    # Sanity: tuple is ascending — ensures "missing milestones" computation is well-defined
    assert insights_service.MILESTONES == (50, 100, 500, 1000)
    assert list(insights_service.MILESTONES) == sorted(insights_service.MILESTONES)
