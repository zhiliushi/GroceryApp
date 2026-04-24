"""Pydantic schemas for feature flags."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class NudgeThresholds(BaseModel):
    """Per-nudge item count triggers."""

    expiry: int = 5
    price: int = 10
    volume: int = 20


class FeatureFlags(BaseModel):
    """Full feature flag document shape. Mirrors app_config/features in Firestore."""

    # OCR master switch + children
    ocr_enabled: bool = False
    receipt_scan: bool = False
    smart_camera: bool = False
    recipe_ocr: bool = False
    shelf_audit: bool = False

    # Product features
    progressive_nudges: bool = True
    financial_tracking: bool = True
    insights: bool = True
    nl_expiry_parser: bool = True

    # Background jobs
    barcode_country_autodetect: bool = True
    catalog_cleanup: bool = True
    reminder_scan: bool = True
    milestone_analytics: bool = True

    # Thresholds
    nudge_thresholds: NudgeThresholds = Field(default_factory=NudgeThresholds)


class FeatureFlagUpdate(BaseModel):
    """Partial update — any subset of flags."""

    ocr_enabled: Optional[bool] = None
    receipt_scan: Optional[bool] = None
    smart_camera: Optional[bool] = None
    recipe_ocr: Optional[bool] = None
    shelf_audit: Optional[bool] = None
    progressive_nudges: Optional[bool] = None
    financial_tracking: Optional[bool] = None
    insights: Optional[bool] = None
    nl_expiry_parser: Optional[bool] = None
    barcode_country_autodetect: Optional[bool] = None
    catalog_cleanup: Optional[bool] = None
    reminder_scan: Optional[bool] = None
    milestone_analytics: Optional[bool] = None
    nudge_thresholds: Optional[NudgeThresholds] = None
