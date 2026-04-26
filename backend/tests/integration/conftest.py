"""Integration-test fixtures — run against a live Firestore emulator.

Tests in this directory talk to a real Firestore (the local emulator) rather
than mocking. They auto-skip if the emulator isn't reachable, so the regular
`pytest backend/tests` invocation stays green even on machines without it.

Start the emulator from the Luqman Dev Hub > Firestore Emulator page, OR:
    firebase emulators:start --only firestore --project demo-grocery

Then:
    FIRESTORE_EMULATOR_HOST=localhost:8080 pytest backend/tests/integration
"""

from __future__ import annotations

import os
import socket
import uuid

import pytest


def _emulator_host() -> str:
    return os.environ.get("FIRESTORE_EMULATOR_HOST", "localhost:8080")


def _emulator_reachable(host: str) -> bool:
    if ":" not in host:
        return False
    h, p = host.split(":", 1)
    try:
        with socket.create_connection((h, int(p)), timeout=0.5):
            return True
    except (OSError, ValueError):
        return False


@pytest.fixture(scope="session", autouse=True)
def _firestore_emulator():
    host = _emulator_host()
    if not _emulator_reachable(host):
        pytest.skip(f"Firestore emulator not reachable at {host}", allow_module_level=True)

    os.environ["FIRESTORE_EMULATOR_HOST"] = host
    os.environ.setdefault("GOOGLE_CLOUD_PROJECT", "demo-grocery")

    import firebase_admin
    from firebase_admin import credentials

    if not firebase_admin._apps:
        firebase_admin.initialize_app(
            credentials.AnonymousCredentials() if hasattr(credentials, "AnonymousCredentials")
            else credentials.ApplicationDefault(),
            {"projectId": os.environ["GOOGLE_CLOUD_PROJECT"]},
        )
    yield


@pytest.fixture
def fresh_uid() -> str:
    """A throwaway uid scoped to a single test — keeps writes isolated."""
    return f"test-{uuid.uuid4().hex[:12]}"


@pytest.fixture(autouse=True)
def _clean_test_data(fresh_uid):
    """After each test, delete the user's purchases + their catalog entries."""
    yield
    from firebase_admin import firestore
    from google.cloud.firestore_v1.base_query import FieldFilter

    db = firestore.client()
    # Delete user's purchases
    purchases_ref = db.collection("users").document(fresh_uid).collection("purchases")
    for doc in purchases_ref.stream():
        doc.reference.delete()
    # Delete user's catalog entries
    for doc in (
        db.collection("catalog_entries")
        .where(filter=FieldFilter("user_id", "==", fresh_uid))
        .stream()
    ):
        doc.reference.delete()
