"""Unit-type classification + canonical pack/base-unit helpers.

UNIT_TYPE_TOUCHPOINT — see `.claude/docs/unit-type-method.md` for the
canonical model. Two independent axes:

  USE-AXIS (unit_type, on catalog row):
    count   — eggs, apples, cartons-as-units, yogurt cups
    volume  — milk, juice, oil           (base_unit ∈ {ml, L})
    weight  — sugar, flour, meat         (base_unit ∈ {g, kg})

  BUY-AXIS (pack_label, on purchase event):
    free-text. carton, box, pack, bottle, jar, bag, can, sachet,
    cup, tray, loose, …
    Doesn't participate in math. Just descriptive.

`container` is a legacy unit_type kept readable; new writes coerce to
`count` (see `coerce_legacy_unit_type`). Pack-as-container is captured
via `pack_label`.
"""

from __future__ import annotations

# Legacy "container" kept in the validator so old records read cleanly.
# New code paths coerce it to "count" via coerce_legacy_unit_type().
VALID_UNIT_TYPES = ("count", "volume", "weight", "container")
CANONICAL_UNIT_TYPES = ("count", "volume", "weight")
DEFAULT_UNIT_TYPE = "count"

# Base-unit options per unit_type. UI dropdowns filter by these.
VALID_BASE_UNITS_BY_TYPE: dict[str, tuple[str, ...]] = {
    "count": ("count",),
    "volume": ("ml", "L"),
    "weight": ("g", "kg"),
    # legacy container behaves like count
    "container": ("count",),
}

# What the unit dropdown defaults to when unit_type is set but base_unit
# isn't (e.g., on first save against a freshly-inferred catalog row).
DEFAULT_BASE_UNIT_BY_TYPE: dict[str, str] = {
    "count": "count",
    "volume": "ml",
    "weight": "g",
    "container": "count",
}

# Suggested pack labels per unit_type — drives the QuickAddModal hint
# dropdown. Free-text input is still allowed (user can type "tray").
SUGGESTED_PACK_LABELS_BY_TYPE: dict[str, tuple[str, ...]] = {
    "count": ("loose", "pack", "carton", "tray", "box"),
    "volume": ("carton", "bottle", "jug", "can", "sachet"),
    "weight": ("pack", "box", "bag", "jar", "tin", "loose"),
    "container": ("loose", "pack", "carton"),
}

# All pack labels recognised by inference (lowercased). Used during
# backfill to detect a pack_label inside a free-text legacy `unit` value.
KNOWN_PACK_LABELS = frozenset(
    {
        "loose", "pack", "carton", "box", "bag", "bottle", "jar", "can",
        "sachet", "tin", "tub", "tray", "punnet", "block", "loaf",
        "container", "cup", "jug", "packet",
    }
)

# Default pack_size when only the pack_label is known (educated guesses
# for the QuickAddModal pre-fill — user can override). Returns None for
# unknown labels (UI keeps current pack_size).
DEFAULT_PACK_SIZE_BY_LABEL: dict[str, dict[str, float]] = {
    # pack_label → {unit_type → pack_size}
    "carton": {"volume": 1000.0, "count": 6.0},
    "bottle": {"volume": 500.0},
    "jug": {"volume": 1000.0},
    "can": {"volume": 330.0, "weight": 400.0},
    "box": {"weight": 500.0, "count": 12.0},
    "bag": {"weight": 1000.0},
    "jar": {"weight": 500.0, "volume": 250.0},
    "sachet": {"weight": 50.0, "volume": 100.0},
    "tray": {"count": 10.0},
    "pack": {"count": 6.0},
    "loose": {"count": 1.0, "volume": 1.0, "weight": 1.0},
}

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
    - container (legacy): coerced to count behaviour (integer step)
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
    return 1.0  # count + container


def coerce_legacy_unit_type(value: str | None) -> str:
    """Normalise to a canonical unit_type.

    Legacy `"container"` collapses to `"count"` — they're behaviourally
    identical (whole-piece consumption). The container's character is
    preserved via `pack_label` on each event.
    """
    v = normalize_unit_type(value)
    if v == "container":
        return "count"
    return v


