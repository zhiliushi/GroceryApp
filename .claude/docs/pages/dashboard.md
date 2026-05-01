# Dashboard

Route: `/dashboard`
File: `backend/web-admin/src/pages/dashboard/DashboardPage.tsx`

## Purpose

Waste-prevention hero screen organised around the two questions a Malaysian
housewife (the archetype user) actually asks when she opens the app:

1. **"Did I overspend?"** — money first.
2. **"What's about to go bad?"** — expiry second.

Everything else (waste cost, insights, frequently-bought, plain-language
inventory glance) sits below the hero and is reference-grade rather than
action-driving.

## Composition (render order)

1. Sticky header — title + date.
2. Nudge stack (top, space-3)
   - `<ProgressiveNudge />` — 5/10/20-item threshold nudges (gated by
     `progressive_nudges` flag).
   - `<NudgeBanner />` — top 7/14/21-day reminder (if any).
3. `<SpendingScoreboard />` — three `SpendingPeriodCard`s. **Mobile**:
   "This month" is featured full-width with `defaultOpen`; "This week"
   and "Last month" wrap to a compact 2-col row below. **Desktop
   (≥sm)**: three equal columns with month center via CSS-grid `order`
   (DOM order stays month / week / last_month so screen readers hear
   the priority order).
4. `<WasteScoreboard />` — symmetric mirror of spending, same featured
   layout. Top-5 most-expensive *thrown* items per period, sorted by
   `total_value` desc.
5. `<ExpiringSoonCard />` — collapsed by default, auto-opens when
   anything is past expiry. Headline shows "N expired · M expiring in 3
   days · 1 in fridge · 2 in pantry". Per-item "Use…" buttons stop click
   propagation so they don't toggle the card.
6. 2-col bottom row: `<StorageListCard />` · `<FrequentlyBoughtCard />`.
   StorageListCard renders one row per registered storage location
   (Fridge, Pantry, Freezer, plus an Unsorted bucket if any active
   events have no location), sorted by expiry urgency. Each row links
   to `/storage/:locationKey` — the per-storage detail view ("what's
   in my fridge right now?"). Mirrors how the user thinks about her
   kitchen — by storage area — rather than abstract aggregate counts.
7. Full-width `<InsightsCard />` (auto-hides when empty).
8. Admin-only stats grid + Quick Actions (gated by `isAdmin`).

## Feature flag gating

- `useFeatureFlags()` provides flags.
- `<SpendingScoreboard />` self-hides when `financial_tracking === false`.
- `<InsightsCard />` is empty-suppressed (`data.count === 0` returns null).
- `<ProgressiveNudge />` hidden when `progressive_nudges === false`.

## Data sources

All widgets fetch their own data via hooks:

- `useSpendingSummary(period)` × 3 — week / month / last_month
  (`/api/waste/spending?period=...`). Response includes `top_items`
  (top-5 by amount). Frontend handles three states: items present →
  list; total>0 but items empty (backend version mismatch) → "refresh
  the page" hint; total=0 → "no purchases".
- `useWasteSummary(period)` × 3 — same three periods
  (`/api/waste/summary?period=...`). Response includes `top_wasted`
  sorted by `total_value` desc.
- `usePurchases({ status: 'active', limit: 200 })` — for ExpiringSoonCard
- `usePurchases({status:'active', limit:200})` — also feeds StorageListCard (cache-shared with ExpiringSoonCard)
- `useLocations()` — feeds StorageListCard (registered storage locations)
- `useDashboard()` — admin stats (legacy)
- `useFeatureFlags()` — `/api/admin/features` (admin) or
  `/api/features/public` (user)

## Currency

All spending/waste figures are converted to the user's
`currency_preference` at read time. Each summary endpoint returns
`display_currency`; frontend renders via `formatCurrencyWithSymbol`. So
MYR users see "RM 45.90", not "45.90".

## Period semantics

`SpendingPeriod = 'week' | 'month' | 'last_month' | 'year' | 'all'`

- `week` → last 7 days (rolling).
- `month` → from 1st of current month → now.
- `last_month` → first of previous month → first of current (full
  calendar month, [start, end)).
- Helper: `_period_range()` in `waste_service.py` is the single source.

## Not on this page (by design)

- Inventory list — lives at `/my-items`.
- Full waste breakdown — drill to `/waste`.
- Full spending — drill to `/spending`.
- Full reminders — drill to `/reminders`.
- Health-score detail — drill to `/health-score`.

## Testing notes

- Empty user: scoreboards show "RM 0.00" with no items in expanded view;
  ExpiringSoonCard shows green "✓ Nothing expires…" line; InventoryGlance
  shows "0 items in stock" (no expiring/expired pills).
- Currency change in Settings: scoreboards update on next query
  invalidation (mutation invalidates `['waste']` keys via
  `usePurchaseMutations`). Reload guarantees a fresh read.
- Auto-expand for ExpiringSoonCard fires when `expired.length > 0` in the
  `useMemo` result.
