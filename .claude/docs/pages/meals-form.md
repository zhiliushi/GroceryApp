# Recipe form (add / edit)

Routes: `/meals/new` and `/meals/:id/edit`
File: `backend/web-admin/src/pages/meals/RecipeFormPage.tsx`
Companion components:
`backend/web-admin/src/components/meals/IngredientAutocomplete.tsx`,
`backend/web-admin/src/components/meals/RecipeCostCard.tsx`,
`backend/web-admin/src/components/meals/RecipeHistoryModal.tsx`,
`backend/web-admin/src/components/meals/IngredientSocialRow.tsx`.
Parent page: [`meals.md`](meals.md).

## Purpose

Single form that handles both **create** (`/meals/new`) and **edit**
(`/meals/:id/edit`) — same layout, same fields, same submit button
copy that flips to "Update Recipe" when an ID is in the URL. The
form deliberately keeps required fields tiny (name + ≥ 1
ingredient) so that scanning a recipe photo or jotting a quick
note doesn't feel like data entry.

## Composition (render order)

1. Breadcrumb row — `← Meals / Edit Recipe` (or `Add Recipe`).
   Edit mode + homemaker.versioning flag → renders a 🕘 History
   button on the right that opens `<RecipeHistoryModal />`.
2. **"Scanned recipe — review and edit before saving" banner** —
   appears after a successful photo scan, until the user submits.
3. **"ⓘ How does the recipe form work?" expandable** — explains:
   - what the photo-scan button does (extracts name / ingredients
     / steps from a JPG or PNG; user reviews before save),
   - that **ingredient names** auto-link to either the user's
     catalog (priced) or the shared common-ingredients list,
   - that **quantity + unit** unlock partial-pack splits in the
     cook flow on `/meals`,
   - that the **cost estimate** card only renders once the recipe
     is saved (edit mode), and how to read it,
   - that **tags** are free-form, Enter-to-add.
4. **Form card** — single white-background container holding the
   fields below.
5. **📷 Scan Recipe Photo** button — `!isEdit && recipeOcrEnabled`
   only. The button label carries a `title=` tooltip with the
   accepted MIME types (`image/jpeg`, `image/png`) and what the
   scan extracts. While scanning, "Processing image…" pulses next
   to it.
6. **Recipe Name *** (required, max 100).
7. **Description** (optional, max 500).
8. **Servings** + **Prep Time (min)** in a 2-col grid. Both labels
   carry `title=` tooltips explaining the field's downstream use.
9. **Ingredients *** (required ≥ 1 with non-empty name). Each row:
   - `<IngredientAutocomplete />` — combined catalog + common
     suggestions with inline match-status. Autocomplete is its own
     component; we don't add tooltips inside it (would be noisy).
   - **Qty** (number) + **Unit** (free text) — both with `title=`
     tooltips clarifying they're optional + how the cook flow
     uses them.
   - 🗑 button to remove (with `title=` "Remove this ingredient").
   - **In edit mode + homemaker.social flag** → `<IngredientSocialRow />`
     mounts under the row, exposing star + pin actions.
10. **Steps (optional)** — numbered ordered list with add/remove.
11. **Tags** — chip list with inline add input. Label has `title=`
    explaining Enter-to-add; remove `×` and add input also tooltip'd.
12. `<RecipeCostCard recipeId={id} />` — edit mode only. Per-line
    state-indicator pills (`no purchase yet`, `common: X`, `free
    text`) each carry a `title=` tooltip explaining how to upgrade
    that line to a priced one.
13. **Actions row** — `Cancel` link → `/meals`, `Save Recipe` /
    `Update Recipe` button. Disabled until `canSave`
    (`name.trim().length >= 2 && ingredients.some(i => i.name.trim())`).
14. `<RecipeHistoryModal />` rendered when `historyOpen`.

## Ingredient autocomplete behaviour

Component: `IngredientAutocomplete.tsx`. Combines two sources:

- `useCatalog({ q, limit: 8 })` — user's personal catalog (priced
  items they've actually bought).
- `useCommonIngredients()` — curated seed list of generic recipe
  building blocks (`egg`, `santan`, `kicap manis`, etc.).

The component renders inline match-status under the row so the
cook can see whether their typed name will resolve at save time
and to what. Authoritative resolution still runs server-side at
save (Phase 0); the inline status is a hint only.

We deliberately don't tooltip inside `IngredientAutocomplete` —
the inline match-status copy already carries the explanation, and
adding a label-level `title=` would compete with the dropdown
behaviour.

## Photo scan (recipe OCR)

- Hidden when `flags.recipe_ocr === false`.
- Hidden in **edit** mode (we don't want to overwrite an
  already-saved recipe with OCR output).
- Accepts `image/jpeg`, `image/png`. Triggers
  `useScanRecipeImage()` → backend OCR → returns `parsed.name`,
  `parsed.ingredients[]`, `parsed.steps[]`.
- On success: pre-fills name (preserves whatever the user already
  typed), replaces ingredients + steps wholesale, sets
  `scannedBanner = true` so the blue "review and edit" banner
  shows.
