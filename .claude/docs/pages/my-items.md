# My Items + Purchase Event Detail

Routes:
- `/my-items` → `pages/my-items/MyItemsPage.tsx`
- `/my-items/:eventId` → `pages/my-items/PurchaseEventDetailPage.tsx`
- `/inventory` redirects to `/my-items` (Phase 6b compat)

## MyItemsPage

### Purpose

The refactored inventory page. Lists active purchase events grouped by urgency, with inline state-driven action buttons. Replaces the legacy `pages/inventory/InventoryListPage.tsx` (no longer routed).

### Groups (computed client-side from `usePurchases({status:'active'})`)

| Group | Predicate |
|---|---|
| Expiring soon | `expiry_date ≤ now+7d` (includes already-expired) |
| Active | has `expiry_date > 7d` away, OR no expiry but bought within last 7 days |
| No expiry tracked | no `expiry_date` AND `date_bought < now-7d` |

### Row component (`PurchaseEventRow`)

- Left: `{catalog_display}` + `{quantity×}` + `<ExpiryCountdownChip />` + location + price
- Right: up to 3 state-driven action buttons from `getPurchaseEventActions(event)` in `utils/actionResolver.ts`
- Click anywhere (except buttons) → navigate to `/my-items/{event.id}`
- Border tinted by state (expired = red, urgent = orange, soon = yellow)

### Action handlers

- `mark_used` → `useChangePurchaseStatus` with `{status:'used', reason:'used_up'}`
- `mark_thrown` → opens `<ThrowAwayModal />` with reason picker (expired / bad / used_up / gift)
- `give_away` → opens `<GiveAwayModal />` with foodbank or free-text recipient
- `delete` → `window.confirm` → `useDeletePurchase`

### Empty state

Shown when total active count is 0 — "Add your first item" hero CTA opens QuickAddModal.

## PurchaseEventDetailPage

### Purpose

Drill-down from a `MyItems` row or a `Reminders` card. Shows every field with inline-editable expiry + location, state-driven primary actions.

### Inline-edit pattern

- Click `📍 {location} ✎` → select dropdown + Save/Cancel → `useUpdatePurchase` with `{location}`
- Click `{expiry_date} ✎` → `<ExpiryInput />` with NL preview → Save/Cancel → `useUpdatePurchase` with `{expiry_raw}`

### Actions panel

Renders the full list from `getPurchaseEventActions(event)`. Handlers:
- `mark_thrown` / `give_away` → modals (same as MyItemsPage)
- `set_expiry` → set inline editor open
- `set_location` / `move_location` → set inline editor open
- `delete` → confirm → `useDeletePurchase` → navigate back to `/my-items`
- `view_history` → navigate to `/catalog/{catalog_name_norm}`

### Catalog cross-link

Below fields, a "Catalog info" block from `useCatalogEntry(event.catalog_name_norm)` — shows `total_purchases / active_purchases` and links to `/catalog/{name_norm}`.
