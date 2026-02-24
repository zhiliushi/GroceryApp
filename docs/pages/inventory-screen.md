# InventoryScreen

**File:** `src/screens/inventory/InventoryScreen.tsx`
**Tab:** Inventory Tab (entry point)
**Header Title:** All Items

## Objective

Display all active inventory items grouped by storage location, with search, filtering, sorting, and two view modes (list/grid).

## User View

| Section | Data Displayed |
|---------|---------------|
| Search bar | Text input to filter items |
| View toggle | Switch between list and grid mode |
| Filter chips | All, Expiring Soon, Expired + Past Items navigation chip |
| Sort menu | Date Added, Expiry Date, Name, Category |
| Item count bar | Total filtered items + current sort label |
| Item list (list mode) | Grouped by location with collapsible sections |
| Item grid (grid mode) | Flat 2-column grid of compact cards |
| FAB | "Add Item" floating action button |

### List Mode — Location Sections

| Column | Data |
|--------|------|
| Section header | Location icon, label, item count, expiring/expired counts |
| Item card | Name, brand, quantity + unit, category badge, expiry status, location badge |

### Grid Mode — Item Cards

| Column | Data |
|--------|------|
| Card | Product image (or placeholder), name, quantity + unit, expiry label or status |

### Swipe Actions (list mode only)

| Swipe | Action |
|-------|--------|
| Right → Edit (blue) | Navigate to edit item |
| Right → Delete (red) | Confirm delete dialog |

## Functions & Processes

| Function | Description |
|----------|-------------|
| `loadData()` | Fetches active items + categories, builds `InventoryItemView[]` |
| `resolveItems()` | Applies search, filter, and sort to item list |
| `toggleSection(location)` | Expands/collapses a location section |
| `handleDelete(item)` | Shows confirm dialog, deletes item from database |
| `onRefresh()` | Pull-to-refresh reloads all data |
| Focus listener | Reloads data when screen regains focus (e.g. after detail screen) |

## Filters

| Filter | Type | Options |
|--------|------|---------|
| Search | Text | Matches name, brand, category name |
| Status filter | Chip row | All, Expiring Soon (next 7 days), Expired (past due) |
| Sort | Menu | Date Added (default), Expiry Date, Name, Category |
| View mode | Toggle | List (grouped by location) / Grid (flat) |

**Past Items chip** — navigates to the dedicated PastItemsScreen (not a filter).
