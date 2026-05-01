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


# ---------------------------------------------------------------------------
# Post-deploy expansion: current_locations, cadence, waste_cost
# ---------------------------------------------------------------------------


def test_current_locations_groups_active_inventory(fresh_uid):
    """Eggs at pantry + at fridge → two location buckets with qty per location."""
    _set_user_doc(fresh_uid, tier="free")
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=11, location="pantry",
    )
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=4, location="fridge",
    )
    overview = catalog_overview_service.compute_overview(fresh_uid, "eggs")
    locations = {loc["location"]: loc for loc in overview["current_locations"]}
    assert "pantry" in locations and "fridge" in locations
    assert locations["pantry"]["active_qty"] == 11
    assert locations["fridge"]["active_qty"] == 4
    # Sorted desc by qty → pantry first
    assert overview["current_locations"][0]["location"] == "pantry"


def test_current_locations_excludes_terminal_events(fresh_uid):
    """Used / thrown / given events shouldn't show as 'active' inventory."""
    _set_user_doc(fresh_uid, tier="free")
    p = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Bread", quantity=1, location="counter",
    )
    purchase_event_service.update_status(
        user_id=fresh_uid, event_id=p["id"], status="used",
    )
    overview = catalog_overview_service.compute_overview(fresh_uid, "bread")
    assert overview["current_locations"] == []


def test_cadence_avg_days_between_buys(fresh_uid):
    """Three buys spaced 7 days apart → avg cadence ~7 days."""
    from datetime import datetime, timezone, timedelta
    _set_user_doc(fresh_uid, tier="free")
    base = datetime.now(timezone.utc) - timedelta(days=21)
    for i in range(3):
        purchase_event_service.create_purchase(
            user_id=fresh_uid, name="Eggs", quantity=12,
            date_bought=base + timedelta(days=i * 7),
        )
    overview = catalog_overview_service.compute_overview(fresh_uid, "eggs")
    cadence = overview["cadence"]
    assert cadence["logical_buy_count"] == 3
    # 7 days between buys
    assert cadence["avg_days_between_buys"] == pytest.approx(7.0, abs=0.5)
    # last buy was 7 days ago (third buy at base + 14 days; now ≈ base + 21)
    assert cadence["days_since_last_buy"] == pytest.approx(7.0, abs=0.5)
    # predicted = avg(7) - elapsed(7) = ~0 → due now
    assert cadence["predicted_next_buy_in_days"] == pytest.approx(0.0, abs=1.0)


def test_cadence_handles_single_buy_gracefully(fresh_uid):
    """One buy → avg/predicted are None (insufficient data)."""
    _set_user_doc(fresh_uid, tier="free")
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Tea", quantity=1)
    overview = catalog_overview_service.compute_overview(fresh_uid, "tea")
    cadence = overview["cadence"]
    assert cadence["logical_buy_count"] == 1
    assert cadence["avg_days_between_buys"] is None
    assert cadence["predicted_next_buy_in_days"] is None
    # days_since_last_buy still computable
    assert cadence["days_since_last_buy"] is not None


def test_cadence_consumption_avg(fresh_uid):
    """avg_days_buy_to_use averages over events that transitioned to used."""
    from datetime import datetime, timezone, timedelta
    _set_user_doc(fresh_uid, tier="free")
    bought_at = datetime.now(timezone.utc) - timedelta(days=10)
    p = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Milk", quantity=1, date_bought=bought_at,
    )
    purchase_event_service.update_status(
        user_id=fresh_uid, event_id=p["id"], status="used",
    )
    overview = catalog_overview_service.compute_overview(fresh_uid, "milk")
    cadence = overview["cadence"]
    assert cadence["use_event_count"] == 1
    # consumed ~now, bought 10 days ago
    assert cadence["avg_days_buy_to_use"] == pytest.approx(10.0, abs=0.5)


