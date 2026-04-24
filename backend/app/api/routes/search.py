"""Federated search across the user's catalog, active purchases, and recipes.

Powers the GlobalSearchBar (Cmd/Ctrl+K). Single request, grouped response.

GET /api/search?q=mil
  {
    "query": "mil",
    "catalog": [CatalogEntry, ...],        # user's catalog, prefix match
    "purchases_active": [PurchaseEvent...], # active events whose catalog matches
    "recipes": [{id, title, ...}, ...],     # recipe title substring match
  }
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.core.auth import UserInfo, get_current_user
from app.services import catalog_service, purchase_event_service, recipe_service

logger = logging.getLogger(__name__)

router = APIRouter()

_MAX_PER_GROUP = 10


@router.get("")
async def federated_search(
    q: str = Query("", min_length=0, max_length=100),
    user: UserInfo = Depends(get_current_user),
) -> dict[str, Any]:
    """Federated search across catalog + active purchases + recipes.

    Returns up to 10 items per group. Empty query returns empty groups.
    """
    q_trimmed = q.strip()
    if not q_trimmed:
        return {"query": "", "catalog": [], "purchases_active": [], "recipes": []}

    # 1. Catalog — prefix match on name_norm (Firestore range query)
    catalog_page = catalog_service.list_catalog(
        user_id=user.uid,
        query=q_trimmed,
        limit=_MAX_PER_GROUP,
        sort_by="last_purchased_at",
    )
    catalog_entries = catalog_page["items"]

    # 2. Purchases — for each matched catalog entry, the active events
    # Batch strategy: collect name_norms from catalog matches, then filter
    # the active purchases list for those names. Avoids a per-name N+1.
    matched_norms = {e.get("name_norm") for e in catalog_entries if e.get("name_norm")}

    purchases_active: list[dict] = []
    if matched_norms:
        # Fetch first page of active purchases, filter in-memory by matched norms.
        # For users with very large active sets, this still caps at 500 reads.
        active_page = purchase_event_service.list_purchases(
            user_id=user.uid,
            status="active",
            limit=200,
        )
        for event in active_page["items"]:
            if event.get("catalog_name_norm") in matched_norms:
                purchases_active.append(event)
                if len(purchases_active) >= _MAX_PER_GROUP:
                    break

    # 3. Recipes — simple substring match on title (client-side)
    q_lower = q_trimmed.lower()
    recipe_matches: list[dict] = []
    try:
        for recipe in recipe_service.list_recipes(user.uid):
            title = (recipe.get("title") or "").lower()
            if q_lower in title:
                recipe_matches.append(
                    {
                        "id": recipe.get("id"),
                        "title": recipe.get("title"),
                        "cuisine": recipe.get("cuisine"),
                        "image_url": recipe.get("image_url"),
                    }
                )
                if len(recipe_matches) >= _MAX_PER_GROUP:
                    break
    except Exception as exc:
        # Don't fail the whole search if recipes are unavailable
        logger.warning("search: recipe lookup failed: %s", exc)

    return {
        "query": q_trimmed,
        "catalog": catalog_entries,
        "purchases_active": purchases_active,
        "recipes": recipe_matches,
    }
