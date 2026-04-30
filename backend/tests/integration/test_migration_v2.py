"""Integration tests for Phase A — migration v2 (writes data).

Plan: F:\\ClaudeProjects\\GroceryApp\\.claude\\docs\\plans\\catalog_evolution.md §4.

Verifies that the migration applies §4.2 defaults exactly, is idempotent on
re-run, collects errors per-doc without bailing, and respects paid-user
exemptions for the idle-TTL clock.

Runs against the Firestore emulator. The autouse `_clean_test_data` fixture in
conftest cleans the user's catalog/events/user-doc; this test file ALSO cleans
its migration_audit_log + store_catalog writes (those collections aren't
covered by the global fixture).
"""

from __future__ import annotations

import pytest
from firebase_admin import firestore

from app.core.exceptions import ValidationError
from app.core.metadata import apply_create_metadata
from app.services import migration_v2, purchase_event_service


def _set_user_doc(uid: str, **fields):
    db = firestore.client()
    db.collection("users").document(uid).set(
        apply_create_metadata({"uid": uid, **fields}, uid=uid, source="test_seed"),
    )


_V2_EVENT_FIELDS = (
    "amount", "display_amount", "display_currency", "fx_rate_at_save", "fx_rate_date",
    "pack_size", "base_unit_label", "store_id", "multi_pack_parent_id",
    "contributes_to_logical_count", "unit_price",
)
_V2_CATALOG_FIELDS = ("catalog_mode", "canonical_name", "idle_expires_at", "_migration_v2_applied_at")


def _downgrade_user_data_to_v1(user_id: str):
    """Strip v2 fields + reset schema_version=1 on a user's catalog rows + events.

    Used to simulate pre-migration v1 state when the production write path
    (Phase B) now stamps everything as v2 directly. This lets the migration
    tests still exercise the v1→v2 conversion code path."""
    from google.cloud.firestore_v1.base_query import FieldFilter
    db = firestore.client()
    # Catalog
    for snap in (
        db.collection("catalog_entries")
        .where(filter=FieldFilter("user_id", "==", user_id))
        .stream()
    ):
        downgrade = {"schema_version": 1}
        for f in _V2_CATALOG_FIELDS:
            downgrade[f] = firestore.DELETE_FIELD
        snap.reference.update(downgrade)
    # Events
    for snap in (
        db.collection("users").document(user_id).collection("purchases").stream()
    ):
        downgrade = {"schema_version": 1}
        for f in _V2_EVENT_FIELDS:
            downgrade[f] = firestore.DELETE_FIELD
        snap.reference.update(downgrade)
    # User doc (drop schema_version so user_doc_update path treats as v1)
    db.collection("users").document(user_id).update({
        "schema_version": firestore.DELETE_FIELD,
        "is_paid": firestore.DELETE_FIELD,
        "currency_preference": firestore.DELETE_FIELD,
        "catalog_quota_used": firestore.DELETE_FIELD,
        "catalog_quota_limit": firestore.DELETE_FIELD,
        "store_quota_used": firestore.DELETE_FIELD,
        "store_quota_limit": firestore.DELETE_FIELD,
    })


@pytest.fixture(autouse=True)
def _clean_migration_artifacts(fresh_uid):
    """Delete migration_audit_log + store_catalog/{fresh_uid} after each test."""
    yield
    db = firestore.client()
    # Clean store_catalog/{uid}/stores/* (subcollection — must list and delete each)
    for snap in (
        db.collection("store_catalog").document(fresh_uid).collection("stores").stream()
    ):
        snap.reference.delete()
    # The audit log is global; we delete only docs created during this test session.
    # Simplest: clean any audit doc whose actor_uid == fresh_uid (test admin).
    for snap in db.collection("migration_audit_log").stream():
        d = snap.to_dict() or {}
        if d.get("actor_uid") == fresh_uid:
            snap.reference.delete()


def test_run_without_confirm_raises(fresh_uid):
    """Belt-and-braces guard: confirm=false (or missing) → ValidationError."""
    with pytest.raises(ValidationError):
        migration_v2.run_migration(actor_uid=fresh_uid, confirm=False)


