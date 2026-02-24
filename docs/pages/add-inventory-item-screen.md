# AddInventoryItemScreen

**File:** `src/screens/inventory/AddInventoryItemScreen.tsx`
**Header Title:** Add Item

## Objective

Form to create a new inventory item. Can be prefilled from a barcode scan or entered manually.

## User View

| Section | Data Displayed |
|---------|---------------|
| Product image | Prefilled image from barcode lookup (if available) |
| Form fields | Name, Barcode, Brand, Category, Unit, Quantity, Price, Expiry Date, Location, Notes |
| Location chips | Selectable chips for each configured storage location |
| Save button | Adds item to inventory |

### Form Fields

| Field | Type | Required | Prefillable | Default |
|-------|------|----------|-------------|---------|
| Product Name | Text | Yes | Yes (from scanner) | — |
| Barcode | Text | No | Yes | — |
| Brand | Text | No | Yes | — |
| Category | Picker (chips) | Yes | Yes (matched by name) | First category |
| Unit | Picker (chips) | Yes | No | First unit |
| Quantity | Numeric | Yes | No | 1 |
| Price | Decimal | No | No | — |
| Expiry Date | Date picker | No | No | — |
| Storage Location | Chips | Yes | No | User's default location |
| Notes | Multiline text | No | No | — |

## Functions & Processes

| Function | Description |
|----------|-------------|
| `handleSave()` | Validates form, creates item in DB, schedules expiry notification if date set, navigates back |
| Category/Unit loading | Fetches all categories and units on mount |
| Barcode prefill | Reads route params and populates fields from scanner data |

## Filters

None (form screen).
