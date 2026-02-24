# ShoppingListsScreen

**File:** `src/screens/lists/ShoppingListsScreen.tsx`
**Tab:** Shopping Tab (entry point)
**Header Title:** Shopping

## Objective

Manage shopping lists — create new lists, view active lists and purchase history, and access list details.

## User View

| Section | Data Displayed |
|---------|---------------|
| Filter chips | Active, Purchase History |
| List cards | Shopping list cards with progress and metadata |
| FAB | "New List" floating action button |
| Create dialog | Input for new list name |

### List Card

| Column | Data |
|--------|------|
| List name | Name of the shopping list |
| Created date | When the list was created |
| Progress | "X / Y items" + progress bar |
| Total price | Sum of item prices (purchase history only) |
| Completion icon | Check-circle if fully purchased |

### Swipe Actions

| Swipe | Action |
|-------|--------|
| Right → Copy (blue) | Duplicate the list |
| Right → Delete (red) | Confirm delete dialog |

### Context Menu (3-dot button)

| Option | Action |
|--------|--------|
| Mark Complete / Reopen | Toggle list completion status |
| Duplicate | Create a copy of the list |
| Share | Share list (if available) |
| Delete | Confirm delete dialog |

## Functions & Processes

| Function | Description |
|----------|-------------|
| `loadLists()` | Fetches all shopping lists |
| `handleCreateList(name)` | Creates new list, navigates to ListDetail |
| `handleDelete(list)` | Confirm dialog, deletes list and all items |
| `handleDuplicate(list)` | Copies list with all items |
| Focus listener | Reloads on screen focus |

## Filters

| Filter | Type | Options |
|--------|------|---------|
| Status | Chip row | Active (not checked out), Purchase History (checked out) |
