# Reminders

Route: `/reminders`
File: `backend/web-admin/src/pages/reminders/RemindersPage.tsx`
Backend service: `backend/app/services/nudge_service.py`
Project doc: `docs/NUDGE_SYSTEM.md`

## Purpose

Catch items the user bought but never recorded an expiry date for —
the prime candidate to be forgotten and silently expire. The
scheduler scans active purchase events without `expiry_date` daily
and creates reminder docs at 7 / 14 / 21-day age thresholds. This
page is where the user clears them.

## Composition (render order)

1. Breadcrumbs — Dashboard › Reminders.
2. `<PageHeader title="Reminders" icon="⏰" />`.
3. **"ⓘ How do reminders work?" expandable** — explains:
   - why a reminder appears (no expiry recorded; age ≥ 7 / 14 / 21 d),
   - what each action button does (Used, Thrown, Still have),
   - how to stop the cycle entirely (record an expiry on the item).
4. **Reminder list** — one card per active reminder. Each card:
   - `display_name` (catalog display) — bold, primary text.
   - `message` — the templated string written by the scheduler
     (`'Still have {name} from a week ago?'`, etc.).
   - Footer line: `Stage {n} days · created {date}`. `n` is the
     scheduler's stage in raw days (7 / 14 / 21). Treat the number as
     diagnostic, not a UI primitive — users mostly read the message
     above.
   - Action row (right side): **Used** / **Thrown** / **Still have**.
5. Empty state: `"No active reminders."` (lowercase, secondary text).

## Action semantics

Frontend mapping → backend `dismiss_reminder`:

| Button       | API action    | Side effects                                                      |
| ------------ | ------------- | ----------------------------------------------------------------- |
| Used         | `used`        | Linked purchase event → `status="used"`. Counts as healthy.       |
| Thrown       | `thrown`      | Linked purchase event → `status="thrown"`, `consumed_reason="expired"`. Counts as waste. |
| Still have   | `still_have`  | Dismiss reminder only. The *same* stage won't re-fire, but the next stage (14 or 21 d) still will if the item stays active without an expiry. |

The frontend hardcodes `consumed_reason="expired"` for the **Thrown**
button — `RemindersPage.tsx:15`. Other reasons (gift, used_up,
unexpected_event) require going through the My Items detail page
instead.

The toast (rendered via `useUndoableAction`) uses different copy for
each action: "Marked '\<name>' as used / thrown" or "Snoozed
'\<name>'" for `still_have`. The "Snoozed" wording is slight UX
imprecision — backend distinguishes `still_have` (clears this stage,
next stage still fires) from `snooze` (time-based re-fire, currently
unimplemented per `nudge_service.py:185`). Users are unlikely to
notice; flag if a backend `snooze` action ships.

## Per-catalog mute via `no_expiry`

Captured 2026-05-04 from the real-user walkthrough: dish soap, soy
sauce, salt and rice were getting 7 / 14 / 21-day nudges because
they were logged for spend tracking with no expiry date. Three
dismissal taps per item over three weeks for things that
intrinsically don't expire.

Fixed by adding a per-catalog **"This item doesn't expire"** flag,
toggled from the catalog entry detail page's *Manage this item*
section. When set, `scan_reminders` skips every active purchase
matching that catalog entry. See [`catalog-entry.md`](catalog-entry.md)
for the toggle UX; `catalog_service.py:432` for the schema
whitelist; `nudge_service.py:scan_reminders` for the skip logic
(per-scan cache, bounded reads).

The flag is opt-in per catalog. New entries default to nudge-as-normal.
Once toggled on, future scans skip; existing pending reminders are
not auto-dismissed (user clears manually if any).

## Stage thresholds

Single source: `nudge_service.scan_reminders()` in
`backend/app/services/nudge_service.py:42`.

| Age    | Stage | Message template                                              |
| ------ | ----- | ------------------------------------------------------------- |
| ≥ 7 d  | 1     | `Still have '{name}' from a week ago?`                        |
| ≥ 14 d | 2     | `Still have '{name}' from 2 weeks ago?`                       |
| ≥ 21 d | 3     | `Definitely check '{name}' — you bought it 3 weeks ago`       |

The scan is feature-gated by `reminder_scan` flag and runs daily as
part of the scheduler. At stage 3, the scan also flags the linked
catalog entry's `needs_review = true` so admin Catalog Analysis can
surface persistently-uncleared items.

The reminder card displays raw stage as `Stage {stage} days` (the
backend stores `stage = stage_idx * 7`, so card shows `Stage 7 days`,
`Stage 14 days`, `Stage 21 days`). Functional but verbose — could be
reworked into "1st nudge / 2nd nudge / Final nudge" in a future pass;
out of scope for this round.

## Data sources

- `useReminders(false)` — `/api/reminders?include_dismissed=false`.
  `staleTime: 60_000`. Server-side filter on `dismissed_at IS NULL`,
  client-side sort by `stage` desc.
- `useDismissReminder()` — `POST /api/reminders/:id/dismiss`. Wrapped
  by `useUndoableAction` so the toast offers "Undo" before the
  optimistic mutation commits, matching the rest of the app's
  destructive-action UX.

## Helper UX choices

- **Same `<details>` pattern** as Waste / Spending / Health Score so
  the helper UX is recognisable across drill-downs.
- **Per-button `title=` tooltips** — the actions look identical
  ("Used / Thrown") to the buttons on My Items detail, but here
  they also dismiss the reminder. The tooltips clarify the dual
  side-effect.
- **No badge / no counts on this page** — already shown on the
  dashboard's `<NudgeBanner />` and `<ProgressiveNudge />`. Adding
  another summary here would be redundant.

## Not on this page (by design)

- Per-item history / expiry editor — drill into `/my-items/:eventId`
  via the catalog page or the dashboard's expiring card. If a user
  wants more than the three reminder buttons, they go there.
- Snoozed reminders / dismissed history — `useReminders(true)`
  exists but isn't surfaced. Could become a "Show dismissed" toggle
  later.
- Per-catalog reminder mute — not implemented. Ship that with a
  proper "this item never expires" catalog flag.

## Update discipline

When adding a fourth stage (e.g. 28-day) to the scheduler:

1. Update `thresholds` in `nudge_service.scan_reminders()` and the
   `<` comparator on `reminder_stage` (currently `< 3`).
2. Add a row to the **Stage thresholds** table here.
3. Decide whether `needs_review` should fire at the new stage.
4. The card's `Stage {n} days` line will render the new value
   automatically — no frontend change needed unless we rework the
   wording.

When introducing the time-based `snooze` action:

1. Wire backend re-creation cadence in `nudge_service.dismiss_reminder`.
2. Add a "Snooze 3 days" button on the card; route through
   `dispatchReminder` with `action: 'snooze'`.
3. Update **Action semantics** table here and remove the "Snoozed"
   wording note (it'll be accurate).

When changing the **Thrown** button's hardcoded reason:

1. The reason mapping lives at `RemindersPage.tsx:15`. If you offer
   reason choice (e.g. a small picker on the button), update the
   helper's "What the buttons do" list and the **Action semantics**
   table.
