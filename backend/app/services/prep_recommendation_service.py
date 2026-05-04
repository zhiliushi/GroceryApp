"""Preppers recommendation engine — "worth keeping in rotation".

Uses the user's saved cooking recipes (`users/{uid}/recipes`) + their
frequently-bought catalog entries (top 30 by `total_purchases`) as
signal pool, then scores each common preserve by how many of its
ingredients overlap. Top N (default 5) preserves the user doesn't
already have an active batch for are surfaced as recommendations.

This is the original pillar of the preppers tier per the scope memo:
"Recommends purchases based on frequent-meals analysis." First-cut
algorithm is binary-overlap scoring (count of matched ingredients).
Future iterations could weight by purchase frequency or recency.

References — preppers_principles.md (archetype B / hobbyist preserver).
NCHFP / Ball / Sandor Katz inform the underlying preserve metadata,
not the matching logic itself.

Phase P11 of preppers.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, Iterable, List, Set

from app.services import (
    catalog_service,
    common_preserves_service,
    prep_batch_service,
    recipe_service,
)

logger = logging.getLogger(__name__)

DEFAULT_TOP_K = 5
FREQUENT_CATALOG_TOP_N = 30


def _norm(s: str) -> str:
    return (s or "").strip().lower()


# Tokenizer for bug-3 fix: split on whitespace + common punctuation so
# "Santan (coconut milk)" → {santan, coconut, milk} and "kicap manis" →
# {kicap, manis}. Empty strings are dropped.
_TOKEN_SPLITTER = re.compile(r"[\s,/&()\[\]\-+]+")


def _tokens(s: str) -> Set[str]:
    if not s:
        return set()
    return {t for t in _TOKEN_SPLITTER.split(_norm(s)) if t}


def _stem(token: str) -> str:
    """Cheap pluralization stemmer — handles English -ies/-es/-s endings.
    Not a real stemmer; just enough to make egg ↔ eggs and tomato ↔
    tomatoes match.

    Edge cases left alone (over-stemming risk):
      - 3-char tokens (so "gas" doesn't become "ga")
      - irregular plurals (mouse/mice, leaf/leaves) — too rare in
        ingredient names to be worth a lookup table
    """
    if len(token) <= 3:
        return token
    if token.endswith("ies") and len(token) > 4:
        return token[:-3] + "y"          # cherries → cherry
    if token.endswith("oes") or token.endswith("xes") or token.endswith("ses"):
        return token[:-2]                # tomatoes → tomato, foxes → fox
    if token.endswith("es") and len(token) > 4:
        return token[:-2]                # leaves → leav (acceptable; matches itself)
    if token.endswith("s") and not token.endswith("ss"):
        return token[:-1]                # eggs → egg, but not "glass"
    return token


def _names_from_cooking_recipes(uid: str) -> Set[str]:
    """All ingredient names appearing in the user's saved cooking recipes,
    normalised. Empty set if the user has no recipes."""
    out: Set[str] = set()
    try:
        recipes = recipe_service.list_recipes(uid)
    except Exception:
        return out
    for r in recipes or []:
        for ing in r.get("ingredients", []) or []:
            if isinstance(ing, dict):
                n = _norm(ing.get("name") or "")
            else:
                n = _norm(str(ing))
            if n:
                out.add(n)
    return out


def _frequent_catalog_names(uid: str, top_n: int = FREQUENT_CATALOG_TOP_N) -> Set[str]:
    """Top-N catalog entries by total_purchases — names + name_norm forms.
    Used as a secondary signal source when the user has thin cooking-recipe
    coverage but a richer purchase history."""
    out: Set[str] = set()
    try:
        result = catalog_service.list_catalog(
            user_id=uid, sort_by="total_purchases", limit=top_n,
        )
    except Exception:
        return out
    for entry in (result or {}).get("items", []) or []:
        for fld in ("display_name", "name_norm"):
            n = _norm(entry.get(fld) or "")
            if n:
                out.add(n)
    return out


def _matches(needle: str, signals: Iterable[str]) -> bool:
    """needle (preserve ingredient) matches any signal in the pool.

    Token-aware exact match with cheap pluralization stemming. Replaces
    the prior bidirectional-substring approach that generated false
    positives like `egg` matching `eggplant`. Two strings match when at
    least one stemmed token is shared between them.

    Examples:
      `egg`           vs `eggplant`             → no  (correct fix)
      `egg`           vs `eggs`                 → yes (plural-tolerant)
      `santan`        vs `Santan (coconut milk)`→ yes (token boundary)
      `kicap manis`   vs `kicap`                → yes (partial token match)
      `tomato`        vs `tomatoes`             → yes (-oes stemmer)
      `salt`          vs `sea salt`             → yes (token boundary)
    """
    n_tokens = {_stem(t) for t in _tokens(needle)}
    if not n_tokens:
        return False
    for s in signals:
        s_tokens = {_stem(t) for t in _tokens(s)}
        if n_tokens & s_tokens:
            return True
    return False


def compute_recommendations(uid: str, top_k: int = DEFAULT_TOP_K) -> Dict[str, Any]:
    """Score and rank common preserves for the user.

    Returns:
        {
          recommendations: [
            {
              preserve: {name_norm, display_name, prep_type,
                         default_ready_after_hours, default_shelf_life_days,
                         description},
              score: int,                  # number of matched ingredients
              matched_ingredients: [str],  # which preserve ingredients hit
              match_sources: {
                from_recipes: [str],
                from_catalog: [str],
              },
              reasoning: str,
            }
          ],
          user_signal_count: int,           # size of combined signal pool
          recipe_ingredient_count: int,
          frequent_catalog_count: int,
          explanation: str,
        }

    Excludes preserves the user already has an active batch for.
    Returns empty list with an explanation when the user's signal pool
    is empty (new account, no cooking recipes, no purchase history).
    """
    recipe_names = _names_from_cooking_recipes(uid)
    frequent_names = _frequent_catalog_names(uid)
    signal_pool = recipe_names | frequent_names

    active = prep_batch_service.list_batches(uid, status_filter="active")
    excluded_refs: Set[str] = {
        (b.get("common_preserve_ref") or "")
        for b in (active or [])
        if b.get("common_preserve_ref")
    }

    preserves = common_preserves_service.list_all() or []
    scored: List[Dict[str, Any]] = []

    if not signal_pool:
        return {
            "recommendations": [],
            "user_signal_count": 0,
            "recipe_ingredient_count": 0,
            "frequent_catalog_count": 0,
            "explanation": (
                "Add a few cooking recipes (Meals page) or build up your "
                "purchase history to see personalized preserve suggestions."
            ),
        }

    for p in preserves:
        if p.get("name_norm") in excluded_refs:
            continue
        ingredients = p.get("ingredients") or []
        if not ingredients:
            continue
        matched = [ing for ing in ingredients if _matches(ing, signal_pool)]
        if not matched:
            continue
        from_recipes = [ing for ing in matched if _matches(ing, recipe_names)]
        from_catalog_only = [
            ing for ing in matched
            if _matches(ing, frequent_names) and ing not in from_recipes
        ]
        snippet = ", ".join(matched[:3]) + ("…" if len(matched) > 3 else "")
        scored.append({
            "preserve": {
                "name_norm": p.get("name_norm"),
                "display_name": p.get("display_name"),
                "prep_type": p.get("prep_type"),
                "default_ready_after_hours": p.get("default_ready_after_hours"),
                "default_shelf_life_days": p.get("default_shelf_life_days"),
                "description": p.get("description") or "",
            },
            "score": len(matched),
            "matched_ingredients": matched,
            "match_sources": {
                "from_recipes": from_recipes,
                "from_catalog": from_catalog_only,
            },
            "reasoning": f"Matches {len(matched)} of your items: {snippet}",
        })

    # Sort: highest score first, ties broken alphabetically by display_name.
    scored.sort(
        key=lambda r: (-r["score"], _norm(r["preserve"]["display_name"])),
    )

    explanation = (
        f"{len(scored)} preserve{'s' if len(scored) != 1 else ''} matched "
        f"your cooking recipes ({len(recipe_names)} ingredients) and "
        f"frequent-buy items ({len(frequent_names)} entries). "
        "Showing top matches not already in your active batches."
        if scored else
        "No common preserves matched your current cooking recipes or "
        "frequent purchases. Try adding more cooking recipes for richer "
        "suggestions, or browse the common presets section directly."
    )

    return {
        "recommendations": scored[:top_k],
        "user_signal_count": len(signal_pool),
        "recipe_ingredient_count": len(recipe_names),
        "frequent_catalog_count": len(frequent_names),
        "explanation": explanation,
    }
