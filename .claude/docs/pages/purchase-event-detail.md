# Purchase event detail

Route: `/my-items/:eventId`
File: `backend/web-admin/src/pages/my-items/PurchaseEventDetailPage.tsx`
Parent page: [`my-items.md`](my-items.md) (`/my-items`).
Related: [`catalog-entry.md`](catalog-entry.md) — drilling further
up groups events under one item name.

## Purpose

The deepest single-event view. One purchase event = one batch
bought on one day, in one location, at one price. The page
surfaces every field on the event, exposes the small editable
ones inline (location, expiry), and routes the destructive ones
through modals that always offer a partial-quantity slider.

## Composition (render order)

1. Modals mounted at the top of the JSX (always rendered;
   visibility controlled by state):
   `<ThrowAwayModal />`, `<GiveAwayModal />`, `<MarkUsedModal />`,
   `<MoveLocationModal />`.
2. Breadcrumbs — Dashboard › My Items › *catalog_display*.
3. `← My Items` back link.
4. **"ⓘ What can I do here?" expandable** — explains:
   - this is one batch, distinct from the catalog item it belongs
     to,
   - the ✎ pen icon means the field is inline-editable,
   - actions vary by state (active → Used / Thrown / Give away;
     terminal → Restore),
   - Use / Throw / Give-away modals offer a partial-quantity
     slider (the original event splits in two on partial),
   - what **multi-pack** means (sibling pack id grouping).
5. **Header card** — title row with `catalog_display`, status
   badge, expiry-countdown chip, and `qty × N` if non-unit.
6. **Field grid** (`<dl>`) — Bought / Location / Barcode / Price
   / Pack size / Store / Multi-pack / Expiry / Status /
   Consumed / Given to. Each `<dt>` carries a `title=` tooltip
   via the `Row` component's new `hint` prop. Inline-editable
   fields (Location, Expiry) double up: the value also has its
   own `title=` because the user might hover the value before
   the label.
7. **Catalog info** card (when `catalogEntry` resolves) — a
   sentence summary plus a "→ View catalog entry" link.
8. **Actions** row — buttons from `getPurchaseEventActions(event)`
   plus the conditional **↺ Restore to active** button for
   terminal events. Below the buttons: a small "State: X"
   diagnostic line (the resolver state from the action resolver).
9. Auto-open behaviour from `?edit=location` or `?edit=expiry`
   query params (deep links from elsewhere in the app); param is
   consumed on first render so a refresh doesn't re-trigger.

## Action resolver

`getPurchaseEventActions(event)` returns an ordered list. Active
events typically yield:

- `mark_used` (primary)
- `mark_thrown` (danger)
- `give_away` (secondary)
- `set_expiry` / `set_location` (only when missing)
- `view_history` (tertiary)
- `delete` (danger)

The set is state-dependent — terminal events (used, thrown,
given) only show `view_history` + `delete`; the **↺ Restore to
active** button is added separately, outside the resolver, so it
can be styled green and isn't filtered by status.

The page passes `action.disabledReason` as `title=` on each
button — when an action is disabled (e.g. `set_expiry` already
set), the user gets a hover hint explaining why.

## Inline edits

Two fields are inline-editable on the page itself; everything
else routes through a modal.

- **Location** — clicking the value (or its ✎) opens
  `<MoveLocationModal />`. The modal supports partial moves (a
  portion of the event moves; the remainder stays in the
  original location), which is why we use the modal flow even
  though "edit location" feels light. Same modal is mounted
  separately and shared across the page (state: `moveOpen`).
- **Expiry** — clicking the value swaps the cell into an inline
  `<ExpiryInput />` with Save / Cancel. Accepts ISO dates and
  natural language ("tomorrow", "next Friday"). On save, the
  page sets `recentlyEditedPurchaseId` in `useUiStore` so the
  list view can highlight the row when the user navigates back.

## Modal-routed actions

| Button       | Modal                | What the modal adds                                                            |
| ------------ | -------------------- | ------------------------------------------------------------------------------ |
| Use          | `<MarkUsedModal />`  | Slider for partial quantity. Defaults to full event qty.                       |
| Thrown       | `<ThrowAwayModal />` | Slider + reason picker (`expired` / `unexpected_event` / `gift` / `used_up`). The reason determines whether it counts as waste — see `waste.md`. |
| Give away    | `<GiveAwayModal />`  | Slider + free-text recipient name. Doesn't count as waste.                     |
| Move         | `<MoveLocationModal />` | Slider + new location picker. Partial moves split the event.                |

All four sliders default to the full event quantity. Partial
amounts cause the backend to split the event into two: the
consumed/moved portion gets the new state/location, the rest
stays as a new active event with the same parent lineage. This is
why the catalog entry's "Partial-action history" tree exists —
those splits are the visible record.

## Restore button

Only appears for terminal events (`status !== 'active'`). Calls
`useRestoreEvent()` which flips the event back to active. From
the file's own note:

