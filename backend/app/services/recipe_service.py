"""
Recipe service — user recipes with inventory matching for waste prevention.

Firestore: users/{uid}/recipes/{recipe_id}

Core features:
- CRUD for personal recipes (free: 15 max, plus/pro: 50)
- Match recipes to expiring inventory (fuzzy ingredient matching)
- Parse recipe text from OCR output
"""

from __future__ import annotations

import logging
import re
import time
from datetime import datetime
from typing import Optional, List, Dict, Any

from firebase_admin import firestore

logger = logging.getLogger(__name__)

TIER_RECIPE_LIMITS = {"free": 15, "plus": 50, "pro": 50, "admin": 999}
SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000


def _db():
    return firestore.client()


def _recipes_ref(uid: str):
    return _db().collection("users").document(uid).collection("recipes")


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


def create_recipe(uid: str, data: Dict[str, Any], tier: str = "free") -> Dict[str, Any]:
    """Create a recipe. Enforces tier limit."""
    limit = TIER_RECIPE_LIMITS.get(tier, 15)
    current = count_user_recipes(uid)
    if current >= limit:
        raise ValueError(f"Recipe limit reached ({current}/{limit}). Upgrade for more.")

    now = datetime.utcnow().isoformat()
    doc_data = {
        "name": (data.get("name") or "").strip()[:100],
        "description": (data.get("description") or "").strip()[:500],
        "servings": data.get("servings", 1),
        "prep_time_min": data.get("prep_time_min", 0),
        "ingredients": data.get("ingredients", []),
        "steps": data.get("steps", []),
        "tags": data.get("tags", []),
        "created_at": now,
        "updated_at": now,
    }

    if not doc_data["name"]:
        raise ValueError("Recipe name is required")
    if not doc_data["ingredients"]:
        raise ValueError("At least one ingredient is required")

    ref = _recipes_ref(uid).document()
    ref.set(doc_data)
    doc_data["id"] = ref.id
    logger.info("Recipe %s created for user %s", ref.id, uid)
    return doc_data


def get_recipe(uid: str, recipe_id: str) -> Optional[Dict[str, Any]]:
    doc = _recipes_ref(uid).document(recipe_id).get()
    if not doc.exists:
        return None
    data = doc.to_dict()
    data["id"] = doc.id
    return data


def list_recipes(uid: str) -> List[Dict[str, Any]]:
    results = []
    for doc in _recipes_ref(uid).stream():
        data = doc.to_dict()
        data["id"] = doc.id
        results.append(data)
    results.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return results


def update_recipe(uid: str, recipe_id: str, data: Dict[str, Any]) -> bool:
    ref = _recipes_ref(uid).document(recipe_id)
    if not ref.get().exists:
        return False
    data["updated_at"] = datetime.utcnow().isoformat()
    ref.update(data)
    return True


def delete_recipe(uid: str, recipe_id: str) -> bool:
    ref = _recipes_ref(uid).document(recipe_id)
    if not ref.get().exists:
        return False
    ref.delete()
    return True


def count_user_recipes(uid: str) -> int:
    return len(list(_recipes_ref(uid).select([]).stream()))


# ---------------------------------------------------------------------------
# Match recipes to expiring inventory
# ---------------------------------------------------------------------------


def match_recipes_to_inventory(uid: str) -> List[Dict[str, Any]]:
    """Match user's recipes against their active inventory.

    Returns recipes sorted by: expiring_match_count DESC, match_score DESC.
    Only includes recipes with ≥50% ingredient match.
    Each recipe includes match details per ingredient.
    """
    from app.services import inventory_service

    recipes = list_recipes(uid)
    if not recipes:
        return []

    # Get all active items (household-aware)
    items = inventory_service.get_household_items(uid, limit=500, status="active")
    if not items:
        return []

    now_ms = int(time.time() * 1000)
    results = []

    for recipe in recipes:
        ingredients = recipe.get("ingredients", [])
        if not ingredients:
            continue

        total = len(ingredients)
        matched = 0
        expiring_matched = 0
        ingredient_matches = []

        for ing in ingredients:
            ing_name = (ing.get("name") or "").lower().strip()
            ing_category = (ing.get("category") or "").lower().strip()
            if not ing_name:
                continue

            # Find matching inventory items
            match_item = None
            for item in items:
                item_name = (item.get("name") or "").lower()
                item_category = (item.get("category") or "").lower()

                # Fuzzy match: ingredient name appears in item name or vice versa
                name_match = ing_name in item_name or item_name in ing_name
                # Category match as fallback
                cat_match = ing_category and ing_category in item_category

                if name_match or cat_match:
                    match_item = item
                    break

            if match_item:
                matched += 1
                exp = match_item.get("expiryDate") or match_item.get("expiry_date")
                exp_ms = (exp if exp and exp > 1e12 else (exp * 1000 if exp else None))
                is_expiring = exp_ms is not None and (exp_ms - now_ms) < SEVEN_DAYS_MS

                if is_expiring:
                    expiring_matched += 1

                ingredient_matches.append({
                    "name": ing.get("name"),
                    "quantity": ing.get("quantity"),
                    "unit": ing.get("unit"),
                    "matched": True,
                    "inventory_item_id": match_item.get("id"),
                    "inventory_item_name": match_item.get("name"),
                    "inventory_quantity": match_item.get("quantity"),
                    "inventory_location": match_item.get("location"),
                    "inventory_user_id": match_item.get("user_id"),
                    "expiring": is_expiring,
                    "expiry_text": _expiry_text(exp_ms, now_ms) if exp_ms else None,
                })
            else:
                ingredient_matches.append({
                    "name": ing.get("name"),
                    "quantity": ing.get("quantity"),
                    "unit": ing.get("unit"),
                    "matched": False,
                })

        match_score = matched / total if total > 0 else 0

        # Only include if ≥50% match
        if match_score >= 0.5:
            results.append({
                **recipe,
                "match_score": round(match_score, 2),
                "matched_count": matched,
                "total_ingredients": total,
                "expiring_match_count": expiring_matched,
                "ingredient_matches": ingredient_matches,
                "missing_ingredients": [m["name"] for m in ingredient_matches if not m["matched"]],
            })

    # Sort: most expiring matches first, then highest match score
    results.sort(key=lambda r: (-r["expiring_match_count"], -r["match_score"]))
    return results