- The button's `title=` tooltip restates this so users know what
  they're getting before tapping.

## Sort behaviour

Ingredients are stored in author-given order, but rendered in this
order:

1. Pinned (`pin_by` truthy) first.
2. Then by `stars.length` desc.
3. Then by original array index.

The `originalIdx` is preserved alongside the rendered row so
homemaker social mutations (star, pin) hit the right backend slot
regardless of render position. Save always uses the unsorted
state, so the user-typed order is preserved on the wire.

## Cost card (RecipeCostCard)

Only renders in edit mode (`isEdit && id`). Uses
`useRecipeCost(recipeId)`. Per-ingredient line states:

| State          | Render                                                      | Tooltip                                                                                  |
| -------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `priced`       | currency + relative date                                    | (no tooltip — the value is the explanation)                                              |
| `no_history`   | italic "no purchase yet"                                    | "Linked to your catalog, but you haven't logged a purchase price yet."                   |
| `common_only`  | italic "common: \<name>"                                    | "Matched to the shared common-ingredients list (no priced product). Add to your catalog to start tracking your own price." |
| `unlinked`     | italic "free text"                                          | "Couldn't match this name to anything. Edit the ingredient to use one from your catalog or the common list." |

Total label semantics:

- All lines priced → `RM 12.34`.
- Some lines priced → `≈ RM 12.34 (3 of 5 priced)` to flag the
  estimate as partial.
- Zero lines priced → `No price history yet`.

Disclaimer text comes from the backend (`data.disclaimer`) and is
rendered verbatim under the line list.

## Homemaker hooks

Two flags gate optional UI, both via `useHomemaker()` (per-user
gate × global flag):

- `homemaker.versioning` → 🕘 History button + `<RecipeHistoryModal />`.
- `homemaker.social` → `<IngredientSocialRow />` under each
  ingredient row in edit mode.

Both default off. Free / standard users see the bare form.

## Data sources

- `useQuery(['recipes', id])` — fetch existing recipe via
  `apiClient.get(API.MEALS_RECIPE(id))`. Enabled only in edit
  mode.
- `useCreateRecipe()` / `useUpdateRecipe()` — submit. Both
  navigate to `/meals` on success.
- `useScanRecipeImage()` — recipe OCR.
- `useFeatureFlags()` — gates the scan button.
- `useHomemaker()` — gates History + IngredientSocialRow.

## Known UI gaps

1. **Module-level `nextKey` counter** — `let nextKey = 0;` at
   `RecipeFormPage.tsx:19` is shared across instances. Single-form
   navigation is fine (the variable just keeps incrementing) but
   if two forms ever co-exist (e.g. side-by-side compare in a
   future feature) the keys could collide. Move into the
   component as `useRef(0)` if that ever ships.
2. **No autosave** — closing the tab loses everything that wasn't
   submitted. Acceptable for a small form; flag if the form grows.
3. **Description truncation** — single-line input, max 500 chars.
   No textarea. Long descriptions get awkwardly cropped on the
   recipe card. Consider switching to `<textarea>` with the same
   max length.

## Helper UX choices

- **One page-level expandable** — the form spans many concepts
  (autocomplete, OCR, partial-quantity splits, cost estimate,
  versioning) and beginners need a single place to read about
  them once. Section-level helpers would fragment the answer.
- **`title=` tooltips on field labels** rather than inline help
  text under each label — keeps the form vertically compact for
  mobile, where every line of help text pushes the Save button
  further down.
- **Cost-card line tooltips** are the most useful per-state
  helpers — the four states look almost identical at a glance,
  but each has a different remediation path (no purchase →
  buy and log; common only → add to catalog; free text → edit
  the name). Tooltip text says exactly what to do.

## Not on this page (by design)

- Recipe list / suggestions / cook flow — that's `/meals`.
- Per-ingredient brand history / store comparison — homemaker
  social row exposes lighter signals (stars, pins) but a richer
  per-ingredient drill is deferred.
- Bulk recipe import (CSV, URL) — not implemented.

## Update discipline

When adding a new recipe field:

1. Add the input to the form (decide create + edit, or edit-only).
2. Update the **Composition** section here.
3. If the field is non-obvious, add a `title=` to the label and
   mention it in the page-level helper expandable.
4. Update the `useCreateRecipe` / `useUpdateRecipe` payload
   shape and the backend recipe schema in lockstep.

When adding a new line state to the cost card:

1. Add the render branch in `RecipeCostCard.tsx`.
2. Add a row to the **Cost card** state table here.
3. Decide whether the new state needs a tooltip (most do — the
   point of the table is explaining how to fix the line).

When changing OCR support (e.g. accept HEIC):

1. Update the `accept=` attribute in the form.
2. Update the **Photo scan** section here AND the scan button's
   `title=` tooltip (currently lists JPG / PNG only).

When introducing a new homemaker sub-feature:

1. Add the flag pair in `feature-inventory.md`.
2. Wire it in `useHomemaker.ts` and consume here behind the
   matching gate.
3. Add a paragraph under **Homemaker hooks**.
