"""Integration tests for partial-action splits (Phases 1, 4) + quantity-based
aggregators (Phase 3).

Each test starts from a fresh uid (autoclean fixture wipes after) so writes
are isolated. These exercise the real Firestore transactions — mocks would
miss the catalog-counter math, the lineage field writes, and the
proportional price split.
"""

from __future__ import annotations

import pytest

from app.core.exceptions import ValidationError
from app.services import catalog_service, purchase_event_service, waste_service


# ---------------------------------------------------------------------------
# Phase 1 — split-on-status (used / thrown / transferred)
# ---------------------------------------------------------------------------


def test_partial_thrown_splits_event_with_lineage(fresh_uid):
    """Throwing 2 of a 12-pack creates a new thrown event + decrements original."""
    p = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=12, price=6.0, location="fridge",
    )
    new_event = purchase_event_service.update_status(
        user_id=fresh_uid, event_id=p["id"], status="thrown",
        reason="expired", quantity=2,
    )
    # New event is the terminal one with the portion + lineage.
    assert new_event["id"] != p["id"]
    assert new_event["status"] == "thrown"
    assert new_event["quantity"] == 2
    assert new_event["consumed_reason"] == "expired"
    assert new_event["split_from_event_id"] == p["id"]
    assert new_event["consumed_date"] is not None
    # Price split proportionally — 2/12 of 6.0 = 1.0
    assert new_event["price"] == pytest.approx(1.0, abs=0.001)

    # Original event decremented and stays active.
    original = purchase_event_service.get_purchase(fresh_uid, p["id"])
    assert original["status"] == "active"
    assert original["quantity"] == 10
    assert original["price"] == pytest.approx(5.0, abs=0.001)


def test_partial_used_splits_with_default_reason(fresh_uid):
    """Marking 3 of 5 used defaults consumed_reason to 'used_up'."""
    p = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Bananas", quantity=5,
    )
    new_event = purchase_event_service.update_status(
        user_id=fresh_uid, event_id=p["id"], status="used", quantity=3,
    )
    assert new_event["status"] == "used"
    assert new_event["quantity"] == 3
    assert new_event["consumed_reason"] == "used_up"
    assert new_event["split_from_event_id"] == p["id"]

    original = purchase_event_service.get_purchase(fresh_uid, p["id"])
    assert original["quantity"] == 2
    assert original["status"] == "active"


def test_partial_transferred_carries_recipient(fresh_uid):
    """Giving away 1 of 4 to a foodbank lands a transferred event with the recipient."""
    p = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Apples", quantity=4,
    )
    new_event = purchase_event_service.update_status(
        user_id=fresh_uid, event_id=p["id"], status="transferred",
        transferred_to="foodbank_xyz", quantity=1,
    )
    assert new_event["status"] == "transferred"
    assert new_event["transferred_to"] == "foodbank_xyz"
    assert new_event["quantity"] == 1
    assert new_event["split_from_event_id"] == p["id"]


def test_full_quantity_uses_legacy_path_no_split(fresh_uid):
    """Passing quantity == event.quantity should NOT split — original transitions."""
    p = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Milk", quantity=2,
    )
    result = purchase_event_service.update_status(
        user_id=fresh_uid, event_id=p["id"], status="used", quantity=2,
    )
    # Same event id, status flipped, no new event.
    assert result["id"] == p["id"]
    assert result["status"] == "used"
    assert result.get("split_from_event_id") is None


def test_partial_split_counter_math(fresh_uid):
    """Catalog counters: original was 1 active, split adds 1 total. Active stays."""
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Cheese", quantity=10,
    )
    entry_before = catalog_service.get_catalog_entry(fresh_uid, "cheese")
    assert entry_before["total_purchases"] == 1
    assert entry_before["active_purchases"] == 1

    purchases = list(
        catalog_service._db().collection("users").document(fresh_uid)
        .collection("purchases").stream()
    )
    purchase_event_service.update_status(
        user_id=fresh_uid, event_id=purchases[0].id,
        status="thrown", reason="bad", quantity=4,
    )

    entry_after = catalog_service.get_catalog_entry(fresh_uid, "cheese")
    # New terminal event was added (total +1). Original stays active (active 0 net).
    assert entry_after["total_purchases"] == 2
    assert entry_after["active_purchases"] == 1


def test_partial_quantity_exceeding_event_quantity_rejected(fresh_uid):
    p = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Yogurt", quantity=3,
    )
    with pytest.raises(ValidationError, match="exceeds event quantity"):
        purchase_event_service.update_status(
            user_id=fresh_uid, event_id=p["id"], status="thrown",
            reason="expired", quantity=10,
        )


def test_partial_quantity_zero_or_negative_rejected(fresh_uid):
    p = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Tomatoes", quantity=3,
    )
    with pytest.raises(ValidationError, match="must be > 0"):
        purchase_event_service.update_status(
            user_id=fresh_uid, event_id=p["id"], status="used", quantity=0,
        )
    with pytest.raises(ValidationError, match="must be > 0"):
        purchase_event_service.update_status(
            user_id=fresh_uid, event_id=p["id"], status="used", quantity=-1,
        )


# ---------------------------------------------------------------------------
# Phase 4 — split-on-location (move)
# ---------------------------------------------------------------------------


