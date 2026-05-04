"""Unit tests for shopping_list_service pure-validation helpers.

The mutation paths (create_list / add_item / etc.) all touch Firestore so
their unit-test coverage belongs in the integration suite. This file covers
the pure portion: `_validate_item_payload` (item add/edit input shape) and
`_norm` (catalog-matching key).
"""

from __future__ import annotations

import pytest

from app.core.exceptions import ValidationError
from app.services.shopping_list_service import (
    _norm,
    _validate_item_payload,
)


# ---------------------------------------------------------------------------
# _norm — catalog-matching key
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "raw,expected",
    [
        ("Eggs", "eggs"),
        ("  Milk  ", "milk"),
        ("BANANA", "banana"),
        ("", ""),
        (None, ""),
    ],
)
def test_norm_strips_and_lowercases(raw, expected):
    assert _norm(raw) == expected


# ---------------------------------------------------------------------------
# _validate_item_payload — required fields
# ---------------------------------------------------------------------------

def test_minimal_valid_payload_only_name():
    out = _validate_item_payload({"item_name": "Eggs"})
    assert out["item_name"] == "Eggs"
    assert out["name_norm"] == "eggs"


def test_blank_name_rejected():
    with pytest.raises(ValidationError, match="item_name is required"):
        _validate_item_payload({"item_name": ""})


def test_whitespace_only_name_rejected():
    with pytest.raises(ValidationError, match="item_name is required"):
        _validate_item_payload({"item_name": "   "})


def test_overlong_name_rejected():
    with pytest.raises(ValidationError, match="≤ 120 characters"):
        _validate_item_payload({"item_name": "x" * 121})


def test_name_at_120_chars_accepted():
    out = _validate_item_payload({"item_name": "x" * 120})
    assert out["item_name"] == "x" * 120


# ---------------------------------------------------------------------------
# Quantity
# ---------------------------------------------------------------------------

def test_quantity_positive_int():
    out = _validate_item_payload({"item_name": "Eggs", "quantity": 12})
    assert out["quantity"] == 12.0


def test_quantity_positive_float():
    out = _validate_item_payload({"item_name": "Milk", "quantity": 1.5})
    assert out["quantity"] == 1.5


def test_quantity_zero_rejected():
    with pytest.raises(ValidationError, match="quantity must be > 0"):
        _validate_item_payload({"item_name": "Eggs", "quantity": 0})


def test_quantity_negative_rejected():
    with pytest.raises(ValidationError, match="quantity must be > 0"):
        _validate_item_payload({"item_name": "Eggs", "quantity": -1})


def test_quantity_non_numeric_rejected():
    with pytest.raises(ValidationError, match="quantity must be a number"):
        _validate_item_payload({"item_name": "Eggs", "quantity": "twelve"})


def test_quantity_none_omitted_from_output():
    out = _validate_item_payload({"item_name": "Eggs", "quantity": None})
    assert "quantity" not in out


# ---------------------------------------------------------------------------
# Weight pair (must come together)
# ---------------------------------------------------------------------------

def test_weight_pair_g():
    out = _validate_item_payload(
        {"item_name": "Flour", "weight_value": 500, "weight_unit": "g"}
    )
    assert out["weight_value"] == 500.0
    assert out["weight_unit"] == "g"


def test_weight_pair_kg():
    out = _validate_item_payload(
        {"item_name": "Rice", "weight_value": 5, "weight_unit": "kg"}
    )
    assert out["weight_value"] == 5.0


def test_weight_value_without_unit_rejected():
    with pytest.raises(ValidationError, match="must both be set"):
        _validate_item_payload({"item_name": "Flour", "weight_value": 500})


def test_weight_unit_without_value_rejected():
    with pytest.raises(ValidationError, match="must both be set"):
        _validate_item_payload({"item_name": "Flour", "weight_unit": "g"})


def test_weight_unit_invalid_rejected():
    with pytest.raises(ValidationError, match="weight_unit must be one of"):
        _validate_item_payload(
            {"item_name": "Flour", "weight_value": 1, "weight_unit": "stone"}
        )


def test_weight_zero_rejected():
    with pytest.raises(ValidationError, match="weight_value must be > 0"):
        _validate_item_payload(
            {"item_name": "Flour", "weight_value": 0, "weight_unit": "g"}
        )


# ---------------------------------------------------------------------------
# Volume pair (must come together)
# ---------------------------------------------------------------------------

def test_volume_pair_l():
    out = _validate_item_payload(
        {"item_name": "Milk", "volume_value": 1, "volume_unit": "l"}
    )
    assert out["volume_value"] == 1.0
    assert out["volume_unit"] == "l"


def test_volume_unit_invalid_rejected():
    with pytest.raises(ValidationError, match="volume_unit must be one of"):
        _validate_item_payload(
            {"item_name": "Milk", "volume_value": 1, "volume_unit": "gallon"}
        )


def test_volume_value_without_unit_rejected():
    with pytest.raises(ValidationError, match="must both be set"):
        _validate_item_payload({"item_name": "Milk", "volume_value": 1})


# ---------------------------------------------------------------------------
# Optional pass-through fields
# ---------------------------------------------------------------------------

def test_notes_passthrough():
    out = _validate_item_payload(
        {"item_name": "Eggs", "notes": "Get the small ones"}
    )
    assert out["notes"] == "Get the small ones"


def test_notes_truncated_at_500():
    out = _validate_item_payload({"item_name": "Eggs", "notes": "x" * 600})
    assert len(out["notes"]) == 500


