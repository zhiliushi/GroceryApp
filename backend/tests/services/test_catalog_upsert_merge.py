"""Unit tests for pure portions of catalog upsert + merge.

Exercises `_compute_upsert_updates` (diff against existing entry) and
`_compute_merge_updates` (how to aggregate two entries into one). Firestore
isn't involved — just dict → dict transforms.
"""

from __future__ import annotations

from app.services.catalog_service import (
    _compute_merge_updates,
    _compute_upsert_updates,
)


# ---------------------------------------------------------------------------
# _compute_upsert_updates
# ---------------------------------------------------------------------------

def test_upsert_no_changes_when_everything_matches():
    existing = {
        "display_name": "Milk",
        "barcode": "9555012345678",
        "default_location": "fridge",
        "default_category": "dairy",
        "image_url": "https://example.com/milk.jpg",
        "country_code": "MY",
        "aliases": [],
    }
    # Same display name, same barcode, no other fields → no updates
    updates = _compute_upsert_updates(existing, display_name="Milk", barcode="9555012345678")
    assert updates == {}


def test_upsert_different_casing_adds_to_aliases():
    existing = {"display_name": "Milk", "aliases": []}
    updates = _compute_upsert_updates(existing, display_name="MILK")
    assert "aliases" in updates
    assert set(updates["aliases"]) == {"Milk", "MILK"}


def test_upsert_whitespace_variant_adds_to_aliases():
    existing = {"display_name": "milk", "aliases": []}
    updates = _compute_upsert_updates(existing, display_name=" milk ")
    assert set(updates["aliases"]) == {"milk", " milk "}


def test_upsert_preserves_prior_aliases():
    existing = {"display_name": "Milk", "aliases": ["MILK"]}
    updates = _compute_upsert_updates(existing, display_name="milk")
    assert set(updates["aliases"]) == {"Milk", "MILK", "milk"}


def test_upsert_barcode_change_included():
    existing = {"display_name": "Milk", "barcode": None, "aliases": []}
    updates = _compute_upsert_updates(existing, display_name="Milk", barcode="9555012345678")
    assert updates == {"barcode": "9555012345678"}


def test_upsert_same_barcode_not_included():
    existing = {"display_name": "Milk", "barcode": "9555012345678", "aliases": []}
    updates = _compute_upsert_updates(existing, display_name="Milk", barcode="9555012345678")
    assert "barcode" not in updates


def test_upsert_does_not_overwrite_existing_default_location():
    existing = {"display_name": "Milk", "default_location": "fridge", "aliases": []}
    updates = _compute_upsert_updates(existing, display_name="Milk", default_location="counter")
    # Existing value preserved — no update
    assert "default_location" not in updates


def test_upsert_sets_default_location_when_missing():
    existing = {"display_name": "Milk", "aliases": []}
    updates = _compute_upsert_updates(existing, display_name="Milk", default_location="fridge")
    assert updates.get("default_location") == "fridge"


def test_upsert_sets_country_code_when_missing():
    existing = {"display_name": "Milk", "aliases": []}
    updates = _compute_upsert_updates(existing, display_name="Milk", country_code="MY")
    assert updates.get("country_code") == "MY"


def test_upsert_sets_image_url_when_missing():
    existing = {"display_name": "Milk", "aliases": []}
    updates = _compute_upsert_updates(
        existing, display_name="Milk", image_url="https://a.com/b.png"
    )
    assert updates.get("image_url") == "https://a.com/b.png"


def test_upsert_combined():
    # New casing + new barcode + new default_location all at once
    existing = {"display_name": "Milk", "aliases": [], "barcode": None}
    updates = _compute_upsert_updates(
        existing,
        display_name="milk",
        barcode="9555012345678",
        default_location="fridge",
    )
    assert set(updates["aliases"]) == {"Milk", "milk"}
    assert updates["barcode"] == "9555012345678"
    assert updates["default_location"] == "fridge"


# ---------------------------------------------------------------------------
# _compute_merge_updates
# ---------------------------------------------------------------------------

def test_merge_counters_sum():
    src = {
        "display_name": "Fresh Milk",
        "total_purchases": 5,
        "active_purchases": 2,
        "aliases": [],
    }
    dst = {
        "display_name": "Milk",
        "total_purchases": 10,
        "active_purchases": 3,
        "aliases": [],
    }
    updates = _compute_merge_updates(src, dst)
    assert updates["total_purchases"] == 15
    assert updates["active_purchases"] == 5


def test_merge_aliases_union_includes_src_name():
    src = {"display_name": "Fresh Milk", "aliases": ["FRESH_MILK"], "total_purchases": 1, "active_purchases": 0}
    dst = {"display_name": "Milk", "aliases": ["MILK"], "total_purchases": 1, "active_purchases": 0}
    updates = _compute_merge_updates(src, dst)
    # Fresh Milk + FRESH_MILK + MILK in aliases; dst's own "Milk" excluded
    assert "Fresh Milk" in updates["aliases"]
    assert "FRESH_MILK" in updates["aliases"]
    assert "MILK" in updates["aliases"]
    assert "Milk" not in updates["aliases"]


def test_merge_dst_barcode_wins():
    src = {
        "display_name": "Fresh Milk",
        "barcode": "111",
        "aliases": [],
        "total_purchases": 0,
        "active_purchases": 0,
    }
    dst = {
        "display_name": "Milk",
        "barcode": "222",
        "aliases": [],
        "total_purchases": 0,
        "active_purchases": 0,
    }
    updates = _compute_merge_updates(src, dst)
    # dst barcode stays — no barcode field in updates
    assert "barcode" not in updates


def test_merge_inherits_src_barcode_when_dst_has_none():
    src = {
        "display_name": "Fresh Milk",
        "barcode": "111",
        "aliases": [],
        "total_purchases": 0,
        "active_purchases": 0,
    }
    dst = {
        "display_name": "Milk",
        "barcode": None,
        "aliases": [],
        "total_purchases": 0,
        "active_purchases": 0,
    }
    updates = _compute_merge_updates(src, dst)
    assert updates.get("barcode") == "111"


def test_merge_needs_review_or():
    src = {
        "display_name": "Fresh Milk",
        "needs_review": True,
        "aliases": [],
        "total_purchases": 0,
        "active_purchases": 0,
    }
    dst = {
        "display_name": "Milk",
        "needs_review": False,
        "aliases": [],
        "total_purchases": 0,
        "active_purchases": 0,
    }
    updates = _compute_merge_updates(src, dst)
    assert updates.get("needs_review") is True


def test_merge_needs_review_stays_false_when_both_false():
    src = {
        "display_name": "Fresh Milk",
        "needs_review": False,
        "aliases": [],
        "total_purchases": 0,
        "active_purchases": 0,
    }
    dst = {
        "display_name": "Milk",
        "needs_review": False,
        "aliases": [],
        "total_purchases": 0,
        "active_purchases": 0,
    }
    updates = _compute_merge_updates(src, dst)
    assert "needs_review" not in updates
