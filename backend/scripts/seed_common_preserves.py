"""Seed the global `common_preserves` collection.

Curated preservation templates for the preppers feature — kimchi,
achar, kaya, jam, jerky, etc. Each entry has default ready-after and
shelf-life durations the user can override per batch. Mix of Malaysian
and global staples.

Idempotent: each entry is upserted by name_norm, so re-running is safe.
Auto-runs on backend startup if the collection is empty (see main.py).

Manual run:
    python -m scripts.seed_common_preserves
"""

from __future__ import annotations

import logging
import sys
from typing import List, Tuple

logger = logging.getLogger(__name__)


# (name_norm, display_name, prep_type, default_ready_after_hours,
#  default_shelf_life_days, description)
# Defaults err on the conservative side for shelf life — unrefrigerated
# ferments and oils degrade fast; user can extend per-batch when in doubt.
SEED: List[Tuple[str, str, str, int, int, str]] = [
    # === Ferments ===
    ("kimchi", "Kimchi", "ferment", 72, 60,
     "Salted napa cabbage + chilli + garlic + ginger. Tangy after ~3d, peak 1-2 weeks."),
    ("sauerkraut", "Sauerkraut", "ferment", 336, 180,
     "Salt-fermented cabbage. ~2 weeks for tang, refrigerate for months."),
    ("kombucha", "Kombucha", "ferment", 168, 30,
     "Sweet tea + SCOBY. ~7d primary fermentation; bottle-condition for fizz."),
    ("miso", "Miso paste", "ferment", 4320, 540,
     "Soybean + koji + salt. 6 months minimum; up to 18 months for richer flavour."),
    ("tempeh", "Tempeh", "ferment", 36, 7,
     "Cultured soybean cake. ~36h to fully knit; refrigerate after."),
    ("tapai", "Tapai (fermented sweet rice)", "ferment", 48, 14,
     "Glutinous rice + ragi yeast. Ready in 2-3d, sweetens fast."),
    ("tempoyak", "Tempoyak (fermented durian)", "ferment", 336, 90,
     "Salted durian flesh. ~2 weeks to mature; pungent — keep sealed."),
    ("yoghurt", "Home yogurt", "ferment", 8, 14,
     "Heated milk + culture. ~6-8h incubation; refrigerated."),

    # === Pickles (vinegar, quick) ===
    ("dill_pickles", "Dill pickles", "pickle", 24, 30,
     "Cucumbers in vinegar brine + dill + garlic. Ready next day."),
    ("achar", "Achar (Malaysian pickled veg)", "pickle", 48, 30,
     "Veg + turmeric + chilli + vinegar + sugar. Mature 1-2 days."),
    ("pickled_ginger", "Pickled ginger (gari)", "pickle", 24, 60,
     "Sliced young ginger + sweet vinegar brine."),
    ("pickled_onions", "Pickled onions", "pickle", 24, 30,
     "Red onion in vinegar + sugar. Ready in hours, peak after a day."),
    ("asam_jeruk", "Asam jeruk (pickled fruit)", "pickle", 48, 60,
     "Salted/sugared fruit. Sweet-sour snack staple."),

    # === Cures ===
    ("gravlax", "Gravlax", "cure", 48, 7,
     "Salt + sugar + dill cure on salmon. Ready in ~2d; refrigerated."),
    ("bacon_home_cured", "Home-cured bacon", "cure", 168, 30,
     "Pork belly + salt + sugar + nitrate. ~7d cure, then optional cold-smoke."),
    ("cured_egg_yolks", "Cured egg yolks", "cure", 96, 30,
     "Yolks in salt-sugar bed for ~4d, then dried. Grate over pasta."),

    # === Cans / preserves ===
    ("strawberry_jam", "Strawberry jam", "jam", 4, 180,
     "Fruit + sugar + acid, water-bath sealed. Unopened: 6 months."),
    ("marmalade", "Marmalade", "jam", 4, 180,
     "Citrus + sugar, set with pectin. Unopened: 6 months."),
    ("kaya", "Kaya (coconut egg jam)", "jam", 4, 14,
     "Egg + santan + sugar + pandan. Refrigerated, ~2 weeks."),
    ("chilli_paste", "Sambal / chilli paste", "jam", 4, 30,
     "Chilli + onion + belacan + oil. Refrigerated, ~1 month."),
    ("canned_tomatoes", "Canned tomatoes", "can", 24, 365,
     "Water-bath sealed in jars. ~1 year if seal holds."),
    ("canned_beans", "Pressure-canned beans", "can", 24, 365,
     "Pressure-canner only — atmospheric/water bath is unsafe for beans."),

    # === Dried ===
    ("beef_jerky", "Beef jerky", "dry", 8, 14,
     "Marinated strips dried at low heat. Vacuum-seal extends to ~30d."),
    ("dried_mushrooms", "Dried mushrooms", "dry", 24, 180,
     "Sliced + air-dried or dehydrator. Store in airtight jar."),
    ("dried_herbs", "Dried herbs", "dry", 168, 365,
     "Hang-dry or low-oven. Whole leaves keep longer than crushed."),
    ("sun_dried_tomatoes", "Sun-dried tomatoes", "dry", 72, 180,
     "Halved + salted + dried. In oil for richer flavour."),

    # === Freezer ===
    ("frozen_stew", "Batch-cooked frozen stew", "freeze", 4, 90,
     "Cooked, cooled, portioned, frozen. Best within 3 months."),
    ("frozen_stock", "Frozen stock", "freeze", 4, 180,
     "Reduced + portioned (ice cubes / bags). 6 months in -18C freezer."),
    ("frozen_pesto", "Frozen pesto", "freeze", 4, 90,
     "Basil + oil + nuts + cheese, portioned in ice trays."),

    # === Infusions ===
    ("chilli_oil", "Chilli oil", "infuse", 24, 60,
     "Heated oil over chilli flakes. Refrigerated for safety."),
    ("herb_vinegar", "Herb-infused vinegar", "infuse", 168, 180,
     "Fresh herbs steeped in vinegar 1-2 weeks. Strain before storing."),
]


def run() -> dict:
    """Execute the seed. Returns a summary dict.

    Idempotent — `upsert` on each entry, so re-runs are safe.
    """
    from app.services import common_preserves_service

    created = 0
    updated = 0
    for name_norm, display_name, prep_type, ready_h, shelf_d, desc in SEED:
        result = common_preserves_service.upsert(
            name_norm=name_norm,
            display_name=display_name,
            prep_type=prep_type,
            default_ready_after_hours=ready_h,
            default_shelf_life_days=shelf_d,
            description=desc,
        )
        if result["created"]:
            created += 1
        else:
            updated += 1
    summary = {"created": created, "updated": updated, "total": len(SEED)}
    logger.info("common_preserves seed: %s", summary)
    return summary


def run_if_empty() -> dict:
    """Skip if collection already has entries — used as a startup hook."""
    from app.services import common_preserves_service

    if common_preserves_service.is_seeded():
        return {"skipped": True, "reason": "already_seeded"}
    return run()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    summary = run()
    print(summary)
    sys.exit(0)
