# FUTURE: Household Catalog Merging

**Status:** Deferred. Household members currently have separate catalogs; inventory is merged at query time but catalog entries stay per-user. Full household catalog sharing is a design challenge worth its own phase.

## Current behaviour

Households share **purchase events** (via `users/{uid}/purchases` + `household_id` field — inventory queries merge across members).

Catalog entries stay **per-user** (`catalog_entries/{uid}__{name_norm}`).

Result:
- Papa has `papa_uid__milk` with his preferred "Milk"
- Mama has `mama_uid__milk` with her preferred "Susu"
- Household inventory view shows both sets of purchases, each attributed to its member
- No cross-member catalog sharing

## Problem

If both Papa and Mama add "Milk" independently, they don't share:
- A common display name
- A default location
- A linked barcode
- Purchase history

This creates inconsistency in household view and duplicates effort.

## Design options

### Option A: Household-level catalog (shared)

New collection `households/{household_id}/catalog/{name_norm}` — catalog scoped to household, not user.

Pros:
- Single shared catalog
- Changes propagate to all members
- No duplicate entries

Cons:
- Breaking change — existing per-user catalogs need migration
- Members lose individual preferences (display name, default location)
- Solo users unaffected but complicates code

### Option B: Per-user with household-wide autocomplete

Keep `catalog_entries/{uid}__{name_norm}`. But in autocomplete, search across all household members' catalogs. When user picks someone else's catalog entry → auto-create a copy in their own catalog (one-time import).

Pros:
- Non-breaking
- Preserves individual preferences
- Reduces duplicate creation

Cons:
- Still duplicates data (just saves re-typing)
- "Who changed what" tracking per-user

### Option C: Hybrid — personal catalogs + household-level aggregation view

Keep per-user. Add household view that aggregates:
- "Household catalog" = union of all members' catalogs grouped by `name_norm`
- Members see merged counts + purchase history
- Optionally: one designated "household owner" can promote entries to a shared list with canonical name

Pros:
- Non-breaking
- Shows household-level insights
- Respects individual autonomy

Cons:
- More complex queries
- UI needs explicit "household view" toggle

## Recommended: Option C

Incremental, non-breaking, gives users visibility without forcing merge.

## Implementation sketch

### New backend endpoints

```
GET /api/household/catalog              # aggregated view across members
GET /api/household/catalog/{name_norm}  # all members' entries for this name
POST /api/household/catalog/promote     # owner-only: canonicalize name across household
```

### New UI

- MyItemsPage gets toggle: `[My Items] [Household Items]` (already exists partially)
- Add toggle: `[My Catalog] [Household Catalog]`
- Household view shows grouped entries: "Milk · 3 members (Papa: Milk, Mama: Susu, Brother: milk)"
- Owner can tap → "Promote 'Milk' as canonical for household"
- Promotion writes `households/{id}/catalog_canonical/{name_norm}` — members' autocomplete prefers canonical names

### Data model additions

```yaml
households/{id}/catalog_canonical/{name_norm}:
  canonical_display: str      # e.g. "Milk"
  promoted_by: uid            # owner who set it
  promoted_at: timestamp
  member_aliases: [uid: str]  # who had different names
```

Non-destructive — members keep their per-user catalog; canonical is just a suggestion layer.

## Migration concerns

Existing households with per-user catalogs:
- Option C requires no migration (additive layer)
- Option A would need a one-time batch job to merge per-user → household catalog, preserving member attribution

## Edge cases

- **Member leaves household** → their catalog entries remain personal (they take their data with them)
- **Household dissolves** → canonical catalog deleted, per-user catalogs untouched
- **New member joins** → sees household canonical catalog, auto-suggests canonical names during their QuickAdd
- **Owner promotes "Milk" but member insists on "Susu"** → canonical is suggestion only, member can override

## Feature flag

`app_config/features.household_catalog_merge` — off by default.

## Estimated effort

- Backend: 2-3 days (new endpoints, aggregation logic)
- Frontend: 2-3 days (household view toggle, promote UX)
- Total: ~1 week

## When to build

After households feature sees heavy usage (several users actively sharing). Prioritise based on user feedback. Not urgent for solo users (the majority).
