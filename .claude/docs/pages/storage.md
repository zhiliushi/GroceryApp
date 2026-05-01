# Storage page (card dashboard)

Route: `/storage`
File: `backend/web-admin/src/pages/storage/StoragePage.tsx`

## Purpose

Card dashboard, one card per storage location (Fridge, Pantry, Freezer,
plus an Unsorted bucket when any active event has no location set).

Each card is clickable into `/storage/:locationKey` (the per-location
detail view) — that's the user's main use case. Admin controls
(Edit / move-up / move-down / Delete) are also on the card but
secondary; they `stopPropagation` so they don't trigger the
card-level navigation.

Earlier iteration was a pure management page (admin-style, no detail
view). Refactored 2026-05-01 in response to user feedback that:

1. Cards weren't clickable → had to drill via the dashboard's
   StorageListCard, which felt indirect.
2. Title and "+ Add Location" admin button slid under the floating
   Add/Scan pills (z-30 fixed).

## Composition

1. **Title row** — `<PageHeader title="Storage" icon="🗄️" count />` +
   admin-only "+ Add Location". Wrapped in `md:pr-[280px]` to clear
   the fixed Add/Scan pills.
2. **Subtitle** — "Tap any location to see what's inside."
3. **AddLocationForm** (admin only, expands above grid when open).
4. **Card grid** — responsive 1/2/3 columns. Each card:
   - Color strip at top (location's configured color).
   - Icon + name + pack count + "Empty — tap to add" or
     "N packs stored".
   - Most-urgent banner (color-coded by days-to-expiry; only shown
     when the location has at least one pack with an expiry date).
   - Stat chips: "⚠ N expired", "⏰ N expiring soon" (only when
     there's something to flag).
   - Chevron `›` affordance bottom-right.
   - Admin footer (Edit / ▲ / ▼) — sibling to the Link, not nested.
5. **Unsorted card** — appended to the grid when active events have
   `location: null`. Same card shape, no admin controls. Links to
   `/storage/_unsorted`.

## Card click model

Two interactive regions per card:

- **Main area** = `<Link to=/storage/:key>` covers icon, name, count,
  banner, stat chips. Tap navigates.
- **Admin footer** = sibling `<div>` outside the Link. Buttons inside
  call `e.preventDefault(); e.stopPropagation()` so the card click
  doesn't fire (technically not needed since the buttons are outside
  the Link, but defensive against future restructuring).

## Data sources

- `useLocations()` — registered locations (with hardcoded fallback
  while the API loads).
- `usePurchases({ status: 'active', limit: 200 })` — active events.
  Same source as StorageDetailPage and the dashboard's
  StorageListCard / ExpiringSoonCard. Cache-shared.

The previous version used `useInventory()` (legacy grocery_items
shim). Switched 2026-05-01 for consistency with the new model.

## Admin actions

- Add / Edit / Reorder / Delete locations — same operations as before,
  same mutation hooks (`useAddLocation`, `useUpdateLocations`,
  `useDeleteLocation`).
- Delete is blocked when the location has packs ("move items first").
- Edit mode swaps the card's main area into a form (name + icon +
  color picker) without leaving the card.

## Title-row right-padding

`md:pr-[280px]` reserves space for the fixed Scan + Add pills at
top-right (z-30). Without it the title and the admin "+ Add Location"
button slide under the pills. Same pattern used on
`CatalogCleanupBanner`.

## Update discipline

When you add a new location-level concept (e.g. "capacity warning",
"expected fill %", "next expected restock"), surface it on each card
here AND on the per-storage detail page (`StorageDetailPage`). The two
should agree on what's worth showing.

When you add a new pack-level concept, surface it on
`StorageDetailPage`'s pack rows — not on this dashboard. The card
shows the *aggregate* state; the detail page shows the per-pack list.
