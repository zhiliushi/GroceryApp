# Waste breakdown

Route: `/waste`
File: `backend/web-admin/src/pages/waste/WastePage.tsx`

## Purpose

Drill-down for the dashboard's "What you wasted" scoreboard. Answers
two questions:

1. **"How much money have I thrown away?"** — single number, in the
   user's preferred currency, for a chosen window.
2. **"What did I throw away the most of?"** — top items, sorted by
   money lost, not by count.

The home dashboard surfaces a compact 3-period scoreboard
(`<WasteScoreboard />`); this page expands the same scoreboard, adds a
period selector for arbitrary windows (week / month / year / all
time), and drops a sortable top-items list under it.

## Composition (render order)

1. Breadcrumbs — Dashboard › Waste.
2. `<PageHeader title="Waste breakdown" icon="🗑️" />`.
3. **"ⓘ What does this page show?" expandable** — one-tap helper that
   explains:
   - what counts as waste (only `expired` / `unexpected_event` reasons),
   - what the three cards above show (week / month / last month),
   - what the buttons below do (zoom into one window),
   - and how "Top wasted items" is sorted (by money, not by count).
   Native `<details>` element — no JS state, collapsed by default.
4. `<WasteScoreboard hideSeeAllLink />` — the same three-card
   scoreboard from the dashboard, but without the "See all →" link
   (we're already here). Each card stays tap-to-expand → top-5
   thrown items in that period.
5. Divider — visually separates the at-a-glance scoreboard from the
   single-period drill view.
6. **Period selector** — Week / Month / Year / All time pill buttons.
   Each pill carries a `title=` tooltip describing its range; the
   active range is also rendered as a small hint line below the
   pills (`aria-live="polite"` so screen readers announce the change
   when the user switches periods).
7. **Single-period total card** — large red `thrown_count` (units
   thrown) on the left, `thrown_value` on the right.
8. **Top wasted items card** — list of up to 10 items sorted by
   `total_value` desc. Header carries a one-line clarification: "Sorted
   by money lost. Number after × is units thrown."

## What counts as waste

The backend (`waste_service.get_waste_summary`) applies a
**waste-reason filter** that the UI helper text mirrors:

| `consumed_reason`   | Counts as waste? | Example                          |
| ------------------- | ---------------- | -------------------------------- |
| `expired`           | ✅                | "It went off before I used it"   |
| `unexpected_event`  | ✅                | "Spilled / damaged / pet ate it" |
| `bad` (legacy)      | ✅ (coerced)      | Old data, normalised to `unexpected_event` |
| `gift`              | ❌                | "Gave to neighbour"              |
| `used_up`           | ❌                | "Finished it normally"           |

Filter source: `backend/app/services/waste_service.py:308-317` and
`WASTE_REASONS` in `backend/app/schemas/purchase.py`. The user-facing
copy in the helper deliberately says "expired or unexpected event"
rather than listing every enum — keeps the hint readable.

## Periods

Single source: `_period_range()` in
`backend/app/services/waste_service.py:35`.

| Key          | Window                                              | UI hint                                              |
| ------------ | --------------------------------------------------- | ---------------------------------------------------- |
| `week`       | Now - 7 days → now (rolling)                        | "Last 7 days (rolling)."                             |
| `month`      | First of current month → now                        | "From the 1st of this month to today."               |
| `year`       | Jan 1 of current year → now                         | "From January 1 to today."                           |
| `all`        | `2000-01-01` → now                                  | "Everything you have thrown since you started."      |
| `last_month` | First-of-prev-month → first-of-current (full month) | (only used by the scoreboard, not the period selector) |

The page selector exposes `week / month / year / all`. The scoreboard
uses `week / month / last_month` for month-over-month comparison and
those keys aren't user-selectable on this page by design.

## Top-items sort rationale

Sorted by `(total_value, count)` desc, top 10. Rationale lives in
`waste_service.py:369-372`: two RM 12 items thrown is a more
actionable lesson than ten RM 0.50 items thrown. The page header text
duplicates this so users don't expect "most-frequent" semantics.

`count` is **units thrown**, not number of throw events — a partial
split that threw 2 of a 12-pack contributes 2 units, not 1 event
(`waste_service.py:360-362`).

## Data sources

- `useWasteSummary(period)` — `/api/waste/summary?period=…`. Same hook
  the dashboard scoreboard uses; cache-shared via the
  `qk.waste.summary(period)` query key, so switching between this page
  and the dashboard doesn't refetch.
- `<WasteScoreboard />` internally calls `useWasteSummary` once per
  card (`week`, `month`, `last_month`).

## Currency

All amounts go through `currency_service.display_amount_for_user` in
the backend so the UI always sees pre-converted numbers in the user's
`currency_preference`. The response carries `display_currency` (e.g.
`MYR`, `SGD`).

**Known UI gap**: the single-period total card currently renders
`{data.thrown_value.toFixed(2)}` without a currency symbol, while the
scoreboard cards format via `formatCurrencyWithSymbol`. Treat as a
small follow-up — wire `formatCurrencyWithSymbol(data.thrown_value,
data.display_currency)` when next on this page.

## Helper UX choices

- **Expandable helper, not a tooltip**: the explanation is multi-line
  (4 paragraphs) and benefits from being readable on a phone without
  hovering. `<details>` is native, accessible, no JS state.
- **Per-pill `title=` plus a single `aria-live` hint line**: title
  tooltips serve mouse users; the live hint serves touch + screen
  reader users. Same hint string in both places — single source.
- **Sort note under "Top wasted items"**: explains the surprising
  default (top by money, not by count) at the moment the user reads
  the list, not buried in the helper above.

## Not on this page (by design)

- Per-day spark / trend chart — `<HealthTrendChart />` lives on
  `/health-score`.
- Per-item history (when a single item was thrown, where, why) —
  drill into `/my-items/:eventId`.
- Spending side of the symmetric pair — `/spending`.

## Update discipline

When adding a new `consumed_reason` enum value:

1. Decide whether it counts as waste, and update `WASTE_REASONS` in
   `backend/app/schemas/purchase.py`.
2. Update the **What counts as waste** table on this page (helper
   text and this doc).
3. If user-facing reason picker UI exists, surface the new option
   there too.

When changing period semantics in `_period_range()`:

1. Update the **Periods** table here.
2. Update each pill's `hint` string in `WastePage.tsx` so the
   `title=` tooltip and the live hint stay in sync.
3. Mirror in `dashboard.md` "Period semantics" section.
