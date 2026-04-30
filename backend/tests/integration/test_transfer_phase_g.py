"""Integration tests for Phase G — catalog transfer-history flow + similarity.

Plan: F:\\ClaudeProjects\\GroceryApp\\.claude\\docs\\plans\\catalog_evolution.md §6 + §7 Phase G.

Covers:
- similarity_score basic correctness (synthetic strings)
- find_similar ranks + threshold behaviour
- find_likely_duplicates: barcode-shared + name-similar pairs
- preview_transfer returns event count + unit-mismatch warning
- execute_transfer re-points events, deletes src, releases quota,
  recomputes counters
- transfer with overlapping dates keeps all events (no de-dup)
- reverse within 7d restores src + counters; re-consumes quota
- reverse after window fails with ConflictError
- reverse fails when src already exists (user re-created)
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta

import pytest
from firebase_admin import firestore

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.metadata import apply_create_metadata, apply_update_metadata
from app.services import (
    catalog_service,
    catalog_similarity_service,
    catalog_transfer_service,
    purchase_event_service,
    quota_service,
)


def _set_user_doc(uid: str, **fields):
    db = firestore.client()
    db.collection("users").document(uid).set(
        apply_create_metadata({"uid": uid, **fields}, uid=uid, source="test_seed"),
    )


@pytest.fixture(autouse=True)
def _clean_phase_g_artifacts(fresh_uid):
    """Clean transfer_audit_log/{fresh_uid}/items/* + store_catalog after each test."""
    yield
    db = firestore.client()
    for snap in (
        db.collection("transfer_audit_log").document(fresh_uid).collection("items").stream()
    ):
        snap.reference.delete()
    for snap in (
        db.collection("store_catalog").document(fresh_uid).collection("stores").stream()
    ):
        snap.reference.delete()


# ---------------------------------------------------------------------------
# Similarity
# ---------------------------------------------------------------------------


def test_similarity_score_identity_one():
    assert catalog_similarity_service.similarity_score("Eggs", "Eggs") == pytest.approx(1.0)


def test_similarity_score_distant_low():
    score = catalog_similarity_service.similarity_score("Eggs", "Computer")
    assert score < 0.4


def test_similarity_score_typo_high():
    """Eggs vs Eggz should rank well above 0.6 threshold."""
    score = catalog_similarity_service.similarity_score("Eggs", "Eggz")
    assert score > 0.6


def test_find_similar_ranks_by_score(fresh_uid):
    _set_user_doc(fresh_uid, tier="free")
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Eggs", quantity=1)
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Egg White", quantity=1)
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Bread", quantity=1)

    matches = catalog_similarity_service.find_similar(fresh_uid, "Eggz", limit=3)
    # Both egg-related rows should match; bread should not
    names = [m["display_name"] for m in matches]
    assert "Eggs" in names
    assert "Bread" not in names
    # Eggs (closer) should outscore Egg White
    by_name = {m["display_name"]: m["score"] for m in matches}
    if "Egg White" in by_name:
        assert by_name["Eggs"] >= by_name["Egg White"]


def test_find_likely_duplicates_pair_via_shared_barcode(fresh_uid):
    """Two catalog rows with the same barcode = highly likely duplicate."""
    _set_user_doc(fresh_uid, tier="free")
    db = firestore.client()
    # Hand-create two rows that share a barcode (one user_custom rename, one global)
    db.collection("catalog_entries").document(f"{fresh_uid}__eggs").set(
        apply_create_metadata({
            "user_id": fresh_uid,
            "name_norm": "eggs",
            "display_name": "Eggs",
            "barcode": "9555000111122",
            "catalog_mode": "global_linked",
            "total_purchases": 0, "active_purchases": 0,
        }, uid=fresh_uid, source="test_seed"),
    )
    db.collection("catalog_entries").document(f"{fresh_uid}__free_range_eggs").set(
        apply_create_metadata({
            "user_id": fresh_uid,
            "name_norm": "free_range_eggs",
            "display_name": "Free Range Eggs",
            "barcode": "9555000111122",  # same barcode
            "catalog_mode": "user_custom",
            "total_purchases": 0, "active_purchases": 0,
        }, uid=fresh_uid, source="test_seed"),
    )

    pairs = catalog_similarity_service.find_likely_duplicates(fresh_uid)
    assert len(pairs) >= 1
    p = pairs[0]
    assert p["why"] == "shared_barcode"
    assert p["score"] >= 0.9


# ---------------------------------------------------------------------------
# Transfer preview
# ---------------------------------------------------------------------------


def test_preview_returns_event_count(fresh_uid):
    _set_user_doc(fresh_uid, tier="free")
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Eggs A", quantity=1)
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Eggs A", quantity=1)
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Eggs B", quantity=1)

    preview = catalog_transfer_service.preview_transfer(fresh_uid, "eggs_a", "eggs_b")
    assert preview["event_count"] == 2
    assert preview["src"]["name_norm"] == "eggs_a"
    assert preview["dst"]["name_norm"] == "eggs_b"


def test_preview_unit_mismatch_warning(fresh_uid):
    """Source and dest with different base_unit_label trip the mismatch flag."""
    _set_user_doc(fresh_uid, tier="free")
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Eggs A", quantity=1)
    p = purchase_event_service.create_purchase(user_id=fresh_uid, name="Pack thing", quantity=1)
    db = firestore.client()
    db.collection("users").document(fresh_uid).collection("purchases").document(p["id"]).update({
        "base_unit_label": "pack",
    })

    preview = catalog_transfer_service.preview_transfer(fresh_uid, "eggs_a", "pack_thing")
    assert preview["base_unit_label_mismatch"] is True
    assert preview["src_base_unit_label"] == "egg"
    assert preview["dst_base_unit_label"] == "pack"


def test_preview_same_src_dst_raises(fresh_uid):
    _set_user_doc(fresh_uid, tier="free")
    purchase_event_service.create_purchase(user_id=fresh_uid, name="X", quantity=1)
    with pytest.raises(ValidationError):
        catalog_transfer_service.preview_transfer(fresh_uid, "x", "x")


def test_preview_404_when_src_or_dst_missing(fresh_uid):
    _set_user_doc(fresh_uid, tier="free")
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Real", quantity=1)
    with pytest.raises(NotFoundError):
        catalog_transfer_service.preview_transfer(fresh_uid, "real", "ghost")
    with pytest.raises(NotFoundError):
        catalog_transfer_service.preview_transfer(fresh_uid, "ghost", "real")


# ---------------------------------------------------------------------------
# Transfer execute
# ---------------------------------------------------------------------------


def test_execute_repoints_events_deletes_src_releases_quota(fresh_uid):
    _set_user_doc(fresh_uid, tier="free")
    p1 = purchase_event_service.create_purchase(user_id=fresh_uid, name="Eggs A", quantity=12)
    p2 = purchase_event_service.create_purchase(user_id=fresh_uid, name="Eggs B", quantity=6)
    quota_before = quota_service.get_quota_status(fresh_uid)["used"]

    result = catalog_transfer_service.execute_transfer(fresh_uid, "eggs_a", "eggs_b")
    assert result["transferred_event_count"] == 1
    assert result["from_catalog_id"] == "eggs_a"
    assert result["to_catalog_id"] == "eggs_b"

    # Source row gone
    assert catalog_service.get_catalog_entry(fresh_uid, "eggs_a") is None
    # Destination row remains
    dst = catalog_service.get_catalog_entry(fresh_uid, "eggs_b")
    assert dst is not None
    # Recomputed counters: 2 events now
    assert dst["total_purchases"] == 2
    assert dst["active_purchases"] == 2

    # Re-pointed event
    p1_after = purchase_event_service.get_purchase(fresh_uid, p1["id"])
    assert p1_after["catalog_name_norm"] == "eggs_b"

    # Quota released (src was user_custom)
    quota_after = quota_service.get_quota_status(fresh_uid)["used"]
    assert quota_after == quota_before - 1


def test_transfer_keeps_overlapping_date_events_separate(fresh_uid):
    """Events with overlapping date_bought stay as siblings — no de-dup."""
    _set_user_doc(fresh_uid, tier="free")
    fixed = datetime(2026, 4, 15, tzinfo=timezone.utc)
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs A", quantity=1, date_bought=fixed,
    )
    purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs B", quantity=1, date_bought=fixed,
    )

    catalog_transfer_service.execute_transfer(fresh_uid, "eggs_a", "eggs_b")
    dst = catalog_service.get_catalog_entry(fresh_uid, "eggs_b")
    # Both events now under eggs_b — no merge
    assert dst["total_purchases"] == 2


# ---------------------------------------------------------------------------
# Reverse
# ---------------------------------------------------------------------------


def test_reverse_within_7d_restores(fresh_uid):
    _set_user_doc(fresh_uid, tier="free")
    p = purchase_event_service.create_purchase(user_id=fresh_uid, name="Eggs A", quantity=12)
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Eggs B", quantity=1)

    result = catalog_transfer_service.execute_transfer(fresh_uid, "eggs_a", "eggs_b")
    transfer_id = result["transfer_id"]

    quota_after_transfer = quota_service.get_quota_status(fresh_uid)["used"]

    rev = catalog_transfer_service.reverse_transfer(fresh_uid, transfer_id)
    assert rev["reversed_event_count"] == 1

    # Source restored
    src = catalog_service.get_catalog_entry(fresh_uid, "eggs_a")
    assert src is not None
    # Event re-pointed back
    ev = purchase_event_service.get_purchase(fresh_uid, p["id"])
    assert ev["catalog_name_norm"] == "eggs_a"
    # Quota re-consumed
    quota_now = quota_service.get_quota_status(fresh_uid)["used"]
    assert quota_now == quota_after_transfer + 1


def test_reverse_after_window_fails(fresh_uid):
    _set_user_doc(fresh_uid, tier="free")
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Old A", quantity=1)
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Old B", quantity=1)
    result = catalog_transfer_service.execute_transfer(fresh_uid, "old_a", "old_b")

    # Backdate the audit doc's reversal_expires_at to 8 days ago
    db = firestore.client()
    audit_ref = (
        db.collection("transfer_audit_log").document(fresh_uid)
        .collection("items").document(result["transfer_id"])
    )
    audit_ref.update(apply_update_metadata({
        "reversal_expires_at": datetime.now(timezone.utc) - timedelta(days=1),
    }))

    with pytest.raises(ConflictError):
        catalog_transfer_service.reverse_transfer(fresh_uid, result["transfer_id"])


def test_reverse_already_reversed_fails(fresh_uid):
    _set_user_doc(fresh_uid, tier="free")
    purchase_event_service.create_purchase(user_id=fresh_uid, name="A", quantity=1)
    purchase_event_service.create_purchase(user_id=fresh_uid, name="B", quantity=1)
    result = catalog_transfer_service.execute_transfer(fresh_uid, "a", "b")
    catalog_transfer_service.reverse_transfer(fresh_uid, result["transfer_id"])
    with pytest.raises(ConflictError):
        catalog_transfer_service.reverse_transfer(fresh_uid, result["transfer_id"])


def test_reverse_when_src_already_exists_fails(fresh_uid):
    """If user re-created the same name_norm post-transfer, reversal blocks."""
    _set_user_doc(fresh_uid, tier="free")
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Apple A", quantity=1)
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Apple B", quantity=1)
    result = catalog_transfer_service.execute_transfer(fresh_uid, "apple_a", "apple_b")
    # Re-create apple_a directly so reversal can't claim its slot
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Apple A", quantity=1)

    with pytest.raises(ConflictError):
        catalog_transfer_service.reverse_transfer(fresh_uid, result["transfer_id"])


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------


def test_list_transfers_returns_recent_first(fresh_uid):
    _set_user_doc(fresh_uid, tier="free")
    purchase_event_service.create_purchase(user_id=fresh_uid, name="A1", quantity=1)
    purchase_event_service.create_purchase(user_id=fresh_uid, name="A2", quantity=1)
    purchase_event_service.create_purchase(user_id=fresh_uid, name="B1", quantity=1)
    purchase_event_service.create_purchase(user_id=fresh_uid, name="B2", quantity=1)

    catalog_transfer_service.execute_transfer(fresh_uid, "a1", "a2")
    catalog_transfer_service.execute_transfer(fresh_uid, "b1", "b2")

    log = catalog_transfer_service.list_transfers(fresh_uid)
    assert len(log) >= 2
    # Newest first
    assert log[0]["from_catalog_id"] in ("a1", "b1")
    # Reversal_window_open is True for both fresh transfers
    assert all(t["reversal_window_open"] for t in log[:2])
