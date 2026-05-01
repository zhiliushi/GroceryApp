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
3. `<SpendingScoreboard />` — three independent `SpendingPeriodCard`s
   side-by-side: `week`, `month` (highlighted), `last_month`. Each card
   collapses by default; tap to reveal top-5 most-expensive purchases for
   that period.
4. `<WasteScoreboard />` — symmetric mirror of spending. Three
   `WastePeriodCard`s. Top-5 most-expensive *thrown* items in each, sorted
   by `total_value` desc.
5. `<ExpiringSoonCard />` — collapsed by default, auto-opens when
   anything is past expiry. Headline shows "N expired · M expiring in 3
   days · 1 in fridge · 2 in pantry". Per-item "Use…" buttons stop click
   propagation so they don't toggle the card.
6. `<InventoryGlance />` — one-line plain-language pill row: "26 items in
   stock · 3 expiring in 3 days · 3 already expired". Replaces the old
   `<HealthBar />` "Inventory Health 73" hero (still available at
   `/health-score` for users who want the score).
7. 2-col reference row: `<InsightsCard />` · `<FrequentlyBoughtCard />`.
8. Admin-only stats grid + Quick Actions (gated by `isAdmin`).

## Feature flag gating

- `useFeatureFlags()` provides flags.
- `<SpendingScoreboard />` self-hides when `financial_tracking === false`.
- `<InsightsCard />` is empty-suppressed (`data.count === 0` returns null).
- `<ProgressiveNudge />` hidden when `progressive_nudges === false`.

## Data sources

All widgets fetch their own data via hooks:

- `useSpendingSummary(period)` × 3 — week / month / last_month
  (`/api/waste/spending?period=...`)
- `useWasteSummary(period)` × 3 — same three periods
  (`/api/waste/summary?period=...`)
- `usePurchases({ status: 'active', limit: 200 })` — for ExpiringSoonCard
- `useHealthScore()` — for InventoryGlance counts (reuses existing endpoint)
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
