# Inventory Health (health score)

Route: `/health-score`
File: `backend/web-admin/src/pages/health-score/HealthScorePage.tsx`
Companion components:
`backend/web-admin/src/components/waste/HealthBar.tsx`,
`backend/web-admin/src/components/waste/HealthTrendChart.tsx`.

Backend formula reference: `docs/HEALTH_SCORE.md` and
`backend/app/services/waste_service.py:78` (`compute_health_score`).

## Purpose

Single-number, single-glance answer to "is my fridge in trouble?".
The score (0–100) blends current inventory health (70%) with this
month's waste rate (30%); the page exposes the contributing buckets
as four tabs so the user can act on whatever's pulling the number
down.

## Composition (render order)

1. Breadcrumbs — Dashboard › Health Score.
2. `<PageHeader title="Inventory Health" icon="💚" />`.
3. **"ⓘ How is this score calculated?" expandable** — explains:
   - the 70/30 weighting (current inventory health × monthly waste
     rate),
   - the colour bands (`green ≥ 80`, `yellow 50–79`, `red < 50`),
   - what each tab groups by,
   - and how the chart's gap-fill works (one snapshot per day at
     23:30 UTC; missing days copy the previous value, so flat
     stretches mean "no new snapshot", not "no change").
4. `<HealthBar drillToPath="/health-score" />` — score number, color
   bar, 5-stat row (Healthy / Expiring 7d / Expiring 3d / Expired /
   Untracked). Each stat with `value > 0` deep-links to the matching
   tab via `?tab=…`.
5. `<HealthTrendChart />` — 30-day Chart.js line of daily score
   snapshots. Gap-fills missing days from the previous snapshot
   (`fillGaps()` in the component).
6. **Tabs row** — Expiring / Expired / Untracked / Wasted this
   month. Each pill carries a `title=` hint; the active hint is also
   rendered as an `aria-live="polite"` line below the row for touch
   and screen-reader users.
7. **Tab body** — switch on `tab` query param:
   - **Expiring** → `<ItemList />` filtered to active items with
     `expiry_date` in `[now, now + 7d]`, sorted ascending. Empty
     state: "Nothing expiring in the next 7 days — nice!".
   - **Expired** → `<ItemList tone="expired" />` of active items
     past `expiry_date`. Red border on each row.
   - **Untracked** → `<UntrackedTab />` with three age buckets
     (`7+ / 14+ / 21+ days old`) for items that have a `date_bought`
     but no `expiry_date`. Each row links to the event detail and
     suggests "Set expiry →".
   - **Wasted this month** → `<WastedTab />` listing thrown items
     with `consumed_date >= start-of-month`. Header banner shows the
     count and total RM.

## Tab semantics

| Tab        | Source                  | Filter                                                      |
| ---------- | ----------------------- | ----------------------------------------------------------- |
| Expiring   | active purchases        | `now ≤ expiry_date ≤ now + 7d`                              |
| Expired    | active purchases        | `expiry_date < now`                                         |
| Untracked  | active purchases        | `expiry_date == null && date_bought < now - 7d`, bucketed   |
| Wasted     | thrown purchases        | `consumed_date >= start-of-month` (no waste-reason filter)  |

`?tab=` is the source of truth. Deep links from `<HealthBar />`'s
stat row use the same param so dashboard nav lands on the right
tab.

## Score formula

Single source: `compute_health_score()` in
`backend/app/services/waste_service.py:78`. Backend writes the
result to `users/{uid}/cache/health` with a 5-minute TTL.

Plain-language summary (the helper text mirrors this):

```
score = 0.7 × active_component + 0.3 × waste_component

active_component = (
    healthy           × 1.0
    + expiring_7d     × 0.8
    + expiring_3d     × 0.5
    + expired         × 0.0
    + untracked_old   × 0.6
) / max(active_total, 1)

waste_component = 1 - (thrown_this_month / max(thrown + used, 1))
```

Bands:

