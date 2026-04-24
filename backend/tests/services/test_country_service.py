"""Unit tests for GS1 prefix → country code detection.

Bypasses Firestore by seeding `_prefix_cache` directly — `detect_country_by_barcode`
is pure lookup once the cache is loaded, so we can exercise it without Firebase.
"""

from __future__ import annotations

import pytest

from app.services import country_service


@pytest.fixture(autouse=True)
def seeded_cache(monkeypatch):
    """Replace cache with a minimal seed covering MY + SG + US ranges."""
    fake_cache = {}
    # Malaysia — 955
    fake_cache["955"] = "MY"
    # Singapore — 888
    fake_cache["888"] = "SG"
    # US / Canada — 000–019 (sample)
    for p in range(0, 20):
        fake_cache[f"{p:03d}"] = "US"
    # Force the module to treat cache as loaded so detect_country_by_barcode skips Firestore
    monkeypatch.setattr(country_service, "_prefix_cache", fake_cache)
    monkeypatch.setattr(country_service, "_prefix_cache_loaded", True)
    yield
    # Reset after test
    monkeypatch.setattr(country_service, "_prefix_cache_loaded", False)
    monkeypatch.setattr(country_service, "_prefix_cache", {})


def test_malaysia_prefix():
    assert country_service.detect_country_by_barcode("9555012345678") == "MY"


def test_singapore_prefix():
    assert country_service.detect_country_by_barcode("8881234567890") == "SG"


def test_us_prefix():
    assert country_service.detect_country_by_barcode("0012345678901") == "US"
    assert country_service.detect_country_by_barcode("0199999999999") == "US"


def test_unknown_prefix_returns_none():
    # 555 not in seed
    assert country_service.detect_country_by_barcode("5551234567890") is None


def test_empty_barcode_returns_none():
    assert country_service.detect_country_by_barcode("") is None


def test_too_short_returns_none():
    assert country_service.detect_country_by_barcode("95") is None


def test_none_input_returns_none():
    assert country_service.detect_country_by_barcode(None) is None  # type: ignore[arg-type]


def test_prefix_is_first_three_digits_only():
    # Make sure it doesn't accidentally match on a later segment
    assert country_service.detect_country_by_barcode("1115551234") is None


def test_exactly_three_digit_barcode():
    # Edge: barcode is exactly the prefix
    assert country_service.detect_country_by_barcode("955") == "MY"


def test_seed_countries_shape():
    """Sanity check: module's seed data is structurally valid."""
    seed = country_service._SEED_COUNTRIES
    assert len(seed) >= 5
    for country in seed:
        assert "code" in country
        assert "name" in country
        assert "currency" in country
        assert "gs1_prefix_ranges" in country
        assert isinstance(country["gs1_prefix_ranges"], list)
        for rng in country["gs1_prefix_ranges"]:
            assert "start" in rng
            assert "end" in rng
            assert len(rng["start"]) == 3
            assert len(rng["end"]) == 3
            # start ≤ end numerically
            assert int(rng["start"]) <= int(rng["end"])
