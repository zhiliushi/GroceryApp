# Inventory Detail Page

Route: `/inventory/:nameNorm`
File: `backend/web-admin/src/pages/inventory/InventoryDetailPage.tsx`
Reached from: `<InventoryListCard />` row click on the dashboard.

## Purpose

The lightweight, action-first per-catalog-row view. Answers "what do I
have for this item *right now*, where is it, when does it expire, and
what should I do with it" — nothing else.

## Why this page exists when CatalogEntryPage is already there

Two distinct mental models:

- **CatalogEntryPage** (`/catalog/:nameNorm`) — *manager view*. Lifetime
  spend, waste rate, cadence, price-by-store, partial-action lineage,
  rename/merge/delete actions. Information density is the goal; the
  user is researching this item.
- **InventoryDetailPage** (`/inventory/:nameNorm`) — *housewife view*.
  Purely current state. No waste, no history, no lifetime, no analytics.
  Action density is the goal; the user is deciding what to do next.

A single toggleable page would make both worse — burying actions under
analytics for one audience, and bloating with history for the other.
The footer link "Full price history & analysis →" bridges the two.

## Composition

1. **Breadcrumb**: Dashboard → My Items → {item name}
2. **Hero card** — name, total available in base units, pack count,
   unit_type chip. "+ Buy more" CTA top-right (opens QuickAddModal
   prefilled with this catalog row).
3. **Status banner** — picks the most-urgent narrative based on the
   soonest pack expiry: red "past expiry — throw or eat today",
   orange "expires today / N days", yellow "soonest N days", green
   "fresh".
4. **Per-location chips** — "Fridge: 6 · Pantry: 12" — sorted by qty
   descending so the biggest cache is first.
5. **Per-pack list** — every active purchase event for this catalog row
   as its own card, sorted by expiry urgency. Each card has:
   - Pack qty in base units, with `(qty × pack_size)` clarification
     when pack_size > 1.
   - Location and bought-date.
   - Expiry chip (color-coded by urgency).
   - Inline action buttons: Use… (primary, opens MarkUsedModal) /
     Move / Throw / Give away.
6. **Footer link** to `/catalog/:nameNorm` for the analytics view.

## Data sources (deliberately minimal)

- `useCatalogEntry(nameNorm)` — for `display_name` and `unit_type`.
- `usePurchases({ status: 'active', catalog_name_norm: nameNorm,
  limit: 100 })` — only the active events. No queries for used /
  thrown / transferred history.

Cache-shared with the dashboard's ExpiringSoonCard which also pulls
active purchases — second-load is essentially free.

## Modals reused

- `QuickAddModal` — buy-more with `defaults={catalogEntry: entry}`.
- `MarkUsedModal` — partial-pack consumption.
- `MoveLocationModal` — relocation.
- `ThrowAwayModal` — waste.
- `GiveAwayModal` — transfer/donate.

All four action modals are reused as-is — no per-page variants.

## Routing notes

- `/inventory` (no params) is a legacy redirect to `/my-items`.
- `/inventory/:uid/:itemId` is a legacy redirect to `/my-items` (old
  mobile path).
- `/inventory/:nameNorm` is the new page. Patterns are distinct so
  React Router doesn't conflict.

## Update discipline

When you add a new per-event action (e.g. "donate", "freeze"), wire it
into the PackRow action button row here AND on
`PurchaseEventDetailPage.tsx`. Both surfaces should expose the same
actions; the inventory page is the catalog-row aggregate, the event
page is the single-pack drill-down.

When you add a new field that's relevant to "current state" (e.g.
"opened? yes/no"), surface it on this page. When you add a field
relevant to "history / analytics" (e.g. "purchase frequency drift"),
keep it on CatalogEntryPage only.