> The 7-day Undo toast handles in-session mistakes; this is for
> older mis-clicks (e.g. "I marked this thrown last week, want
> it back") and disaster recovery.

The button's `title="Flip this event back to active"` matches the
file note's intent.

## Delete behaviour

Plan principle from the file: no up-front confirm; deferred
mutation with Undo. The button:

1. Navigates to `/my-items` first (so the user is back on the
   list, not staring at a dead event detail page).
2. Runs the delete via `undoable.run` — toast appears with a
   visible Undo button; the actual mutation only commits if Undo
   isn't tapped within the toast window.

This is friendlier than a modal-confirm-then-delete, and the
toast undo covers the "oops" case without two clicks per delete.

## PriceCell

The `PriceCell` subcomponent renders up to three lines based on
what the event has (per Phase B of `catalog_evolution.md`):

1. **Original line** — `MYR 10.99 (cash)`. Always shown when any
   price is present.
2. **Display-currency conversion** — `≈ SGD 3.30 · rate 0.30 ·
   locked 2026-04-30 (stale)`. Only when original currency
   differs from the user's display currency. The `(stale)` flag
   surfaces in orange when the FX rate at save was older than the
   freshness window.
3. **Per-unit** — `SGD 1.83 / egg`. Only when `unit_price` is
   set; uses `display_currency` and `base_unit_label`.

The Price label's `title=` tooltip ("Original currency on top,
your display currency below if different, then per-unit price")
documents this layout for hover.

## Data sources

- `usePurchase(eventId)` — `/api/purchases/:id`. The event
  itself.
- `useCatalogEntry(catalog_name_norm)` — used to surface the
  parent catalog summary line.
- `useStores()` — resolves `store_id` to a display name.
- `useDeletePurchase()`, `useUpdatePurchase()`, `useRestoreEvent()`
  — the mutation set wired to action handlers.
- `useUndoableAction()` — wraps the delete mutation.
- `useUiStore.setRecentlyEditedPurchaseId` — cross-page hint for
  the list view's row highlight.

## Helper UX choices

- **Page-level expandable** — the page is dense (10+ field rows
  + several modals + state-dependent actions) and the conceptual
  bridge "this is *one* batch, not the item" is the most-asked
  question. Pinning that at top reduces confusion.
- **`Row` gained a `hint` prop** — keeps the field-grid layout
  unchanged but adds per-`<dt>` tooltips. Hover-only, so non-hover
  users see the same dense table they always saw.
- **Doubled tooltips on inline-editable values** — both the
  label and the value carry tooltips. Users frequently hover the
  value first ("what does this mean?") so duplicating is cheaper
  than hoping they'll find the label tooltip.
- **Diagnostic "State: X"** got a tooltip explaining it's the
  action-resolver state and decides which buttons appear. Without
  the tooltip, that line read like duplicate of the Status row.

## Known UI gaps

1. **Status row vs status chip duplication** — the colored chip
   at the top renders the friendly label, while the field row
   below shows the raw enum (`active`, `thrown`, `used`). The
   tooltip on the row label flags this; consider either dropping
   the row or rendering it through the same `getStatusBadge`
   helper.
2. **No price edit** — Price is read-only here. To correct a
   wrong price, the user has to delete and re-create the event.
   Inline price editing is a reasonable add — would need a
   currency-aware input plus FX-rate handling on save.
3. **Multi-pack id is opaque** — shows the first 8 chars of the
   parent id with "(sibling packs share this id)" as the only
   explanation. A "show siblings" link would surface them
   visually; not implemented.

## Not on this page (by design)

- Per-event drill into deep history — there's nothing deeper
  than one event.
- Aggregate / trend / cadence views for the same item — those
  live on the catalog entry page (`/catalog/:nameNorm`),
  reachable via the "→ View catalog entry" link.
- Bulk-edit several events — not implemented; do them one by one.

## Update discipline

When adding a new field to the event schema:

1. Add a `<Row>` to the field grid here with a `hint` prop. If
   the field's meaning isn't obvious from the label alone (it
   often isn't), invest 1–2 sentences.
2. Decide whether the field is inline-editable. If yes, mirror
   the Location/Expiry pattern (clickable value, modal or inline
   editor, save flow).
3. Update the `Composition` order above.

When adding a new action button:

1. Add the `id` + `label` + `severity` to
   `getPurchaseEventActions(event)`. Decide gating by state.
2. Wire the case in `handleAction()`. Either open a modal or
   navigate.
3. If the action is destructive, prefer the deferred-mutation +
   Undo pattern (like delete). Up-front modals are fine for
   actions that need a parameter (Use slider, Throw reason).

When adding a new auto-open `?edit=` target:

1. Add the case to the `useEffect` at top of the component.
2. Mirror in any cross-page navigation that should land on this
   target (typically a `Link to` with the param).
3. The param is consumed on first render — verify your new
   target preserves that behaviour so refresh doesn't re-trigger.

When changing the Restore semantics (e.g. allow restore only
within 30 days):

1. Update the **Restore button** section here.
2. Adjust the button's `title=` if the time window matters.
3. The undo toast and Restore solve overlapping problems; if you
   add restrictions, document why each is preferred for which
   case.
