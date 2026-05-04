# My Catalog (list)

Route: `/catalog`
File: `backend/web-admin/src/pages/catalog/CatalogListPage.tsx`
Sister page (drill-down): `/catalog/:nameNorm` →
`backend/web-admin/src/pages/catalog/CatalogEntryPage.tsx` (own
doc later).
Backend: `backend/app/services/catalog_service.py`.
Project doc: `docs/CATALOG_SYSTEM.md`.

## Purpose

The user's reusable list of *named items* — one row per unique
`(user_id, name_norm)`. Catalog is the identity layer of the app's
data model: every purchase event references a catalog entry, and
the catalog never disappears even when the underlying purchase
events change status. The list page is the user's entry point for
"what do I keep buying?" + a quick-add launcher for repeat
purchases.

Conceptually distinct from:

- **My Items** (`/my-items`) — every purchase event, can be many
  per catalog entry.
- **Storage** (`/storage`) — where active items physically sit.

## Composition (render order)

1. Breadcrumbs — Dashboard › My Catalog.
2. `<PageHeader title="My Catalog" icon="📚" />`.
3. **"ⓘ What is My Catalog?" expandable** — the most opinionated
   helper of any page in the app. Catalog vs My Items vs Storage
   is the single most-confused concept in the data model, so the
   helper makes the distinction explicit, explains what each sort
   option emphasises, calls out the search-resets-to-alphabetical
   quirk, and clarifies the 🏷️ barcode badge.