def test_migrates_v1_data_to_v2_with_correct_defaults(fresh_uid):
    """A fresh v1 user gets schema_version=2 + all §4.2 defaults applied."""
    _set_user_doc(fresh_uid, email="t@example.com", tier="free")

    p_eggs = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=12, price=6.0,
        currency="MYR", barcode="9555012345678",
    )
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Homemade jam", quantity=1, price=4.5,
    )

    # Production write path (Phase B) now stamps v2 directly; simulate v1 state
    # so the migration has something to migrate.
    _downgrade_user_data_to_v1(fresh_uid)

    audit = migration_v2.run_migration(actor_uid=fresh_uid, confirm=True)

    # --- Audit doc shape ---
    assert audit["status"] == "complete"
    assert audit["user_count"] >= 1
    assert audit["catalog_rows_processed"] >= 2
    assert audit["events_processed"] >= 2
    assert audit["events_with_unit_label_inferred"] >= 1  # "Eggs" → "egg"
    assert audit["user_docs_updated"] >= 1
    assert audit["stores_created"] >= 1

    # --- Catalog row: Eggs (with barcode) → global_linked, no idle clock ---
    db = firestore.client()
    eggs_cat = db.collection("catalog_entries").document(f"{fresh_uid}__eggs").get().to_dict()
    assert eggs_cat["catalog_mode"] == "global_linked"
    assert eggs_cat["canonical_name"] == "Eggs"
    assert eggs_cat["idle_expires_at"] is None
    assert eggs_cat["schema_version"] == 2

    # --- Catalog row: Homemade jam (no barcode) → user_custom, idle in ~60d ---
    jam_cat = (
        db.collection("catalog_entries").document(f"{fresh_uid}__homemade_jam").get().to_dict()
    )
    assert jam_cat["catalog_mode"] == "user_custom"
    assert jam_cat["idle_expires_at"] is not None
    assert jam_cat["schema_version"] == 2

    # --- Event: Eggs purchase ---
    eggs_ev = (
        db.collection("users").document(fresh_uid)
        .collection("purchases").document(p_eggs["id"]).get().to_dict()
    )
    assert eggs_ev["pack_size"] == 1
    assert eggs_ev["base_unit_label"] == "egg"  # inferred from name
    assert eggs_ev["amount"] == 6.0
    assert eggs_ev["currency"] == "MYR"
    # display_currency == user.currency_preference (default SGD)
    assert eggs_ev["display_currency"] == "SGD"
    # Currencies differ → fx_rate_at_save left as None for Phase B to fill in
    assert eggs_ev["fx_rate_at_save"] is None
    assert eggs_ev["unit_price"] == pytest.approx(0.5, abs=0.001)  # 6.0 / 12 / 1
    assert eggs_ev["store_id"] == "unknown"
    assert eggs_ev["contributes_to_logical_count"] is True
    assert eggs_ev["schema_version"] == 2

    # --- User doc updated ---
    user = db.collection("users").document(fresh_uid).get().to_dict()
    assert user["is_paid"] is False
    assert user["currency_preference"] == "SGD"
    assert user["catalog_quota_used"] == 1  # only the no-barcode "Homemade jam" row
    assert user["catalog_quota_limit"] == 50
    assert user["store_quota_used"] == 1
    assert user["store_quota_limit"] == 30
    assert user["schema_version"] == 2

    # --- Store catalog: "unknown" auto-created with use_count=2 ---
    unknown_store = (
        db.collection("store_catalog").document(fresh_uid)
        .collection("stores").document("unknown").get().to_dict()
    )
    assert unknown_store["name"] == "Unknown"
    assert unknown_store["auto_created"] is True
    assert unknown_store["use_count"] == 2


