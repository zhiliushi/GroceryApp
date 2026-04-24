"""Metadata helpers — every Firestore write goes through these.

Ensures every document has consistent metadata fields:
- created_at: SERVER_TIMESTAMP on create
- updated_at: SERVER_TIMESTAMP on every write
- schema_version: int (for future migrations)
- created_by: uid or "system" | "migration" | "scheduler"
- source: "api" | "migration" | "scheduler" | "admin" | "telegram"

Usage:
    from app.core.metadata import apply_create_metadata, apply_update_metadata

    doc_data = {"name": "Milk"}
    doc_data = apply_create_metadata(doc_data, uid=user.uid, source="api")
    doc_ref.set(doc_data)

    # Later...
    doc_ref.update(apply_update_metadata({"status": "used"}))
"""

from __future__ import annotations

from typing import Any

from firebase_admin import firestore

SERVER_TIMESTAMP = firestore.SERVER_TIMESTAMP

CURRENT_SCHEMA_VERSION = 1

# Valid source values
VALID_SOURCES = frozenset({
    "api",
    "migration",
    "scheduler",
    "admin",
    "telegram",
    "barcode_scan",
    "receipt",
    "manual",
})


def apply_create_metadata(
    doc_data: dict[str, Any],
    uid: str | None = None,
    source: str = "api",
    schema_version: int = CURRENT_SCHEMA_VERSION,
) -> dict[str, Any]:
    """Stamp a document with create-time metadata.

    Args:
        doc_data: The document data to augment.
        uid: Firebase UID of the actor. Use None for system writes.
        source: One of VALID_SOURCES. Defaults to "api".
        schema_version: Schema version for future migrations.

    Returns:
        New dict with metadata fields merged in.
    """
    if source not in VALID_SOURCES:
        raise ValueError(f"Invalid source: {source!r}. Must be one of {sorted(VALID_SOURCES)}")

    return {
        **doc_data,
        "created_at": SERVER_TIMESTAMP,
        "updated_at": SERVER_TIMESTAMP,
        "schema_version": schema_version,
        "created_by": uid or "system",
        "source": source,
    }


def apply_update_metadata(doc_data: dict[str, Any]) -> dict[str, Any]:
    """Stamp updated_at on an update payload.

    Args:
        doc_data: Partial update data.

    Returns:
        New dict with updated_at set to SERVER_TIMESTAMP.
    """
    return {**doc_data, "updated_at": SERVER_TIMESTAMP}