def test_waste_cost_tracks_money_lost(fresh_uid):
    """Thrown events sum into waste_cost.thrown_total in display currency."""
    _set_user_doc(fresh_uid, tier="free", currency_preference="SGD")
    p = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Bananas", quantity=6, price=4.80, currency="SGD",
    )
    purchase_event_service.update_status(
        user_id=fresh_uid, event_id=p["id"], status="thrown", reason="bad", quantity=6,
    )
    overview = catalog_overview_service.compute_overview(fresh_uid, "bananas")
    cost = overview["waste_cost"]
    # Original event + thrown split = 2 events, but the split inherits a portion
    # of the price. Sum of all (display_amount) across events for this catalog
    # should be the total spent.
    assert cost["spent_total"] == pytest.approx(4.80, abs=0.01)
    assert cost["thrown_total"] == pytest.approx(4.80, abs=0.01)  # full qty thrown
    assert cost["waste_pct_by_value"] == pytest.approx(100.0, abs=0.5)
    assert cost["display_currency"] == "SGD"


def test_waste_cost_zero_when_no_prices(fresh_uid):
    _set_user_doc(fresh_uid, tier="free")
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Free item", quantity=1)
    overview = catalog_overview_service.compute_overview(fresh_uid, "free_item")
    cost = overview["waste_cost"]
    assert cost["spent_total"] == 0.0
    assert cost["thrown_total"] == 0.0
    assert cost["waste_pct_by_value"] == 0.0


# ---------------------------------------------------------------------------
# Read-time currency conversion (user changed currency_preference after the
# event was saved — overview should still display in the new pref).
# ---------------------------------------------------------------------------


def test_overview_honors_user_currency_pref_at_read_time(fresh_uid, monkeypatch):
    """Event saved with display_currency=SGD; user changes pref to MYR; overview
    must show MYR amounts using the current FX rate, not the locked SGD."""
    from app.services import fx_rate_service

    _set_user_doc(fresh_uid, tier="free", currency_preference="SGD")
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=12, price=6.0, currency="SGD",
    )

    # User flips preference to MYR. Stub FX so SGD→MYR = 3.30.
    db = firestore.client()
    db.collection("users").document(fresh_uid).set(
        {"currency_preference": "MYR"}, merge=True,
    )
    monkeypatch.setattr(
        fx_rate_service,
        "get_rate",
        lambda f, t, d=None: {
            "rate": 3.30 if (f, t) == ("SGD", "MYR") else 1.0,
            "from": f, "to": t, "date": "2026-01-05", "source": "stub", "is_stale": False,
        },
    )

    overview = catalog_overview_service.compute_overview(fresh_uid, "eggs")

    # waste_cost should report MYR
    assert overview["waste_cost"]["display_currency"] == "MYR"
    assert overview["waste_cost"]["spent_total"] == pytest.approx(6.0 * 3.30, abs=0.01)

    # price-history sample should be in MYR
    samples = overview["price_history_per_store"][0]["samples"]
    assert samples[0]["display_currency"] == "MYR"
    assert samples[0]["display_amount"] == pytest.approx(6.0 * 3.30, abs=0.01)
    # unit_price = display_amount / qty / pack_size = 19.80 / 12 / 1 = 1.65 MYR/egg
    assert samples[0]["unit_price"] == pytest.approx(1.65, abs=0.01)


def test_overview_passthrough_when_event_currency_matches_pref(fresh_uid, monkeypatch):
    """When event.currency == user.pref, no FX call is made — pure passthrough."""
    from app.services import fx_rate_service

    called = {"count": 0}
    def boom(*a, **kw):
        called["count"] += 1
        raise AssertionError("FX should not be called for same-currency events")

    _set_user_doc(fresh_uid, tier="free", currency_preference="SGD")
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Bread", quantity=1, price=3.50, currency="SGD",
    )

    monkeypatch.setattr(fx_rate_service, "get_rate", boom)

    overview = catalog_overview_service.compute_overview(fresh_uid, "bread")
    assert overview["waste_cost"]["spent_total"] == pytest.approx(3.50, abs=0.01)
    assert overview["waste_cost"]["display_currency"] == "SGD"
    assert called["count"] == 0


def test_overview_handles_fx_unavailable(fresh_uid, monkeypatch):
    """When FX returns None for a cross-currency pair, the event is still
    counted but its display_amount stays as whatever was stored at save
    (graceful fallback) — we don't blow up the overview."""
    from app.services import fx_rate_service

    _set_user_doc(fresh_uid, tier="free", currency_preference="JPY")
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Imported", quantity=1, price=10.0, currency="MYR",
    )

    monkeypatch.setattr(
        fx_rate_service, "get_rate",
        lambda f, t, d=None: {"rate": None, "from": f, "to": t, "date": "x",
                              "source": "none", "is_stale": False},
    )

    overview = catalog_overview_service.compute_overview(fresh_uid, "imported")
    # No conversion possible; spent_total is whatever fell back (0 or the saved
    # display_amount). Important is that we didn't crash.
    assert "waste_cost" in overview


