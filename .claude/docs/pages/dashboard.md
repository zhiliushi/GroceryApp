# Dashboard (refactored 2026-04)

Route: `/dashboard`
File: `backend/web-admin/src/pages/dashboard/DashboardPage.tsx`

## Purpose

Waste-prevention hero screen. Answers "what should I do next?" in under 5 seconds via health bar + 5 actionable cards. NOT a stats dump.

## Composition (render order)

1. Sticky header — title + date + `[+ Add item]` button (opens QuickAddModal)
2. Nudge stack (top, space-3)
   - `<ProgressiveNudge />` — 5/10/20-item threshold nudges (first non-dismissed wins)
   - `<NudgeBanner />` — top 7/14/21-day reminder (if any)
   - `<InsightsCard />` — top milestone insight (if any) — auto-hides when `data.count === 0`
3. `<HealthBar />` — hero. Links to `/health-score`
4. 3-col row: `<ExpiringSoonCard />` · `<WasteSummaryCard />` · `<SpendingCard />`
5. 2-col row: `<UntrackedAgeBuckets />` · `<FrequentlyBoughtCard />`
6. Admin-only legacy stats grid (StatsCards from useDashboard)
7. Quick Actions panel (admin links)
8. Modals: `<QuickAddModal />` controlled by `quickAddOpen` state

## Feature flag gating

- `useFeatureFlags()` provides `flags` → `ocrOff = !flags?.ocr_enabled` (default true)
- `ScanReceiptButton` only rendered when `!ocrOff`
- `SpendingCard` self-hides when `financial_tracking === false`
- `InsightsCard` never shows when backend returns empty (flag `insights` gates server-side)
- `ProgressiveNudge` hidden when `progressive_nudges === false`

## Data sources

- `useDashboard()` — legacy admin stats
- `useRecentInventory(200)` — legacy inventory items (kept for admin empty-state hero)
- `useFeatureFlags()` — routes to `/api/admin/features` for admin, `/api/features/public` for user
- All refactor widgets fetch their own data via hooks (`useHealthScore`, `usePurchases`, `useWasteSummary`, `useSpendingSummary`, `useReminders`, `useInsights`, `useCatalog`)

## Not on this page (by design)

- Inventory list — lives at `/my-items`
- Full waste breakdown — drill to `/waste`
- Full spending — drill to `/spending`
- Full reminders — drill to `/reminders`
- All insights — drill to `/insights`

## Testing notes

- Pre-migration: all refactor widgets show empty state gracefully (healthBar: 100/green, cards: 0 items). This is correct.
- Post-migration: recompute health score requires mutation invalidation of `['waste']` queries — `usePurchaseMutations` does this.