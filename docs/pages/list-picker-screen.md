# ListPickerScreen

**File:** `src/screens/lists/ListPickerScreen.tsx`
**Header Title:** Choose a Shopping List

## Objective

After scanning a barcode from the Scan tab, the user picks which shopping list to add the product to.

## User View

| Section | Data Displayed |
|---------|---------------|
| List cards | Card for each active shopping list (name + date) |
| FAB | "New List" to create and add to a new list |
| Create dialog | Input for new list name |

### List Card

| Column | Data |
|--------|------|
| List name | Name of the shopping list |
| Created date | When the list was created |

## Functions & Processes

| Function | Description |
|----------|-------------|
| `loadLists()` | Fetches all active (non-checked-out) shopping lists |
| Tap list | Navigates to AddListItem with selected listId + barcode prefill data |
| `handleCreateList(name)` | Creates new list, navigates to AddListItem with prefill |

## Filters

None (shows all active lists).
