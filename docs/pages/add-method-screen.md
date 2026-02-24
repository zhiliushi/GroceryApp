# AddMethodScreen

**File:** `src/screens/common/AddMethodScreen.tsx`
**Header Title:** Add Item / Add Items

## Objective

Gateway screen where the user chooses between scanning a barcode or entering an item manually.

## Parameters

| Param | Type | Description |
|-------|------|-------------|
| `context` | `'inventory' \| 'shopping_list'` | Determines where items will be added |
| `listId` | `string?` | Required when context is `shopping_list` |

## User View

| Card | Icon | Description | Navigation |
|------|------|-------------|------------|
| Scan Barcode | `barcode-scan` (purple) | "Quickly add items by scanning their barcode" | ContextScanner (with context + listId) |
| Manual Entry | `pencil-plus-outline` (green) | "Type in item details manually" | AddItem (inventory) or AddListItem (shopping_list) |

## Functions & Processes

| Function | Description |
|----------|-------------|
| `handleScan()` | Navigates to ContextScanner with context params |
| `handleManual()` | Navigates to AddItem or AddListItem based on context |

## Filters

None (choice screen).
