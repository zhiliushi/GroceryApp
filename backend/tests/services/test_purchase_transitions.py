"""Unit tests for `validate_status_transition` — the pure portion of update_status.

Covers the plan's invariant: active → {used, thrown, transferred} are the only
valid transitions; terminal states cannot move further. Defaults + reason
validation + transferred_to requirement also checked.
"""

from __future__ import annotations

import pytest

from app.core.exceptions import ValidationError
from app.services.purchase_event_service import validate_status_transition


# ---------------------------------------------------------------------------
# Valid transitions
# ---------------------------------------------------------------------------

def test_active_to_used():
    # `used` accepts any reason (or none)
    assert validate_status_transition("active", "used") is None


def test_active_to_used_with_reason():
    assert validate_status_transition("active", "used", reason="used_up") == "used_up"


def test_active_to_thrown_defaults_to_expired():
    # No reason passed → defaults to "expired"
    assert validate_status_transition("active", "thrown") == "expired"


def test_active_to_thrown_with_explicit_reason():
    assert validate_status_transition("active", "thrown", reason="bad") == "bad"
    assert validate_status_transition("active", "thrown", reason="gift") == "gift"
    assert validate_status_transition("active", "thrown", reason="used_up") == "used_up"


def test_active_to_transferred_with_recipient():
    # transferred_to required — OK when provided
    assert validate_status_transition(
        "active", "transferred", transferred_to="foodbank_xyz"
    ) is None


# ---------------------------------------------------------------------------
# Invalid target statuses
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "bad_target",
    ["active", "unknown", "consumed", "expired", "discarded", ""],
)
def test_invalid_target_status_raises(bad_target):
    with pytest.raises(ValidationError, match="Invalid status transition target"):
        validate_status_transition("active", bad_target)


# ---------------------------------------------------------------------------
# Terminal state cannot transition
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("terminal", ["used", "thrown", "transferred"])
def test_terminal_state_cannot_transition(terminal):
    with pytest.raises(ValidationError, match="terminal state"):
        validate_status_transition(terminal, "used")


def test_terminal_state_error_includes_current_status_in_details():
    with pytest.raises(ValidationError) as exc_info:
        validate_status_transition("used", "thrown")
    assert exc_info.value.details == {"current_status": "used"}


# ---------------------------------------------------------------------------
# Reason validation for `thrown`
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("bad_reason", ["crazy", "dunno", "destroyed", "junk"])
def test_thrown_with_invalid_reason_raises(bad_reason):
    with pytest.raises(ValidationError, match="Invalid thrown reason"):
        validate_status_transition("active", "thrown", reason=bad_reason)


# ---------------------------------------------------------------------------
# transferred_to required
# ---------------------------------------------------------------------------

def test_transferred_without_recipient_raises():
    with pytest.raises(ValidationError, match="transferred_to required"):
        validate_status_transition("active", "transferred")


def test_transferred_empty_string_recipient_raises():
    with pytest.raises(ValidationError, match="transferred_to required"):
        validate_status_transition("active", "transferred", transferred_to="")


def test_transferred_none_recipient_raises():
    with pytest.raises(ValidationError, match="transferred_to required"):
        validate_status_transition("active", "transferred", transferred_to=None)
