"""Common base schemas for all Firestore-backed documents."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class BaseDoc(BaseModel):
    """Base for every Firestore-backed Pydantic model.

    Defines the standard metadata fields every doc should have. Fields are
    optional on read (Firestore may omit them for old docs) but services
    always stamp them on write via app.core.metadata helpers.
    """

    model_config = ConfigDict(populate_by_name=True, extra="allow")

    schema_version: int = 1
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None  # uid or "system" | "migration" | "scheduler" | "admin"
    source: str = "api"               # "api" | "migration" | "scheduler" | "admin" | "telegram" | "barcode_scan" | "receipt" | "manual"
