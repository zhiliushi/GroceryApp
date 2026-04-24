"""Countries API — list supported countries + GS1 prefix lookup.

GET /api/countries                   — Seeded country list (MY, SG, ID, TH, US, GB, CN, JP, KR, AU)
GET /api/countries/lookup/{barcode}  — Detect country from barcode prefix (3-digit GS1)
"""

from __future__ import annotations

import logging

from fastapi import APIRouter

from app.services import country_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("")
async def list_countries():
    """Return the seeded country list with GS1 prefix ranges."""
    return {"countries": country_service.list_countries()}


@router.get("/lookup/{barcode}")
async def lookup_by_barcode(barcode: str):
    """Detect ISO country code from a barcode's GS1 prefix (first 3 digits).

    Returns {"barcode": ..., "country_code": "MY" | null}.
    """
    code = country_service.detect_country_by_barcode(barcode)
    return {"barcode": barcode, "country_code": code}
