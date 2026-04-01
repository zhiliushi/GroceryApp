"""
Mindee Receipt API provider (v2 SDK — ClientV2).

Pipeline:
  1. Call Mindee API with Receipt model via ClientV2
  2. Map native structured fields (line_items, totals, dates, store) → ReceiptData

Uses model_id for the pre-built Receipt model.
250 pages/month free tier.
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Optional

from .base import (
    OcrProvider,
    OcrProviderError,
    ReceiptData,
    ReceiptItem,
    ReceiptStore,
)

logger = logging.getLogger(__name__)

# Pre-built Receipt model ID from Mindee
RECEIPT_MODEL_ID = "7c502527-d3c3-46de-90d2-0083753a4d8f"


class MindeeProvider(OcrProvider):
    key = "mindee"
    name = "Mindee Receipt API"

    def __init__(self, api_key: str = "", model_id: str = RECEIPT_MODEL_ID):
        self._api_key = api_key
        self._model_id = model_id

    async def extract(self, image_bytes: bytes) -> ReceiptData:
        if not self._api_key:
            raise OcrProviderError("key_missing", "Mindee API key not configured")

        try:
            from mindee import (
                ClientV2,
                BytesInput,
                InferenceParameters,
                InferenceResponse,
            )
        except ImportError:
            raise OcrProviderError(
                "dependency_missing",
                "mindee package not installed (requires >= 4.33.0)",
            )

        try:
            client = ClientV2(self._api_key)
            input_source = BytesInput(image_bytes, "receipt.jpg")
            params = InferenceParameters(model_id=self._model_id)
            result = client.enqueue_and_get_result(
                InferenceResponse, input_source, params,
            )
        except Exception as exc:
            error_msg = str(exc).lower()
            if "401" in error_msg or "unauthorized" in error_msg or "auth" in error_msg:
                raise OcrProviderError("auth_error", f"Mindee API key invalid: {exc}")
            if "429" in error_msg or "rate" in error_msg:
                raise OcrProviderError("rate_limited", f"Mindee rate limited: {exc}")
            if "quota" in error_msg:
                raise OcrProviderError("quota_exceeded", f"Mindee quota exceeded: {exc}")
            raise OcrProviderError("api_error", f"Mindee API call failed: {exc}")

        fields = result.inference.result.fields

        # --- Map Mindee v2 fields to our model ---
        items = _map_line_items(fields)
        store = _map_store(fields)
        total = _safe_field_float(fields, "total_amount")
        tax = _safe_field_float(fields, "total_tax")
        receipt_date = _map_date(fields)
        currency = _map_currency(fields)
        raw_text = str(result.inference)

        confidence = 0.9 if items else 0.4

        return ReceiptData(
            items=items,
            store=store,
            subtotal=_safe_field_float(fields, "total_net"),
            tax=tax,
            total=total,
            date=receipt_date,
            currency=currency or "MYR",
            raw_text=raw_text,
            confidence=confidence,
        )


# ---------------------------------------------------------------------------
# Field mappers for Mindee v2 response
# ---------------------------------------------------------------------------


def _map_line_items(fields: dict) -> list[ReceiptItem]:
    """Map Mindee line_items (list of objects) to ReceiptItem list."""
    items: list[ReceiptItem] = []

    line_items_field = fields.get("line_items")
    if not line_items_field or not hasattr(line_items_field, "items"):
        return items

    for obj_item in line_items_field.items:
        sub = obj_item.fields if hasattr(obj_item, "fields") else {}

        description = _safe_sub_value(sub, "description")
        if not description or len(description.strip()) < 2:
            continue

        total_amount = _safe_sub_float(sub, "total_amount")
        unit_price = _safe_sub_float(sub, "unit_price")
        quantity = _safe_sub_float(sub, "quantity")

        # Calculate price
        price = total_amount or 0.0
        if not price and unit_price and quantity:
            price = unit_price * quantity

        qty = int(quantity) if quantity and quantity >= 1 else 1

        items.append(ReceiptItem(
            name=description.strip(),
            price=round(price, 2),
            quantity=qty,
            barcode=None,
            confidence=0.9,
        ))

    return items


def _map_store(fields: dict) -> ReceiptStore:
    """Map supplier fields to ReceiptStore."""
    name = _safe_field_str(fields, "supplier_name")
    address = _safe_field_str(fields, "supplier_address")
    return ReceiptStore(name=name, address=address)


def _map_date(fields: dict) -> Optional[date]:
    """Map date field to Python date."""
    val = _safe_field_str(fields, "date")
    if not val:
        return None
    try:
        parts = val.split("-")
        if len(parts) == 3:
            return date(int(parts[0]), int(parts[1]), int(parts[2]))
    except (ValueError, IndexError):
        pass
    return None


def _map_currency(fields: dict) -> Optional[str]:
    """Extract currency from locale field."""
    locale_field = fields.get("locale")
    if not locale_field:
        return None
    # locale field may have sub-fields or direct value
    if hasattr(locale_field, "fields"):
        currency_sub = locale_field.fields.get("currency")
        if currency_sub:
            return str(currency_sub.value) if currency_sub.value else None
    if hasattr(locale_field, "value") and locale_field.value:
        val = str(locale_field.value)
        # locale value might be "en-MY" or just "MYR"
        if len(val) == 3 and val.isupper():
            return val
    return None


# ---------------------------------------------------------------------------
# Safe field accessors
# ---------------------------------------------------------------------------


def _safe_field_str(fields: dict, key: str) -> Optional[str]:
    """Get a string value from a top-level field."""
    field = fields.get(key)
    if not field:
        return None
    if hasattr(field, "value") and field.value is not None:
        return str(field.value)
    return None


def _safe_field_float(fields: dict, key: str) -> Optional[float]:
    """Get a float value from a top-level field."""
    field = fields.get(key)
    if not field:
        return None
    if hasattr(field, "value") and field.value is not None:
        try:
            return float(field.value)
        except (ValueError, TypeError):
            return None
    return None


def _safe_sub_value(sub_fields: dict, key: str) -> Optional[str]:
    """Get string value from an object's sub-field."""
    field = sub_fields.get(key)
    if not field:
        return None
    if hasattr(field, "value") and field.value is not None:
        return str(field.value)
    return None


def _safe_sub_float(sub_fields: dict, key: str) -> Optional[float]:
    """Get float value from an object's sub-field."""
    field = sub_fields.get(key)
    if not field:
        return None
    if hasattr(field, "value") and field.value is not None:
        try:
            return float(field.value)
        except (ValueError, TypeError):
            return None
    return None
