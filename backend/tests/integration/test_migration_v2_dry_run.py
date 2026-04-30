"""Integration tests for Phase 0 — migration v2 dry-run.

Plan: F:\\ClaudeProjects\\GroceryApp\\.claude\\docs\\plans\\catalog_evolution.md §4.

Verifies the predicted-diff produced by `migration_v2_dry_run.dry_run_for_user`
matches the migration defaults table exactly. Read-only — no writes occur.
"""

from __future__ import annotations

from firebase_admin import firestore

from app.core.metadata import apply_create_metadata
from app.services import migration_v2_dry_run, purchase_event_service


def _set_user_doc(uid: str, **fields):
    db = firestore.client()
    db.collection("users").document(uid).set(
        apply_create_metadata({"uid": uid, **fields}, uid=uid, source="test_seed"),
    )


def test_fresh_install_classifies_correctly(fresh_uid):
    """Catalog with barcodes → global_linked; no-barcode → user_custom; events default to pack_size=1."""
    _set_user_doc(fresh_uid, email="t@example.com", tier="free")

    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=12, price=6.0, barcode="9555012345678",
    )
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Homemade jam", quantity=1, price=4.5,
    )

    r = migration_v2_dry_run.dry_run_for_user(fresh_uid)

    assert r["user_id"] == fresh_uid
    assert r["schema_version_target"] == 2
    assert r["is_paid"] is False  # tier=free
    assert r["catalog"]["total"] == 2
    assert r["catalog"]["predicted_global_linked"] == 1
    assert r["catalog"]["predicted_user_custom_with_barcode"] == 0
    assert r["catalog"]["predicted_user_custom_no_barcode"] == 1

    assert r["events"]["total"] == 2
    assert r["events"]["pack_size_default_count"] == 2
    # "Eggs" should be inferred to base_unit_label = "egg"; "Homemade jam" defaults to "unit".
    assert r["events"]["base_unit_inferred_count"] == 1
    assert r["events"]["base_unit_default_count"] == 1
    assert r["events"]["split_event_count"] == 0
    assert r["events"]["logical_event_count"] == 2

    assert r["user"]["predicted_is_paid"] is False
    assert r["user"]["predicted_currency_preference"] == "SGD"
    assert r["user"]["predicted_catalog_quota_used"] == 1  # only the no-barcode row
    assert r["user"]["predicted_catalog_quota_limit"] == 50
    assert r["user"]["quota_at_or_above_limit"] is False

    assert r["stores"]["will_create_unknown_store"] is True
    assert r["stores"]["auto_created_store_doc"]["use_count"] == 2

    assert r["totals"]["pass_threshold_met"] is True


def test_paid_user_no_idle_expiry(fresh_uid):
    """tier=plus → is_paid=True → idle_expires_at stays null even for user_custom."""
    _set_user_doc(fresh_uid, email="paid@example.com", tier="plus")
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Custom soup", quantity=1)

    r = migration_v2_dry_run.dry_run_for_user(fresh_uid)
    assert r["is_paid"] is True
    assert r["user"]["predicted_is_paid"] is True

    # The single user_custom row should have null idle_expires_at because user is paid.
    sample = r["sample_diffs"]["catalog"]
    assert sample is not None
    assert sample["predicted_catalog_mode"] == "user_custom"
    assert sample["predicted_idle_expires_at"] is None


def test_split_event_predicted_as_non_logical(fresh_uid):
    """Phase 1 partial-action splits are predicted with contributes_to_logical_count=False."""
    _set_user_doc(fresh_uid, tier="free")
    p = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=12, price=6.0,
    )
    purchase_event_service.update_status(
        user_id=fresh_uid, event_id=p["id"], status="thrown", reason="expired", quantity=2,
    )

    r = migration_v2_dry_run.dry_run_for_user(fresh_uid)
    # 2 events total: original (logical) + split-thrown (not logical).
    assert r["events"]["total"] == 2
    assert r["events"]["split_event_count"] == 1
    assert r["events"]["logical_event_count"] == 1

    # In the events_sample we expect one event with contributes_to_logical_count=False
    contributions = [e["predicted_contributes_to_logical_count"] for e in r["events_sample"]]
    assert True in contributions
    assert False in contributions


def test_multi_currency_user_flagged(fresh_uid):
    """Events in different currencies → multi_currency_user=True; flagged for FX in Phase B."""
    _set_user_doc(fresh_uid, tier="free")
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=12, price=6.0, currency="MYR",
    )
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Apples", quantity=4, price=4.0, currency="SGD",
    )

    r = migration_v2_dry_run.dry_run_for_user(fresh_uid)
    assert r["events"]["multi_currency_user"] is True
    assert set(r["events"]["currencies_seen"].keys()) == {"MYR", "SGD"}
    assert r["events"]["currency_set_count"] == 2
    assert r["events"]["currency_default_count"] == 0


def test_event_without_currency_is_defaulted_and_flagged(fresh_uid):
    """Event with price but no currency → currency_defaulted ambiguity flag."""
    _set_user_doc(fresh_uid, tier="free")
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Bread", quantity=1, price=3.0,  # no currency arg
    )

    r = migration_v2_dry_run.dry_run_for_user(fresh_uid)
    assert r["events"]["currency_default_count"] == 1
    flags_per_event = [set(e["ambiguity_flags"]) for e in r["events_sample"]]
    assert any("currency_defaulted" in fs for fs in flags_per_event)


def test_idempotent_pass_threshold_with_clean_data(fresh_uid):
    """Clean creates with barcodes + currency set → pass_threshold_met=True, low ambig pct."""
    _set_user_doc(fresh_uid, tier="free")
    for i in range(5):
        purchase_event_service.create_purchase(
            user_id=fresh_uid,
            name=f"Item {i} pack",
            quantity=1.0,
            price=2.0,
            currency="MYR",
            barcode=f"9555000{i:06d}",
        )

    r = migration_v2_dry_run.dry_run_for_user(fresh_uid)
    assert r["totals"]["pass_threshold_met"] is True
    assert r["totals"]["total_ambiguous_pct"] < 5.0
    assert r["catalog"]["predicted_global_linked"] == 5
    assert r["catalog"]["predicted_user_custom_no_barcode"] == 0


def test_all_users_aggregate_runs(fresh_uid):
    """all-users mode aggregates this user's seed (and any other test residue tolerated)."""
    _set_user_doc(fresh_uid, tier="free")
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Test item", quantity=1)

    agg = migration_v2_dry_run.dry_run_all_users()
    assert "computed_at" in agg
    assert agg["user_count"] >= 1
    # Our user must appear in per_user list
    uids = {u["user_id"] for u in agg["per_user"]}
    assert fresh_uid in uids
