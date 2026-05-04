# Spending breakdown

Route: `/spending`
File: `backend/web-admin/src/pages/spending/SpendingPage.tsx`
Sister page (drill-down): `/spending/history` →
`backend/web-admin/src/pages/spending/SpendingHistoryPage.tsx` (own
doc later).

## Purpose

Top-level "where did the money go?" view. Symmetric mirror of
`/waste`. Three KPIs at the top — Cash / Card / Grand total — and a
prominent CTA into the per-item history table where users can see
which catalog entries are eating their money.

## Composition (render order)

1. Breadcrumbs — Dashboard › Spending.
2. `<PageHeader title="Spending breakdown" icon="💳" />`.
3. **"ⓘ What does this page show?" expandable** — explains:
   - what counts as Cash vs Card (e-wallets, debit, credit all count
     as Card; cash is its own bucket),
   - that **Grand total** can exceed Cash + Card if some purchases
     have a price but no payment method tagged ("other"),
   - that items without a recorded price are excluded from every
     total,
   - what the "Detailed history" link below adds.
4. **Period selector** — Week / Month / Year / All time pills, each
   with a `title=` tooltip describing its window. Active range
   appears below the pills as an `aria-live="polite"` hint line.
5. **3-card KPI row** — Cash / Card / Grand total. Each card label
   carries a `title=` tooltip restating the bucket definition. The
   Grand total card also surfaces "N items without a recorded price"
   when `untracked_count > 0`, with a tooltip explaining why those
   items don't count.
6. **Detailed history CTA** — block link to `/spending/history`. Only
   shown when `financial_tracking !== false` (the flag that gates the
   detailed table).

## Period semantics

Same `_period_range()` as `/waste` —
`backend/app/services/waste_service.py:35`.

| Key      | Window                       | UI hint                                              |
| -------- | ---------------------------- | ---------------------------------------------------- |
| `week`   | Now - 7 days → now (rolling) | "Last 7 days (rolling)."                             |
| `month`  | First of current month → now | "From the 1st of this month to today."               |
| `year`   | Jan 1 of current year → now  | "From January 1 to today."                           |
| `all`    | `2000-01-01` → now            | "Everything you have bought since you started."      |

The dashboard scoreboard adds `last_month` for month-over-month
comparison; this page exposes `week / month / year / all` only.

## Payment-method classification

Backend single source: `get_spending_summary()` in
`backend/app/services/waste_service.py:494`.

| `payment_method` value | Bucket             | Counted in Grand total? |
| ---------------------- | ------------------ | ----------------------- |
| `cash`                 | Cash               | ✅                       |
| `debit_card`           | Card               | ✅                       |
| `credit_card`          | Card               | ✅                       |
| `ewallet`              | Card               | ✅                       |
| `card` (legacy)        | Card               | ✅                       |
| anything else / unset  | Other (not shown)  | ✅                       |
| no price at all        | Untracked          | ❌                       |

The UI shows only Cash and Card cards explicitly. "Other" (price
recorded but payment method unknown) is silently rolled into the
Grand total. That's why the helper text warns "Grand total can be
larger than Cash + Card alone".

`untracked_count` is the count of purchase events with no price
field — they're excluded entirely from spending math. The KPI card
surfaces this so the user knows the number isn't a complete picture.

## Data sources

- `useSpendingSummary(period)` — `/api/waste/spending?period=…`. Same
  hook used by the dashboard's `<SpendingScoreboard />` and shared
  via the `qk.waste.spending(period)` query key — no refetch when
  switching between dashboard and this page.
- `useFeatureFlags()` — controls visibility of the Detailed history
  CTA. The flag is `financial_tracking`; off → hide CTA. The
  detailed page itself also re-checks the flag and shows an explainer
  if the flag flips to off mid-session.

## Currency

Read-time conversion in the backend (`display_amount_for_user`).
Response carries `display_currency`. **Known UI gap** (same as on
`/waste`): the KPI cards render `value.toFixed(2)` without the
currency symbol, while the dashboard scoreboard uses
`formatCurrencyWithSymbol`. Wire on next visit — the data is already
in the response.

## Helper UX choices

- **Same `<details>` pattern as `/waste`** — keeps the helper UX
  recognisable session-to-session. Native HTML, accessible, no JS
  state.
- **`title=` on bucket labels and the untracked count** — short
  hover text reinforces the same definition the expandable helper
  carries; users who already understand can ignore the helper but
  still get a single-bucket reminder on hover.
- **One-line live hint under the period pills** — same string as the
  pill's `title=`, surfaced for touch and screen-reader users.

## Not on this page (by design)

- Per-item drill: `Detailed history` CTA → `/spending/history`. Same
  period selector but with a per-catalog table including waste %.
- Per-period waste comparison: handled on the dashboard's
  side-by-side `<SpendingScoreboard />` + `<WasteScoreboard />`
  layout. No mirror on this page; users go to `/waste` for that.
- Currency configuration: lives in `/settings`. Changes invalidate
  `['waste']` query keys so this page refreshes on next focus.

## Update discipline

When adding a new `payment_method` enum value:

1. Decide whether it lands in Cash or Card (or stays "other"), and
   wire the classification in
   `backend/app/services/waste_service.py:528-535`.
2. If a fourth bucket is genuinely needed, add a column on this page
   AND on the dashboard's `<SpendingScoreboard />` — the two should
   stay symmetric.
3. Add the new value to the **Payment-method classification** table
   here.

When changing period semantics, update the **Period semantics** table
here, the pill `hint` strings in `SpendingPage.tsx`, and mirror in
`waste.md` + `dashboard.md`.

When the Detailed history CTA copy changes, mirror the
"what's there" sentence in the **"ⓘ What does this page show?"**
helper.
