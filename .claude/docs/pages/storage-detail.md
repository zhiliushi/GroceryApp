# Storage Detail Page

Route: `/storage/:locationKey`
File: `backend/web-admin/src/pages/storage/StorageDetailPage.tsx`
Reached from: `<StorageListCard />` row click on the dashboard, or
`/storage` (the management view).

## Purpose

The lightweight, action-first per-storage-location view. Answers
"what's in my fridge / pantry / freezer right now, and what needs
attention?" — nothing else.

## Why this page exists alongside /storage and /catalog/:nameNorm

Three distinct mental models, three distinct pages:

- **/storage** — *management view*. Add / rename / reorder / recolor
  storage locations. Admin-style. Doesn't show what's inside.
- **/storage/:locationKey** — *housewife view per location*. "What's
  in this drawer/shelf/fridge right now?" Current state only, sorted
  by expiry urgency, with one-tap actions per pack.
- **/catalog/:nameNorm** — *manager view per item*. Lifetime spend,
  waste rate, cadence, price-by-store, partial-action lineage. Used
  when researching a single product across all storage locations.

Conflating any pair would muddy the view: management actions buried
under content, content buried under analytics, etc.

## Composition

1. **Breadcrumb**: Dashboard → Storage → {location name}
2. **Hero card** — location icon + name + pack count + most-urgent
   banner (red / orange / yellow / green based on the soonest pack
   expiry). "+ Add here" CTA opens QuickAdd prefilled with this
   location.
3. **Stat strip** (only when something's flagged) — "⚠ N expired",
   "⏰ N expiring soon (≤7d)".
4. **Pack list** — every active pack stored in this location, sorted
   by expiry urgency. Each pack:
   - Item name (link to `/inventory/:nameNorm`-style catalog detail —
     currently disabled; see "Item-detail link" below).
   - Qty in base units.
   - Color-coded expiry chip.
   - Inline action buttons: Use… / Move (out) / Throw.

## Special key: `_unsorted`

Reaches `/storage/_unsorted`. Bucket for active events with no
`location` set. The hero icon is 📥, name is "Unsorted". The "+ Add
here" CTA on this page does NOT prefill a location (so QuickAdd
falls back to its default).

## Data sources

- `useLocations()` — registered storage locations (fridge, pantry,
  freezer, etc.). Fallback to hardcoded defaults if the API call is
  loading.
- `usePurchases({ status: 'active', limit: 200 })` — all active
  events, filtered client-side by `event.location === locationKey`.
  Cache-shared with the dashboard's `<ExpiringSoonCard />` and
  `<StorageListCard />`.

No queries for waste/used/transferred history — that's intentional
separation per the housewife-view scope.

## Modals reused

- `QuickAddModal` — buy-more with `defaults={location: locationKey}`
  (unset for `_unsorted`).
- `MarkUsedModal`, `MoveLocationModal`, `ThrowAwayModal` — per-pack
  actions.
- `GiveAwayModal` is NOT exposed here (give-away is a less-common
  action; user can reach it from the per-event detail page or
  CatalogEntryPage if needed). If usage data shows people want it
  here too, add it.

## Item-detail link

Each pack row links to `/catalog/:nameNorm` — the manager view for
that catalog row (lifetime spend, waste rate, price-by-store,
rename/merge/delete). This is the existing rich page; we don't
maintain a separate "lightweight item view" — the lightweight view
is the storage-side one (this page).

## Update discipline

When you add a per-pack action (e.g. "donate", "freeze"), wire it
into the action button row here AND on:
- `PurchaseEventDetailPage.tsx` (single-pack drill-down)
- Any other surface that exposes per-pack actions.

When you add a new field that's relevant to "what's in this storage
right now" (e.g. "expected to spoil sooner because warm"), surface
it here. Keep history/analytics fields off this page.