4. **Search + Sort row**:
   - Search input (substring prefix match on `name_norm`). `title=`
     reminds the user the search is a *prefix* match (so "tomato"
     finds "tomato sauce" but "sauce" doesn't find "tomato sauce").
   - Sort dropdown — `Last bought` (default) / `Most bought` /
     `Alphabetical`. Dropdown carries a `title=` warning that
     searching temporarily switches to alphabetical (see "Search
     quirk" below).
5. **Counter line** — `N{+} entries · K linked to barcode`. The
   barcode-linked count is wrapped in a `title=` tooltip
   explaining barcode-less items are first-class.
6. **Body** —
   - Loading: `<SkeletonList count={8} />`.
   - Empty + has search: "No matching entries."
   - Empty + no search: "Your catalog is empty — add some items
     first."
   - Sort = alphabetical OR search active: A/B/C section headers
     above each letter group.
   - Sort = last bought / most bought: flat list, no headers.
7. **Infinite-scroll sentinel** — fetches the next page when in
   view (50 entries per page).
8. `<QuickAddModal />` — opens when **+ Add** on a row is tapped,
   pre-filled with the catalog entry so the user doesn't retype.

## CatalogRow

Each row carries:

- **Display name** — `display_name` from the entry, truncated.
- **🏷️ Barcode** — only when the entry has one. Tooltip shows the
  full barcode value.
- **`{N}× bought`** — `total_purchases` count. Tooltip explains
  it's the lifetime count.
- **`{N} active`** — `active_purchases` count, in green. Hidden
  when zero. Tooltip clarifies "active = not yet used or thrown".
- **`+ Add` button** — opens QuickAddModal pre-filled with this
  entry. Tooltip clarifies "log another purchase without retyping
  the name".

The row link target is `/catalog/:name_norm` (the drill-down
page). The whole row body is a Link with `flex-1`; the **+ Add**
button is a sibling button inside the same flex container so the
two interactions don't nest.

## Sort options

Single source: `_SORT_FIELDS` in
`backend/app/services/catalog_service.py:113`.

| Key                  | Field                  | Direction | UI label       |
| -------------------- | ---------------------- | --------- | -------------- |
| `last_purchased_at`  | `last_purchased_at`    | DESC      | Last bought    |
| `total_purchases`    | `total_purchases`      | DESC      | Most bought    |
| `display_name`       | `display_name`         | ASC       | Alphabetical   |

Default is `last_purchased_at` — recently active items at the top
matches "what's on my mind" thinking. `total_purchases` surfaces
staples (rice, eggs, soy sauce). `display_name` is the index view
with A/B/C headers added in the UI.

## Search quirk (worth knowing about)

Backend behaviour at `catalog_service.py:158-162`:

> With a `name_norm` range filter active, Firestore requires the
> first `order_by` to match the inequality field. The list endpoint
> overrides the user-requested sort to `name_norm` ASC whenever
> the search query is non-empty.

The UI mirrors this server-side behaviour by switching the
client-side grouping to letter sections whenever search is active
(condition: `sortBy === 'display_name'` triggers the grouped
render — but search results are *also* alphabetical at the
backend, so the un-grouped flat render still happens to be in
order). The search input's `title=` tooltip and the sort
dropdown's `title=` both surface the trade-off so users don't
think the sort dropdown silently broke.

If we ever want a non-alphabetical search ranking, the backend
would need a different index strategy — flag if/when product
demands it.

## Pagination

`useCatalogInfinite({ q, sort_by, limit: 50 })` — opaque
cursor-based pagination. The hook flattens `data.pages[].items`
into one list. The fetch-next sentinel mounts after the body and
intersects when scrolled into view; auto-fetches if
`hasNextPage && !isFetchingNextPage`.

Counter line shows `N+ entries` while there's a next page, `N
entries` once we've loaded the tail.

Cursor implementation note (server-side, for context): cursors
are `[sort_value, doc_id]` decoded into a doc snapshot for
`start_after` — necessary because dict-form cursors silently
no-op on some Python SDK versions. See `catalog_service.py:177-182`.

## Data sources

- `useCatalogInfinite` — `/api/catalog?q=…&sort_by=…&limit=50&cursor=…`.
  Cache key includes `q` and `sort_by` so switching either resets
  the page list.
- `<QuickAddModal />` — handles its own `useCreatePurchase` /
  `useCreateCatalogEntry` mutations on submit. Pre-fills the
  catalog entry from the row clicked.

## Quick-Add via row vs floating button

The **+ Add** row button and the page's floating Add/Scan pills
both open `<QuickAddModal />`, but with different defaults:

- **Row button**: `defaults.catalogEntry` set → name + barcode
  pre-filled, user just enters expiry / qty / price.
- **Floating Add pill**: no defaults → user picks catalog entry
  via autocomplete.

The row path is the fast path for "I bought this again" — usually
1–2 taps to log. Floating pill is the path for new items.

## Helper UX choices

- **Front-load the conceptual helper** — the catalog vs My Items
  vs Storage distinction is the most-confused topic from feedback;
  the helper expandable lives at the top so a new user can read it
  before scrolling rows.
- **Per-stat label tooltips on the row** — `total_purchases`,
  `active_purchases`, and the barcode badge are all small, dense,
  and easy to misread. Tooltips reinforce.
- **Search + Sort tooltip cross-reference** — both controls carry
  copy about the search-resets-sort behaviour so wherever the user
  hovers, they see the same explanation.
- **Tooltip on +Add button** — surfaces the side-effect ("opens
  modal, pre-filled") so the row tap feels deliberate.

## Not on this page (by design)

- Per-entry purchase history, expiry trends, delete — drill into
  `/catalog/:name_norm`.
- Cross-entry merge / catalog cleanup — lives in
  `<MergeNudgeWidget />` on `/settings`.
- Admin-side aggregate catalog analysis — `/admin/catalog-analysis`.

## Update discipline

When adding a new sort option:

1. Add a row to `_SORT_FIELDS` in `catalog_service.py`.
2. Add the matching `<option>` to the dropdown in
   `CatalogListPage.tsx`.
3. Add a row to the **Sort options** table here.
4. Decide whether grouped rendering should kick in for the new
   sort (currently only `display_name` triggers letter sections).
5. Verify the dropdown still works while a search is active — the
   "search overrides sort" behaviour applies to every sort.

When changing search semantics (e.g. fuzzy or full-text):

1. Update **Search quirk** here.
2. Update the search input's `title=` tooltip to match.
3. Update the helper expandable's "Search" paragraph.
4. Reconsider whether the sort dropdown should stay disabled
   during search, get re-enabled, or split into a separate "while
   searching" axis.

When adding a row stat (e.g. `last_paid_amount`):

1. Add it to the row's right-hand stat group (alongside `bought`
   and `active`).
2. Add a `title=` tooltip explaining it.
3. Update the **CatalogRow** section here.

When adding a column to the catalog itself (e.g. `category`):

1. Update `docs/CATALOG_SYSTEM.md` schema.
2. Decide whether it surfaces on this list page or only on the
   drill-down page.
3. Mirror the decision in the helper expandable so users know
   it's there.
