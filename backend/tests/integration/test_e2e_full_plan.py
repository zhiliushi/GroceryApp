"""End-to-end happy-path test for the full catalog evolution plan.

Walks one user through the full lifecycle:
  v1 data → Phase 0 dry-run → Phase A migration → Phase F diagnostic →
  Phase B (currency + multi-pack) → Phase C (quota + idle clock + cascade) →
  Phase D (store) → Phase E (overview) → Phase G (similarity + transfer + reverse).

Existence of this test demonstrates the phases compose correctly, not just
in isolation. Each phase's own test file covers the per-feature edge cases.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta

import pytest
from firebase_admin import firestore

from app.core.metadata import apply_create_metadata
from app.services import (
    catalog_overview_service,
    catalog_service,
    catalog_similarity_service,
    catalog_transfer_service,
    fx_rate_service,
    idle_clock_service,
    migration_v2,
    migration_v2_dry_run,
    purchase_event_service,
    quota_service,
    store_catalog_service,
)
from app.services import admin_diagnostic_service


def _set_user_doc(uid: str, **fields):
    db = firestore.client()
    db.collection("users").document(uid).set(
        apply_create_metadata({"uid": uid, **fields}, uid=uid, source="test_seed"),
    )


@pytest.fixture(autouse=True)
def _e2e_cleanup(fresh_uid):
    yield
    db = firestore.client()
    # Clean Phase D store_catalog
    for snap in (
        db.collection("store_catalog").document(fresh_uid).collection("stores").stream()
    ):
        snap.reference.delete()
    # Clean Phase G transfer audit log
    for snap in (
        db.collection("transfer_audit_log").document(fresh_uid).collection("items").stream()
    ):
        snap.reference.delete()
    # Clean Phase A migration audit log
    for snap in db.collection("migration_audit_log").stream():
        d = snap.to_dict() or {}
        if d.get("actor_uid") == fresh_uid:
            snap.reference.delete()
    # Clean Phase C cascade audit log
    for snap in db.collection("cascade_audit_log").stream():
        d = snap.to_dict() or {}
        if d.get("actor_uid") == fresh_uid:
            snap.reference.delete()


def test_e2e_full_plan_happy_path(fresh_uid, monkeypatch):
    """One user, full plan. Each section corresponds to a phase."""
    db = firestore.client()

    # ─── Stub FX so cross-currency events convert deterministically ─────
    monkeypatch.setattr(
        fx_rate_service,
        "get_rate",
        lambda f, t, d=None: {
            "rate": 1.0 if f == t else 0.30,
            "from": f,
            "to": t,
            "date": "2026-04-30",
            "source": "test",
            "is_stale": False,
        },
    )

    # ─── 0. Seed v1-style data ──────────────────────────────────────────
    # User doc has tier=free, no schema_version field (v1).
    _set_user_doc(fresh_uid, email="e2e@test", tier="free")
    # Two events created via the modern path, then DOWNGRADED to v1 shape
    # so the migration has something to convert.
    p_eggs = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=12, price=6.0,
        currency="MYR", barcode="9555012345678",
    )
    p_jam = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Homemade jam", quantity=1, price=4.5,
    )
    _downgrade_to_v1(fresh_uid)

    # ─── Phase 0: dry-run prediction ────────────────────────────────────
    dry = migration_v2_dry_run.dry_run_for_user(fresh_uid)
    assert dry["totals"]["pass_threshold_met"] is True, (
        f"Dry-run should pass with clean v1 data, got {dry['totals']['total_ambiguous_pct']}%"
    )
    assert dry["catalog"]["predicted_global_linked"] == 1  # Eggs (has barcode)
    assert dry["catalog"]["predicted_user_custom_no_barcode"] == 1  # Homemade jam

    # ─── Phase A: run migration ─────────────────────────────────────────
    audit = migration_v2.run_migration(actor_uid=fresh_uid, confirm=True)
    assert audit["status"] == "complete"
    # Both catalog rows + events + user doc + unknown store
    user_entry = next(u for u in audit["per_user"] if u["user_id"] == fresh_uid)
    assert user_entry["catalog_rows_processed"] >= 2
    assert user_entry["events_processed"] >= 2
    assert user_entry["user_doc_updated"] is True
    assert user_entry["store_unknown_created"] is True

    # Verify schema_version=2 stamped on every doc
    eggs_cat = catalog_service.get_catalog_entry(fresh_uid, "eggs")
    assert eggs_cat["schema_version"] == 2
    assert eggs_cat["catalog_mode"] == "global_linked"
    assert eggs_cat["idle_expires_at"] is None
    jam_cat = catalog_service.get_catalog_entry(fresh_uid, "homemade_jam")
    assert jam_cat["catalog_mode"] == "user_custom"
    assert jam_cat["idle_expires_at"] is not None

    # ─── Phase F: diagnostic — no drift, no inflation ───────────────────
    diag = admin_diagnostic_service.compute_catalog_counter_diagnostics(fresh_uid)
    assert diag["divergent_count"] == 0, "Migration should not introduce drift"
    assert diag["inflated_count"] == 0, "No splits yet → no inflation"

    # ─── Phase B: multi-pack purchase with cross-currency ──────────────
    multi = purchase_event_service.create_multi_pack(
        user_id=fresh_uid, name="Eggs",  # existing global_linked catalog
        pack_count=6, units_per_pack=6, price_per_pack=10.99, currency="MYR",
    )
    assert multi["created_count"] == 6
    parent_id = multi["parent_id"]
    for ev in multi["events"]:
        assert ev["multi_pack_parent_id"] == parent_id
        assert ev["pack_size"] == 6
        assert ev["currency"] == "MYR"
        assert ev["display_currency"] == "SGD"  # default user pref
        assert ev["display_amount"] == pytest.approx(10.99 * 0.30)
        assert ev["fx_rate_at_save"] == 0.30
        assert ev["unit_price"] == pytest.approx(10.99 * 0.30 / 6, abs=0.001)

    # ─── Phase C: quota — fill to cap, expect 409 with candidates ───────
    # Bump the user's quota_used to one below the cap so the next user_custom
    # create hits the limit.
    db.collection("users").document(fresh_uid).set(
        {"catalog_quota_used": 49}, merge=True,
    )
    # Should still succeed — 50 is the cap, 49+1=50.
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Custom A", quantity=1,
    )
    # Now at cap. Next user_custom create should raise.
    from app.core.exceptions import QuotaExceededError
    with pytest.raises(QuotaExceededError) as exc:
        purchase_event_service.create_purchase(
            user_id=fresh_uid, name="Custom B", quantity=1,
        )
    assert exc.value.details["used"] == 50
    assert exc.value.details["limit"] == 50
    assert len(exc.value.details["eviction_candidates"]) >= 1

    # Reconcile + free a slot via cascade so we can continue the journey
    quota_service.reconcile_count(fresh_uid)
    db.collection("catalog_entries").document(f"{fresh_uid}__custom_a").update({
        "idle_expires_at": datetime.now(timezone.utc) - timedelta(days=1),
    })
    cascade_result = idle_clock_service.cascade_one(fresh_uid, "custom_a")
    assert cascade_result["mode"] == "b"  # no barcode → mode b
    # Re-set quota counter to live count for clean state
    quota_service.reconcile_count(fresh_uid)

    # ─── Phase D: store catalog ────────────────────────────────────────
    tesco = store_catalog_service.create_store(fresh_uid, "Tesco")
    assert tesco["store_id"] == "tesco"
    # Buy at Tesco — store touch + use_count++
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=12, price=5.50, currency="SGD",
        store_id="tesco",
    )
    refreshed = store_catalog_service.get_store(fresh_uid, "tesco")
    assert refreshed["use_count"] == 1

    # ─── Phase E: overview payload assembly ────────────────────────────
    overview = catalog_overview_service.compute_overview(fresh_uid, "eggs")
    # Many events under "eggs" now (1 original + 6 multi-pack + 1 tesco buy = 8)
    assert overview["counters"]["total_event_count"] >= 8
    assert overview["counters"]["logical_purchase_count"] == overview["counters"]["total_event_count"]
    assert overview["lifetime_breakdown"]["total_qty"] > 0
    # Price history: at least Tesco shown
    store_ids = {p["store_id"] for p in overview["price_history_per_store"]}
    assert "tesco" in store_ids
    # Movement timeline ordered oldest first
    timeline = overview["movement_timeline"]
    if len(timeline) > 1:
        first_two = [t["date"] for t in timeline[:2] if t["date"]]
        assert first_two == sorted(first_two)

    # ─── Phase G: similarity → transfer → reverse ──────────────────────
    # Create a near-duplicate so similarity has a target
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggz", quantity=1,
    )
    # Typo lookup — "Egs" should match "Eggs" and/or "Eggz" via fuzzy match
    matches = catalog_similarity_service.find_similar(fresh_uid, "Egs")
    assert any(m["name_norm"] in ("eggs", "eggz") for m in matches), (
        f"Expected 'Egs' to fuzzy-match Eggs/Eggz, got {[m['name_norm'] for m in matches]}"
    )

    # Transfer Eggz → eggs (consolidation)
    preview = catalog_transfer_service.preview_transfer(fresh_uid, "eggz", "eggs")
    assert preview["event_count"] == 1
    result = catalog_transfer_service.execute_transfer(fresh_uid, "eggz", "eggs")
    assert result["transferred_event_count"] == 1
    # Source gone
    assert catalog_service.get_catalog_entry(fresh_uid, "eggz") is None
    # Destination grew by 1 event
    eggs_after = catalog_service.get_catalog_entry(fresh_uid, "eggs")
    assert eggs_after["total_purchases"] >= 9

    # Reverse within window
    rev = catalog_transfer_service.reverse_transfer(fresh_uid, result["transfer_id"])
    assert rev["reversed_event_count"] == 1
    assert catalog_service.get_catalog_entry(fresh_uid, "eggz") is not None

    # ─── Final: full integration didn't drift any counters ─────────────
    final_diag = admin_diagnostic_service.compute_catalog_counter_diagnostics(fresh_uid)
    assert final_diag["divergent_count"] == 0, (
        f"After full e2e flow, counters drifted: top divergent {final_diag['top_divergent']}"
    )


_V2_EVENT_FIELDS = (
    "amount", "display_amount", "display_currency", "fx_rate_at_save", "fx_rate_date",
    "pack_size", "base_unit_label", "store_id", "multi_pack_parent_id",
    "contributes_to_logical_count", "unit_price",
)
_V2_CATALOG_FIELDS = ("catalog_mode", "canonical_name", "idle_expires_at", "_migration_v2_applied_at")


def _downgrade_to_v1(user_id: str):
    """Strip v2 fields so the migration has work to do."""
    from google.cloud.firestore_v1.base_query import FieldFilter
    db = firestore.client()
    for snap in (
        db.collection("catalog_entries")
        .where(filter=FieldFilter("user_id", "==", user_id))
        .stream()
    ):
        downgrade = {"schema_version": 1}
        for f in _V2_CATALOG_FIELDS:
            downgrade[f] = firestore.DELETE_FIELD
        snap.reference.update(downgrade)
    for snap in (
        db.collection("users").document(user_id).collection("purchases").stream()
    ):
        downgrade = {"schema_version": 1}
        for f in _V2_EVENT_FIELDS:
            downgrade[f] = firestore.DELETE_FIELD
        snap.reference.update(downgrade)
    db.collection("users").document(user_id).update({
        "schema_version": firestore.DELETE_FIELD,
        "is_paid": firestore.DELETE_FIELD,
        "currency_preference": firestore.DELETE_FIELD,
        "catalog_quota_used": firestore.DELETE_FIELD,
        "catalog_quota_limit": firestore.DELETE_FIELD,
        "store_quota_used": firestore.DELETE_FIELD,
        "store_quota_limit": firestore.DELETE_FIELD,
    })
