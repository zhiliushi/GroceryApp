"""Tests for is_in_store_label — protects users from naming a store-internal
deli sticker into the global product cache."""

from app.services.barcode_service import is_in_store_label


def test_02_prefix_is_in_store():
    # EAN-13 starting with 02 = variable-measure / store-internal
    assert is_in_store_label("0212345678901") is True
    assert is_in_store_label("0299999999999") is True


def test_2xx_prefix_in_range_is_in_store():
    # 200-299 reserved for in-store labels
    assert is_in_store_label("2001234567890") is True
    assert is_in_store_label("2501234567890") is True
    assert is_in_store_label("2991234567890") is True


def test_genuine_gs1_prefixes_are_not_in_store():
    # Malaysia 955
    assert is_in_store_label("9551234567890") is False
    # USA 0xx (but not 02)
    assert is_in_store_label("0001234567890") is False
    assert is_in_store_label("0341234567890") is False
    # Singapore 888
    assert is_in_store_label("8881234567890") is False
    # ISBN 978
    assert is_in_store_label("9781234567890") is False


def test_3xx_is_not_in_store():
    # 300-379 = France GS1 — definitely not in-store
    assert is_in_store_label("3001234567890") is False
    assert is_in_store_label("3791234567890") is False


def test_short_or_non_digit_is_not_in_store():
    assert is_in_store_label("") is False
    assert is_in_store_label("abc") is False
    assert is_in_store_label("02") is True  # boundary: 2 chars, "02"
    assert is_in_store_label("0") is False
    assert is_in_store_label(None) is False
