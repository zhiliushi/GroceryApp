"""Preppers API routes — preservation recipe templates + active batches.

All routes require authentication AND require the user to have
`preppers_enabled=True` on their user doc AND the global
`preppers_enabled` feature flag to be True. Mirrors the homemaker
two-axis access pattern.

Beta posture: per-user toggle defaults TRUE for now (anyone can try),
score-meter for eligibility is informational only — actual gating is
tightened later when leaving beta.

Phase P1 of preppers.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import UserInfo, get_current_user
from app.core import feature_flags
from app.services import (
    common_preserves_service,
    prep_batch_service,
    prep_eligibility_service,
    prep_finance_service,
    prep_recipe_service,
    prep_recommendation_service,
    prep_supply_service,
    user_service,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Access guard
# ---------------------------------------------------------------------------


def require_preppers(user: UserInfo = Depends(get_current_user)) -> UserInfo:
    """Two-axis gate: per-user toggle AND global feature flag.

    Returns 404 (not 403) when disabled — hides feature existence,
    matching the homemaker pattern.
    """
    if not feature_flags.is_enabled("preppers_enabled"):
        raise HTTPException(status_code=404, detail="Feature not available")
    profile = user_service.get_user(user.uid) or {}
    if not profile.get("preppers_enabled", False):
        raise HTTPException(status_code=404, detail="Feature not available")
    return user


# ---------------------------------------------------------------------------
# Eligibility (data-readiness score — informational during beta)
# ---------------------------------------------------------------------------


@router.get("/eligibility")
async def get_preppers_eligibility(user: UserInfo = Depends(require_preppers)):
    """Data-readiness report.

    Beta: this is INFORMATIONAL ONLY — the rest of the preppers routes
    don't gate on it. Shown to the user so they understand why analytics
    improve over time.
    """
    return prep_eligibility_service.compute_eligibility(user.uid)


# ---------------------------------------------------------------------------
# Household composition + supply estimate
# ---------------------------------------------------------------------------


@router.get("/household")
async def get_preppers_household(user: UserInfo = Depends(require_preppers)):
    """User's household composition for supply projection (adults / youth /
    elderly + per-person daily servings)."""
    return user_service.get_preppers_household(user.uid)


@router.put("/household")
async def update_preppers_household(
    body: dict, user: UserInfo = Depends(require_preppers),
):
    """Upsert household composition. Body fields (any subset):
      adults, youth, elderly (int >= 0)
      servings_per_adult, servings_per_youth, servings_per_elderly (float > 0)
    """
    try:
        updated = user_service.update_preppers_household(user.uid, body)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if updated is None:
        raise HTTPException(404, "User not found")
    return {"success": True, "household": updated}


@router.get("/supply-estimate")
async def get_preppers_supply_estimate(user: UserInfo = Depends(require_preppers)):
    """Days-of-supply projection from active batches + household composition."""
    return prep_supply_service.compute_supply_estimate(user.uid)


# ---------------------------------------------------------------------------
# Recommendations — "worth keeping in rotation"
# ---------------------------------------------------------------------------


@router.get("/recommendations")
async def get_preppers_recommendations(
    top_k: int = 5, user: UserInfo = Depends(require_preppers),
):
    """Score common preserves by ingredient overlap with the user's cooking
    recipes + frequent-buy catalog. Excludes preserves already in an active
    batch."""
    return prep_recommendation_service.compute_recommendations(user.uid, top_k=top_k)


# ---------------------------------------------------------------------------
# Cost-per-serving + savings rollup (P12)
# ---------------------------------------------------------------------------


@router.get("/recipes/{rid}/cost")
async def get_prep_recipe_cost(rid: str, user: UserInfo = Depends(require_preppers)):
    """Cost breakdown for one prep recipe. Home cost from the user's
    purchase history; store reference (if set) drives the savings number."""
    cost = prep_finance_service.estimate_recipe_cost(user.uid, rid)
    if cost is None:
        raise HTTPException(404, "Prep recipe not found")
    return cost


@router.get("/batches/{bid}/cost")
async def get_prep_batch_cost(bid: str, user: UserInfo = Depends(require_preppers)):
    """Cost breakdown for one batch. Per-batch store ref overrides recipe
    ref when set; otherwise falls back to parent recipe."""
    cost = prep_finance_service.estimate_batch_cost(user.uid, bid)
    if cost is None:
        raise HTTPException(404, "Prep batch not found")
    return cost


@router.get("/savings")
async def get_preppers_savings(user: UserInfo = Depends(require_preppers)):
    """Aggregate cost + savings rollup across all active batches."""
    return prep_finance_service.compute_active_savings_rollup(user.uid)


# ---------------------------------------------------------------------------
# Common preserves (curated seed — read-only for clients)
# ---------------------------------------------------------------------------


@router.get("/common-preserves")
async def list_common_preserves(_: UserInfo = Depends(require_preppers)):
    """Curated preserve templates (~25-30 entries). Cheap full dump,
    intended to be fetched once per session and cached."""
    items = common_preserves_service.list_all()
    items.sort(key=lambda x: (x.get("display_name") or "").lower())
    return {"items": items, "count": len(items)}


# ---------------------------------------------------------------------------
# User prep recipes (templates)
# ---------------------------------------------------------------------------


@router.get("/recipes")
async def list_prep_recipes(user: UserInfo = Depends(require_preppers)):
    recipes = prep_recipe_service.list_recipes(user.uid)
    return {
        "recipes": recipes,
        "count": len(recipes),
        "limit": prep_recipe_service.PREP_RECIPE_LIMIT,
    }


@router.post("/recipes")
async def create_prep_recipe(
    body: dict, user: UserInfo = Depends(require_preppers),
):
    try:
        recipe = prep_recipe_service.create_recipe(user.uid, body)
        return {"success": True, "recipe": recipe}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/recipes/{rid}")
async def get_prep_recipe(rid: str, user: UserInfo = Depends(require_preppers)):
    recipe = prep_recipe_service.get_recipe(user.uid, rid)
    if not recipe:
        raise HTTPException(404, "Prep recipe not found")
    return recipe


@router.put("/recipes/{rid}")
async def update_prep_recipe(
    rid: str, body: dict, user: UserInfo = Depends(require_preppers),
):
    try:
        recipe = prep_recipe_service.update_recipe(user.uid, rid, body)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not recipe:
        raise HTTPException(404, "Prep recipe not found")
    return {"success": True, "recipe": recipe}


@router.delete("/recipes/{rid}")
async def delete_prep_recipe(rid: str, user: UserInfo = Depends(require_preppers)):
    if not prep_recipe_service.delete_recipe(user.uid, rid):
        raise HTTPException(404, "Prep recipe not found")
    return {"success": True}


# ---------------------------------------------------------------------------
# User prep batches (active instances)
# ---------------------------------------------------------------------------


@router.get("/batches")
async def list_prep_batches(
    status: str = "active", user: UserInfo = Depends(require_preppers),
):
    """List batches. Default = active only. Pass ?status=all for everything,
    or ?status=consumed / ?status=discarded for slices."""
    batches = prep_batch_service.list_batches(user.uid, status_filter=status)
    return {"batches": batches, "count": len(batches)}


@router.post("/batches")
async def create_prep_batch(
    body: dict, user: UserInfo = Depends(require_preppers),
):
    try:
        batch = prep_batch_service.create_batch(user.uid, body)
        return {"success": True, "batch": batch}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/batches/{bid}")
async def get_prep_batch(bid: str, user: UserInfo = Depends(require_preppers)):
    batch = prep_batch_service.get_batch(user.uid, bid)
    if not batch:
        raise HTTPException(404, "Prep batch not found")
    return batch


@router.put("/batches/{bid}/status")
async def set_prep_batch_status(
    bid: str, body: dict, user: UserInfo = Depends(require_preppers),
):
    """Body: {"status": "active"|"consumed"|"discarded", "notes"?: "..."}"""
    new_status = body.get("status")
    if not new_status:
        raise HTTPException(400, "status is required")
    try:
        batch = prep_batch_service.set_batch_status(
            user.uid, bid, new_status, notes=body.get("notes") or "",
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not batch:
        raise HTTPException(404, "Prep batch not found")
    return {"success": True, "batch": batch}


@router.delete("/batches/{bid}")
async def delete_prep_batch(bid: str, user: UserInfo = Depends(require_preppers)):
    if not prep_batch_service.delete_batch(user.uid, bid):
        raise HTTPException(404, "Prep batch not found")
    return {"success": True}
