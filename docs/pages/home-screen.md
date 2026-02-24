# HomeScreen

**File:** `src/screens/home/HomeScreen.tsx`
**Tab:** Home Tab (entry point)
**Header Title:** Inventory

## Objective

Main dashboard providing an at-a-glance overview of the user's grocery inventory, shopping activity, and quick access to common actions.

## User View

| Section | Data Displayed |
|---------|---------------|
| Greeting | Time-based greeting (Good morning/afternoon/evening) + user name |
| Date | Current date (weekday, month, day) |
| Tier badge | "Free" or "Premium" chip |
| Sync status bar | Last sync time, sync button (premium only) |
| Stats grid (2x2) | Shopping Lists count, Almost Expired count, Total Items count, Need Restock count |
| Quick Actions list | Configurable action items (vertical card list) |

### Stats Grid

| Stat Card | Source | Tap Action |
|-----------|--------|------------|
| Shopping Lists | `shoppingList.getAll().length` | Navigate to Shopping Tab |
| Almost Expired | `inventory.getExpiring(7).length` | Navigate to Inventory Tab |
| Total Items | `inventory.getActive().length` | Navigate to Inventory Tab |
| Need Restock | `inventory.getNeedingRestockCount()` | Navigate to Restock screen |

### Quick Actions

| Action Key | Label | Navigation |
|------------|-------|------------|
| `add_inventory` | Add to Inventory | AddMethod (context: inventory) |
| `add_shopping_list` | Add Shopping List | Shopping Tab |
| `restock_settings` | Restock Settings | Restock screen |
| `scan_barcode` | Scan Barcode | Scan Tab |
| `past_items` | Past Items | PastItems screen |

Quick actions are configurable in Settings. Only actions enabled in the user's `quickActions` setting appear.

## Functions & Processes

| Function | Description |
|----------|-------------|
| `loadDashboard()` | Fetches all stats in parallel (active items, expiring, lists, restock count) |
| `handleRefresh()` | Pull-to-refresh reloads dashboard |
| `handleQuickAction(key)` | Routes to the appropriate screen based on action key |
| Focus listener | Reloads data whenever screen regains focus |

## Filters

None.
