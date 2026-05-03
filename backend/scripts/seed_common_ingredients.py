"""Seed the global `common_ingredients` collection.

Curated list of generic recipe building blocks for the auto-match step
of recipe-write. Malaysian-context-aware (santan, ikan bilis, kicap
manis, daun pandan, etc.) plus the global core (salt, sugar, eggs,
flour…). Doesn't count against any user's quota.

Idempotent: each entry is upserted by name_norm, so re-running is safe.
Auto-runs on backend startup if the collection is empty (see main.py).

Manual run:
    python -m scripts.seed_common_ingredients
"""

from __future__ import annotations

import logging
import sys
from typing import Iterable, List, Tuple

logger = logging.getLogger(__name__)


# (name_norm, display_name, default_category)
# Categories used: pantry, oil, grain, flour, protein, vegetable, herb,
# fruit, dairy, coconut, condiment, paste, beverage, sweetener
SEED: List[Tuple[str, str, str]] = [
    # === Salt / sugar / sweeteners ===
    ("salt", "Salt", "pantry"),
    ("sugar", "Sugar", "sweetener"),
    ("brown_sugar", "Brown sugar", "sweetener"),
    ("palm_sugar", "Palm sugar (gula melaka)", "sweetener"),
    ("honey", "Honey", "sweetener"),

    # === Spices ===
    ("white_pepper", "White pepper", "pantry"),
    ("black_pepper", "Black pepper", "pantry"),
    ("cinnamon", "Cinnamon", "pantry"),
    ("turmeric_powder", "Turmeric powder (kunyit)", "pantry"),
    ("curry_powder", "Curry powder", "pantry"),
    ("chili_powder", "Chili powder", "pantry"),
    ("cumin", "Cumin", "pantry"),
    ("coriander_seed", "Coriander seed", "pantry"),
    ("fennel_seed", "Fennel seed", "pantry"),
    ("star_anise", "Star anise", "pantry"),
    ("cardamom", "Cardamom", "pantry"),
    ("cloves", "Cloves", "pantry"),
    ("nutmeg", "Nutmeg", "pantry"),
    ("paprika", "Paprika", "pantry"),

    # === Sauces / liquid pantry ===
    ("soy_sauce", "Soy sauce", "condiment"),
    ("kicap_manis", "Sweet soy sauce (kicap manis)", "condiment"),
    ("kicap_masin", "Salty soy sauce (kicap masin)", "condiment"),
    ("oyster_sauce", "Oyster sauce", "condiment"),
    ("fish_sauce", "Fish sauce", "condiment"),
    ("vinegar", "Vinegar", "condiment"),
    ("tomato_sauce", "Tomato sauce / ketchup", "condiment"),
    ("chili_sauce", "Chili sauce", "condiment"),
    ("hoisin_sauce", "Hoisin sauce", "condiment"),
    ("sriracha", "Sriracha", "condiment"),
    ("mayonnaise", "Mayonnaise", "condiment"),

    # === Pastes ===
    ("sambal", "Sambal", "paste"),
    ("sambal_belacan", "Sambal belacan", "paste"),
    ("belacan", "Belacan (shrimp paste)", "paste"),
    ("miso", "Miso paste", "paste"),
    ("tamarind", "Tamarind (asam jawa)", "paste"),

    # === Cooking oils ===
    ("vegetable_oil", "Vegetable oil", "oil"),
    ("coconut_oil", "Coconut oil", "oil"),
    ("olive_oil", "Olive oil", "oil"),
    ("sesame_oil", "Sesame oil", "oil"),
    ("ghee", "Ghee", "oil"),
    ("butter", "Butter", "dairy"),

    # === Grains / staples ===
    ("white_rice", "White rice", "grain"),
    ("basmati_rice", "Basmati rice", "grain"),
    ("brown_rice", "Brown rice", "grain"),
    ("jasmine_rice", "Jasmine rice", "grain"),
    ("glutinous_rice", "Glutinous rice", "grain"),
    ("vermicelli", "Vermicelli (mihun)", "grain"),
    ("kuey_teow", "Kuey teow", "grain"),
    ("yellow_noodle", "Yellow noodle (mee)", "grain"),
    ("bee_hoon", "Bee hoon", "grain"),
    ("bread", "Bread", "grain"),

    # === Flour / baking ===
    ("wheat_flour", "Wheat flour", "flour"),
    ("rice_flour", "Rice flour", "flour"),
    ("corn_flour", "Corn flour", "flour"),
    ("tapioca_flour", "Tapioca flour", "flour"),
    ("baking_powder", "Baking powder", "flour"),
    ("baking_soda", "Baking soda", "flour"),
    ("yeast", "Yeast", "flour"),
    ("vanilla_extract", "Vanilla extract", "flour"),

    # === Proteins ===
    ("chicken_breast", "Chicken breast", "protein"),
    ("chicken_thigh", "Chicken thigh", "protein"),
    ("chicken_whole", "Whole chicken", "protein"),
    ("beef", "Beef", "protein"),
    ("mutton", "Mutton", "protein"),
    ("lamb", "Lamb", "protein"),
    ("fish", "Fish", "protein"),
    ("prawn", "Prawn", "protein"),
    ("squid", "Squid (sotong)", "protein"),
    ("crab", "Crab", "protein"),
    ("ikan_bilis", "Anchovies (ikan bilis)", "protein"),
    ("egg", "Egg", "protein"),
    ("salted_egg", "Salted egg", "protein"),
    ("century_egg", "Century egg", "protein"),
    ("tofu", "Tofu", "protein"),
    ("tempeh", "Tempeh", "protein"),

    # === Vegetables ===
    ("onion", "Onion", "vegetable"),
    ("red_onion", "Red onion", "vegetable"),
    ("shallot", "Shallot (bawang merah kecil)", "vegetable"),
    ("garlic", "Garlic", "vegetable"),
    ("ginger", "Ginger (halia)", "vegetable"),
    ("lemongrass", "Lemongrass (serai)", "vegetable"),
    ("galangal", "Galangal (lengkuas)", "vegetable"),
    ("turmeric_root", "Turmeric root (kunyit hidup)", "vegetable"),
    ("chili", "Chili (cili)", "vegetable"),
    ("birds_eye_chili", "Bird's eye chili (cili padi)", "vegetable"),
    ("tomato", "Tomato", "vegetable"),
    ("potato", "Potato", "vegetable"),
    ("sweet_potato", "Sweet potato", "vegetable"),
    ("carrot", "Carrot", "vegetable"),
    ("cabbage", "Cabbage", "vegetable"),
    ("choy_sum", "Choy sum / sawi", "vegetable"),
    ("kangkung", "Water spinach (kangkung)", "vegetable"),
    ("bok_choy", "Bok choy", "vegetable"),
    ("lettuce", "Lettuce", "vegetable"),
    ("cucumber", "Cucumber", "vegetable"),
    ("eggplant", "Eggplant (terung)", "vegetable"),
    ("ladys_finger", "Lady's finger (bendi/okra)", "vegetable"),
    ("long_bean", "Long bean (kacang panjang)", "vegetable"),
    ("bean_sprout", "Bean sprout (taugeh)", "vegetable"),
    ("mushroom", "Mushroom", "vegetable"),
    ("dried_shiitake", "Dried shiitake mushroom", "vegetable"),

    # === Herbs / aromatics ===
    ("pandan_leaf", "Pandan leaf (daun pandan)", "herb"),
    ("curry_leaf", "Curry leaf (daun kari)", "herb"),
    ("kaffir_lime_leaf", "Kaffir lime leaf (daun limau purut)", "herb"),
    ("turmeric_leaf", "Turmeric leaf (daun kunyit)", "herb"),
    ("torch_ginger_flower", "Torch ginger flower (bunga kantan)", "herb"),
    ("mint", "Mint", "herb"),
    ("basil", "Thai basil / kemangi", "herb"),
    ("coriander", "Coriander / cilantro", "herb"),
    ("spring_onion", "Spring onion", "herb"),
    ("parsley", "Parsley", "herb"),

    # === Fruits ===
    ("lime", "Lime", "fruit"),
    ("lemon", "Lemon", "fruit"),
    ("calamansi", "Calamansi (limau kasturi)", "fruit"),
    ("banana", "Banana", "fruit"),
    ("apple", "Apple", "fruit"),
    ("orange", "Orange", "fruit"),
    ("mango", "Mango", "fruit"),
    ("papaya", "Papaya", "fruit"),
    ("pineapple", "Pineapple", "fruit"),
    ("coconut", "Coconut", "fruit"),

    # === Coconut products ===
    ("santan", "Coconut milk (santan)", "coconut"),
    ("coconut_cream", "Coconut cream", "coconut"),
    ("desiccated_coconut", "Desiccated coconut (kelapa parut)", "coconut"),

    # === Dairy ===
    ("milk", "Milk", "dairy"),
    ("fresh_milk", "Fresh milk", "dairy"),
    ("condensed_milk", "Condensed milk", "dairy"),
    ("evaporated_milk", "Evaporated milk", "dairy"),
    ("yogurt", "Yogurt", "dairy"),
    ("cheese", "Cheese", "dairy"),

    # === Specialty / dried ===
    ("dried_shrimp", "Dried shrimp (udang kering)", "protein"),
    ("dried_scallop", "Dried scallop", "protein"),
    ("preserved_radish", "Preserved radish (chai poh)", "vegetable"),
    ("candlenut", "Candlenut (buah keras)", "pantry"),
]


def run() -> dict:
    """Execute the seed. Returns a summary dict.

    Idempotent — `upsert` on each entry, so re-runs are safe.
    """
    from app.services import common_ingredients_service

    created = 0
    updated = 0
    for name_norm, display_name, category in SEED:
        result = common_ingredients_service.upsert(
            name_norm=name_norm,
            display_name=display_name,
            default_category=category,
        )
        if result["created"]:
            created += 1
        else:
            updated += 1
    summary = {"created": created, "updated": updated, "total": len(SEED)}
    logger.info("common_ingredients seed: %s", summary)
    return summary


def run_if_empty() -> dict:
    """Skip if collection already has entries — used as a startup hook to
    cheaply guard against repeat work on every cold start."""
    from app.services import common_ingredients_service

    if common_ingredients_service.is_seeded():
        return {"skipped": True, "reason": "already_seeded"}
    return run()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    summary = run()
    print(summary)
    sys.exit(0)
