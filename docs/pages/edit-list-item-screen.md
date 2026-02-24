# EditListItemScreen

**File:** `src/screens/lists/EditListItemScreen.tsx`
**Header Title:** Edit Item

## Objective

Edit price, quantity, and expiry date for a purchased shopping list item.

## User View

| Section | Data Displayed |
|---------|---------------|
| Item header | Item name + brand |
| Form fields | Price, Quantity, Expiry Date |

### Form Fields

| Field | Type | Default |
|-------|------|---------|
| Price | Decimal input with "$" prefix | Current price or empty |
| Quantity | Numeric input | Current quantity |
| Expiry Date | Date picker | Current expiry or none |

### Actions

| Button | Action |
|--------|--------|
| Save | Updates item in DB, navigates back |
| Clear expiry | Removes expiry date |
| Date picker | Opens native date picker |

## Functions & Processes

| Function | Description |
|----------|-------------|
| `loadItem()` | Fetches list item by ID |
| `handleSave()` | Updates price, quantity, expiry in DB |

## Filters

None (single item edit form).
