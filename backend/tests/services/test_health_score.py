"""Unit tests for the health-score formula (pure computation, no Firestore).

The backend `waste_service.compute_health_score` reads from Firestore; these
tests replicate the formula directly on HealthComponents to guard against
formula regressions (client + server must match — see docs/HEALTH_SCORE.md).
"""

from __future__ import annotations


def _compute_score(
    active_healthy: int,
    active_expiring_7d: int,
    active_expiring_3d: int,
    active_expired: int,
    active_untracked: int,
    thrown_this_month: int,
    used_this_month: int,
) -> int:
    """Mirror of waste_service.compute_health_score formula."""
    active_total = (
        active_healthy + active_expiring_7d + active_expiring_3d + active_expired + active_untracked
    )
    total_month = thrown_this_month + used_this_month
    if active_total == 0 and total_month == 0:
        return 100

    if active_total > 0:
        active_component = (
            active_healthy * 1.0
            + active_expiring_7d * 0.8
            + active_expiring_3d * 0.5
            + active_expired * 0.0
            + active_untracked * 0.6
        ) / active_total
    else:
        active_component = 1.0

    waste_rate = thrown_this_month / total_month if total_month else 0.0
    waste_component = 1.0 - waste_rate
    return int(round(100 * (0.7 * active_component + 0.3 * waste_component)))


def test_brand_new_user_scores_100():
    assert _compute_score(0, 0, 0, 0, 0, 0, 0) == 100


def test_all_healthy_perfect_score():
    # 10 healthy, no waste → score = 100
    assert _compute_score(10, 0, 0, 0, 0, 0, 0) == 100


def test_all_expired_floors_score():
    # All items expired + no used/thrown → active component = 0, waste = 0
    # score = 100 * (0.7 * 0 + 0.3 * 1) = 30
    assert _compute_score(0, 0, 0, 5, 0, 0, 0) == 30


def test_mixed_waste_degrades_score():
    # 5 healthy + 5 thrown this month, 5 used → waste rate 0.5
    # active_component = 1.0, waste_component = 0.5
    # score = 100 * (0.7 * 1 + 0.3 * 0.5) = 100 * 0.85 = 85
    assert _compute_score(5, 0, 0, 0, 0, 5, 5) == 85


def test_pure_waste_month_scores_low():
    # no active items, 100% waste this month
    # active_total=0 → active_component=1, waste_component=0
    # score = 100 * (0.7 * 1 + 0.3 * 0) = 70
    assert _compute_score(0, 0, 0, 0, 0, 10, 0) == 70


def test_untracked_contributes_partial_health():
    # 10 untracked (0.6 weight) → active_component = 0.6
    # score = 100 * (0.7 * 0.6 + 0.3 * 1) = 72
    assert _compute_score(0, 0, 0, 0, 10, 0, 0) == 72


def test_expiring_7d_weight():
    # 10 expiring in 4-7d (weight 0.8) → active_component = 0.8
    # score = 100 * (0.7 * 0.8 + 0.3 * 1) = 86
    assert _compute_score(0, 10, 0, 0, 0, 0, 0) == 86


def test_expiring_3d_weight():
    # 10 expiring in <=3d (weight 0.5)
    # score = 100 * (0.7 * 0.5 + 0.3 * 1) = 65
    assert _compute_score(0, 0, 10, 0, 0, 0, 0) == 65


def test_critical_scenario():
    # 2 healthy + 3 expired + 5 thrown / 1 used this month
    # active_total = 5, active_component = (2 + 0)/5 = 0.4
    # waste_rate = 5/6 ≈ 0.833, waste_component ≈ 0.167
    # score = 100 * (0.7 * 0.4 + 0.3 * 0.167) ≈ 100 * (0.28 + 0.05) = 33
    score = _compute_score(2, 0, 0, 3, 0, 5, 1)
    assert 30 <= score <= 36


def test_grade_thresholds_from_score():
    """Grade bands: green >= 80, yellow 50-79, red < 50."""
    def grade(score: int) -> str:
        if score >= 80:
            return "green"
        if score >= 50:
            return "yellow"
        return "red"

    assert grade(_compute_score(10, 0, 0, 0, 0, 0, 0)) == "green"    # 100
    assert grade(_compute_score(5, 0, 0, 0, 0, 5, 5)) == "green"      # 85
    assert grade(_compute_score(0, 10, 0, 0, 0, 0, 0)) == "green"     # 86
    assert grade(_compute_score(0, 0, 10, 0, 0, 0, 0)) == "yellow"    # 65
    assert grade(_compute_score(0, 0, 0, 5, 0, 0, 0)) == "red"        # 30