def _expiry_text(exp_ms: float, now_ms: float) -> str:
    diff_days = int((exp_ms - now_ms) / (24 * 60 * 60 * 1000))
    if diff_days < 0:
        return f"expired {abs(diff_days)}d ago"
    if diff_days == 0:
        return "expires today"
    if diff_days == 1:
        return "expires tomorrow"
    return f"expires in {diff_days}d"


# ---------------------------------------------------------------------------
# Parse recipe text from OCR
# ---------------------------------------------------------------------------

# Patterns for ingredient lines: "2 cups flour", "100g butter", "3 eggs"
_QTY_UNIT_NAME = re.compile(
    r"^(\d+(?:[/\.]\d+)?)\s*"                    # quantity: 2, 1/2, 0.5
    r"(cups?|tbsp?|tsp?|oz|g|kg|ml|l|lb|pcs?|"   # unit
    r"slices?|pieces?|cloves?|stalks?|bunche?s?|cans?)?\s*"
    r"(.+)$",
    re.IGNORECASE,
)
_STEP_NUMBER = re.compile(r"^\d+[\.\)]\s*(.+)$")
_SECTION_HEADER = re.compile(
    r"^(ingredients?|directions?|instructions?|method|steps?|preparation)\s*:?\s*$",
    re.IGNORECASE,
)


def parse_recipe_text(raw_text: str) -> Dict[str, Any]:
    """Parse OCR text into structured recipe data.

    Returns: {name, ingredients: [{name, quantity, unit}], steps: [str]}
    """
    lines = [ln.strip() for ln in raw_text.split("\n") if ln.strip()]
    if not lines:
        return {"name": "", "ingredients": [], "steps": []}

    name = lines[0]  # First line = recipe name
    ingredients: List[Dict[str, Any]] = []
    steps: List[str] = []
    current_section = "unknown"  # "ingredients" | "steps" | "unknown"

    for line in lines[1:]:
        # Check for section headers
        if _SECTION_HEADER.match(line):
            header = line.lower()
            if "ingredient" in header:
                current_section = "ingredients"
            elif any(w in header for w in ("direction", "instruction", "method", "step", "preparation")):
                current_section = "steps"
            continue

        # Try to parse as ingredient
        ing_match = _QTY_UNIT_NAME.match(line)
        if ing_match and (current_section in ("ingredients", "unknown")):
            qty_str = ing_match.group(1)
            unit = (ing_match.group(2) or "").strip()
            ing_name = ing_match.group(3).strip().rstrip(",;.")

            # Convert quantity
            try:
                if "/" in qty_str:
                    parts = qty_str.split("/")
                    qty = float(parts[0]) / float(parts[1])
                else:
                    qty = float(qty_str)
            except (ValueError, ZeroDivisionError):
                qty = None

            if ing_name and len(ing_name) > 1:
                ingredients.append({
                    "name": ing_name,
                    "quantity": qty,
                    "unit": unit or None,
                    "category": "",
                })
                current_section = "ingredients"  # Infer section
                continue

        # Try to parse as step
        step_match = _STEP_NUMBER.match(line)
        if step_match:
            steps.append(step_match.group(1).strip())
            current_section = "steps"
            continue

        # If we're in steps section, add as step
        if current_section == "steps" and len(line) > 10:
            steps.append(line)

    return {
        "name": name[:100],
        "ingredients": ingredients,
        "steps": steps,
    }
