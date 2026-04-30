"""Integration tests for the catalog counter diagnostic (Phase F).

Seeds a fresh uid with split-heavy and move-heavy data, then verifies that
`compute_catalog_counter_diagnostics` correctly distinguishes:

  * stored `total_purchases` (every event ticks it up — including splits/moves)
  * recomputed `total_event_count` (raw event count — should equal stored if no drift)
  * recomputed `logical_purchase_count` (events with no `split_from_event_id`)
  * inflation = stored - logical (the user-perceived "numbering not tally" symptom)

Tests run against the real Firestore emulator via the conftest fixtures.
"""

from __future__ import annotations

from app.services import (
    admin_diagnostic_service,
    purchase_event_service,
)


def test_baseline_no_splits_no_inflation_no_drift(fresh_uid):
    """A clean catalog with simple creates should have zero drift and zero inflation."""
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Milk", quantity=1)
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Eggs", quantity=12)
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Eggs", quantity=6)

    diag = admin_diagnostic_service.compute_catalog_counter_diagnostics(fresh_uid)

    assert diag["user_id"] == fresh_uid
    assert diag["total_catalog_rows"] == 2
    assert diag["total_events"] == 3
    assert diag["divergent_count"] == 0
    assert diag["inflated_count"] == 0
    assert diag["orphan_event_count"] == 0

    by_norm = {r["name_norm"]: r for r in diag["rows"]}
    eggs = by_norm["eggs"]
    milk = by_norm["milk"]

    assert eggs["stored_total_purchases"] == 2
    assert eggs["recomputed_total_event_count"] == 2
    assert eggs["recomputed_logical_purchase_count"] == 2
    assert eggs["delta_total"] == 0
    assert eggs["inflation"] == 0
    assert eggs["split_event_count"] == 0

    assert milk["stored_total_purchases"] == 1
    assert milk["recomputed_logical_purchase_count"] == 1
    assert milk["inflation"] == 0


def test_partial_split_inflates_counter_above_logical(fresh_uid):
    """Throwing 2 of 12 eggs creates a split event → inflation = 1, drift = 0."""
    p = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Eggs", quantity=12, price=6.0,
    )
    purchase_event_service.update_status(
        user_id=fresh_uid, event_id=p["id"], status="thrown",
        reason="expired", quantity=2,
    )

    diag = admin_diagnostic_service.compute_catalog_counter_diagnostics(fresh_uid)
    eggs = next(r for r in diag["rows"] if r["name_norm"] == "eggs")

    # Stored counter ticked up twice (1 create + 1 split-and-terminate).
    assert eggs["stored_total_purchases"] == 2
    # Recomputed event count matches stored — no drift.
    assert eggs["recomputed_total_event_count"] == 2
    assert eggs["delta_total"] == 0
    # But logical purchases = 1 (the create; the split has split_from_event_id).
    assert eggs["recomputed_logical_purchase_count"] == 1
    # Inflation = 1: this is the "numbering not tally" symptom.
    assert eggs["inflation"] == 1
    assert eggs["split_event_count"] == 1

    assert diag["divergent_count"] == 0
    assert diag["inflated_count"] == 1
    # Top-inflated should surface this row.
    assert diag["top_inflated"][0]["name_norm"] == "eggs"


def test_full_terminal_does_not_inflate(fresh_uid):
    """Full-quantity update_status terminates in place — no new event, no inflation."""
    p = purchase_event_service.create_purchase(
        user_id=fresh_uid, name="Lettuce", quantity=1,
    )
    purchase_event_service.update_status(
        user_id=fresh_uid, event_id=p["id"], status="used",
    )

    diag = admin_diagnostic_service.compute_catalog_counter_diagnostics(fresh_uid)
    lettuce = next(r for r in diag["rows"] if r["name_norm"] == "lettuce")

    assert lettuce["stored_total_purchases"] == 1
    assert lettuce["recomputed_total_event_count"] == 1
    assert lettuce["recomputed_logical_purchase_count"] == 1
    assert lettuce["inflation"] == 0
    assert lettuce["split_event_count"] == 0
    assert lettuce["recomputed_active"] == 0
    assert lettuce["stored_active_purchases"] == 0
    assert lettuce["delta_active"] == 0


def test_storage_drift_is_detected(fresh_uid):
    """Manually corrupt the stored counter; diagnostic flags delta_total != 0."""
    from firebase_admin import firestore
    from app.core.metadata import apply_update_metadata

    purchase_event_service.create_purchase(user_id=fresh_uid, name="Cheese", quantity=1)
    purchase_event_service.create_purchase(user_id=fresh_uid, name="Cheese", quantity=1)

    # Corrupt: bump stored counter without adding events.
    db = firestore.client()
    cheese_ref = db.collection("catalog_entries").document(f"{fresh_uid}__cheese")
    cheese_ref.update(apply_update_metadata({"total_purchases": 99}))

    diag = admin_diagnostic_service.compute_catalog_counter_diagnostics(fresh_uid)
    cheese = next(r for r in diag["rows"] if r["name_norm"] == "cheese")

    assert cheese["stored_total_purchases"] == 99
    assert cheese["recomputed_total_event_count"] == 2
    # delta = 97: real drift, this is the bug-class signal.
    assert cheese["delta_total"] == 97
    assert diag["divergent_count"] == 1
    # Drift does NOT count as inflation in this implementation —
    # inflation is the gap between stored and *logical*, computed independently.
    # (97 stored vs 2 logical = inflation 95; both symptoms surface.)
    assert cheese["inflation"] == 97
    assert diag["top_divergent"][0]["name_norm"] == "cheese"


def test_orphan_events_are_surfaced(fresh_uid):
    """An event with catalog_name_norm whose catalog row is missing → orphan."""
    p = purchase_event_service.create_purchase(user_id=fresh_uid, name="Bread", quantity=1)

    # Force-delete the catalog row out from under the event (bypasses guards
    # so we can construct the orphan scenario the diagnostic is meant to detect).
    _force_delete_catalog(fresh_uid, "bread")

    diag = admin_diagnostic_service.compute_catalog_counter_diagnostics(fresh_uid)

    # No catalog rows remain.
    assert diag["total_catalog_rows"] == 0
    # But the event still exists, so total_events = 1 + orphan_event_count = 1.
    assert diag["total_events"] == 1
    assert diag["orphan_event_count"] == 1
    assert any(o["event_id"] == p["id"] for o in diag["orphan_events"])
    assert any(o["catalog_name_norm"] == "bread" for o in diag["orphan_events"])


def _force_delete_catalog(user_id: str, name_norm: str) -> None:
    """Bypass guards — delete catalog row directly. Used only by orphan test."""
    from firebase_admin import firestore
    db = firestore.client()
    db.collection("catalog_entries").document(f"{user_id}__{name_norm}").delete()
