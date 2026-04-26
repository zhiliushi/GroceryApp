"""Integration: create purchase + catalog upsert + counter increment.

Verifies the transactional path that mocks would never catch: the catalog
counter and the purchase event must end up consistent.
"""

from __future__ import annotations

from app.services import catalog_service, purchase_event_service


def test_create_purchase_upserts_catalog_and_increments_counter(fresh_uid):
    purchase = purchase_event_service.create_purchase(
        user_id=fresh_uid,
        name="Milk",
        quantity=1,
        location="fridge",
    )
    assert purchase["status"] == "active"
    assert purchase["catalog_name_norm"] == "milk"

    entry = catalog_service.get_catalog_entry(fresh_uid, "milk")
    assert entry is not None
    assert entry["active_purchases"] == 1
    assert entry["total_purchases"] == 1


def test_two_purchases_same_name_share_one_catalog_entry(fresh_uid):
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Milk")
    purchase_event_service.create_purchase(user_id=fresh_uid, name="milk")
    purchase_event_service.create_purchase(user_id=fresh_uid, name=" MILK ")

    entry = catalog_service.get_catalog_entry(fresh_uid, "milk")
    assert entry is not None
    assert entry["total_purchases"] == 3
    assert entry["active_purchases"] == 3
    # all variants captured as aliases
    assert {"Milk", "milk", " MILK "}.issubset(set(entry.get("aliases", [])) | {entry["display_name"]})


def test_status_transition_decrements_active_counter(fresh_uid):
    p = purchase_event_service.create_purchase(user_id=fresh_uid, name="Bread")
    purchase_event_service.update_status(fresh_uid, p["id"], "used")

    entry = catalog_service.get_catalog_entry(fresh_uid, "bread")
    assert entry["active_purchases"] == 0
    assert entry["total_purchases"] == 1