def test_partial_move_splits_active_event(fresh_uid):
    """Moving 3 of 12 eggs to freezer creates a new active event there + decrements original."""
    p = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=12, price=6.0, location="fridge",
    )
    new_event = purchase_event_service.move_to_location(
        user_id=fresh_uid, event_id=p["id"], location="freezer", quantity=3,
    )
    assert new_event["id"] != p["id"]
    assert new_event["status"] == "active"
    assert new_event["location"] == "freezer"
    assert new_event["quantity"] == 3
    assert new_event["split_from_event_id"] == p["id"]
    assert new_event["price"] == pytest.approx(1.5, abs=0.001)

    original = purchase_event_service.get_purchase(fresh_uid, p["id"])
    assert original["status"] == "active"
    assert original["location"] == "fridge"
    assert original["quantity"] == 9
    assert original["price"] == pytest.approx(4.5, abs=0.001)


def test_partial_move_counter_math_increments_active(fresh_uid):
    """Catalog: partial-move adds 1 active + 1 total (both events active now)."""
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Bread", quantity=4, location="counter",
    )
    purchases = list(
        catalog_service._db().collection("users").document(fresh_uid)
        .collection("purchases").stream()
    )
    purchase_event_service.move_to_location(
        user_id=fresh_uid, event_id=purchases[0].id,
        location="freezer", quantity=2,
    )
    entry = catalog_service.get_catalog_entry(fresh_uid, "bread")
    assert entry["total_purchases"] == 2
    # Different from terminal split: both events stay active.
    assert entry["active_purchases"] == 2


def test_full_move_keeps_event_id_no_split(fresh_uid):
    """Whole-event move (quantity omitted or equal) updates location in place."""
    p = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Pasta", quantity=2, location="pantry",
    )
    result = purchase_event_service.move_to_location(
        user_id=fresh_uid, event_id=p["id"], location="counter",
    )
    assert result["id"] == p["id"]
    assert result["location"] == "counter"
    assert result["quantity"] == 2
    assert result.get("split_from_event_id") is None


def test_terminal_event_cannot_be_moved(fresh_uid):
    """Used/thrown events are historical records — moving them is rejected."""
    p = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Ice cream", quantity=2,
    )
    purchase_event_service.update_status(
        user_id=fresh_uid, event_id=p["id"], status="used", quantity=2,
    )
    with pytest.raises(ValidationError, match="Only active events"):
        purchase_event_service.move_to_location(
            user_id=fresh_uid, event_id=p["id"], location="freezer",
        )


def test_move_requires_location(fresh_uid):
    p = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Carrots", quantity=2,
    )
    with pytest.raises(ValidationError, match="location is required"):
        purchase_event_service.move_to_location(
            user_id=fresh_uid, event_id=p["id"], location="",
        )


# ---------------------------------------------------------------------------
# Phase 3 — quantity-based aggregators
# ---------------------------------------------------------------------------


def test_waste_summary_sums_by_quantity_not_event_count(fresh_uid):
    """get_waste_summary should sum thrown.quantity, not increment by 1."""
    # Throw a 6-pack outright (qty=6 in one terminal event).
    p1 = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Bagels", quantity=6, price=12.0,
    )
    purchase_event_service.update_status(
        user_id=fresh_uid, event_id=p1["id"], status="thrown",
        reason="expired", quantity=6,
    )
    # And a partial throw — 2 of 5 cookies.
    p2 = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Cookies", quantity=5, price=10.0,
    )
    purchase_event_service.update_status(
        user_id=fresh_uid, event_id=p2["id"], status="thrown",
        reason="bad", quantity=2,
    )

    summary = waste_service.get_waste_summary(fresh_uid, period="all")
    # Quantity-based: 6 + 2 = 8 units thrown (NOT 2 events).
    assert summary["thrown_count"] == pytest.approx(8.0)
    bagels = next(
        c for c in summary["top_wasted"] if c["catalog_name_norm"] == "bagels"
    )
    cookies = next(
        c for c in summary["top_wasted"] if c["catalog_name_norm"] == "cookies"
    )
    assert bagels["count"] == pytest.approx(6.0)
    assert cookies["count"] == pytest.approx(2.0)


def test_financial_summary_waste_pct_is_unit_based(fresh_uid):
    """waste_pct = thrown_units / total_units, not events / events."""
    p = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=12, price=6.0,
    )
    # Throw 2 of 12 → split. waste_pct should be 2/12 ≈ 0.167, not 1/2 = 0.5.
    purchase_event_service.update_status(
        user_id=fresh_uid, event_id=p["id"], status="thrown",
        reason="expired", quantity=2,
    )
    fin = waste_service.get_financial_summary(fresh_uid, period="all")
    eggs_row = next(r for r in fin["rows"] if r["catalog_name_norm"] == "eggs")
    assert eggs_row["total_purchases"] == pytest.approx(12.0)
    assert eggs_row["thrown_count"] == pytest.approx(2.0)
    assert eggs_row["active_count"] == pytest.approx(10.0)
    # 2 / 12 ≈ 0.167
    assert eggs_row["waste_pct"] == pytest.approx(0.167, abs=0.001)
