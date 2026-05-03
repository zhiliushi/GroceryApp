"""
Meals API routes — recipe CRUD, inventory matching, recipe scanning.

All endpoints require authentication.
"""

import logging

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File

from app.core.auth import UserInfo, get_current_user
from app.services import recipe_service, recipe_finance_service

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Recipe CRUD
# ---------------------------------------------------------------------------


@router.get("/recipes")
async def list_recipes(user: UserInfo = Depends(get_current_user)):
    """List all recipes for the current user."""
    recipes = recipe_service.list_recipes(user.uid)
    count = len(recipes)
    from app.services import user_service
    profile = user_service.get_user(user.uid) or {}
    tier = profile.get("tier", "free")
    limit = recipe_service.TIER_RECIPE_LIMITS.get(tier, 15)
    return {"recipes": recipes, "count": count, "limit": limit}


@router.post("/recipes")
async def create_recipe(body: dict, user: UserInfo = Depends(get_current_user)):
    """Create a new recipe."""
    from app.services import user_service
    profile = user_service.get_user(user.uid) or {}
    tier = profile.get("tier", "free")
    try:
        recipe = recipe_service.create_recipe(user.uid, body, tier)
        return {"success": True, "recipe": recipe}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/recipes/{recipe_id}")
async def get_recipe(recipe_id: str, user: UserInfo = Depends(get_current_user)):
    recipe = recipe_service.get_recipe(user.uid, recipe_id)
    if not recipe:
        raise HTTPException(404, "Recipe not found")
    return recipe


@router.put("/recipes/{recipe_id}")
async def update_recipe(recipe_id: str, body: dict, user: UserInfo = Depends(get_current_user)):
    if not recipe_service.update_recipe(user.uid, recipe_id, body):
        raise HTTPException(404, "Recipe not found")
    return {"success": True}


@router.delete("/recipes/{recipe_id}")
async def delete_recipe(recipe_id: str, user: UserInfo = Depends(get_current_user)):
    if not recipe_service.delete_recipe(user.uid, recipe_id):
        raise HTTPException(404, "Recipe not found")
    return {"success": True}


# ---------------------------------------------------------------------------
# Suggestions (match recipes to expiring inventory)
# ---------------------------------------------------------------------------


@router.get("/suggestions")
async def get_suggestions(user: UserInfo = Depends(get_current_user)):
    """Get recipes matched to expiring inventory items.

    Returns recipes sorted by expiring ingredient match count.
    Only includes recipes with ≥50% ingredient availability.
    """
    suggestions = recipe_service.match_recipes_to_inventory(user.uid)
    return {"suggestions": suggestions, "count": len(suggestions)}


# ---------------------------------------------------------------------------
# Recipe revisions (H2 — homemaker.versioning)
# ---------------------------------------------------------------------------


def _require_homemaker_versioning(user: UserInfo) -> None:
    """403 if the user can't see homemaker.versioning. Two-layer check
    matches the resolution rule documented on `is_homemaker_enabled`."""
    from app.services import user_service
    if not user_service.is_homemaker_enabled(user.uid, "versioning"):
        raise HTTPException(
            status_code=403,
            detail="Recipe versioning requires homemaker access.",
        )


@router.get("/recipes/{recipe_id}/revisions")
async def list_recipe_revisions(
    recipe_id: str, user: UserInfo = Depends(get_current_user),
):
    """List revisions for a recipe (newest first). Homemaker-only."""
    _require_homemaker_versioning(user)
    if not recipe_service.get_recipe(user.uid, recipe_id):
        raise HTTPException(404, "Recipe not found")
    return {"revisions": recipe_service.list_revisions(user.uid, recipe_id)}


@router.get("/recipes/{recipe_id}/revisions/{revision_id}")
async def get_recipe_revision(
    recipe_id: str,
    revision_id: str,
    user: UserInfo = Depends(get_current_user),
):
    """Fetch a single revision. Homemaker-only."""
    _require_homemaker_versioning(user)
    rev = recipe_service.get_revision(user.uid, recipe_id, revision_id)
    if not rev:
        raise HTTPException(404, "Revision not found")
    return rev


