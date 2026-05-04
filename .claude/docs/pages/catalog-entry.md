# Catalog entry detail

Route: `/catalog/:nameNorm`
File: `backend/web-admin/src/pages/catalog/CatalogEntryPage.tsx`
Parent page: [`catalog.md`](catalog.md) (`/catalog`).
Backend: `backend/app/services/catalog_service.py` +
`backend/app/services/catalog_overview_service.py`.

## Purpose

The deepest single-item view in the app. One catalog entry → every
purchase event ever made of it, every store you bought it from,
the cadence at which you buy, where it sits right now, and the
levers to act on the most-pressing thing about it.

The page leans heavily on a single backend aggregator
(`get_catalog_overview`) so all the rich panels share one
round-trip and one cache key.

## Composition (render order)

1. Breadcrumbs — Dashboard › My Catalog › *display_name*.
2. `← My Catalog` back link (redundant with breadcrumb but matches
   the rest of the app's drill-down convention).
3. **"ⓘ What's on this page?" expandable** — overview of the eight
   sections below so a first-time visitor doesn't get lost.
4. **Header card** — single white container holding everything
   below.
5. **Title row** — `display_name` (click to edit inline), barcode,
   country code, optional **Needs review** chip with a `title=`
   tooltip explaining what triggered the flag (usually an
   un-actioned 21-day reminder; see `nudge_service.scan_reminders()`).
6. **HeroActionBar** — the most-important block on the page. Picks
   one of five tones (red / orange / accent / orange / quiet) based
   on `buildHeroBanner()` priority order:
   1. `expired` — any `soonest_expiry < now` → red banner.
   2. `expiring ≤ 3d` → orange banner with countdown.
   3. `predicted_next_buy_in_days <= 0` → accent "Restock due".
   4. `lifetime_breakdown.active_qty <= 1` → orange "Almost out".
   5. `active_qty == 0` → accent "Out of stock".
   6. Healthy → quiet "N on hand · all fresh".
   Always renders `+ Buy more` (opens QuickAddModal pre-filled).
   Renders `✓ Use…` only when `useTargetAvailable` (an active
   event exists), and the modal target is `overallMostUrgentEventId`
   — re-picked here from `current_locations` by soonest expiry.
7. **`<AddToShoppingListButton />`** — one-tap drop into a
   shopping list (right-aligned).
8. **4-stat tile row** — `Times bought` / `Open packs` / `Total on
   hand` / `Last bought`. Each tile has its own `hint` paragraph
   (the `Stat` component embeds the layman explanation under the
   number).
9. **Split-events note** (conditional) — when
   `total_event_count != logical_purchase_count`, surfaces "N
   additional split events from partial actions — visible in
   lineage tree below" so the difference between the stat and the
   timeline is explained inline.
10. **Currently stored** section — `<CurrentLocations />`. Per-spot
    Use / Move buttons (open `<MarkUsedModal />` /
    `<MoveLocationModal />` for the most-urgent event in that
    location).
11. **Your patterns** section — `<ItemPatterns />`. Cadence, waste
    cost, waste rate based on the user's history.
12. **Where you've bought it** (conditional) — `<PriceHistoryTable />`
    only when `price_history_per_store.length > 0`. Cheapest first.
13. **Lifetime breakdown** — collapsible. Reference data; closed
    by default.
14. **Recent activity** — collapsible. Newest event first; the
    `hint` shows the total count.
15. **Partial-action history** — collapsible. Only renders when at
    least one parent has children (`split_lineage.some(...)`) — its
    presence is the signal worth seeing.
16. **Manage this item** — bottom-of-page rare-actions block:
    `<UnitTypeEditor />` (count / volume / weight) + the resolved
    action buttons + `↪ Transfer history…`. The action set comes
    from `getCatalogEntryActions(entry)` (see `actionResolver.ts`)
    and includes edit-name / unlink-barcode / merge-into / delete,
    each gated by entry state.
17. Modals — `<QuickAddModal />`, `<TransferHistoryFlow />`,
    `<MoveLocationModal />`, `<MarkUsedModal />`, `<MergeModal />`.

## SectionHeader / CollapsibleHeader pattern

This page introduced a layman-copy convention every section
follows: a bold title plus a small-font *hint* paragraph
underneath explaining what that section is. From the file's own
note (`SectionHeader` JSDoc):

> Layman copy + 1-line "what this section is" beneath each header
> — added after real-feedback that bare titles like "Patterns" and
> "Lifetime breakdown" left users guessing.

Other pages should adopt this when adding their own sections —
it's the cheapest helper-per-section pattern in the codebase.

## Hero banner decision table

`buildHeroBanner()` runs the priority list once per render. The
tone + headline + detail map:

| Trigger                                  | Tone   | Icon | Headline                              |
| ---------------------------------------- | ------ | ---- | ------------------------------------- |
| `soonest_expiry < now`                   | red    | ⚠    | `{qty} units expired at {loc}`        |
| `0 < soonest_expiry ≤ 3d`                | orange | ⏰   | `Use soon — {qty} expire in {Xd}`     |
| `predicted_next_buy_in_days ≤ 0`         | accent | 🛒   | `Restock due — N days overdue`        |
| `0 < active_qty ≤ 1`                     | orange | 🪫   | `Almost out`                          |
| `active_qty == 0`                        | accent | 📦   | `Out of stock`                        |
| All else                                 | quiet  | ✓    | `{qty} on hand · all fresh`           |

The detail paragraph carries cadence info ("you buy these every
~7 days") when relevant.

## Action resolver

`getCatalogEntryActions(entry)` returns an ordered list of
actions, each with `id`, `label`, `severity`, `disabled`, and
`disabledReason`. Current actions:

- `new_purchase` — surfaced in HeroActionBar as `+ Buy more`,
  filtered out of the **Manage** row.
- `edit_name` — opens inline rename in the title.
- `unlink_barcode` — only enabled when `entry.barcode` is set.
  `window.confirm` on click; mutation sets `barcode: null`.
- `merge_into` — opens `<MergeModal />`.
- `delete` — runs a `previewDelete` first (for shopping-list
  cascade impact: items repointed vs cascade-deleted), then
  surfaces concrete counts in the `window.confirm` before doing
  the delete. On preview failure, falls back to a generic confirm.

The `↪ Transfer history…` button lives outside the resolver
because it's a Phase G addition with its own modal flow; tooltip
explains the use case (move a *portion* of history rather than
merge two entries entirely).

## Unit type editor

The `UnitTypeEditor` is intentionally placed in **Manage this
item** because it's a rare per-item config knob. Three canonical
options:

| Value    | Meaning                                                           | Use modal control          |
| -------- | ----------------------------------------------------------------- | -------------------------- |
| `count`  | Whole pieces (eggs, apples, cartons treated as units)             | Integer spinner            |
| `volume` | Measured in ml / L (milk, juice, oil)                             | ml/L slider                |
| `weight` | Measured in g / kg (sugar, flour, meat)                           | g/kg slider                |

Legacy `container` value still appears in old data — it's
read-compat (coerced to `count` by `effectiveUnitType`) and gets
normalised on next write. The editor surfaces an amber note when
the entry is currently `container` so the user sees what's
happening. The "container-ness" of a purchase (carton, box, bag,
…) is now stored as `pack_label` per-event.

Save-on-change: every dropdown change fires the mutation
immediately. No save button.

## Hero `Use…` flow

The `Use…` button targets `overallMostUrgentEventId`, computed by
walking `current_locations` and picking the location with the
soonest expiry that has a `most_urgent_event_id`. This re-pick is
deliberate — `current_locations` is sorted by qty (which the
`<CurrentLocations />` panel uses for display) but for "Use" we
want soonest-expiry, regardless of which location holds it.

The modal (`<MarkUsedModal />`) defaults to the full event
quantity, with a slider down to partial. The file note explains
why:

> Replaces the unsafe "Use 1" inline button. Critical for
> multi-pack and high-qty events where "Use 1" would have wiped
> out a whole batch with one click.

If you ever simplify the modal to a single-tap "Use 1" again,
re-read that note first — the problem it solved is in the
historical record.

## Delete cascade preview

Delete is the only action that runs a preview mutation before the
confirm. Reasoning: a catalog delete may cascade into shopping
lists in two ways:

- **Repointed** — list items that referenced this catalog entry
  but have a global product to fall back on (`global_revert_to_name`
  is non-null) — they switch to the global name and stay in the
  list.
- **Cascade-deleted** — list items where no global product
  exists; they get removed entirely.

The confirm message surfaces the counts so the user can decide
with eyes open. If preview itself errors (e.g. due to active
purchases blocking delete), a generic confirm offers to try
anyway and lets the backend reject if it must.

## Data sources

- `useCatalogEntry(nameNorm)` — `/api/catalog/:name_norm`. The
  light-weight read for the title row + stat tiles.
- `useCatalogOverview(nameNorm)` — `/api/catalog/:name_norm/overview`.
  The heavy aggregator. Powers HeroActionBar, CurrentLocations,
  ItemPatterns, PriceHistoryTable, LifetimeUnitBreakdown,
  MovementTimeline, SplitLineageTree.
- `useUpdateCatalogEntry()` — for inline name edit, unit-type
  change, unlink-barcode.
- `useDeleteCatalogEntry()` / `usePreviewDeleteCatalogEntry()` —
  delete cascade pair.
- `useMergeCatalogEntry()` — merge-into target. Navigates to the
  target's catalog page on success (the source entry is gone).
- `usePurchase(eventId)` — fetches the per-event detail for the
  Move / Use modals. Two separate state slots so the modals
  don't accidentally open together.

## Helper UX choices

- **Section-header `hint` props** — used everywhere on this
  page. Cheapest helper pattern — embeds context next to each
  section heading.
- **Stat tile `hint` props** — same idea at the per-tile level.
- **Page-level overview expandable** — added on top because the
  page is genuinely long; first-time users benefit from a map
  before scrolling.
- **`title=` on the Needs review chip + Transfer history button**
  — those two were the only spots without inline copy. The chip
  needed to explain *why* the flag fired (a 21-day reminder went
  un-cleared); the transfer button needed to explain *when* you'd
  use it vs merge.

## Not on this page (by design)

- Per-event editor (price, expiry, status change with reason) —
  drill into `/my-items/:eventId` from the activity timeline.
- Cross-entry merge candidates — surfaced on `/settings`'s
  Catalog cleanup widget. The merge modal here is point-to-point
  (source already chosen, pick target).
- Admin-side aggregate stats — `/admin/catalog-analysis`.
- Recipe matches that include this ingredient — `/meals`'s
  suggestion list, not duplicated here.

## Update discipline

When adding a new HeroActionBar trigger:

1. Add the case to `buildHeroBanner()` priority order. Insert by
   urgency.
2. Add a row to the **Hero banner decision table** here.
3. Decide whether the case should hide / show the `Use…` button
   (the current `useTargetAvailable` covers it indirectly).

When adding a section:

1. Use `<SectionHeader>` (always-open) or `<CollapsibleHeader>`
   (collapsible) — both already exist; pick the one that fits.
   ALWAYS pass a `hint` prop. Bare titles are not the convention
   here.
2. Add an entry to the **Composition** order above.
3. If the section depends on `overview` data (most do), guard
   on its presence so the page still renders before the heavy
   read resolves.

When adding a per-item config to **Manage this item**:

1. Add a small `<…Editor />` component above the action button row
   (matching `<UnitTypeEditor />`'s pattern: save-on-change).
2. Document the option semantics in `unit-type-method.md` style if
   the choice is non-obvious.
3. Update the page-level expandable's "Manage this item"
   paragraph.

When changing the unit-type set:

1. Update the editor's `<option>` list.
2. Update the **Unit type editor** table here.
3. Update `UNIT_TYPE_DESCRIPTIONS` in
   `backend/web-admin/src/utils/unitType.ts` so the inline
   description matches.
4. Decide what happens to existing rows on the obsolete value —
   prefer read-compat coercion (like `container → count`) over a
   migration to keep old data working.

When changing the delete cascade behaviour:

1. Update the **Delete cascade preview** section here.
2. Make sure `previewDelete` returns whatever counts the new
   cascade introduces; the confirm copy is generated from that
   shape.