def valid_base_units(unit_type: str) -> tuple[str, ...]:
    """Allowed base_unit values for a given unit_type."""
    return VALID_BASE_UNITS_BY_TYPE.get(
        coerce_legacy_unit_type(unit_type), VALID_BASE_UNITS_BY_TYPE["count"]
    )


def default_base_unit(unit_type: str) -> str:
    """Default base_unit when only unit_type is known."""
    return DEFAULT_BASE_UNIT_BY_TYPE.get(
        coerce_legacy_unit_type(unit_type), "count"
    )


def suggested_pack_labels(unit_type: str) -> tuple[str, ...]:
    """Pack-label dropdown suggestions for the QuickAddModal."""
    return SUGGESTED_PACK_LABELS_BY_TYPE.get(
        coerce_legacy_unit_type(unit_type), SUGGESTED_PACK_LABELS_BY_TYPE["count"]
    )


def default_pack_size(pack_label: str | None, unit_type: str | None) -> float | None:
    """Educated guess for pack_size when only pack_label + unit_type are known.

    Returns None when no guess is available — caller keeps the current
    pack_size or falls back to 1.
    """
    label = (pack_label or "").strip().lower()
    if not label:
        return None
    canonical = coerce_legacy_unit_type(unit_type)
    by_type = DEFAULT_PACK_SIZE_BY_LABEL.get(label)
    if not by_type:
        return None
    return by_type.get(canonical)


CANONICAL_BASE_UNITS = ("count", "ml", "L", "g", "kg")


def normalize_base_unit(value: str | None, unit_type: str | None = None) -> str:
    """Validate / canonicalise a base_unit string.

    UNIT_TYPE_TOUCHPOINT — soft-constraint policy. unit_type on the catalog
    row is a HINT for sensible defaults (slider step heuristic, default
    dropdown selection), NOT a hard constraint on which base_units are
    accepted. The user is free to record "1 g of milk powder" against a
    catalog row whose unit_type was inferred as "volume"; we trust them.

    Behaviour:
      - Empty / falsy input → default for the unit_type (or "count")
      - Recognised spelling (e.g. "ML", "litre", "Grams") → canonicalised
        ("ml", "L", "g")
      - Unknown string → fallback to default (don't store junk)
      - Validates against ALL canonical base units, NOT a unit_type-filtered
        subset (the previous bug — silently rewrote user's "g" to "ml" when
        unit_type happened to be "volume").
    """
    raw = (value or "").strip()
    if not raw:
        return default_base_unit(unit_type or DEFAULT_UNIT_TYPE)
    lower = raw.lower()
    canonical = {
        "ml": "ml", "milliliter": "ml", "millilitre": "ml",
        "l": "L", "liter": "L", "litre": "L",
        "g": "g", "gram": "g", "grams": "g",
        "kg": "kg", "kilogram": "kg", "kilograms": "kg",
        "count": "count", "ct": "count", "pcs": "count", "piece": "count",
    }.get(lower, raw)
    if canonical in CANONICAL_BASE_UNITS:
        return canonical
    # Truly unknown — fall back to a sensible default rather than store junk.
    return default_base_unit(unit_type or DEFAULT_UNIT_TYPE)


def infer_pack_label(legacy_unit: str | None, pack_size: float | None) -> str:
    """Backfill helper — derive a pack_label for legacy events.

    Reads the old free-text `unit` field and pack_size to choose a
    descriptive pack_label:
      - if `unit` is a recognised pack name ("pack", "carton", …) → use it
      - else if pack_size > 1 → "pack" (some kind of multi-pack, otherwise unknown)
      - else → "loose"
    """
    raw = (legacy_unit or "").strip().lower()
    if raw in KNOWN_PACK_LABELS:
        return raw
    if pack_size is not None and pack_size > 1:
        return "pack"
    return "loose"
