"""Integration tests for Phase E — catalog overview aggregation.

Plan: F:\\ClaudeProjects\\GroceryApp\\.claude\\docs\\plans\\catalog_evolution.md §7 Phase E.

Validates that compute_overview returns the right shape and the math is:
  - logical_purchase_count = events with no split_from_event_id
  - total_event_count = all events (matches stored total_purchases unless drift)
  - lifetime breakdown is BY QUANTITY (not event count)
  - waste rate = thrown_qty / total_qty
  - split lineage groups parents with their children
  - price history groups by store with mean / min / max unit_price
"""

from __future__ import annotations

import pytest
from firebase_admin import firestore

from app.core.metadata import apply_create_metadata
from app.core.exceptions import NotFoundError
from app.services import (
    catalog_overview_service,
    purchase_event_service,
    store_catalog_service,
)


def _set_user_doc(uid: str, **fields):
    db = firestore.client()
    db.collection("users").document(uid).set(
        apply_create_metadata({"uid": uid, **fields}, uid=uid, source="test_seed"),
    )


@pytest.fixture(autouse=True)
def _clean_phase_e_artifacts(fresh_uid):
    yield
    db = firestore.client()
    for snap in (
        db.collection("store_catalog").document(fresh_uid).collection("stores").stream()
    ):
        snap.reference.delete()


def test_overview_404_when_catalog_missing(fresh_uid):
    _set_user_doc(fresh_uid, tier="free")
    with pytest.raises(NotFoundError):
        catalog_overview_service.compute_overview(fresh_uid, "no_such_thing")


def test_logical_vs_event_count_diverge_on_split(fresh_uid):
    """Splitting 2 of 12 eggs → total_event_count=2, logical_purchase_count=1."""
    _set_user_doc(fresh_uid, tier="free", currency_preference="SGD")
    p = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=12, price=6.0, currency="SGD",
    )
    purchase_event_service.update_status(
        user_id=fresh_uid, event_id=p["id"], status="thrown",
        reason="expired", quantity=2,
    )
    overview = catalog_overview_service.compute_overview(fresh_uid, "eggs")
    assert overview["counters"]["total_event_count"] == 2
    assert overview["counters"]["logical_purchase_count"] == 1
    assert overview["counters"]["active_count"] == 1


def test_lifetime_breakdown_is_quantity_based(fresh_uid):
    """Throwing 2 of 12 eggs = 2 thrown_qty + 10 active_qty (not 1 event each)."""
    _set_user_doc(fresh_uid, tier="free")
    p = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=12, price=6.0,
    )
    purchase_event_service.update_status(
        user_id=fresh_uid, event_id=p["id"], status="thrown",
        reason="expired", quantity=2,
    )
    overview = catalog_overview_service.compute_overview(fresh_uid, "eggs")
    lifetime = overview["lifetime_breakdown"]
    assert lifetime["thrown_qty"] == pytest.approx(2.0)
    assert lifetime["active_qty"] == pytest.approx(10.0)
    assert lifetime["total_qty"] == pytest.approx(12.0)


def test_waste_rate_uses_quantity_not_event_count(fresh_uid):
    """16.7% waste = 2 thrown / 12 total qty. NOT 50% (1 thrown event / 2 events)."""
    _set_user_doc(fresh_uid, tier="free")
    p = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=12,
    )
    purchase_event_service.update_status(
        user_id=fresh_uid, event_id=p["id"], status="thrown",
        reason="expired", quantity=2,
    )
    overview = catalog_overview_service.compute_overview(fresh_uid, "eggs")
    assert overview["waste_rate"]["thrown_pct"] == pytest.approx(16.67, abs=0.01)
    assert overview["waste_rate"]["active_pct"] == pytest.approx(83.33, abs=0.01)


def test_split_lineage_groups_children_under_parent(fresh_uid):
    """Lineage tree: original purchase has the split-thrown child nested under it."""
    _set_user_doc(fresh_uid, tier="free")
    p = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=12,
    )
    split = purchase_event_service.update_status(
        user_id=fresh_uid, event_id=p["id"], status="thrown",
        reason="expired", quantity=2,
    )
    overview = catalog_overview_service.compute_overview(fresh_uid, "eggs")
    parents = overview["split_lineage"]
    assert len(parents) == 1
    assert parents[0]["id"] == p["id"]
    children = parents[0]["children"]
    assert len(children) == 1
    assert children[0]["id"] == split["id"]
    assert children[0]["status"] == "thrown"
    assert children[0]["consumed_reason"] == "expired"


def test_movement_timeline_orders_by_date(fresh_uid):
    """Timeline lists events oldest-first."""
    _set_user_doc(fresh_uid, tier="free")
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Item", quantity=1)
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Item", quantity=1)
    overview = catalog_overview_service.compute_overview(fresh_uid, "item")
    timeline = overview["movement_timeline"]
    assert len(timeline) == 2
    assert timeline[0]["date"] <= timeline[1]["date"]
    assert timeline[0]["action"] == "purchased"


def test_price_history_groups_by_store(fresh_uid):
    """Per-store price history with mean/min/max unit_price + resolved store name."""
    _set_user_doc(fresh_uid, tier="free", currency_preference="SGD")
    tesco = store_catalog_service.create_store(fresh_uid, "Tesco")
    market = store_catalog_service.create_store(fresh_uid, "Wet Market")

    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=12, price=6.00,
        currency="SGD", store_id=tesco["store_id"],
    )
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=12, price=5.50,
        currency="SGD", store_id=tesco["store_id"],
    )
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=10, price=5.00,
        currency="SGD", store_id=market["store_id"],
    )

    overview = catalog_overview_service.compute_overview(fresh_uid, "eggs")
    by_store = {s["store_id"]: s for s in overview["price_history_per_store"]}

    assert "tesco" in by_store
    assert "wet_market" in by_store
    assert by_store["tesco"]["store_name"] == "Tesco"
    assert by_store["tesco"]["sample_count"] == 2
    # tesco mean unit_price = ((6/12 + 5.5/12) / 2) = 0.4792 SGD/egg
    assert by_store["tesco"]["mean_unit_price"] == pytest.approx(0.4792, abs=0.001)
    # market unit_price = 5/10 = 0.50 SGD/egg
    assert by_store["wet_market"]["mean_unit_price"] == pytest.approx(0.50, abs=0.001)
    # Sorted cheapest mean first → tesco before wet_market
    assert overview["price_history_per_store"][0]["store_id"] == "tesco"


def test_overview_omits_non_priced_events_from_history(fresh_uid):
    """Events with no price/amount don't pollute the price history table."""
    _set_user_doc(fresh_uid, tier="free")
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Free thing", quantity=1)
    overview = catalog_overview_service.compute_overview(fresh_uid, "free_thing")
    assert overview["price_history_per_store"] == []