def test_barcode_stripped():
    out = _validate_item_payload(
        {"item_name": "Eggs", "barcode": "  12345678  "}
    )
    assert out["barcode"] == "12345678"


def test_source_catalog_passthrough():
    out = _validate_item_payload(
        {"item_name": "Eggs", "source_catalog_name_norm": "eggs"}
    )
    assert out["source_catalog_name_norm"] == "eggs"


def test_unit_truncated_at_16():
    out = _validate_item_payload({"item_name": "Eggs", "unit": "x" * 50})
    assert len(out["unit"]) == 16


# ---------------------------------------------------------------------------
# Mixed fields — full payload
# ---------------------------------------------------------------------------

def test_full_payload_all_fields():
    out = _validate_item_payload(
        {
            "item_name": "Premium Eggs",
            "quantity": 12,
            "unit": "count",
            "weight_value": 600,
            "weight_unit": "g",
            "volume_value": None,
            "volume_unit": None,
            "notes": "from the farmer's market",
            "barcode": "9876543210",
            "source_catalog_name_norm": "eggs",
        }
    )
    assert out["item_name"] == "Premium Eggs"
    assert out["name_norm"] == "premium eggs"
    assert out["quantity"] == 12.0
    assert out["weight_value"] == 600.0
    assert out["weight_unit"] == "g"
    assert "volume_value" not in out
    assert out["barcode"] == "9876543210"


def test_payload_drops_falsy_optional_fields():
    out = _validate_item_payload(
        {
            "item_name": "Eggs",
            "quantity": None,
            "unit": "",
            "notes": "",
            "barcode": "",
        }
    )
    assert out == {"item_name": "Eggs", "name_norm": "eggs"}


# ---------------------------------------------------------------------------
# v3 — alternative validation
# ---------------------------------------------------------------------------

from app.services.shopping_list_service import (
    _validate_alternative_payload,
    MAX_PRIMARIES_PER_LIST,
    MAX_ALTERNATIVES_PER_PRIMARY,
)


def test_v3_caps_match_beta_spec():
    assert MAX_PRIMARIES_PER_LIST == 15
    assert MAX_ALTERNATIVES_PER_PRIMARY == 3


def test_alternative_minimal_no_price():
    out = _validate_alternative_payload({})
    assert "price" not in out
    assert out["currency"] == "SGD"


def test_alternative_with_price():
    out = _validate_alternative_payload({"price": 5.99, "currency": "myr"})
    assert out["price"] == 5.99
    assert out["currency"] == "myr"


def test_alternative_zero_price_rejected():
    with pytest.raises(ValidationError, match="price must be > 0"):
        _validate_alternative_payload({"price": 0})


def test_alternative_negative_price_rejected():
    with pytest.raises(ValidationError, match="price must be > 0"):
        _validate_alternative_payload({"price": -5})


def test_alternative_pack_count_pack_size():
    out = _validate_alternative_payload({"pack_count": 2, "pack_size": 12})
    assert out["pack_count"] == 2.0
    assert out["pack_size"] == 12.0


def test_alternative_pack_count_zero_rejected():
    with pytest.raises(ValidationError, match="pack_count must be > 0"):
        _validate_alternative_payload({"pack_count": 0})


def test_alternative_weight_pair():
    out = _validate_alternative_payload({"weight_value": 500, "weight_unit": "g"})
    assert out["weight_value"] == 500.0
    assert out["weight_unit"] == "g"


def test_alternative_weight_value_only_rejected():
    with pytest.raises(ValidationError, match="must both be set"):
        _validate_alternative_payload({"weight_value": 500})


def test_alternative_weight_unit_only_rejected():
    with pytest.raises(ValidationError, match="must both be set"):
        _validate_alternative_payload({"weight_unit": "g"})


def test_alternative_invalid_weight_unit():
    with pytest.raises(ValidationError, match="weight_unit must be one of"):
        _validate_alternative_payload({"weight_value": 1, "weight_unit": "stone"})


def test_alternative_volume_pair():
    out = _validate_alternative_payload({"volume_value": 1, "volume_unit": "l"})
    assert out["volume_value"] == 1.0
    assert out["volume_unit"] == "l"


def test_alternative_invalid_volume_unit():
    with pytest.raises(ValidationError, match="volume_unit must be one of"):
        _validate_alternative_payload({"volume_value": 1, "volume_unit": "gallon"})


def test_alternative_candidate_name_passthrough():
    out = _validate_alternative_payload({"candidate_name": "TestBrand 12-pack"})
    assert out["candidate_name"] == "TestBrand 12-pack"


def test_alternative_full_payload():
    out = _validate_alternative_payload({
        "candidate_name": "Brand A 12-pack eggs",
        "price": 12.50,
        "currency": "SGD",
        "brand": "Brand A",
        "store_name": "NSK",
        "barcode": "9555012345678",
        "pack_count": 2,
        "pack_size": 12,
        "weight_value": 600,
        "weight_unit": "g",
        "source_catalog_name_norm": "eggs",
    })
    assert out["candidate_name"] == "Brand A 12-pack eggs"
    assert out["price"] == 12.50
    assert out["pack_count"] == 2.0
    assert out["pack_size"] == 12.0
    assert out["weight_value"] == 600.0
    assert out["barcode"] == "9555012345678"


def test_alternative_drops_falsy_optionals():
    out = _validate_alternative_payload({
        "price": None,
        "brand": "",
        "store_name": "",
        "barcode": "",
        "candidate_name": "",
    })
    # currency always defaults; everything else dropped
    assert out == {
        "currency": "SGD",
        "brand": None,
        "store_name": None,
        "barcode": None,
        "candidate_name": None,
    }
