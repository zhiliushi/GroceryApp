"""Preppers cost-per-serving + savings rollup.

Wraps the existing F1 cooking-recipe finance helper
(`recipe_finance_service.estimate_recipe_cost`) for prep recipes and
batches, adds per-serving math, and folds in a user-entered
store-bought reference price to surface "RM 2/serving home vs RM 8
store" style savings analytics.

Per preppers principles
(`.claude/docs/preppers_principles.md` § Design Principles):

- P3 (Transparency): every cost number ships with reasoning — which
  ingredients matched, which didn't, why the total is partial.
- P4 (Defer on safety / cite the source): home cost comes from the
  user's own purchase history (the `recipe_finance_service` source);
  store reference is user-entered (their own knowledge).
- P5 (Conservative bias): partial home cost is reported with a `+`
  suffix in the response shape so UI can mark "RM 1.25+/serving" — the
  real cost is at least this much, often more. Never underestimate.
- P6 (User input authoritative): store_reference_price is per-recipe
  (and overridable per-batch), always optional, never auto-derived.
- P7 (Empty states first-class): four distinct explanation strings
  (no_ingredients / no_priced / partial / full).

Phase P12 of preppers.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.services import (
    prep_batch_service,
    prep_recipe_service,
    recipe_finance_service,
)

logger = logging.getLogger(__name__)


def _compute_cost_for_ingredients(
    uid: str,
    ingredients: List[Dict[str, Any]],
    servings: int,
    store_reference_price: Optional[float],
    store_reference_servings: Optional[int],
    store_reference_label: str,
) -> Dict[str, Any]:
    """Core cost math. Reused by recipe and batch endpoints.

    Returns a transparent breakdown:
      home_total_cost, home_cost_per_serving, partial,
      priced_count, total_count,
      store_total_cost, store_cost_per_serving,
      savings_per_serving (when both sides available),
      lines (per-ingredient breakdown),
      explanation, currency.
    """
    if servings is None or servings <= 0:
        servings = 1  # avoid division-by-zero; UI flags this elsewhere

    estimate = recipe_finance_service.estimate_recipe_cost(uid, ingredients)
    currency = estimate["currency"]
    home_total = estimate["total_cost"]            # None if zero priced
    partial = estimate["total_is_partial"]
    priced = estimate["priced_count"]
    total = estimate["total_count"]
    lines = estimate["lines"]

    home_per_serving = (
        round(home_total / servings, 2)
        if home_total is not None
        else None
    )

    # Store-side math — only produces a number when the user supplied
    # both price and servings.
    store_per_serving: Optional[float] = None
    store_total_for_batch: Optional[float] = None
    if (
        store_reference_price is not None
        and store_reference_servings is not None
        and store_reference_servings > 0
    ):
        store_per_serving = round(
            store_reference_price / store_reference_servings, 2,
        )
        store_total_for_batch = round(store_per_serving * servings, 2)

    # Savings — only when both sides exist AND home cost isn't partial.
    # P5 (conservative bias): we don't surface a savings number when
    # home cost might be under-reported. Showing "Savings: RM 5" when
    # we only priced 2 of 5 ingredients overstates the win.
    savings_per_serving: Optional[float] = None
    if (
        home_per_serving is not None
        and store_per_serving is not None
        and not partial
    ):
        savings_per_serving = round(store_per_serving - home_per_serving, 2)

    # Explanation — P7 first-class empty states.
    if total == 0:
        explanation = "No ingredients listed yet — add ingredients to see cost."
    elif priced == 0:
        explanation = (
            f"None of the {total} ingredient{'s' if total != 1 else ''} "
            "matched your purchase history yet. Buy them and the cost "
            "estimate will populate automatically."
        )
    elif partial:
        explanation = (
            f"Partial estimate — {priced} of {total} ingredients priced "
            f"from your buy history. Real home cost is at least "
            f"{home_per_serving}/serving (more if unpriced ingredients are "
            "non-trivial)."
        )
    else:
        if savings_per_serving is None:
            explanation = (
                f"Home cost: {home_per_serving}/serving across "
                f"{total} priced ingredient{'s' if total != 1 else ''}. "
                "Set a store reference price on the recipe to compare."
            )
        elif savings_per_serving > 0:
            explanation = (
                f"Saving {savings_per_serving}/serving — home "
                f"{home_per_serving} vs store {store_per_serving}."
            )
        elif savings_per_serving < 0:
            explanation = (
                f"Home costs {-savings_per_serving}/serving more than "
                f"store-bought ({home_per_serving} vs {store_per_serving}). "
                "Niche ingredients or small-batch overhead can flip this."
            )
        else:
            explanation = (
                f"Break-even with store-bought ({home_per_serving}/serving)."
            )

    return {
        "currency": currency,
        "servings": servings,
        "home_total_cost": home_total,
        "home_cost_per_serving": home_per_serving,
        "partial": partial,
        "priced_count": priced,
        "total_count": total,
        "store_reference_price": store_reference_price,
        "store_reference_servings": store_reference_servings,
        "store_reference_label": store_reference_label,
        "store_total_for_batch": store_total_for_batch,
        "store_cost_per_serving": store_per_serving,
        "savings_per_serving": savings_per_serving,
        "lines": lines,
        "explanation": explanation,
    }


def estimate_recipe_cost(uid: str, recipe_id: str) -> Optional[Dict[str, Any]]:
    """Cost breakdown for one prep recipe template."""
    recipe = prep_recipe_service.get_recipe(uid, recipe_id)
    if recipe is None:
        return None
    return _compute_cost_for_ingredients(
        uid,
        ingredients=recipe.get("ingredients") or [],
        servings=int(recipe.get("servings") or 1),
        store_reference_price=recipe.get("store_reference_price"),
        store_reference_servings=recipe.get("store_reference_servings"),
        store_reference_label=recipe.get("store_reference_label") or "",
    )


def estimate_batch_cost(uid: str, batch_id: str) -> Optional[Dict[str, Any]]:
    """Cost breakdown for one batch, using the snapshot ingredients
    captured at start time."""
    batch = prep_batch_service.get_batch(uid, batch_id)
    if batch is None:
        return None
    # Per-batch store ref overrides recipe ref when set; otherwise we
    # walk the parent recipe (if any) for its store_reference_price.
    store_price = batch.get("store_reference_price")
    store_servings = batch.get("store_reference_servings")
    store_label = batch.get("store_reference_label") or ""
    if store_price is None and batch.get("recipe_id"):
        parent = prep_recipe_service.get_recipe(uid, batch["recipe_id"])
        if parent:
            store_price = parent.get("store_reference_price")
            store_servings = parent.get("store_reference_servings")
            store_label = parent.get("store_reference_label") or store_label
    return _compute_cost_for_ingredients(
        uid,
        ingredients=batch.get("ingredients_snapshot") or [],
        servings=int(batch.get("servings") or 1),
        store_reference_price=store_price,
        store_reference_servings=store_servings,
        store_reference_label=store_label,
    )


def compute_active_savings_rollup(uid: str) -> Dict[str, Any]:
    """Aggregate cost + savings across all active batches.

    Walks each active batch, computes its cost via estimate_batch_cost,
    and rolls up:
      - total home cost (across all priced batches)
      - total store cost (across batches with store ref)
      - total savings (across batches that contribute to BOTH sides)
      - total servings
      - per-serving rollups (sums divided by servings)

    Returns four-state explanation per P7 (no_batches / no_priced /
    partial_priced / fully_priced).
    """
    batches = prep_batch_service.list_batches(uid, status_filter="active")
    out: Dict[str, Any] = {
        "currency": None,
        "active_batches_count": len(batches),
        "fully_priced_count": 0,
        "partially_priced_count": 0,
        "with_store_reference_count": 0,
        "with_savings_count": 0,
        "total_home_cost": 0.0,
        "total_store_cost": 0.0,
        "total_savings": 0.0,
        "total_servings": 0,
        "home_cost_per_serving": None,
        "store_cost_per_serving": None,
        "savings_per_serving": None,
        "batches": [],
        "explanation": "",
    }

    if not batches:
        out["explanation"] = (
            "No active batches yet. Start one from a recipe or common "
            "preset to see cost-per-serving and savings vs store-bought."
        )
        return out

    for b in batches:
        cost = estimate_batch_cost(uid, b["id"])
        if cost is None:
            continue
        out["currency"] = out["currency"] or cost["currency"]
        out["total_servings"] += int(b.get("servings") or 0)

        if cost["home_total_cost"] is not None:
            if cost["partial"]:
                out["partially_priced_count"] += 1
            else:
                out["fully_priced_count"] += 1
            out["total_home_cost"] += cost["home_total_cost"]

        if cost["store_total_for_batch"] is not None:
            out["with_store_reference_count"] += 1
            out["total_store_cost"] += cost["store_total_for_batch"]

        # Savings — only count batches with savings_per_serving (i.e.,
        # full-priced AND store-ref'd).
        if cost["savings_per_serving"] is not None:
            out["with_savings_count"] += 1
            out["total_savings"] += cost["savings_per_serving"] * int(
                b.get("servings") or 0,
            )

        out["batches"].append({
            "id": b["id"],
            "name": b.get("name"),
            "prep_type": b.get("prep_type"),
            "servings": b.get("servings"),
            "home_cost_per_serving": cost["home_cost_per_serving"],
            "store_cost_per_serving": cost["store_cost_per_serving"],
            "savings_per_serving": cost["savings_per_serving"],
            "partial": cost["partial"],
        })

    if out["total_servings"] > 0 and out["total_home_cost"] > 0:
        out["home_cost_per_serving"] = round(
            out["total_home_cost"] / out["total_servings"], 2,
        )
    if out["total_servings"] > 0 and out["total_store_cost"] > 0:
        out["store_cost_per_serving"] = round(
            out["total_store_cost"] / out["total_servings"], 2,
        )
    if (
        out["with_savings_count"] > 0
        and out["total_servings"] > 0
    ):
        # Savings-per-serving is averaged across the WHOLE active stockpile
        # (not just the batches with savings) — that's the user-level
        # signal: "your stockpile saves you on average X/serving."
        out["savings_per_serving"] = round(
            out["total_savings"] / out["total_servings"], 2,
        )

    # P7 — explanation per state.
    if out["fully_priced_count"] == 0 and out["partially_priced_count"] == 0:
        out["explanation"] = (
            "Active batches exist but no ingredients have matched your "
            "purchase history yet. Cost rollup will populate as you log "
            "purchases for the ingredients."
        )
    elif out["with_savings_count"] == 0:
        out["explanation"] = (
            f"Tracking home cost across "
            f"{out['fully_priced_count'] + out['partially_priced_count']} "
            "priced batches. Set store reference prices on recipes to see "
            "savings vs store-bought."
        )
    else:
        savings_text = (
            f"Saving {out['savings_per_serving']}/serving on average "
            if out["savings_per_serving"] and out["savings_per_serving"] > 0
            else f"Home costs more than store on average "
            if out["savings_per_serving"] and out["savings_per_serving"] < 0
            else "Break-even with store on average "
        )
        out["explanation"] = (
            savings_text +
            f"across {out['with_savings_count']} of "
            f"{out['active_batches_count']} active batches "
            f"({out['fully_priced_count']} fully priced, "
            f"{out['partially_priced_count']} partial)."
        )

    # Round monetary totals
    out["total_home_cost"] = round(out["total_home_cost"], 2)
    out["total_store_cost"] = round(out["total_store_cost"], 2)
    out["total_savings"] = round(out["total_savings"], 2)
    return out
