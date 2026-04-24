"""Unit tests for catalog_service._normalize — critical because it composes the Firestore doc ID.

Consistency here guarantees (user_id, name_norm) uniqueness at the storage layer.
"""

from __future__ import annotations

import pytest

from app.services.catalog_service import _normalize


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("Milk", "milk"),
        ("MILK", "milk"),
        ("milk", "milk"),
        (" milk ", "milk"),
        ("  Milk  ", "milk"),
        ("Milk 1L", "milk_1l"),
        ("Milk  1L", "milk_1l"),                   # collapsed double-space
        ("Dr. Pepper", "dr_pepper"),               # punctuation stripped
        ("100% Juice", "100_juice"),
        ("coca-cola", "cocacola"),                 # hyphen also stripped
        ("organic Milk (2L)", "organic_milk_2l"),  # parens removed
        ("Café Latte", "café_latte"),              # unicode word chars kept
        ("café",  "café"),
        ("", ""),
        ("   ", ""),
        ("!!!", ""),                               # all-punctuation → empty
        (",,,", ""),
        ("-" , ""),
        ("  -  ", ""),
    ],
)
def test_normalize_basic(raw, expected):
    assert _normalize(raw) == expected


def test_normalize_none_input():
    # Guard against None (called from optional fields)
    assert _normalize(None) == ""  # type: ignore[arg-type]


def test_normalize_idempotent():
    # Normalizing an already-normalized name returns the same thing.
    for inp in ("milk", "dr_pepper", "100_juice"):
        assert _normalize(inp) == inp


def test_normalize_case_collapse():
    # Different casings must collapse to the same key (prevents dup catalog rows)
    for variant in ("Milk", "MILK", "milk", " milk ", "\tMilk\n"):
        assert _normalize(variant) == "milk"


def test_normalize_strips_leading_trailing_underscores_from_internal_formatting():
    # "___milk___" edge case — stripped
    assert _normalize("___milk___") == "milk"


def test_normalize_numeric_only():
    assert _normalize("100") == "100"
    assert _normalize("100 200") == "100_200"
