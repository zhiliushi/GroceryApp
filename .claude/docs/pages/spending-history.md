# Spending history (per-item)

Route: `/spending/history`
File: `backend/web-admin/src/pages/spending/SpendingHistoryPage.tsx`
Parent page: [`spending.md`](spending.md) (`/spending`).

## Purpose

The actionable drill-down behind the spending overview. Every catalog
entry the user bought in the chosen period is one row; columns
expose how much money each item cost, how much of that ended up in
the bin, and what fraction of units was wasted. High-waste rows are
auto-highlighted so the user can spot what to buy less of (or buy
smaller quantities of) next shop.

## Composition (render order)

1. Breadcrumbs — Dashboard › Spending › History.
2. `<PageHeader title="Spending history" icon="💳" subtitle="Per-item spent vs wasted" />`.
3. **"ⓘ What does this page show?" expandable** — explains:
   - what Total spent / Wasted / Kept each mean,
   - that the **Waste %** column is unit-based (not money-based),
   - why some rows are tinted red (≥ 20% waste by units OR by money),
   - that **Times bought** counts units, not shopping trips,
   - that an item name links to its catalog page.
4. **Period selector** — Week / Month / Year / All time pills, each
   with `title=` tooltip; active range mirrored as an
   `aria-live="polite"` hint line below.
5. **3-card hero row** — Total spent / Wasted / Kept. Each card label
   carries a `title=` tooltip restating its definition. Wasted and
   Kept also surface `% of spend` as a subtitle.
6. **Per-item table** — sorted by `thrown_value` desc (worst-waste-by-money
   first), with `total_spent` as tie-breaker. Columns:
   - Item (link to `/catalog/:nameNorm`),
   - Times bought,
   - Spent (RM),
   - Wasted (RM, em-dash if zero),
   - Waste % (em-dash if zero).
   Each header has a `title=` tooltip with the column's definition.
   Rows where `waste_value_pct ≥ 0.2 || waste_pct ≥ 0.2` get a
   `bg-red-500/5` tint.

## Feature-flag gate

Whole page is gated by the `financial_tracking` flag.

- Off → backend returns 404 on `/api/waste/financial-summary`. The
  frontend swallows the 404 (see `useFinancialSummary` retry guard
  in `backend/web-admin/src/api/queries/useWaste.ts:38-43`) and
  shows a yellow banner: "Financial tracking is turned off. Ask an
  admin to enable the `financial_tracking` flag in Admin Settings →
  Feature Flags."
- On → table renders.

The parent `/spending` page also hides its "Detailed history" CTA
when this flag is off, but typing `/spending/history` directly still
works — the explainer banner is the fallback.

## Period semantics

Computed inline in `get_financial_summary()` (not via shared
`_period_range`) — `backend/app/services/waste_service.py:402-413`:

| Key      | Window                       | UI hint                                              |
| -------- | ---------------------------- | ---------------------------------------------------- |
| `week`   | Now - 7 days → now           | "Last 7 days (rolling)."                             |
| `month`  | First of current month → now | "From the 1st of this month to today."               |
| `year`   | Jan 1 of current year → now  | "From January 1 to today."                           |
| `all`    | `2000-01-01` → now            | "Everything you have bought since you started."      |

Diverges slightly from `/waste` and `/spending`, which use
`_period_range`. Same windows in practice, but keep aligned if either
side changes.

## How the columns are computed

Backend single source: `get_financial_summary()` in
`backend/app/services/waste_service.py:391`.

- **total_purchases** — sum of `event.quantity` across all purchase
  events for the catalog entry in the period. Unit-based (a partial
  split that bought 12 reads as 12, not 1). Rendered as **Times
  bought**.
- **total_spent** — sum of `event.price` across the same events.
  Currently raw from the `price` field, **not** routed through
  `currency_service.display_amount_for_user`. See "Known UI gaps"
  below.
- **thrown_count** / **thrown_value** — only events with
  `status="thrown"` AND `consumed_reason ∈ {expired, unexpected_event}`
  contribute. Legacy `bad` reason coerces to `unexpected_event`.
  `gift` and `used_up` thrown reasons don't count.
- **waste_pct** = `thrown_count / total_purchases` (unit-based).
- **waste_value_pct** = `thrown_value / total_spent` (money-based).
- **active_count** / **used_count** — also returned per row but not
  rendered on this page. Available if a future column wants to show
  them.

The Waste % cell shows `waste_pct` only — the unit-based one. The row
tint trigger uses `wasteHigh = waste_value_pct >= 0.2 || waste_pct >= 0.2`
so a row can be flagged red even when the visible % is < 20% (when
the *money* fraction is high but the unit fraction isn't, or vice
versa). Helper text mentions this asymmetry.

## Hero metric formulas

- `grand_total_spent` — sum across all rows.
- `grand_total_wasted` — sum across all rows (only waste-reason
  events contribute).
- `grand_waste_pct` — `grand_total_wasted / grand_total_spent`.
- **Kept** (frontend-only) = `grand_total_spent - grand_total_wasted`.
  Kept's "% of spend" is computed as `1 - grand_waste_pct`.

## Data source

`useFinancialSummary(period)` —
`/api/waste/financial-summary?period=…`. 5-minute `staleTime`. The
404-on-flag-off swallow is part of this hook so consumers can check
`!data` and render the explainer.

## Known UI gaps

1. **Currency symbol hardcoded `RM`** — Hero cards and table cells
   prefix `RM` regardless of the user's `currency_preference`. The
   parent `/spending` page also has this gap on its KPI cards. Fix
   together: route `total_spent` / `thrown_value` /
   `grand_total_spent` / `grand_total_wasted` through
   `currency_service.display_amount_for_user` in
   `get_financial_summary()`, return `display_currency`, and use
   `formatCurrencyWithSymbol` on the frontend.
2. **Waste % column shows units only** — the row tint considers
   money too, but the visible % doesn't. Could either render both
   (e.g. "17% units / 23% money") or pick one and document the
   choice. Helper text currently explains the asymmetry as-is.

## Helper UX choices

- **Same `<details>` pattern** as `/waste` and `/spending` for
  consistency. Users learn the helper convention once.
- **Hero cards: `labelHint` prop** — added to the existing `Hero`
  subcomponent so each card label can carry its own `title=`
  tooltip without inline noise.
- **Table headers carry `title=` tooltips** — column meaning
  (especially "Times bought" and "Waste %") is non-obvious; a hover
  tip is more discoverable than the helper above.

## Not on this page (by design)

- Per-event timeline for a single item — drill into the item name
  link → `/catalog/:nameNorm`.
- Aggregate Cash vs Card breakdown — lives on `/spending`.
- Health score / waste trend chart — lives on `/health-score`.

## Update discipline

When changing `_DEFAULT_TIERS` so that `financial_tracking` becomes
default-on for free tier (currently a paid-tier flag), update:

1. The yellow "ask an admin" banner copy here — it can soften from
   "ask an admin" to a simple "this view is off; turn it on in
   Settings" if non-admins gain control.
2. `feature-inventory.md` row for `financial_tracking`.

When adding a column to the per-item table:

1. Add the `<th>` here AND its definition tooltip, keeping the
   helper text in sync.
2. Decide whether the new column should affect the row-tint trigger;
   if so, document the trigger formula in **How the columns are
   computed**.

When adding a `consumed_reason` enum value, mirror the same checklist
from `waste.md` (filter table, schema, picker UI). The waste filter
in `get_financial_summary()` and `get_waste_summary()` must agree.
