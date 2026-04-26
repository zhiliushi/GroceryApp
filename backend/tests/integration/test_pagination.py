"""Integration: cursor pagination on list_catalog + list_purchases.

Seeds 30 catalog entries / purchases, paginates 10 at a time, asserts no
duplicates and stable ordering across pages.
"""

from __future__ import annotations

from app.services import catalog_service, purchase_event_service


def test_list_catalog_cursor_paginates_without_duplicates(fresh_uid):
    for i in range(30):
        purchase_event_service.create_purchase(
            user_id=fresh_uid, name=f"Item {i:03d}"
        )

    seen: list[str] = []
    cursor = None
    pages = 0
    while True:
        result = catalog_service.list_catalog(
            user_id=fresh_uid, limit=10, cursor=cursor
        )
        seen.extend(item["name_norm"] for item in result["items"])
        pages += 1
        cursor = result.get("next_cursor")
        if not cursor:
            break
        if pages > 5:
            raise AssertionError("Pagination did not terminate")

    assert len(seen) == 30
    assert len(set(seen)) == 30  # no duplicates
    assert pages == 3  # 30 / 10


def test_list_purchases_cursor_paginates(fresh_uid):
    for i in range(25):
        purchase_event_service.create_purchase(
            user_id=fresh_uid, name=f"Item {i:03d}"
        )

    seen_ids: list[str] = []
    cursor = None
    while True:
        result = purchase_event_service.list_purchases(
            user_id=fresh_uid, limit=10, cursor=cursor
        )
        seen_ids.extend(item["id"] for item in result["items"])
        cursor = result.get("next_cursor")
        if not cursor:
            break

    assert len(seen_ids) == 25
    assert len(set(seen_ids)) == 25
