# Shopping Lists Page

> **Status: v3 BETA SHIPPED 2026-05-04.** Three-step model:
> list → compare → checkout. Primary + alternatives data model;
> only alternatives are tickable; checkout = ticked subset.
> Caps: 15 primaries / 3 alternatives per primary (beta). Customer-feedback
> hook for cap revisits is parked (raspberry-pi + AI capture, future).
>
> v2 (read-only admin → user-side transit list with prices + per-item Buy)
> shipped 2026-05-03. v3 builds on v2's frontend; per-item Buy button
> removed in favor of the tick-then-confirm checkout flow.

## How this page maps to the architectural principles

(See `.claude/docs/project_context.md` "Architectural Principles" for the
canonical statement.)

- **P1 (Catalog = source of truth)**: Every primary references a catalog
  entry via `source_catalog_name_norm`. Adding a primary with a custom
  free-text name routes through `catalog_service.upsert_catalog_entry`,
  which fires the standard quota check (free-tier 50 cap on user_custom
  rows). Alternatives carrying a custom `candidate_name` or new barcode
  do the same. Existing-name picks (autocomplete match) consume zero
  quota. Per-instance values (price, qty, weight, volume) live ON the
  shopping-list item / alternative, NEVER on the catalog row.
- **P2 (Currency = UI-only)**: Each alternative stores its `(price,
  currency)` pair as entered by the user. The CheckoutFooter displays
  totals in the user's `currency_preference` with FX estimates for
  off-currency lines, but does NOT persist converted amounts. A
  purchase event created at checkout carries the price exactly as the
  alternative listed it.
- **P3 (State machine)**: Shopping-list items are TRANSIT.
  - `transit → storage`: confirm_checkout creates `purchase_events`
    (status=active) and cascade-deletes the source primaries + sibling
    alternatives. Single direction.
  - `transit → gone`: TTL sweep (30d) or manual delete. No record kept;
    transit items had no real value to track.
  - The page never operates on STORAGE or PAST states — those are
    handled by My Items / Storage / catalog detail.

Routes:
- `/shopping-lists` — list of shopping lists for the current user
- `/shopping-lists/:listId` — detail view (line items + price comparisons)

Files (target):
- `backend/web-admin/src/pages/shopping-lists/ShoppingListsPage.tsx`
- `backend/web-admin/src/pages/shopping-lists/ShoppingListDetailPage.tsx`

Replaces the current admin-style read-only views (no add/create/buy
actions today — confirmed 2026-05-03 across page, API, and service
layer).

## Purpose

A **transit list of things to buy.** Not a catalog. Items here are
intentions, not inventory. When the user "buys" an item, it leaves
this list and joins the catalog/purchase model via the existing
`QuickAddModal` flow.

## Why this page exists alongside Catalog and My Items

Three distinct mental models, three distinct pages:

- **/shopping-lists/:listId** — *intent view*. "What I want to buy
  next." Transit, optional fields, optional price comparison.
- **/my-items** — *consumption view*. "What I already own and need to
  use before it expires."
- **/catalog/:nameNorm** — *manager view per item*. Lifetime stats per
  named item across all locations.

Conflating any pair would muddy the view: intentions buried under
inventory, inventory buried under analytics.

## Lifecycle and quotas

- **Transit**: items auto-clear **30 days after `addedAt`**. APScheduler
  job runs daily (see `backend/app/services/scheduler.py` for the
  existing pattern).
- **Per-list cap**: **50 items max**. Enforced server-side on item POST
  with a 409 + `QuotaExceededDetails`-shaped response; UI surfaces a
  quota banner like the existing `QuotaHitPicker` pattern.
- **Catalog quota separation**: shopping-list items DO NOT count
  against the catalog item quota (`up to 50` for free tier). They are
  a distinct collection with their own cap.
- **List count cap**: unchanged from existing tier matrix — 3 for
  free, unlimited for plus/pro (see `feature-inventory.md` and user
  manual section 9).

## Data model

