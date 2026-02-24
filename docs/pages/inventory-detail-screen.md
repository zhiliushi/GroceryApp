# InventoryDetailScreen

**File:** `src/screens/inventory/InventoryDetailScreen.tsx`
**Header Title:** Item Details

## Objective

Full detail view of a single inventory item with quantity management, editing, location transfer, and lifecycle controls (mark consumed, restore, delete).

## User View

| Section | Data Displayed |
|---------|---------------|
| Status badge | Chip showing "Used Up", "Expired", or "Discarded" (non-active items only) |
| Item header | Name, brand |
| Details table | Category, Quantity (with stepper), Price, Barcode, Location, Purchase date, Expiry date, Notes, Status |
| Remaining section | Progress bar + percentage + Used Quarter / Used Half / Revert buttons (active items with qty > 0) |
| Action buttons | Varies by item status (see below) |

### Details Table

| Row | Value |
|-----|-------|
| Category | Category name |
| Quantity | Current qty + unit with +/- stepper (active only) |
| Price | Formatted price or "—" |
| Barcode | Barcode string (if set) |
| Location | Capitalised location name |
| Purchased | Formatted date (if set) |
| Expires | Formatted date, red if expired, orange if expiring |
| Notes | Free text (if set) |
| Status | Active / Used Up / Expired / Discarded |

### Quantity Controls

| Button | Effect |
|--------|--------|
| `-` stepper | Subtract 1 from quantity |
| `+` stepper | Add 1 to quantity |
| Used Quarter | Subtract 25% of initial quantity (fractional, rounded to 2 decimals) |
| Used Half | Subtract 50% of initial quantity (fractional, rounded to 2 decimals) |
| Revert | Reset to initial quantity |

When quantity reaches 0, an "Item Finished — Transfer to Past Items?" popup appears.

### Action Buttons by Status

| Status | Available Actions |
|--------|-------------------|
| **Active** | Edit, Transfer (location), Mark Used (Used Up / Expired / Discarded), Delete |
| **Consumed / Expired** | Restore to Inventory, Move to Past Items, Edit, Delete |
| **Discarded** | Restore to Inventory, Edit, Delete |

## Functions & Processes

| Function | Description |
|----------|-------------|
| `loadItem()` | Fetches item by ID, resolves category + unit names |
| `adjustAndCheck(newQty)` | Clamps to 0, rounds to 2 decimals, updates DB, triggers popup if 0 |
| `handleUseQuarter()` | Subtracts 25% of initial qty |
| `handleUseHalf()` | Subtracts 50% of initial qty |
| `handleRevert()` | Resets quantity to initial value |
| `showTransferToPastPopup()` | Alert: cancel or transfer (marks consumed, navigates back) |
| `handleOpenEdit()` | Opens edit dialog (name + notes) |
| `handleSaveEdit()` | Updates name/notes in DB |
| `handleTransfer(location)` | Moves item to selected location |
| `handleMarkConsumed()` | Alert with 3 options: Used Up, Expired, Discarded |
| `handleRestoreToActive()` | Restores item to active status |
| `handleMoveToPast()` | Marks item as discarded and navigates back |
| `handleDelete()` | Confirm dialog, deletes item, navigates back |

## Filters

None (single item view).
