"""Unit-type classification for catalog entries.

A catalog item is one of four families:
  - count     : eggs, apples, yogurt cups — discrete things
  - volume    : milk, juice, oil — measured in ml
  - weight    : meat, rice, flour — measured in g
  - container : bread, bag of chips — opaque "I have one of these"

Why this matters: the right input shape for "use this" depends on the family.
A grocery user who wants "use 250 ml of milk" should NOT be presented with
"use 0.25 of a 1L carton" — same math, wildly different mental model.

Stored on the catalog row (catalog_entries.unit_type). Inherited by every
event of that catalog. Set on:
  - new catalog row creation (catalog_service.upsert_catalog_entry)
  - lazy backfill in catalog_overview_service.compute_overview when missing

Re-classification is rare and lives in the catalog page's "Manage entry"
section.
"""

from __future__ import annotations

VALID_UNIT_TYPES = ("count", "volume", "weight", "container")
DEFAULT_UNIT_TYPE = "count"

# Base-unit-label lookup tables. The label that lands on events from the
# inference heuristic in migration_v2_dry_run is normalized to lowercase.
_VOLUME_LABELS = {"ml", "milliliter", "millilitre", "l", "liter", "litre", "fl oz", "oz"}
_WEIGHT_LABELS = {"g", "gram", "grams", "kg", "kilogram", "kilograms", "mg", "lb", "lbs"}
_CONTAINER_LABELS = {
    "loaf", "loaves", "jar", "bag", "box", "bottle", "can", "carton",
    "packet", "tin", "tub", "container", "block", "tray", "sachet", "punnet",
}

# Name-fragment hints when no explicit base_unit_label was given.
_NAME_VOLUME_HINTS = (
    "milk", "juice", "oil", "vinegar", "sauce", "syrup", "soda",
    "soft drink", "kombucha", "yogurt drink", "yoghurt drink", "soup",
    "broth", "stock", "wine", "beer", "spirits", "whisky",
)
_NAME_WEIGHT_HINTS = (
    "beef", "chicken", "pork", "lamb", "fish", "prawn", "shrimp", "meat",
    "rice", "flour", "sugar", "salt", "pasta", "noodle", "oats", "cereal",
    "lentil", "bean", "potato", "onion", "carrot", "tomato", "garlic",
    "ginger", "peanut", "cheese",
)
_NAME_CONTAINER_HINTS = (
    "bread", "loaf", "bagel", "biscuit", "cracker", "chips", "tea bag",
)


def infer_unit_type(
    base_unit_label: str | None = None,
    name: str | None = None,
) -> str:
    """Best-effort classification. Returns one of VALID_UNIT_TYPES.

    Order:
      1. Explicit base_unit_label (most authoritative — set by the QuickAdd
         pack-size flow or migration heuristic)
      2. Name-fragment hints
      3. Default: count

    The classification is deliberately a one-way classifier — when the user
    re-classifies via Manage Entry, the dropdown writes to unit_type directly
    and bypasses inference.
    """
    bul = (base_unit_label or "").strip().lower()
    if bul:
        if bul in _VOLUME_LABELS:
            return "volume"
        if bul in _WEIGHT_LABELS:
            return "weight"
        if bul in _CONTAINER_LABELS:
            return "container"
        # else: explicit label that's a count noun (egg, apple, slice, pack…)
        return "count"

    nlow = (name or "").lower()
    if any(h in nlow for h in _NAME_VOLUME_HINTS):
        return "volume"
    if any(h in nlow for h in _NAME_WEIGHT_HINTS):
        return "weight"
    if any(h in nlow for h in _NAME_CONTAINER_HINTS):
        return "container"
    return DEFAULT_UNIT_TYPE


def normalize_unit_type(value: str | None) -> str:
    """Validate / coerce a user-supplied unit_type to one of the enum values.

    Falls back to DEFAULT_UNIT_TYPE on garbage input. No raise so the read
    path stays robust to bad data.
    """
    v = (value or "").strip().lower()
    if v in VALID_UNIT_TYPES:
        return v
    return DEFAULT_UNIT_TYPE


def default_step(unit_type: str, total_base_units: float) -> float:
    """Suggested slider step for a Use modal.

    - count: integer steps
    - volume: 10 ml for small containers, 50 ml for medium, 100 for jugs
    - weight: 10 g for small packs, 50 g for medium, 100 for big sacks
    - container: whole containers only (step = full)
    """
    if unit_type == "volume":
        if total_base_units <= 200:
            return 10.0
        if total_base_units <= 2000:
            return 50.0
        return 100.0
    if unit_type == "weight":
        if total_base_units <= 500:
            return 10.0
        if total_base_units <= 5000:
            return 50.0
        return 100.0
    if unit_type == "container":
        return max(total_base_units, 1.0)
    return 1.0