```
users/{uid}/shopping_lists/{list_id}
  name: string
  created_at, updated_at, schema_version=2, source
  item_count: int   # denormalized; reconciled on write

users/{uid}/shopping_lists/{list_id}/items/{item_id}
  itemName: string                # required
  nameNorm: string                # normalized for catalog matching at buy time
  quantity: number | null         # optional
  weight: { value, unit } | null  # optional, e.g. { 500, "g" }
  volume: { value, unit } | null  # optional, e.g. { 1, "L" }
  unit: string | null             # for plain-count units
  notes: string | null            # optional
  barcode: string | null          # if scanned
  sourceCatalogId: string | null  # if added from catalog/item detail
  prices: PriceComparison[]       # array, ≤10 entries
  addedAt: timestamp              # for 30d TTL
  schema_version=2
```

`PriceComparison` (array element on item — NOT a separate collection;
≤10 entries per item, no separate cap):

```
{
  id: string                # uuid
  brand: string | null
  price: number             # required
  currency: string          # default 'SGD'
  store: string | null      # store name, free-text or StoreSelect-picked
  barcode: string | null    # if added via in-row scan
  addedAt: timestamp
}
```

**Schema-bump rationale.** The existing `users/{uid}/shopping_lists`
collection is read-only and has unknown shape. `schema_version=2`
flags the new shape; legacy docs (if any) keep working at v1 for read
but are not mutated. Migration job (one-shot, optional) can backfill
v1 → v2 if usage data shows it's worth the effort.

## Composition — list page

1. **Header**: "Shopping Lists" + count + `[+ New list]` button.
2. **Card grid**: one card per list — name, item count (live or
   cached), age, soonest-to-expire indicator (any item nearing 30d
   TTL), `[Open]`. Empty state: friendly hint + `[+ New list]`.
3. **Tier banner** if user is at the list-count cap: "You've used 3 of
   3 lists — upgrade for unlimited."

## Composition — detail page

1. **Breadcrumb**: Shopping Lists → {list name}.
2. **Header**: list name (inline-edit) + item count (`N/50`) + age +
   `[Delete list]`.
3. **Add row** (always at top): three entry points unified into one
   strip —
   - **Manual**: name input + optional qty/weight/volume → `[+ Add]`.
   - **From catalog**: `[Browse catalog]` opens an autocomplete
     dropdown reusing `CatalogAutocomplete`.
   - **Scan**: `[📷 Scan]` opens `ContextualScannerModal` in the
     existing `shopping-lists` context branch (already stubbed at
     `ContextualScannerModal.tsx:54-55`). Result → adds an item with
     `barcode` set; if catalog-matched, prefills `itemName`.
4. **Item rows** (one per item, expandable):
   - **Collapsed**: name, qty/weight/volume summary, lowest recorded
     price (if any), `[Buy]` `[Edit]` `[Delete]` `[▾]`.
   - **Expanded**: price comparison sub-table — brand, store, price,
     barcode, `[+ Add price]` row that opens a small inline form OR
     `[📷 Scan to add price]` (same scanner, different in-row context).
     Each price has `[Delete]`. Sortable by price.
5. **Quota banner** if list at 50 items.
6. **Empty state**: "Nothing on the list yet — add manually, browse
   catalog, or scan."

## Buy flow

`[Buy]` on a row:

1. If item has **multiple prices recorded** → picker dialog: "Which
   one are you buying?" Options: each price entry + "Different one
   (rescan)" + "Manual entry."
2. Selection (or single-price / no-price item) → opens
   **`QuickAddModal`** with `defaults` pre-populated:
   - `name` = item.itemName
   - `barcode` = selected price's barcode OR item.barcode
   - `price`, `currency` = from selected price entry
   - `quantity`, `unit`, `weight`, `volume` = from item
   - `catalogEntry` = item.sourceCatalogId resolved (so existing
     CatalogAutocomplete match logic short-circuits)
3. User confirms storage location + any remaining fields → existing
   `useCreatePurchase` mutation fires.
4. On success → shopping-list item is **deleted** (soft: optional
   `purchasedAt` field for analytics; hard delete fine for v1).
5. Optimistic UI: the row visually crosses out and disappears after
   the mutation settles.

