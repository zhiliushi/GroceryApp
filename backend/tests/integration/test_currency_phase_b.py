"""Integration tests for Phase B — pricing + per-unit + currency.

Plan: F:\\ClaudeProjects\\GroceryApp\\.claude\\docs\\plans\\catalog_evolution.md §5.

Covers fx_rate_service caching + stale fallback, currency_service conversion,
write-path display_amount/fx_rate computation, multi-pack create.

External-API calls (frankfurter.app) are monkey-patched so tests don't hit the
network and stay stable in CI.
"""

from __future__ import annotations

import pytest
from datetime import datetime, timezone, timedelta
from firebase_admin import firestore

from app.core.exceptions import ValidationError
from app.core.metadata import apply_create_metadata
from app.services import (
    currency_service,
    fx_rate_service,
    purchase_event_service,
)


def _set_user_doc(uid: str, **fields):
    db = firestore.client()
    db.collection("users").document(uid).set(
        apply_create_metadata({"uid": uid, **fields}, uid=uid, source="test_seed"),
    )


@pytest.fixture(autouse=True)
def _clean_fx_cache():
    """Clear fx_rates collection before each test for determinism."""
    db = firestore.client()
    for snap in db.collection("fx_rates").stream():
        snap.reference.delete()
    yield
    for snap in db.collection("fx_rates").stream():
        snap.reference.delete()


# ---------------------------------------------------------------------------
# fx_rate_service
# ---------------------------------------------------------------------------


def test_fx_identity_skips_api():
    """from == to → rate=1.0, source=identity, no API call."""
    r = fx_rate_service.get_rate("SGD", "SGD")
    assert r["rate"] == 1.0
    assert r["source"] == "identity"
    assert r["is_stale"] is False


def test_fx_cache_hit(monkeypatch):
    """Pre-seed the cache; get_rate should not call the API."""
    db = firestore.client()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    db.collection("fx_rates").document(f"MYR_SGD_{today}").set({
        "rate": 0.305,
        "from": "MYR",
        "to": "SGD",
        "date": today,
        "source": "frankfurter",
        "is_stale": False,
    })

    called = {"count": 0}

    def boom(*a, **kw):
        called["count"] += 1
        raise AssertionError("API should not be called when cache hits")

    monkeypatch.setattr(fx_rate_service, "_fetch_rate", boom)

    r = fx_rate_service.get_rate("MYR", "SGD")
    assert r["rate"] == 0.305
    assert called["count"] == 0


def test_fx_api_miss_writes_to_cache(monkeypatch):
    """Cache miss → API fetch → result cached."""
    monkeypatch.setattr(fx_rate_service, "_fetch_rate", lambda f, t, d: 0.31)
    r = fx_rate_service.get_rate("MYR", "SGD")
    assert r["rate"] == 0.31
    assert r["source"] == "frankfurter"

    db = firestore.client()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    cached = db.collection("fx_rates").document(f"MYR_SGD_{today}").get()
    assert cached.exists
    assert (cached.to_dict() or {})["rate"] == 0.31


def test_fx_stale_fallback_when_api_fails(monkeypatch):
    """API fails AND no cache for today → return most-recent cached within 7d, is_stale=True."""
    db = firestore.client()
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    db.collection("fx_rates").document(f"MYR_SGD_{yesterday}").set({
        "rate": 0.30,
        "from": "MYR",
        "to": "SGD",
        "date": yesterday,
        "source": "frankfurter",
        "is_stale": False,
    })

    def fail(*a, **kw):
        raise RuntimeError("upstream down")

    monkeypatch.setattr(fx_rate_service, "_fetch_rate", fail)

    r = fx_rate_service.get_rate("MYR", "SGD")
    assert r["rate"] == 0.30
    assert r["source"] == "stale_cache"
    assert r["is_stale"] is True


def test_fx_no_rate_when_api_fails_and_no_cache(monkeypatch):
    """No cache, no API → rate=None."""
    monkeypatch.setattr(fx_rate_service, "_fetch_rate", lambda *a, **kw: (_ for _ in ()).throw(RuntimeError("down")))
    r = fx_rate_service.get_rate("MYR", "JPY")
    assert r["rate"] is None
    assert r["source"] == "none"


# ---------------------------------------------------------------------------
# currency_service
# ---------------------------------------------------------------------------


def test_currency_convert_identity():
    out = currency_service.convert_to_display(10.0, "SGD", "SGD")
    assert out["display_amount"] == 10.0
    assert out["display_currency"] == "SGD"
    assert out["fx_rate_at_save"] == 1.0
    assert out["is_stale"] is False


def test_currency_convert_missing_inputs_safe():
    out = currency_service.convert_to_display(None, None, "SGD")
    assert out["display_amount"] is None
    assert out["fx_rate_at_save"] is None


def test_currency_convert_uses_fx_service(monkeypatch):
    monkeypatch.setattr(
        fx_rate_service,
        "get_rate",
        lambda f, t, d=None: {"rate": 0.31, "from": f, "to": t, "date": "2026-04-30",
                              "source": "frankfurter", "is_stale": False},
    )
    out = currency_service.convert_to_display(100.0, "MYR", "SGD")
    assert out["display_amount"] == pytest.approx(31.0)
    assert out["fx_rate_at_save"] == 0.31


# ---------------------------------------------------------------------------
# purchase_event_service write path — display fields computed at save
# ---------------------------------------------------------------------------


