# Meals (recipe list + cook flow)

Route: `/meals`
File: `backend/web-admin/src/pages/meals/MealsPage.tsx`
Sister page: `/meals/new` and `/meals/:id/edit` →
`backend/web-admin/src/pages/meals/RecipeFormPage.tsx` (own doc
later).

## Purpose

Pivot from "what should I cook?" to "what am I about to throw
away?". The page surfaces saved recipes that match the user's
current inventory, prioritising recipes whose ingredients are about
to expire. Cooking a recipe through the in-page modal deducts those
ingredients from inventory in one shot — closing the loop between
food the user has and food the user uses.

## Composition (render order)

1. Header row — `<PageHeader title="Meals" icon="🍳" />` + the
   `+ Add Recipe` button (hidden when at the recipe limit).
2. **"ⓘ How does this page work?" expandable** — explains the
   suggestion threshold (≥ 50% match, expiring ingredients first),
   what the **match badge** and **🔥 Perfect match!** tag mean,
   what the cook buttons do (deduct from inventory, opens checklist
   first), and the free-tier limit on saved recipes.
3. **🔥 Cook These Now** section. Title carries a `title=` tooltip
   reinforcing the "uses what you already have" intent.
   - Loading: pulsing card with text.
   - Has matches: `<RecipeCard showMatchDetails />` per result.
   - Empty + has saved recipes: "No recipe matches right now —
     items are all fresh, or try recipes with more common
     ingredients."
   - Empty + zero saved recipes: friendly empty state with
     `+ Add Recipe` CTA.
4. **My Recipes (N/Limit)** section. Title carries a `title=`
   tooltip explaining the section. At-limit users see "Limit
   reached — upgrade for more" at the right.
   - Empty: friendly empty state.
   - Populated: 1/2/3-column grid of compact recipe cards (name,
     prep time, servings, ingredient count, optional description,
     Edit / Delete actions).
5. **AI Chef (Coming Soon)** placeholder card — opacity-60.
6. `<CookConfirmModal />` rendered when `cookingRecipe` state is
   set (see "Cook flow" below).

## Match algorithm

Backend single source: `match_recipes_to_inventory()` in
`backend/app/services/recipe_service.py:169`. Drives
`/api/meals/recipe-suggestions` via `useRecipeSuggestions()`.

Per-ingredient match logic (`recipe_service.py:199-218`):

- **Name match** — case-insensitive substring either way:
  `ing_name in item_name OR item_name in ing_name`. So an
  ingredient `"tomato"` matches inventory `"cherry tomato"` and
  vice versa.
- **Category fallback** — when the recipe ingredient and the
  inventory item both have a `category`, a containment match on
  that field also counts. Useful for generic ingredients like
  "vegetable" matching anything tagged in the produce category.

Per-recipe scoring:

- `match_score = matched / total` ingredients.
- `expiring_match_count` = matched ingredients whose linked
  inventory item has `expiry_date` within 7 days (`SEVEN_DAYS_MS`).
- **Suggestion threshold**: `match_score >= 0.5`. Recipes below
  that don't appear in **🔥 Cook These Now** at all.
- **Sort order**: `(-expiring_match_count, -match_score)`. Recipes
  with the most expiring ingredients first, then by overall match
  quality. So "all 5/5 expiring soon" wins over "all 8/8 fresh".

Match details returned per ingredient include
`inventory_item_id`, `inventory_quantity`, `inventory_location`,
`expiring`, and `expiry_text` so the UI can show "❌ in fridge",
"⚠️ 2 days left", etc. without a second round-trip.

## Suggestion card (`RecipeCard`)

Used only on this page (grep-confirmed). Visual cues:

- **Border tint**: orange when any matched ingredient is expiring,
  default border otherwise.
- **🔥 Perfect match!** chip (orange) — `allMatched && hasExpiring`
  — every ingredient in stock AND at least one expiring. Carries a
  `title=` tooltip restating the rule for hover users.
- **Match badge** (e.g. `5/5`) — green at 100%, neutral otherwise.
  Tooltip: `"5 of 5 ingredients are in your inventory."`
- **Per-ingredient list** (`showMatchDetails`) — `✅ name (qty
  unit) ⚠️ expiry text` for matched-and-expiring; `❌ name`
  greyed-out for missing.
- **"Missing: a, b, c"** line when there's anything not in
  inventory.
