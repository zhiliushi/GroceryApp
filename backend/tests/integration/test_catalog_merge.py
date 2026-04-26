"""Integration: merging two catalog entries reparents purchases atomically.

Catches the bug class where merge runs partial — events get reassigned but
counters drift.
"""

from __future__ import annotations

import pytest

from app.core.exceptions import ConflictError
from app.services import catalog_service, purchase_event_service


def test_merge_reparents_purchases_and_combines_counters(fresh_uid):
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Susu")
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Susu")
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Milk")

    catalog_service.merge_catalog_entries(
        user_id=fresh_uid,
        source_name_norm="susu",
        target_name_norm="milk",
    )

    target = catalog_service.get_catalog_entry(fresh_uid, "milk")
    assert target["total_purchases"] == 3
    assert target["active_purchases"] == 3

    src = catalog_service.get_catalog_entry(fresh_uid, "susu")
    assert src is None

    purchases = purchase_event_service.list_purchases(user_id=fresh_uid, limit=100)
    assert len(purchases["items"]) == 3
    assert all(p["catalog_name_norm"] == "milk" for p in purchases["items"])


def test_delete_catalog_blocked_when_active_purchases(fresh_uid):
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Eggs")

    with pytest.raises(ConflictError):
        catalog_service.delete_catalog_entry(fresh_uid, "eggs")

    # Still there
    assert catalog_service.get_catalog_entry(fresh_uid, "eggs") is not None
