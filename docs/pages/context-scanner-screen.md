# ContextScannerScreen

**File:** `src/screens/common/ContextScannerScreen.tsx`
**Header:** Hidden (full-screen camera)

## Objective

Context-aware barcode scanner used from within Inventory or Shopping flows. Behaves like BarcodeScannerScreen but adapts buttons and behavior based on the `context` parameter.

## Parameters

| Param | Type | Description |
|-------|------|-------------|
| `context` | `'inventory' \| 'shopping_list'` | Determines button labels and navigation targets |
| `listId` | `string?` | Required when context is `shopping_list` |

## Context Behavior

### Inventory Context

- Button: "Add to Inventory"
- Navigation: AddItem with product prefill

### Shopping List Context

- Button: "Add to Shopping List"
- Navigation: AddListItem with product prefill
- **Barcode matching**: Automatically checks if scanned barcode matches an existing item in the list. If matched:
  - Auto-ticks the item as purchased (if not already)
  - Navigates to EditListItem for price/expiry/qty editing

## User View

Same states as [BarcodeScannerScreen](barcode-scanner-screen.md):
1. Camera active with overlay
2. Product found — context-appropriate button
3. Product not found — context-appropriate button
4. Permission states
5. Loading / Error

## Functions & Processes

| Function | Description |
|----------|-------------|
| `navigateToForm(prefill?)` | Routes to AddItem or AddListItem based on context |
| Barcode match effect | For shopping_list context: checks `shoppingList.findListItemByBarcode()`, auto-ticks and navigates to EditListItem if matched |
| All other functions | Same as BarcodeScannerScreen (permission, scanning, product lookup) |

## Filters

None (scanner screen).
