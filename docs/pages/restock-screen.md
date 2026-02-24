# RestockScreen

**File:** `src/screens/inventory/RestockScreen.tsx`
**Header Title:** Restock

## Objective

Track which inventory items need restocking by setting importance flags and threshold quantities.

## User View

| Section | Data Displayed |
|---------|---------------|
| Summary header | Tracked count, Needs Restock count, Total items |
| Item list | All active items sorted by: tracked first, then needs-restock, then alphabetical |

### Item Row

| Column | Data |
|--------|------|
| Status dot | Gray (not tracked), Red (needs restock), Green (OK) |
| Item name | Item name |
| Quantity + location | e.g. "3 pcs | Fridge" |
| Track toggle | Switch to enable/disable tracking (sets `isImportant`) |
| Threshold button | Shows current threshold, tap to edit inline |
| RESTOCK badge | Red badge shown when quantity <= threshold |

### Inline Threshold Editor

| Control | Action |
|---------|--------|
| Numeric input | Edit threshold value |
| Checkmark icon | Save new threshold |
| Cancel icon | Discard changes |

## Functions & Processes

| Function | Description |
|----------|-------------|
| `loadItems()` | Fetches all active items, sorts by importance/restock need |
| `handleToggleTrack(item)` | Toggles `isImportant` flag on item |
| `handleSaveThreshold(item, value)` | Updates `restockThreshold` in DB |

## Filters

None (shows all active items, sorted by restock priority).