# ---------------------------------------------------------------------------
# Per-location quick actions (post-deploy feedback iteration)
# ---------------------------------------------------------------------------


def test_current_locations_includes_most_urgent_event_id(fresh_uid):
    """Each location summary carries the event_id of its most-urgent batch so
    the Move button can target a real event for the move modal."""
    from datetime import datetime, timezone, timedelta
    _set_user_doc(fresh_uid, tier="free")
    base = datetime.now(timezone.utc)
    p_a = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=4, location="fridge",
        expiry_date=base + timedelta(days=10),
    )
    # Older expiry at fridge — should win as most_urgent
    p_b = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=2, location="fridge",
        expiry_date=base + timedelta(days=3),
    )
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=11, location="pantry",
        expiry_date=base + timedelta(days=8),
    )

    overview = catalog_overview_service.compute_overview(fresh_uid, "eggs")
    by_loc = {loc["location"]: loc for loc in overview["current_locations"]}
    assert by_loc["fridge"]["most_urgent_event_id"] == p_b["id"]  # 3d wins over 10d
    assert by_loc["fridge"]["most_urgent_event_qty"] == 2
    assert by_loc["pantry"]["most_urgent_event_id"] is not None


def test_consume_one_by_catalog_with_location_filter(fresh_uid):
    """consume_one_by_catalog(location='fridge') only marks fridge events used."""
    from datetime import datetime, timezone, timedelta
    _set_user_doc(fresh_uid, tier="free")
    base = datetime.now(timezone.utc)
    # Pantry has the most-urgent batch globally, but we're consuming at fridge
    p_pantry_urgent = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=11, location="pantry",
        expiry_date=base + timedelta(days=2),
    )
    p_fridge_a = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=4, location="fridge",
        expiry_date=base + timedelta(days=10),
    )
    p_fridge_urgent = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=2, location="fridge",
        expiry_date=base + timedelta(days=5),
    )

    result = purchase_event_service.consume_one_by_catalog(
        user_id=fresh_uid, catalog_name_norm="eggs", quantity=1, location="fridge",
    )
    # Should consume the fridge-urgent (5d) event, NOT the pantry-urgent (2d)
    consumed_id = result["consumed"][0]
    consumed = purchase_event_service.get_purchase(fresh_uid, consumed_id)
    assert consumed["location"] == "fridge"
    assert consumed["status"] == "used"
    assert consumed_id == p_fridge_urgent["id"]

    # Pantry event still active
    pantry = purchase_event_service.get_purchase(fresh_uid, p_pantry_urgent["id"])
    assert pantry["status"] == "active"


def test_consume_one_by_catalog_location_with_no_active_raises(fresh_uid):
    from app.core.exceptions import NotFoundError
    _set_user_doc(fresh_uid, tier="free")
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=1, location="pantry",
    )
    with pytest.raises(NotFoundError):
        purchase_event_service.consume_one_by_catalog(
            user_id=fresh_uid, catalog_name_norm="eggs", quantity=1, location="freezer",
        )


def test_current_locations_reports_base_units_for_multipack(fresh_uid):
    """4 packs of 6 eggs at fridge should report 24 base units, not 4 'units'.

    Real-feedback bug: the Currently Stored card was summing event.quantity
    (= pack count) without multiplying by pack_size, so a 4-pack-of-6 looked
    like '4 units' instead of '24 eggs'. This test pins the new field.
    """
    _set_user_doc(fresh_uid, tier="free")
    multi = purchase_event_service.create_multi_pack(
        user_id=fresh_uid, name="Eggs",
        pack_count=4, units_per_pack=6,
        price_per_pack=10.99, currency="SGD", location="fridge",
    )
    assert multi["created_count"] == 4

    overview = catalog_overview_service.compute_overview(fresh_uid, "eggs")
    fridge = next(loc for loc in overview["current_locations"] if loc["location"] == "fridge")
    assert fridge["active_qty"] == 4              # 4 events × qty=1 each
    assert fridge["active_base_units"] == 24      # 4 × 1 × pack_size=6 = 24 eggs
    assert fridge["pack_sizes"] == [6]
    assert fridge["mixed_pack_sizes"] is False
    assert fridge["base_unit_label"] == "egg"     # inferred from "Eggs"
    assert fridge["most_urgent_event_pack_size"] == 6