**No new modal.** The buy flow is QuickAddModal + a thin price-picker
preceding it. This is the single biggest reuse — defer detailed
review to next session.

## Cross-page integration

- **Catalog item detail** (`/catalog/:nameNorm`) — add an
  `[+ Add to shopping list]` button. Opens a small picker: which
  list? + optional qty. Posts to
  `POST /shopping-lists/{listId}/items` with
  `sourceCatalogId={nameNorm}`.
- **Item overview** (wherever a generic item appears: dashboard
  expiring soon, my-items rows) — same button, same picker.
- **ContextualScannerModal** — the `'shopping-lists'` context branch
  needs to actually do something. Currently a no-op stub. Wire it to
  add-item-by-barcode against the active list (read from URL).

## API endpoints to add

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/shopping-lists` | Create list |
| GET | `/api/shopping-lists` | List user's lists |
| GET | `/api/shopping-lists/{listId}` | Get list + items |
| PATCH | `/api/shopping-lists/{listId}` | Rename list |
| DELETE | `/api/shopping-lists/{listId}` | Delete list (cascade items) |
| POST | `/api/shopping-lists/{listId}/items` | Add item (manual / catalog / scan) |
| PATCH | `/api/shopping-lists/{listId}/items/{itemId}` | Edit item |
| DELETE | `/api/shopping-lists/{listId}/items/{itemId}` | Remove item |
| POST | `/api/shopping-lists/{listId}/items/{itemId}/prices` | Add price comparison entry |
| DELETE | `/api/shopping-lists/{listId}/items/{itemId}/prices/{priceId}` | Remove price entry |
| POST | `/api/shopping-lists/{listId}/items/{itemId}/buy` | Buy flow — server-side: validates, returns prefilled QuickAdd payload (frontend then drives the existing purchase POST). Removes the shopping-list item on success. |

Existing admin GETs at `/api/admin/shopping-lists*` stay as-is for
the admin cross-user view (separate page, separate concern).

## Service layer

`backend/app/services/shopping_list_service.py` is read-only today.
Add mutation functions:
- `create_list`, `update_list`, `delete_list`
- `add_item`, `update_item`, `delete_item` (with quota enforcement)
- `add_price`, `delete_price`
- `record_buy` (deletes item; the actual purchase POST runs through
  existing `purchase_service`)
- `sweep_expired_items(now)` — TTL job, called daily by APScheduler

## Modals reused

- `QuickAddModal` — buy flow uses with prefilled defaults.
- `ContextualScannerModal` — already has a `'shopping-lists'` context
  branch ([line 54-55](F:\ClaudeProjects\GroceryApp\backend\web-admin\src\components\barcode\ContextualScannerModal.tsx#L54)); extend, don't duplicate.
- `CatalogAutocomplete` — for "Browse catalog" entry point.
- `StoreSelect` — for the store field on price comparison rows.
- `QuotaHitPicker` — for the 50-item / 3-list quota walls.

## Modals new

- **AddPriceInlineForm** (small inline component, not a modal) —
  brand / price / currency / store / `[📷 Scan]` (sets barcode).
- **PricePickerDialog** (small modal) — opens when user clicks `[Buy]`
  and item has multiple prices. Picks which price → defaults for
  QuickAddModal.

## Hooks new (`backend/web-admin/src/api/queries/useShoppingLists.ts`)

Existing: `useShoppingLists`, `useShoppingListDetail`. Add:

- `useCreateShoppingList`, `useDeleteShoppingList`, `useRenameShoppingList`
- `useAddShoppingListItem`, `useUpdateShoppingListItem`, `useDeleteShoppingListItem`
- `useAddPrice`, `useDeletePrice`
- `useBuyShoppingListItem` — composes with `useCreatePurchase`

## Tier and feature-flag wiring

- Page tier: free (unchanged).
- Tier-gated subsections from current matrix: `checkout_flow`,
  `trip_notes`, `receipt_scanning` are **plus**. Mapping to the new
  design:
  - `checkout_flow` → maybe maps to "Buy multiple items at once"
    (multi-row buy). Defer to next session.
  - `trip_notes` → list-level notes field. Defer.
  - `receipt_scanning` → already exists via ReceiptScanModal; can
    add a "destination = shopping list" option (currently
    `receipt.py` already has this side-door).
- New flag: `shopping_list_v2_enabled` — gate the whole refactor so
  it can ship behind a flag and be flipped per-tier in development.

## Documentation touchpoints (per CLAUDE.md discipline)

When implementation lands, update **in the same PR**:
- `backend/web-admin/src/pages/help/UserManualPage.tsx` — section 4
  (actions) + section 9 (tiers).
- `.claude/docs/feature-inventory.md` — Shopping Lists row.
- This doc — flip status from "design" to "shipped" + remove TODOs.

## Redundancy candidates (review next session)

These are reuse questions to resolve before writing code:

1. **PriceRecord vs PriceComparison.** `types/api.ts` has a
   `PriceRecord` interface (line ~184). Is it user-visible? Used
   anywhere? Should shopping-list price comparison entries write
   into the same store (`/users/{uid}/price_records`) so
   `/catalog/:nameNorm` price-by-store can index them?
2. **CatalogAutocomplete coverage.** Does it already filter to active
   catalog entries? Will using it inside the "Browse catalog" entry
   point need a different mode (transit vs. owned)?
3. **`ContextualScannerModal` shopping-lists branch.** Currently a
   stub. Does extending it stay within its single-modal-deep
   principle, or does the shopping-list flow need its own scanner
   wrapper?
4. **QuickAddModal payload coverage.** It currently handles single +
   multi-pack. The shopping-list buy flow only feeds it single-pack
   data. Confirm: does any field in the shopping-list item have NO
   QuickAddModal counterpart? (weight/volume might — needs check.)
5. **Receipt-scan side door.** `receipt.py:354 _save_to_shopping_list`
   already adds items via destination=shopping_list. Should it call
   the new `add_item` service (with quota enforcement) instead of
   writing directly?
6. **Mobile compat shim.** `legacy_item_shim.py` has zero shopping
   reference. If mobile shipped a list-create flow at any point,
   surface it now or accept the divergence.
7. **`isCompleted` field on `ShoppingList`.** Already in the type but
   never written. Is it leftover or intended for v2 list-level state?
8. **Existing `/shopping-lists/{uid}/{listId}` route.** New design
   drops the `:uid` segment (user is implicit from auth). Admin view
   keeps the cross-user route under `/api/admin/`. Confirm router
   changes.

## Tier-gated subsections

- `trip_notes` (plus) — **shipped 2026-05-03**. Inline-edited `notes` field
  (≤1000 chars) on the list-detail page header. Backend allows always;
  frontend hides editor when `canUseTool('trip_notes')` is false.
- `receipt_scanning` (plus) — **shipped 2026-05-03** via embedded
  `<ScanReceiptButton destination="shopping_list" />` on the detail page.
  Re-uses the existing receipt OCR flow (Mindee). The component handles
  its own tier-gate via `canUseTool('receipt_scanning_ocr')`.
- `checkout_flow` (plus) — **NOT YET IMPLEMENTED**. Open question:
  - Concept A: "trip mode" — full-screen view of the active list with
    each item rendered as a checkable card; scan or tap to mark "got
    this," reach the bottom and a single Buy-All button opens
    QuickAddModal once per item with prefilled defaults. Optimised for
    use IN the store with phone in hand.
  - Concept B: "bulk Buy" on the existing detail page — multi-select
    items (checkboxes), then a "Buy all selected" button that runs the
    Buy flow N times in sequence with a single confirmation summary.
  - Concept C: a different design Shahir has in mind.
  Requires user input on intent (in-store vs at-home, single-flow vs
  per-item confirmation) before implementation. Tracked here.

## Out of scope (explicitly deferred)

- Sharing a list with household members.
- Recurring lists / templates ("weekly groceries").
- Smart suggestions ("you usually buy eggs every 2 weeks").
- Push notifications when a recurring item is due.
- Mobile app integration.
