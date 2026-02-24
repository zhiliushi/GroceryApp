# PastItemsScreen

**File:** `src/screens/inventory/PastItemsScreen.tsx`
**Header Title:** Past Items

## Objective

Dedicated page for viewing items that have been consumed, expired, or discarded. Allows searching, filtering by status, and navigating to detail to restore items.

## User View

| Section | Data Displayed |
|---------|---------------|
| Search bar | Text input to filter past items |
| Status filter chips | All, Used Up, Expired, Discarded |
| Item count | Total filtered items |
| Item list | Cards showing past items with status indicators |

### Item Card

| Column | Data |
|--------|------|
| Product image | Image or placeholder |
| Name | Item name |
| Brand | Brand (if set) |
| Quantity + unit | e.g. "0 pcs" |
| Category badge | Category name with color |
| Status indicator | Icon + label: Used Up (green), Expired (red), Discarded (orange) |
| Location badge | Storage location |

## Functions & Processes

| Function | Description |
|----------|-------------|
| `loadData()` | Fetches `inventory.getPastItems()` + categories, builds view models |
| `onRefresh()` | Pull-to-refresh reloads data |
| Focus listener | Reloads data when screen regains focus (e.g. after restoring an item) |
| Item tap | Navigates to InventoryDetailScreen where user can Restore or Delete |

## Filters

| Filter | Type | Options |
|--------|------|---------|
| Search | Text | Matches name, brand, category name |
| Status | Chip row | All (default), Used Up (`consumed`), Expired (`expired`), Discarded (`discarded`) |
| Sort | Automatic | Most recent first (by `addedDate` descending) |