def test_current_locations_mixed_pack_sizes_flagged(fresh_uid):
    """Two events at same location with different pack_sizes → mixed_pack_sizes=True."""
    _set_user_doc(fresh_uid, tier="free")
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=12, location="pantry",
    )
    # Same catalog, different pack_size at the same location
    purchase_event_service.create_multi_pack(
        user_id=fresh_uid, name="Eggs",
        pack_count=1, units_per_pack=6, price_per_pack=5.0,
        currency="SGD", location="pantry",
    )
    overview = catalog_overview_service.compute_overview(fresh_uid, "eggs")
    pantry = next(loc for loc in overview["current_locations"] if loc["location"] == "pantry")
    assert pantry["active_base_units"] == 18   # 12 + 6
    assert sorted(pantry["pack_sizes"]) == [1, 6]
    assert pantry["mixed_pack_sizes"] is True


# ---------------------------------------------------------------------------
# Restore — flip a terminal event back to active
# ---------------------------------------------------------------------------


def test_restore_flips_used_back_to_active(fresh_uid):
    """A used event flipped back to active increments the catalog active counter."""
    from app.services import catalog_service as _cat_svc
    _set_user_doc(fresh_uid, tier="free")
    p = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=12,
    )
    purchase_event_service.update_status(
        user_id=fresh_uid, event_id=p["id"], status="used",
    )
    cat_before = _cat_svc.get_catalog_entry(fresh_uid, "eggs")
    active_before = int(cat_before["active_purchases"])

    restored = purchase_event_service.restore_event(fresh_uid, p["id"])
    assert restored["status"] == "active"
    assert restored["consumed_date"] is None
    assert restored["consumed_reason"] is None
    assert restored.get("_restored_from_status") == "used"

    cat_after = _cat_svc.get_catalog_entry(fresh_uid, "eggs")
    assert int(cat_after["active_purchases"]) == active_before + 1


def test_restore_flips_thrown_back_to_active(fresh_uid):
    _set_user_doc(fresh_uid, tier="free")
    p = purchase_event_service.create_purchase(user_id=fresh_uid, name="Bananas", quantity=6)
    purchase_event_service.update_status(
        user_id=fresh_uid, event_id=p["id"], status="thrown", reason="bad",
    )
    restored = purchase_event_service.restore_event(fresh_uid, p["id"])
    assert restored["status"] == "active"


def test_restore_already_active_raises(fresh_uid):
    from app.core.exceptions import ValidationError
    _set_user_doc(fresh_uid, tier="free")
    p = purchase_event_service.create_purchase(user_id=fresh_uid, name="Bread", quantity=1)
    with pytest.raises(ValidationError):
        purchase_event_service.restore_event(fresh_uid, p["id"])


def test_restore_missing_event_raises(fresh_uid):
    from app.core.exceptions import NotFoundError
    _set_user_doc(fresh_uid, tier="free")
    with pytest.raises(NotFoundError):
        purchase_event_service.restore_event(fresh_uid, "no_such_event")


def test_bulk_restore_recent_terminal_by_catalog(fresh_uid):
    """Bulk restore picks the most-recently-terminated events for the catalog,
    up to limit, and flips them all back to active."""
    _set_user_doc(fresh_uid, tier="free")
    # Create + terminate 5 events
    ids = []
    for _ in range(5):
        p = purchase_event_service.create_purchase(
            user_id=fresh_uid, name="Eggs", quantity=12,
        )
        purchase_event_service.update_status(
            user_id=fresh_uid, event_id=p["id"], status="used",
        )
        ids.append(p["id"])
    # All 5 now used. Bulk-restore 3.
    result = purchase_event_service.restore_recent_terminal_by_catalog(
        fresh_uid, "eggs", limit=3,
    )
    assert result["count"] == 3
    assert result["from_statuses"]["used"] == 3
    # Three events should now be active again
    active_count = 0
    for eid in ids:
        ev = purchase_event_service.get_purchase(fresh_uid, eid)
        if ev["status"] == "active":
            active_count += 1
    assert active_count == 3


