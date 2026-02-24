# AddListItemScreen

**File:** `src/screens/lists/AddListItemScreen.tsx`
**Header Title:** Add Items

## Objective

Add items to a shopping list with manual entry and smart suggestions based on inventory history.

## User View

| Section | Data Displayed |
|---------|---------------|
| Search bar | Filters suggestions in real-time |
| Manual add form | Name, Qty, Price inputs + Add button |
| Category/Unit selectors | Horizontal chip rows |
| Suggestion sections | Re-buy, Low Stock, Recent Items |

### Manual Add Form

| Field | Type | Required | Default |
|-------|------|----------|---------|
| Item name | Text | Yes | — |
| Quantity | Numeric | Yes | 1 |
| Price | Decimal | No | — |
| Category | Chip selector | Yes | First category |
| Unit | Chip selector | Yes | First unit |

### Suggestion Sections

| Section | Source | Description |
|---------|--------|-------------|
| Re-buy (Past Items) | `inventory.getPastItems()` | Items previously consumed/expired/discarded |
| Low Stock | `inventory.getActive()` where qty <= 1 | Items running low |
| Recent Items | Last 10 added items | Quick re-add |

Each suggestion shows: name, inventory quantity, brand, category color dot, and a quick "Add" button.

## Functions & Processes

| Function | Description |
|----------|-------------|
| `loadData()` | Fetches categories, units, active items, past items |
| `handleManualAdd()` | Validates form, creates list item in DB |
| `handleQuickAdd(suggestion)` | Adds suggestion directly to list with default qty/unit |
| Search filtering | Real-time filter across all suggestion sections |

## Filters

| Filter | Type | Options |
|--------|------|---------|
| Search | Text | Filters suggestion items by name |