def test_create_purchase_locks_fx_rate_when_currency_matches_pref(fresh_uid):
    _set_user_doc(fresh_uid, tier="free", currency_preference="SGD")
    ev = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Apples", quantity=4, price=4.0, currency="SGD",
    )
    assert ev["currency"] == "SGD"
    assert ev["display_currency"] == "SGD"
    assert ev["display_amount"] == 4.0
    assert ev["fx_rate_at_save"] == 1.0
    # unit_price = display_amount / qty / pack_size = 4 / 4 / 1 = 1.0
    assert ev["unit_price"] == pytest.approx(1.0)
    assert ev["pack_size"] == 1
    assert ev["base_unit_label"] == "unit"  # "Apples" doesn't match unit-hint regex
    assert ev["store_id"] == "unknown"
    assert ev["contributes_to_logical_count"] is True
    assert ev["schema_version"] == 2


def test_create_purchase_converts_cross_currency_via_fx(fresh_uid, monkeypatch):
    _set_user_doc(fresh_uid, tier="free", currency_preference="SGD")
    monkeypatch.setattr(
        fx_rate_service,
        "get_rate",
        lambda f, t, d=None: {"rate": 0.30, "from": f, "to": t, "date": "2026-04-30",
                              "source": "frankfurter", "is_stale": False},
    )
    ev = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=12, price=10.00, currency="MYR",
    )
    assert ev["currency"] == "MYR"
    assert ev["display_currency"] == "SGD"
    assert ev["display_amount"] == pytest.approx(3.0)  # 10 * 0.30
    assert ev["fx_rate_at_save"] == 0.30
    # unit_price computed in display currency: 3.0 / 12 / 1 = 0.25/egg
    assert ev["unit_price"] == pytest.approx(0.25)
    assert ev["base_unit_label"] == "egg"  # inferred from "Eggs"


def test_create_purchase_handles_fx_unavailable_gracefully(fresh_uid, monkeypatch):
    """If FX API down + no cache, event still created with display_amount=None."""
    _set_user_doc(fresh_uid, tier="free", currency_preference="SGD")
    monkeypatch.setattr(
        fx_rate_service,
        "get_rate",
        lambda f, t, d=None: {"rate": None, "from": f, "to": t, "date": "x",
                              "source": "none", "is_stale": False},
    )
    ev = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Imported tea", quantity=1, price=15.0, currency="JPY",
    )
    assert ev["currency"] == "JPY"
    assert ev["display_currency"] == "SGD"
    assert ev["display_amount"] is None
    assert ev["fx_rate_at_save"] is None
    # unit_price falls through to None when display_amount is None
    assert ev["unit_price"] is None


def test_create_purchase_user_without_pref_defaults_to_sgd(fresh_uid):
    """v1 user (no currency_preference field) → defaults to SGD on the create path."""
    # Note: NOT calling _set_user_doc — simulates v1 user with no profile yet.
    ev = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Bread", quantity=1, price=3.0, currency="SGD",
    )
    assert ev["display_currency"] == "SGD"
    assert ev["fx_rate_at_save"] == 1.0


# ---------------------------------------------------------------------------
# Multi-pack create
# ---------------------------------------------------------------------------


def test_multi_pack_creates_n_events_with_shared_parent_id(fresh_uid):
    """6 packs of 6 eggs at 10.99/pack → 6 events, qty=1, pack_size=6, all share parent_id."""
    _set_user_doc(fresh_uid, tier="free", currency_preference="SGD")
    result = purchase_event_service.create_multi_pack(
        user_id=fresh_uid, name="Eggs",
        pack_count=6, units_per_pack=6, price_per_pack=10.99,
        currency="SGD",
    )
    assert result["created_count"] == 6
    assert len(result["events"]) == 6
    parent_id = result["parent_id"]
    assert parent_id and len(parent_id) >= 8

    for ev in result["events"]:
        assert ev["multi_pack_parent_id"] == parent_id
        assert ev["pack_size"] == 6
        assert ev["quantity"] == 1.0
        assert ev["price"] == 10.99
        assert ev["currency"] == "SGD"
        assert ev["display_currency"] == "SGD"
        assert ev["display_amount"] == 10.99
        # unit_price = 10.99 / 1 / 6 = $1.83/egg (in display currency)
        assert ev["unit_price"] == pytest.approx(10.99 / 6, abs=0.001)
        assert ev["base_unit_label"] == "egg"  # inferred


def test_multi_pack_total_spend_math(fresh_uid):
    """6 packs × 10.99 = 65.94. Sum of display_amount across siblings = 65.94."""
    _set_user_doc(fresh_uid, tier="free", currency_preference="SGD")
    result = purchase_event_service.create_multi_pack(
        user_id=fresh_uid, name="Eggs",
        pack_count=6, units_per_pack=6, price_per_pack=10.99,
        currency="SGD",
    )
    total = sum(ev["display_amount"] for ev in result["events"])
    assert total == pytest.approx(65.94, abs=0.001)


def test_multi_pack_validates_inputs(fresh_uid):
    _set_user_doc(fresh_uid, tier="free")
    with pytest.raises(ValidationError):
        purchase_event_service.create_multi_pack(
            user_id=fresh_uid, name="Eggs",
            pack_count=0, units_per_pack=6, price_per_pack=1.0,
        )
    with pytest.raises(ValidationError):
        purchase_event_service.create_multi_pack(
            user_id=fresh_uid, name="Eggs",
            pack_count=6, units_per_pack=0, price_per_pack=1.0,
        )