@router.post("/recipes/{recipe_id}/revisions/{revision_id}/restore")
async def restore_recipe_revision(
    recipe_id: str,
    revision_id: str,
    user: UserInfo = Depends(get_current_user),
):
    """Restore a recipe's ingredients from a revision. Auto-snapshots
    the current state first, so the restore is itself undoable.
    Homemaker-only."""
    _require_homemaker_versioning(user)
    if not recipe_service.restore_revision(user.uid, recipe_id, revision_id):
        raise HTTPException(404, "Recipe or revision not found")
    return {"success": True}


# ---------------------------------------------------------------------------
# Recipe finance (F1 base — per-ingredient pricing from buy history)
# ---------------------------------------------------------------------------


@router.get("/recipes/{recipe_id}/cost")
async def get_recipe_cost(
    recipe_id: str, user: UserInfo = Depends(get_current_user),
):
    """Estimated recipe cost from the user's recent buy history.

    Available to ALL users (NOT homemaker-gated). Per-ingredient last-paid
    price + sum. Approximate — not portion-aware. Homemaker enhances this
    with per-version snapshots + weight × unit_price math (separate phase).
    """
    estimate = recipe_finance_service.estimate_for_recipe(user.uid, recipe_id)
    if estimate is None:
        raise HTTPException(404, "Recipe not found")
    return estimate


# ---------------------------------------------------------------------------
# Recipe scanning (OCR)
# ---------------------------------------------------------------------------


from app.core.feature_flags import require_flag


@router.post("/scan-recipe", dependencies=[require_flag("recipe_ocr")])
async def scan_recipe(
    image: UploadFile = File(...),
    user: UserInfo = Depends(get_current_user),
):
    """Scan a recipe image using OCR and extract ingredients.

    Returns structured recipe data (name, ingredients, steps) with
    each ingredient matched against the user's current inventory.
    """
    from PIL import Image
    import io

    # Validate image
    if image.content_type and image.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(400, "Only JPEG/PNG images accepted")

    image_bytes = await image.read()
    if len(image_bytes) > 5 * 1024 * 1024:
        raise HTTPException(413, "Image too large (max 5MB)")

    try:
        Image.open(io.BytesIO(image_bytes))
    except Exception:
        raise HTTPException(422, "Could not read image")

    # Run OCR using existing cascade
    from app.services.ocr.manager import OcrManager
    from app.services import ocr_config_service

    ocr_config = ocr_config_service.get_ocr_config()
    usage = ocr_config_service.get_usage()

    manager = OcrManager()
    result = await manager.scan(image_bytes, ocr_config, usage)

    if not result.success or not result.data:
        return {
            "success": False,
            "raw_text": result.data.raw_text if result.data else "",
            "parsed": {"name": "", "ingredients": [], "steps": []},
            "message": "Could not extract text from image",
        }

    raw_text = result.data.raw_text

    # Parse recipe from OCR text
    parsed = recipe_service.parse_recipe_text(raw_text)

    # Match ingredients against inventory
    from app.services import inventory_service
    items = inventory_service.get_household_items(user.uid, limit=500, status="active")

    ingredient_matches = []
    for ing in parsed.get("ingredients", []):
        ing_name = (ing.get("name") or "").lower()
        matched_item = None
        for item in items:
            item_name = (item.get("name") or "").lower()
            if ing_name in item_name or item_name in ing_name:
                matched_item = item
                break

        ingredient_matches.append({
            **ing,
            "matched": matched_item is not None,
            "inventory_item_name": matched_item.get("name") if matched_item else None,
            "inventory_location": matched_item.get("location") if matched_item else None,
            "inventory_quantity": matched_item.get("quantity") if matched_item else None,
        })

    return {
        "success": True,
        "provider_used": result.provider_used,
        "raw_text": raw_text[:3000],
        "parsed": {
            "name": parsed.get("name", ""),
            "ingredients": ingredient_matches,
            "steps": parsed.get("steps", []),
        },
    }