def test_unit_type_inferred_from_name(fresh_uid):
    """unit_type heuristic uses item name when no base_unit_label is set yet."""
    _set_user_doc(fresh_uid, tier="free")
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Eggs", quantity=12)
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Milk", quantity=1, price=3.0, currency="SGD")
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Beef Steak", quantity=1)
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Sourdough Bread", quantity=1)

    eggs = catalog_overview_service.compute_overview(fresh_uid, "eggs")
    milk = catalog_overview_service.compute_overview(fresh_uid, "milk")
    beef = catalog_overview_service.compute_overview(fresh_uid, "beef_steak")
    bread = catalog_overview_service.compute_overview(fresh_uid, "sourdough_bread")

    assert eggs["entry"]["unit_type"] == "count"
    assert milk["entry"]["unit_type"] == "volume"
    assert beef["entry"]["unit_type"] == "weight"
    # UNIT_TYPE_TOUCHPOINT — bread previously inferred to "container" but
    # the canonical model coerces container → count (see unit-type-method.md).
    # The bread row's container-ness is now captured per-event via pack_label.
    assert bread["entry"]["unit_type"] == "count"


def test_unit_type_user_override_via_update(fresh_uid):
    """User can re-classify via update_catalog_entry — Manage Entry dropdown."""
    from app.services import catalog_service as _cs
    _set_user_doc(fresh_uid, tier="free")
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Mystery Item", quantity=1)
    # Default classification is "count"
    o1 = catalog_overview_service.compute_overview(fresh_uid, "mystery_item")
    assert o1["entry"]["unit_type"] == "count"
    # User flips to volume
    _cs.update_catalog_entry(fresh_uid, "mystery_item", {"unit_type": "volume"})
    o2 = catalog_overview_service.compute_overview(fresh_uid, "mystery_item")
    assert o2["entry"]["unit_type"] == "volume"
    # Garbage gets coerced to default
    _cs.update_catalog_entry(fresh_uid, "mystery_item", {"unit_type": "garbage"})
    o3 = catalog_overview_service.compute_overview(fresh_uid, "mystery_item")
    assert o3["entry"]["unit_type"] == "count"


def test_bulk_restore_skips_active_events(fresh_uid):
    """Bulk restore over a catalog with both active + terminal events only
    targets the terminal ones."""
    _set_user_doc(fresh_uid, tier="free")
    p_active = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=12,
    )
    p_used = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=12,
    )
    purchase_event_service.update_status(
        user_id=fresh_uid, event_id=p_used["id"], status="used",
    )
    result = purchase_event_service.restore_recent_terminal_by_catalog(
        fresh_uid, "eggs", limit=10,
    )
    assert result["count"] == 1
    assert p_active["id"] not in result["restored"]
    assert p_used["id"] in result["restored"]


# ---------------------------------------------------------------------------
# FX cache pre-warm (refresh_common_rates)
# ---------------------------------------------------------------------------


def test_fx_refresh_common_rates_returns_summary(monkeypatch):
    """refresh_common_rates iterates COMMON_PAIRS + user-derived pairs and
    returns a summary with counts per outcome."""
    from app.services import fx_rate_service

    # Cold-start the fx_rates cache so this test sees real fetch behaviour
    # (other tests in this file may have left rates in the cache).
    db = firestore.client()
    for snap in db.collection("fx_rates").stream():
        snap.reference.delete()

    fetch_calls = {"count": 0}
    def fake_fetch(f, t, d):
        fetch_calls["count"] += 1
        return 0.42

    monkeypatch.setattr(fx_rate_service, "_fetch_rate", fake_fetch)
    summary = fx_rate_service.refresh_common_rates()
    assert summary["pairs_attempted"] >= 1
    assert summary["newly_fetched"] + summary["already_cached"] + summary["failed"] == summary["pairs_attempted"]
    # First run should have fetched at least one pair (cache was cold)
    assert summary["newly_fetched"] >= 1
    # Re-run should hit cache, not API
    monkeypatch.setattr(
        fx_rate_service, "_fetch_rate",
        lambda *a, **kw: (_ for _ in ()).throw(AssertionError("should not refetch")),
    )
    summary2 = fx_rate_service.refresh_common_rates()
    assert summary2["already_cached"] >= summary["newly_fetched"]
    assert summary2["newly_fetched"] == 0
