# Foodbanks (donation directory)

Route: `/foodbanks`
File: `backend/web-admin/src/pages/foodbanks/FoodbanksListPage.tsx`
Admin-only sister page: `/foodbanks/new` and
`/foodbanks/:foodbankId/edit` →
`backend/web-admin/src/pages/foodbanks/FoodbankFormPage.tsx`
(admin authoring; no separate doc).

## Purpose

A directory of real-world places that accept unopened food
donations. Closes the loop on the **Give away** action: when a
user has items they won't finish in time but that are still good,
this page is where they find a nearby foodbank to drop them at.

The directory is curated — admins seed initial entries from
country-specific source lists, then keep the list current by
running scrapers (the **Sources** panel below).

## Composition (render order)

### Always-on (user-facing)

1. `<PageHeader title="Foodbanks" icon="🏦" count={...} />`. The
   `+ Add Foodbank` action button shows for admins only.
2. **"ⓘ What is this directory for?" expandable** — explains:
   - what a foodbank is and when to use one (good food you won't
     finish in time, still in donatable condition),
   - the country filter and the "View on Map" link,
   - that admins curate the list — users can ask for additions.
3. **Country filter** — `<FilterBar>` with a `Country` dropdown
   built from `FOODBANK_COUNTRIES`. Apply on submit.
4. **Foodbank cards grid** — 1/2/3-column responsive grid. Each
   card carries:
   - Name (semibold).
   - Two `<StatusBadge>`s: state-or-country, and active/disabled.
   - Truncated description (max 100 chars) — full text in `title=`
     via `truncateText`.
   - Address with a 📍 emoji (max 60 chars; full text in `title=`).
   - **View on Map** external link (`target="_blank"`, with
     `rel="noopener noreferrer"`). `title=` clarifies it opens the
     maps app for directions.
   - Admin-only footer with Edit / Enable-Disable / Delete.

### Admin-only

5. **Quick-action buttons row** — `Seed Foodbanks` (creates the
   default seed set per country), `Refresh All` (fan-out fetch
   across every healthy source).
6. **Foodbank Sources panel** — collapsible. Lists every scraper
   source with its country, status (`healthy` / `cooldown` /
   `disabled`), last-success timestamp, last error message, and a
   per-source action that depends on status:
   - `healthy` → **Fetch** (manual refresh now).
   - `cooldown` → **Reset** (clear backoff timer).
   - `disabled` → **Enable** (flip back on).

## Source state machine

Single source: `_DEFAULT_SOURCES` and `update_source_state` in
the foodbank service. Three states:

| State      | Meaning                                                       | Action available |
| ---------- | ------------------------------------------------------------- | ---------------- |
| `healthy`  | Scraper succeeded recently. Fetches allowed.                  | Fetch            |
| `cooldown` | Scraper failed; auto-disabled until cooldown expires.         | Reset            |
| `disabled` | Manually disabled (or hit max retries). No auto-fetch.        | Enable           |

The `cooldown` state is what protects upstream sites from being
hammered when scrapers break. Reset clears the timer so the next
fetch attempt fires immediately.

## Cards: user-facing vs admin-facing

Cards render the same layout for everyone, but the bottom action
bar (Edit / Enable-Disable / Delete) is conditionally rendered
when `isAdmin`. Non-admin users see the card content but no
controls.

The `is_active` badge is visible to all users — a `disabled`
foodbank still appears in the list (so users see a record exists)
but admins see a disabled chip and can re-enable. Hiding disabled
entries from non-admins would be a separate decision; current
behaviour intentionally surfaces "we know about this place; it's
just not actively maintained right now."

## Country filter

`FOODBANK_COUNTRIES` (in `utils/constants.ts`) is the canonical
list. The "All Countries" option (`value: ''`) clears the filter.

Apply is explicit (button-driven) rather than instant on change
because the dropdown sits inside the shared `<FilterBar>` pattern
used across admin pages.

## Data sources

- `useFoodbanks(country)` — `/api/foodbanks?country=…`. The main
  card list.
- `useFoodbankSources()` — `/api/foodbank-sources`. Admin-only;
  feeds the sources panel.
- `useDeleteFoodbank()`, `useToggleFoodbank()`, `useSeedFoodbanks()`,
  `useRefreshAllFoodbanks()` — admin mutations on the foodbank
  records.
- `useFetchSource()`, `useResetSourceCooldown()`, `useToggleSource()`
  — admin mutations on the scraper sources.

## Helper UX choices

- **One expandable, on the user-facing surface** — admins don't
  need the directory explained; users do. The collapsible lives at
  the top so a first-time user understands why this page exists
  before scrolling cards.
- **Tooltips on the View on Map link and address line** — the
  link's effect (opens external maps app) and the truncated
  address (`title=` shows the full string) are both small lifts
  that add real value on hover.
- **No tooltips on admin source-panel cells** — the table is
  self-documenting (Status / Last Success / Error / Action all
  read directly), and the panel is admin-only by gate. Admins
  read tables; we don't reach for tooltips there.

## Cross-feature integration

This page is reachable from the **Give away** flow:

- `<GiveAwayModal />` (used by My Items detail and Catalog entry
  detail) lets the user record a recipient name. There's an
  obvious feature-add to surface "Find a foodbank →" inside that
  modal — currently the user has to navigate manually.
- The recipient field is free-text only; foodbank IDs aren't
  stored on the purchase event. So "I gave 2 cans to KL Food
  Bank" registers as a freeform string. Worth a future link if
  donation tracking matters.

## Not on this page (by design)

- Per-foodbank detail page (hours, contact, what-to-bring lists)
  — the current card is the whole entry. Drilling into a foodbank
  detail page would be a future add.
- User favourites or pinned foodbanks — not implemented.
- Distance from the user — `latitude` / `longitude` are stored
  but not used for sorting. A "nearest first" sort would need a
  geolocation prompt.

## Update discipline

When adding a new country:

1. Append to `FOODBANK_COUNTRIES` in
   `backend/web-admin/src/utils/constants.ts`.
2. Decide whether seed data exists; if yes, add to
   `_DEFAULT_FOODBANKS` in the backend service so `Seed Foodbanks`
   covers it.
3. Decide whether a scraper source exists; if yes, add to
   `_DEFAULT_SOURCES`.
4. The country filter dropdown auto-picks up the constant — no
   page-level change needed.

When adding a new card field (e.g. opening hours):

1. Add to the foodbank backend schema and the foodbank form page.
2. Render conditionally on the card here — small enough fields
   inline, larger ones may push toward the per-foodbank detail
   page concept.
3. Decide whether the field needs a tooltip — anything truncated
   should mirror the `address` pattern.

When adding a new source state:

1. Add to the state machine in `update_source_state`.
2. Add a row to the **Source state machine** table here.
3. Add the matching `case` in `getSourceAction()` so admins have
   an action to take.
4. Decide whether `<StatusBadge>` already covers the new status
   string visually.

When wiring a "Find a foodbank" entry from `<GiveAwayModal />`:

1. Add the link target there (`/foodbanks?country=…` keyed off
   the user's country preference).
2. Update **Cross-feature integration** here.
3. Consider whether donation tracking should evolve the
   `transferred_to` field into a structured `recipient` (foodbank
   id + name).
