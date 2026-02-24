# ListDetailScreen

**File:** `src/screens/lists/ListDetailScreen.tsx`
**Header Title:** List (dynamic name)

## Objective

View and manage items within a shopping list. Check off purchased items, edit quantities, and proceed to checkout.

## User View

| Section | Data Displayed |
|---------|---------------|
| Progress header | "X / Y items" + progress bar |
| Items grouped by category | Category headers with color dot, item count |
| Per-item row | Checkbox, name, quantity + unit, price (if set) |
| Checkout button | Appears when purchased items exist |
| FAB | "Add Item" (when list is not checked out) |

### Item Row

| Column | Data |
|--------|------|
| Checkbox | Toggle purchased status |
| Item name | Strikethrough + dimmed if purchased |
| Quantity + unit | e.g. "2 pcs" |
| Price | Formatted price (if set) |
| Close icon | Remove item from list |

### Category Header

| Column | Data |
|--------|------|
| Color dot | Category color |
| Category name | e.g. "Dairy" |
| Item count | Number of items in category |

### Header Menu

| Option | Action |
|--------|--------|
| Rename List | Opens rename dialog |
| Mark All Purchased | Toggles all items to purchased |
| Complete List | Marks list as completed |

## Functions & Processes

| Function | Description |
|----------|-------------|
| `loadList()` | Fetches list metadata + all list items |
| `handleTogglePurchased(item)` | Toggles purchased status on item model |
| `handleRemoveItem(item)` | Removes item from list |
| `handleEditQuantity(item, qty)` | Updates item quantity via dialog |
| `handleRenameList(name)` | Updates list name in DB |
| Tap purchased item | Navigates to EditListItem for price/expiry/qty |
| Focus listener | Reloads on screen focus |

## Filters

None (shows all items in the list, grouped by category).