def test_re_run_is_idempotent(fresh_uid):
    """Running migration twice on the same data does not re-update the docs."""
    _set_user_doc(fresh_uid, tier="free")
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Bread", quantity=1, price=3.0,
    )
    _downgrade_user_data_to_v1(fresh_uid)

    first = migration_v2.run_migration(actor_uid=fresh_uid, confirm=True)
    assert first["catalog_rows_processed"] >= 1
    assert first["events_processed"] >= 1

    second = migration_v2.run_migration(actor_uid=fresh_uid, confirm=True)
    # Second run: this user contributes ZERO processed rows because schema_version=2 already.
    # Other test residue (other users) may inflate the totals, so check the per_user entry.
    user_entry = next(u for u in second["per_user"] if u["user_id"] == fresh_uid)
    assert user_entry["catalog_rows_processed"] == 0
    assert user_entry["events_processed"] == 0
    assert user_entry["catalog_rows_skipped"] >= 1
    assert user_entry["events_skipped"] >= 1
    assert user_entry["user_doc_skipped"] is True
    assert user_entry["store_unknown_created"] is False  # store already exists


def test_paid_user_skips_idle_expiry(fresh_uid):
    """tier=plus → user_custom rows get idle_expires_at=null (no clock for paid)."""
    _set_user_doc(fresh_uid, tier="plus")
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Custom soup", quantity=1,
    )

    migration_v2.run_migration(actor_uid=fresh_uid, confirm=True)

    db = firestore.client()
    soup_cat = (
        db.collection("catalog_entries").document(f"{fresh_uid}__custom_soup").get().to_dict()
    )
    assert soup_cat["catalog_mode"] == "user_custom"
    assert soup_cat["idle_expires_at"] is None  # paid → no clock

    user = db.collection("users").document(fresh_uid).get().to_dict()
    assert user["is_paid"] is True


def test_split_event_marked_non_logical(fresh_uid):
    """Phase 1-4 split children get contributes_to_logical_count=False after migration."""
    _set_user_doc(fresh_uid, tier="free")
    p = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=12, price=6.0,
    )
    split = purchase_event_service.update_status(
        user_id=fresh_uid, event_id=p["id"], status="thrown",
        reason="expired", quantity=2,
    )

    migration_v2.run_migration(actor_uid=fresh_uid, confirm=True)

    db = firestore.client()
    original_ev = (
        db.collection("users").document(fresh_uid)
        .collection("purchases").document(p["id"]).get().to_dict()
    )
    split_ev = (
        db.collection("users").document(fresh_uid)
        .collection("purchases").document(split["id"]).get().to_dict()
    )
    assert original_ev["contributes_to_logical_count"] is True
    assert split_ev["contributes_to_logical_count"] is False
    # Both have schema_version=2
    assert original_ev["schema_version"] == 2
    assert split_ev["schema_version"] == 2


def test_audit_log_persists_and_listable(fresh_uid):
    """Migration writes a migration_audit_log doc; list_runs returns it newest-first."""
    _set_user_doc(fresh_uid, tier="free")
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Milk", quantity=1)

    audit = migration_v2.run_migration(actor_uid=fresh_uid, confirm=True)
    run_id = audit["run_id"]

    runs = migration_v2.list_runs(limit=10)
    assert any(r["run_id"] == run_id for r in runs)

    detail = migration_v2.get_run(run_id)
    assert detail is not None
    assert detail["actor_uid"] == fresh_uid
    assert detail["status"] == "complete"
    # per_user is preserved on the detail view
    assert any(u["user_id"] == fresh_uid for u in detail.get("per_user", []))


def test_currency_already_in_preference_locks_fx_rate_to_one(fresh_uid):
    """Event currency == user pref → fx_rate_at_save = 1.0."""
    _set_user_doc(fresh_uid, tier="free", currency_preference="MYR")
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Apples", quantity=4, price=4.0, currency="MYR",
    )

    migration_v2.run_migration(actor_uid=fresh_uid, confirm=True)

    db = firestore.client()
    snaps = (
        db.collection("users").document(fresh_uid)
        .collection("purchases").stream()
    )
    snap = next(iter(snaps))
    ev = snap.to_dict()
    assert ev["currency"] == "MYR"
    assert ev["display_currency"] == "MYR"
    assert ev["fx_rate_at_save"] == 1.0
