"""Integration tests for Phase C — quota + idle TTL + cascade.

Plan: F:\\ClaudeProjects\\GroceryApp\\.claude\\docs\\plans\\catalog_evolution.md §2.2 #1-3 + §7 Phase C.

Covers:
- quota check raises QuotaExceededError when at limit
- consume / release counters
- paid users are exempt from quota check (configurable) and from idle clock
- create_purchase ticks the idle clock on a user_custom row
- view-only paths do NOT tick (we never call create on a view)
- cascade mode (a): user_custom + barcode → catalog removed, events stay
- cascade mode (b): user_custom + no barcode → catalog + events deleted
- cascade decrements quota_quota_used
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta

import pytest
from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from app.core.exceptions import QuotaExceededError
from app.core.metadata import apply_create_metadata
from app.services import (
    catalog_service,
    idle_clock_service,
    purchase_event_service,
    quota_service,
)


def _set_user_doc(uid: str, **fields):
    db = firestore.client()
    db.collection("users").document(uid).set(
        apply_create_metadata({"uid": uid, **fields}, uid=uid, source="test_seed"),
    )


@pytest.fixture(autouse=True)
def _clean_phase_c_artifacts(fresh_uid):
    """Remove cascade audit log + store_catalog rows tied to fresh_uid."""
    yield
    db = firestore.client()
    # cascade_audit_log entries from this run
    for snap in db.collection("cascade_audit_log").stream():
        d = snap.to_dict() or {}
        if d.get("actor_uid") == fresh_uid:
            snap.reference.delete()


# ---------------------------------------------------------------------------
# quota_service
# ---------------------------------------------------------------------------


def test_quota_status_pre_migration_user_counts_live(fresh_uid):
    """Pre-migration user with no catalog_quota_used field → live count of user_custom rows."""
    # Skip _set_user_doc so user is missing catalog_quota_used
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Custom soup", quantity=1)

    status = quota_service.get_quota_status(fresh_uid)
    assert status["used"] >= 1
    assert status["limit"] == 50
    assert status["at_or_above_limit"] is False


def test_quota_check_raises_at_cap(fresh_uid):
    """At cap → check_or_raise returns 409 with eviction candidates."""
    # Seed below cap so the create succeeds
    _set_user_doc(fresh_uid, tier="free", catalog_quota_used=49, catalog_quota_limit=50)
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Custom thing", quantity=1)
    # After create + consume, used should be 50 (the cap)
    assert quota_service.get_quota_status(fresh_uid)["used"] == 50

    with pytest.raises(QuotaExceededError) as exc_info:
        quota_service.check_or_raise(fresh_uid, would_be_user_custom=True)
    err = exc_info.value
    assert err.details["type"] == "catalog_quota_exceeded"
    assert err.details["used"] == 50
    assert err.details["limit"] == 50
    assert len(err.details["eviction_candidates"]) >= 1


def test_quota_check_skipped_for_global_linked(fresh_uid):
    """global_linked rows (barcode-tied) skip the quota check."""
    _set_user_doc(fresh_uid, tier="free", catalog_quota_used=50, catalog_quota_limit=50)
    # No raise expected
    quota_service.check_or_raise(fresh_uid, would_be_user_custom=False)


def test_quota_consume_and_release(fresh_uid):
    _set_user_doc(fresh_uid, tier="free", catalog_quota_used=10)
    quota_service.consume(fresh_uid, 1)
    assert quota_service.get_quota_status(fresh_uid)["used"] == 11
    quota_service.release(fresh_uid, 1)
    assert quota_service.get_quota_status(fresh_uid)["used"] == 10


def test_quota_reconcile_fixes_drift(fresh_uid):
    """Manually inflated counter gets fixed by reconcile_count."""
    _set_user_doc(fresh_uid, tier="free", catalog_quota_used=0, catalog_quota_limit=50)
    # Create one user_custom row legitimately
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Eggs", quantity=1)
    # Now manually corrupt the stored counter
    db = firestore.client()
    db.collection("users").document(fresh_uid).set({"catalog_quota_used": 99}, merge=True)

    result = quota_service.reconcile_count(fresh_uid)
    assert result["before"] == 99
    assert result["after"] == 1
    assert result["delta"] == -98


# ---------------------------------------------------------------------------
# catalog_service quota integration
# ---------------------------------------------------------------------------


def test_create_user_custom_blocked_at_quota_cap(fresh_uid):
    """Creating a no-barcode catalog at cap raises QuotaExceededError."""
    _set_user_doc(fresh_uid, tier="free", catalog_quota_used=50, catalog_quota_limit=50)
    with pytest.raises(QuotaExceededError):
        purchase_event_service.create_purchase(
            user_id=fresh_uid, name="Cap-buster", quantity=1,
        )


def test_create_global_linked_not_blocked_at_cap(fresh_uid):
    """Creating a barcode-tied (global_linked) catalog at cap is allowed."""
    _set_user_doc(fresh_uid, tier="free", catalog_quota_used=50, catalog_quota_limit=50)
    ev = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Branded item", quantity=1, barcode="9555012345678",
    )
    # Catalog mode should be global_linked
    cat = catalog_service.get_catalog_entry(fresh_uid, ev["catalog_name_norm"])
    assert cat["catalog_mode"] == "global_linked"
    assert cat["idle_expires_at"] is None  # global_linked has no clock


def test_user_custom_create_consumes_quota(fresh_uid):
    """Creating a no-barcode catalog increments catalog_quota_used."""
    _set_user_doc(fresh_uid, tier="free", catalog_quota_used=10)
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Custom item", quantity=1,
    )
    assert quota_service.get_quota_status(fresh_uid)["used"] == 11


def test_paid_user_custom_no_idle_clock(fresh_uid):
    """tier=plus → user_custom rows have idle_expires_at=null."""
    _set_user_doc(fresh_uid, tier="plus")
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Paid custom item", quantity=1,
    )
    cat = catalog_service.get_catalog_entry(fresh_uid, "paid_custom_item")
    assert cat["catalog_mode"] == "user_custom"
    assert cat["idle_expires_at"] is None


def test_free_user_custom_has_30d_clock(fresh_uid):
    """Free user + user_custom → idle_expires_at ≈ now + 30d."""
    _set_user_doc(fresh_uid, tier="free")
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Free custom", quantity=1,
    )
    cat = catalog_service.get_catalog_entry(fresh_uid, "free_custom")
    assert cat["idle_expires_at"] is not None
    delta = cat["idle_expires_at"] - datetime.now(timezone.utc)
    assert timedelta(days=29) < delta < timedelta(days=31)


# ---------------------------------------------------------------------------
# idle_clock tick
# ---------------------------------------------------------------------------


def test_tick_extends_idle_clock(fresh_uid):
    """Tick advances idle_expires_at on a user_custom row."""
    _set_user_doc(fresh_uid, tier="free")
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Ticked item", quantity=1,
    )

    # Manually backdate the clock so we can verify a tick advances it
    db = firestore.client()
    cat_ref = db.collection("catalog_entries").document(f"{fresh_uid}__ticked_item")
    cat_ref.update({"idle_expires_at": datetime.now(timezone.utc) - timedelta(days=5)})
    backdated = cat_ref.get().to_dict()["idle_expires_at"]

    new_expires = idle_clock_service.tick(fresh_uid, "ticked_item")
    assert new_expires is not None
    assert new_expires > backdated


def test_tick_no_op_for_global_linked(fresh_uid):
    """global_linked rows have no clock — tick returns None."""
    _set_user_doc(fresh_uid, tier="free")
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Branded", quantity=1, barcode="9555012345678",
    )
    result = idle_clock_service.tick(fresh_uid, "branded")
    assert result is None


def test_tick_no_op_for_paid_user(fresh_uid):
    """Paid user → tick is a no-op (clock stays null)."""
    _set_user_doc(fresh_uid, tier="plus")
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Paid custom", quantity=1,
    )
    result = idle_clock_service.tick(fresh_uid, "paid_custom")
    assert result is None


def test_create_purchase_auto_ticks(fresh_uid):
    """Creating a second purchase on an existing catalog refreshes the clock."""
    _set_user_doc(fresh_uid, tier="free")

    purchase_event_service.create_purchase(user_id=fresh_uid, name="Item", quantity=1)
    # Backdate
    db = firestore.client()
    cat_ref = db.collection("catalog_entries").document(f"{fresh_uid}__item")
    cat_ref.update({"idle_expires_at": datetime.now(timezone.utc) - timedelta(days=3)})

    purchase_event_service.create_purchase(user_id=fresh_uid, name="Item", quantity=1)
    new_expires = cat_ref.get().to_dict()["idle_expires_at"]
    assert new_expires > datetime.now(timezone.utc) + timedelta(days=29)


# ---------------------------------------------------------------------------
# Cascade
# ---------------------------------------------------------------------------


def test_cascade_mode_a_keeps_events_removes_catalog(fresh_uid):
    """user_custom + barcode → mode (a): catalog removed, events stay."""
    _set_user_doc(fresh_uid, tier="free")
    p = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Renamed thing", quantity=1, barcode="9555000000001",
    )
    # The first creation is global_linked (barcode-tied). For mode-a we need a
    # user_custom row WITH barcode — i.e. a renamed version. Force it via direct
    # write since the service classifies barcode-present as global_linked.
    db = firestore.client()
    db.collection("catalog_entries").document(f"{fresh_uid}__renamed_thing").update({
        "catalog_mode": "user_custom",
        "idle_expires_at": datetime.now(timezone.utc) - timedelta(days=1),
    })

    result = idle_clock_service.cascade_one(fresh_uid, "renamed_thing")
    assert result["mode"] == "a"
    # Catalog row deleted
    assert catalog_service.get_catalog_entry(fresh_uid, "renamed_thing") is None
    # Events still exist (orphaned, will be re-resolved by future reconcile)
    ev = purchase_event_service.get_purchase(fresh_uid, p["id"])
    assert ev is not None


def test_cascade_mode_b_deletes_catalog_and_events(fresh_uid):
    """user_custom + no barcode → mode (b): catalog + events deleted."""
    _set_user_doc(fresh_uid, tier="free")
    p = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Homemade jam", quantity=1,
    )
    # Backdate the idle clock so it's expired
    db = firestore.client()
    db.collection("catalog_entries").document(f"{fresh_uid}__homemade_jam").update({
        "idle_expires_at": datetime.now(timezone.utc) - timedelta(days=1),
    })

    result = idle_clock_service.cascade_one(fresh_uid, "homemade_jam")
    assert result["mode"] == "b"
    assert result["events_deleted"] >= 1
    # Catalog gone
    assert catalog_service.get_catalog_entry(fresh_uid, "homemade_jam") is None
    # Events gone
    ev = purchase_event_service.get_purchase(fresh_uid, p["id"])
    assert ev is None


def test_cascade_decrements_quota(fresh_uid):
    """Cascade on a user_custom row releases 1 quota slot."""
    _set_user_doc(fresh_uid, tier="free")
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Custom", quantity=1)
    used_before = quota_service.get_quota_status(fresh_uid)["used"]

    db = firestore.client()
    db.collection("catalog_entries").document(f"{fresh_uid}__custom").update({
        "idle_expires_at": datetime.now(timezone.utc) - timedelta(days=1),
    })
    idle_clock_service.cascade_one(fresh_uid, "custom")

    used_after = quota_service.get_quota_status(fresh_uid)["used"]
    assert used_after == used_before - 1


def test_cascade_paid_user_skipped(fresh_uid):
    """Paid users → cascade returns skipped, catalog stays."""
    _set_user_doc(fresh_uid, tier="plus")
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Premium", quantity=1)

    # Force the row to look expired
    db = firestore.client()
    db.collection("catalog_entries").document(f"{fresh_uid}__premium").update({
        "idle_expires_at": datetime.now(timezone.utc) - timedelta(days=1),
    })
    result = idle_clock_service.cascade_one(fresh_uid, "premium")
    assert result["mode"] == "skipped"
    assert result["reason"] == "paid_user"
    assert catalog_service.get_catalog_entry(fresh_uid, "premium") is not None


def test_run_cascade_writes_audit_log_and_summarizes(fresh_uid):
    """run_cascade writes a cascade_audit_log doc with totals."""
    _set_user_doc(fresh_uid, tier="free")
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Custom A", quantity=1)
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Custom B", quantity=1)
    db = firestore.client()
    for nn in ("custom_a", "custom_b"):
        db.collection("catalog_entries").document(f"{fresh_uid}__{nn}").update({
            "idle_expires_at": datetime.now(timezone.utc) - timedelta(days=1),
        })

    audit = idle_clock_service.run_cascade(actor_uid=fresh_uid, user_id=fresh_uid)
    assert audit["status"] == "complete"
    assert audit["expired_found"] >= 2
    assert audit["mode_b_count"] >= 2  # both no-barcode → mode (b)
    assert audit["quota_released"] >= 2
