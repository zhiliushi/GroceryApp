"""Pydantic schemas for country definitions + GS1 barcode prefix lookup."""

from __future__ import annotations

from pydantic import BaseModel, Field

from .common import BaseDoc


class GS1PrefixRange(BaseModel):
    """A single prefix range. E.g. {start: "955", end: "955"} for Malaysia."""

    start: str
    end: str


class Country(BaseDoc):
    """ISO-3166-1 alpha-2 country with GS1 prefix ranges."""

    code: str                                  # ISO alpha-2 ("MY", "SG", "US")
    name: str                                  # "Malaysia"
    currency: str                              # "MYR"
    currency_symbol: str                       # "RM"
    gs1_prefix_ranges: list[GS1PrefixRange] = Field(default_factory=list)
    flag_emoji: str                            # "🇲🇾"
    locale: str                                # "ms-MY"
    enabled: bool = True
