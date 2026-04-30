"""Integration tests for Phase D — store catalog.

Plan: F:\\ClaudeProjects\\GroceryApp\\.claude\\docs\\plans\\catalog_evolution.md §2.2 #9 + §7 Phase D.

Covers:
- create_store within quota
- create_store idempotent on duplicate name
- 30-cap quota enforcement
- search by prefix + substring, ranked by use_count
- delete_store releases quota; refuses to delete "unknown"
- create_purchase with store_id touches the store (use_count + last_used_at)
"""

from __future__ import annotations

import pytest
from firebase_admin import firestore

from app.core.exceptions import (
    NotFoundError,
    QuotaExceededError,
    ValidationError,
)
from app.core.metadata import apply_create_metadata
from app.services import (
    purchase_event_service,
    store_catalog_service,
)


def _set_user_doc(uid: str, **fields):
    db = firestore.client()
    db.collection("users").document(uid).set(
        apply_create_metadata({"uid": uid, **fields}, uid=uid, source="test_seed"),
    )


@pytest.fixture(autouse=True)
def _clean_phase_d_artifacts(fresh_uid):
    """Clean store_catalog/{fresh_uid}/stores/* after each test."""
    yield
    db = firestore.client()
    for snap in (
        db.collection("store_catalog").document(fresh_uid).collection("stores").stream()
    ):
        snap.reference.delete()


def test_create_store_consumes_quota(fresh_uid):
    _set_user_doc(fresh_uid, tier="free", store_quota_used=0, store_quota_limit=30)
    s = store_catalog_service.create_store(fresh_uid, "Tesco")
    assert s["store_id"] == "tesco"
    assert s["name"] == "Tesco"
    status = store_catalog_service.get_quota_status(fresh_uid)
    assert status["used"] == 1


def test_create_store_idempotent_on_duplicate_name(fresh_uid):
    """Same name twice → returns the existing row, no second create + no extra quota use."""
    _set_user_doc(fresh_uid, tier="free", store_quota_used=0)
    a = store_catalog_service.create_store(fresh_uid, "Tesco")
    b = store_catalog_service.create_store(fresh_uid, "tesco")  # different casing
    assert a["store_id"] == b["store_id"]
    assert store_catalog_service.get_quota_status(fresh_uid)["used"] == 1


def test_create_store_blocks_at_cap(fresh_uid):
    _set_user_doc(fresh_uid, tier="free", store_quota_used=30, store_quota_limit=30)
    with pytest.raises(QuotaExceededError) as exc_info:
        store_catalog_service.create_store(fresh_uid, "OneToomanyMart")
    assert exc_info.value.details["type"] == "store_quota_exceeded"
    assert exc_info.value.details["used"] == 30
    assert exc_info.value.details["limit"] == 30


def test_validation_rejects_empty_name(fresh_uid):
    _set_user_doc(fresh_uid, tier="free")
    with pytest.raises(ValidationError):
        store_catalog_service.create_store(fresh_uid, "")
    with pytest.raises(ValidationError):
        store_catalog_service.create_store(fresh_uid, "   ")


def test_search_returns_prefix_match_first(fresh_uid):
    _set_user_doc(fresh_uid, tier="free")
    store_catalog_service.create_store(fresh_uid, "Tesco")
    store_catalog_service.create_store(fresh_uid, "Tesco Express")
    store_catalog_service.create_store(fresh_uid, "Wet Market")

    matches = store_catalog_service.search_stores(fresh_uid, "tes")
    assert len(matches) >= 2
    names = [m["name"] for m in matches[:2]]
    assert "Tesco" in names and "Tesco Express" in names


def test_delete_releases_quota(fresh_uid):
    _set_user_doc(fresh_uid, tier="free", store_quota_used=0)
    store_catalog_service.create_store(fresh_uid, "Tesco")
    assert store_catalog_service.get_quota_status(fresh_uid)["used"] == 1
    store_catalog_service.delete_store(fresh_uid, "tesco")
    assert store_catalog_service.get_quota_status(fresh_uid)["used"] == 0


def test_delete_refuses_unknown(fresh_uid):
    """The auto-created 'unknown' store is the events-without-store sink — keep it."""
    _set_user_doc(fresh_uid, tier="free")
    # Phase A migration would create it; simulate it manually
    db = firestore.client()
    db.collection("store_catalog").document(fresh_uid).collection("stores").document("unknown").set(
        {"store_id": "unknown", "name": "Unknown", "auto_created": True, "use_count": 0}
    )
    with pytest.raises(ValidationError):
        store_catalog_service.delete_store(fresh_uid, "unknown")


def test_delete_missing_raises_not_found(fresh_uid):
    _set_user_doc(fresh_uid, tier="free")
    with pytest.raises(NotFoundError):
        store_catalog_service.delete_store(fresh_uid, "nonexistent")


def test_create_purchase_with_store_id_touches_store(fresh_uid):
    """Buying records the store on the event AND bumps the store's use_count."""
    _set_user_doc(fresh_uid, tier="free")
    store = store_catalog_service.create_store(fresh_uid, "Tesco")

    ev = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=12, store_id=store["store_id"],
    )
    assert ev["store_id"] == "tesco"

    refreshed = store_catalog_service.get_store(fresh_uid, "tesco")
    assert (refreshed.get("use_count") or 0) >= 1
    assert refreshed.get("last_used_at") is not None


def test_create_purchase_default_store_unknown(fresh_uid):
    """Omitting store_id defaults to "unknown" server-side."""
    _set_user_doc(fresh_uid, tier="free")
    ev = purchase_event_service.create_purchase(user_id=fresh_uid, name="Bread", quantity=1)
    assert ev["store_id"] == "unknown"


def test_pre_migration_user_quota_status_is_live_count(fresh_uid):
    """User without store_quota_used field → live count via streaming the subcollection."""
    # No _set_user_doc — simulate v1 user
    store_catalog_service.create_store(fresh_uid, "Cafe Beta")
    status = store_catalog_service.get_quota_status(fresh_uid)
    assert status["used"] == 1
    assert status["limit"] == 30
