"""Opaque cursor encode/decode for paginated list endpoints.

Wire format: URL-safe base64 of a compact JSON array. Keep tuples ordered the
same way the caller passes the Firestore `order_by` clauses, with the doc ID
always last so pagination is stable across duplicate ordered-field values.

Example:
    encode_cursor(["2026-04-23T10:00:00Z", "abc123"])
    → "WyIyMDI2LTA0LTIzVDEwOjAwOjAwWiIsICJhYmMxMjMiXQ=="

    decode_cursor("WyIyMD…") -> ["2026-04-23T10:00:00Z", "abc123"]
"""

from __future__ import annotations

import base64
import json
from typing import Any

from app.core.exceptions import ValidationError


def encode_cursor(values: list[Any]) -> str:
    raw = json.dumps(values, default=_json_default, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def decode_cursor(cursor: str) -> list[Any]:
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        raw = base64.urlsafe_b64decode(padded.encode())
        data = json.loads(raw)
        if not isinstance(data, list):
            raise ValueError("cursor must decode to list")
        return data
    except Exception as exc:
        raise ValidationError(f"Invalid cursor: {exc}") from exc


def _json_default(value: Any) -> Any:
    # datetime and Firestore timestamps -> ISO string
    if hasattr(value, "isoformat"):
        return value.isoformat()
    raise TypeError(f"Unserializable cursor value: {value!r}")
