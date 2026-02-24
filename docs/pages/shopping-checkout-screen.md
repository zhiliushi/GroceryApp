# ShoppingCheckoutScreen

**File:** `src/screens/lists/ShoppingCheckoutScreen.tsx`
**Header Title:** Checkout

## Objective

Finalize a shopping list purchase — select store, assign storage locations, set expiry dates, and transfer purchased items into inventory.

## User View

| Section | Data Displayed |
|---------|---------------|
| Store selector | Buttons for saved stores + "Add New Store" |
| Default location | Location chips for default storage |
| Purchased items list | Each item with location override and expiry option |
| Total price | Sum of all item prices (if prices set) |
| Confirm button | "Confirm Purchase" |

### Per-Item Row

| Column | Data |
|--------|------|
| Item name | Name of purchased item |
| Quantity + price | e.g. "2 x $3.50" |
| Expiry date | Set/Remove via date picker |
| Location accordion | Override location for this specific item |

### Store Dialog

| Field | Type |
|-------|------|
| Store name | Text input |
| Create button | Saves store and selects it |

## Functions & Processes

| Function | Description |
|----------|-------------|
| `loadData()` | Fetches list + purchased items + stores |
| `handleConfirmPurchase()` | For each purchased item: creates inventory item with location, expiry, price. Marks list as checked out with store + total price. Navigates to Inventory Tab. |
| `handleAddStore(name)` | Creates new store in DB |
| `handleSetExpiry(item, date)` | Sets expiry date on a specific item |
| `handleLocationOverride(item, loc)` | Overrides storage location for one item |

## Filters

None (checkout flow).