- **Cook button** — copy depends on `allMatched`:
  - Yes → `🍳 Cook & Mark All Used` (green)
  - No → `Cook with what you have` (accent-tinted)
  Both buttons carry `title=` tooltips clarifying that confirming
  *will deduct from inventory* — the modal lets the user uncheck
  before confirming, but the side-effect is the headline.

## Cook flow (`CookConfirmModal`)

Triggered by setting `cookingRecipe` state from a card's
`onCook` handler.

- Pre-checks every matched ingredient by default; user toggles to
  skip any they're saving for later.
- Confirm runs one `POST /api/purchases/{id}/status` per checked
  ingredient with `status="used"`, `reason="used_up"`. If the
  recipe needs *less* than the inventory has on hand, the request
  includes `quantity` and the backend splits the purchase event;
  otherwise the whole event is consumed (CookConfirmModal:48-62).
- Failed individual updates are logged to the console, not
  surfaced — only the aggregate success/error toast shows.
- Modal close clears `cookingRecipe`. Successful cook also
  invalidates the recipes / suggestions / purchases query keys via
  the underlying mutation hook, so the suggestion list refreshes.

## Data sources

- `useRecipes()` — `/api/meals/recipes`. Drives the **My Recipes**
  grid + `recipeCount` / `recipeLimit` for the limit display.
- `useRecipeSuggestions()` — `/api/meals/recipe-suggestions`.
  Wraps `match_recipes_to_inventory`. Lazy-loaded; the loading
  card displays while it resolves.
- `useDeleteRecipe()` — `DELETE /api/meals/recipes/:id`. Wired
  through `useConfirmDialog` for the delete action on each card.
- `useChangePurchaseStatus()` — used by the cook modal to deduct
  inventory.

## Helper UX choices

- **One page-level expandable** — the match algorithm is
  non-obvious (50% threshold, expiring-first sort). One pinned
  explainer beats five scattered tooltips for users who don't yet
  know what they're looking at.
- **Section-heading tooltips** — "🔥 Cook These Now" and "My
  Recipes (N/M)" each get a `title=`, so a hover reveals the
  intent without expanding the helper.
- **Cook button tooltip is the loud one** — these buttons have a
  side-effect on inventory state, and the modal can be confirmed
  in one tap. The tooltip surfaces the consequence on the trigger
  itself.
- **No tooltips on per-ingredient ✅ / ❌ rows** — the icons +
  label text are already self-explanatory. Adding tooltips would
  be noise.

## Limits + tier handling

- `recipes.count` and `recipes.limit` come from the backend
  (`useRecipes` returns them). When `count >= limit`:
  - The `+ Add Recipe` button hides at the top of the page.
  - The "My Recipes" header shows `Limit reached — upgrade for
    more`.
  - The empty-state CTAs in **🔥 Cook These Now** still link to
    `/meals/new` — the form itself enforces the limit on save,
    not the link.
- Free-tier limit is currently **15** (`recipeLimit ?? 15` default
  in `MealsPage.tsx:22`). If this changes, sync `feature-inventory.md`
  and the "Limit reached" UX wording.

## Not on this page (by design)

- Recipe authoring — `/meals/new`, `/meals/:id/edit` (own doc
  later).
- Per-ingredient cost analysis — lives inside the recipe form's
  cost card.
- Inventory drill-down on a matched ingredient — the cook modal
  shows location + qty inline, but if the user wants to see the
  whole event history they go to `/my-items/:eventId` via the
  catalog page.

## Update discipline

When changing the suggestion threshold (`match_score >= 0.5` in
`recipe_service.py:253`):

1. Update **Match algorithm** here.
2. Update the page-level helper's "≥ 50%" wording.
3. Verify the empty-state copy still makes sense at the new
   threshold.

When changing the expiring window (currently `SEVEN_DAYS_MS`):

1. Update **Match algorithm** + helper paragraph.
2. Mirror the window in `dashboard.md` "Expiring" semantics if it
   should align (currently the dashboard uses 3-day urgency and
   7-day soft-expiring — separate concept; only update if you're
   unifying).

When the AI Chef placeholder ships:

1. Replace the `opacity-60` block with the real surface.
2. Add a section under **Composition (render order)** here.
3. Document its data source + side effects.

When the recipe limit changes:

1. Confirm the backend response actually carries the new limit
   (`recipes.limit`).
2. Update **Limits + tier handling** here and the matching tier
   row in `feature-inventory.md`.