| Score   | Grade  | UI tone                        |
| ------- | ------ | ------------------------------ |
| 80–100  | green  | Healthy                        |
| 50–79   | yellow | Needs attention                |
| 0–49    | red    | Urgent                         |

Brand-new users (no active items, no monthly activity) score 100 by
convention so the page doesn't render a grim red bar before they've
done anything.

## Cache + update cadence

- On read of `/api/waste/health-score`, recompute if the cached
  `computed_at` is older than 5 minutes. Otherwise return cache.
- On write events (purchase create/update/delete) the cache is
  invalidated upstream so the next read recomputes.
- A daily scheduler at 23:30 UTC writes a `health_history` snapshot
  (one per user per day) — that's what the trend chart reads via
  `useHealthHistory(30)`.
- Snapshot writes are the only source for the trend chart. If the
  scheduler missed a day, the chart's `fillGaps()` carries the last
  value forward — explained in the helper.

## Data sources

- `useHealthScore()` — `/api/waste/health-score` via `<HealthBar />`
  (5-min `staleTime`).
- `useHealthHistory(30)` — `/api/waste/health-history?days=30` via
  `<HealthTrendChart />` (60-min `staleTime` because snapshots write
  daily).
- `usePurchases({ status: 'active', limit: 500 })` — feeds the
  Expiring / Expired / Untracked tabs. Cache-shared with the
  dashboard's `<ExpiringSoonCard />` and the storage views.
- `usePurchases({ status: 'thrown', limit: 500 })` — feeds the
  Wasted tab.

## Known UI gaps

1. **"Wasted this month" doesn't apply the waste-reason filter.**
   The Wasted tab renders every thrown event in the period, while
   `/waste` (and `compute_health_score`'s `waste_component`) only
   counts `consumed_reason ∈ {expired, unexpected_event}`. So the
   tab can show items the score considers "fine" (gifts, used-up).
   Either filter the tab to match `WASTE_REASONS` or rename it to
   "Thrown this month" — both are valid; needs a product call.
2. **Hardcoded `RM` prefix on the Wasted total and per-row price.**
   Same gap as `/spending` and `/waste`. Wire
   `formatCurrencyWithSymbol` next time on this page.
3. **Active-items query limit is 500.** A power user with > 500
   active events would see an undercount on every tab. Pagination
   isn't on the roadmap; document if/when it becomes a problem.

## Helper UX choices

- **One expandable explainer** for the score formula — the math is
  the part users most often misunderstand ("why am I red when I
  only have one expired item?"). The formula stays pinned inside a
  collapsible so the page isn't dominated by it.
- **Per-tab `title=` plus single live-hint line** — same pattern as
  Waste / Spending. Hint differentiates the tabs at a glance,
  especially Expiring vs Expired (the 7-day window for Expiring is
  not obvious from the label alone).
- **No new component** — the helper uses native `<details>` so we
  don't introduce a tooltip primitive just for this page.

## Not on this page (by design)

- Per-event detail (history, edit price/expiry, mark consumed) —
  drill into `/my-items/:eventId`.
- Aggregate waste totals across periods (year, all-time) — that's
  `/waste`.
- Per-payment-method breakdown — that's `/spending`.

## Update discipline

When changing the score formula in
`backend/app/services/waste_service.py:78`:

1. Update **Score formula** here AND `docs/HEALTH_SCORE.md`.
2. Update the helper paragraph in the page (kept short — full math
   stays in this doc).
3. If thresholds shift, update the **Bands** table and the colour
   tokens in `gradeColor` / `gradeTextColor`
   (`backend/web-admin/src/utils/healthScore.ts`).

When adding a new tab:

1. Append to `TABS` in `HealthScorePage.tsx` with a hint string.
2. Add the filter rule to **Tab semantics** table here.
3. Decide whether `<HealthBar />`'s stat row should deep-link to
   it; add a `<Stat tab="…" />` with the right tone if so.

When changing the trend snapshot cadence:

1. Update the helper paragraph (the "23:30 UTC" line).
2. Update **Cache + update cadence** here.
3. The `fillGaps()` behaviour is independent of cadence; verify
   it still holds for the new schedule.
