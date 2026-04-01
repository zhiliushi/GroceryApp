# Database Documentation

## Overview

GroceryApp uses two database layers:

1. **WatermelonDB (SQLite)** — Local database on the mobile device. Offline-first, reactive queries, automatic change tracking.
2. **Firebase Firestore** — Cloud database for sync, shared data, and backend queries.

## Standardized Enums & Constants

All enums and controlled vocabularies are defined in `src/config/constants.ts`:

### Storage Locations
```typescript
export const STORAGE_LOCATIONS = ['fridge', 'pantry', 'freezer'] as const;
export type StorageLocation = string; // string (not union) — users can add custom locations via settingsStore
export const DEFAULT_STORAGE_LOCATION = 'fridge';
```

### Inventory Status (Lifecycle)
```typescript
// Defined in models/InventoryItem.ts
export type InventoryStatus = 'active' | 'consumed' | 'expired' | 'discarded';
```

### Consume Reasons
```typescript
export type ConsumeReason = 'used_up' | 'expired' | 'discarded';
```

### Weight Units (Price Comparison)
```typescript
export const WEIGHT_UNITS = ['g', 'kg', 'oz', 'lb'] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];
```

### Unit Types
```typescript
type UnitType = 'weight' | 'volume' | 'count';
```

## Local Database (WatermelonDB)

### Schema Version

Current version: **8** (defined in `src/config/constants.ts` as `DB_VERSION`)

### Tables (11 Total)

#### categories
Normalized lookup table for item categories. Seeded with 9 defaults on first launch.

| Column | Type | Indexed | Notes |
|--------|------|---------|-------|
| name | string | yes | e.g. "Dairy", "Produce" |
| icon | string | | Material icon name |
| color | string | | Hex color code |
| sort_order | number | | Display ordering |
| is_default | boolean | | Prevents deletion of seed data |
| created_at | number | | |
| updated_at | number | | |

**Seed data**: Dairy (#D4A843, cheese), Produce (#5A9E5E, food-apple), Meat (#C45454, food-steak), Bakery (#C4873B, bread-slice), Beverages (#4A80C4, cup-water), Frozen (#4A9EA8, snowflake), Snacks (#8A5A96, cookie), Household (#6B7D87, home), Other (#8A8A8A, dots-horizontal)

#### units
Normalized lookup table for measurement units. Seeded with 14 defaults.

| Column | Type | Indexed | Notes |
|--------|------|---------|-------|
| name | string | | e.g. "kilogram" |
| abbreviation | string | yes | e.g. "kg" |
| unit_type | string | | `weight`, `volume`, or `count` |
| created_at | number | | |
| updated_at | number | | |

**Seed data**: g, kg, oz, lb (weight); ml, L, fl oz, gal (volume); pcs, pack, box, bag, can, bottle (count)

#### scanned_items (Stage 1)
Temporary barcode scan records. Ephemeral with 24-hour TTL. Never synced to cloud.

| Column | Type | Indexed | Optional | Notes |
|--------|------|---------|----------|-------|
| barcode | string | yes | | Scanned barcode value |
| name | string | | yes | Product name from lookup |
| brand | string | | yes | Brand name |
| image_url | string | | yes | Product image URL |
| lookup_data | string | | yes | Full JSON from Open Food Facts |
| scanned_at | number | | | Scan timestamp |
| expires_at | number | yes | | TTL: auto-deleted after this time |
| user_id | string | yes | | Owner user ID |
| created_at | number | | | |
| updated_at | number | | | |

#### inventory_items (Stage 2 + Stage 3)
Main data table. Holds active inventory (status=`active`) and consumed/used items (status=`consumed`/`expired`/`discarded`).

| Column | Type | Indexed | Optional | Notes |
|--------|------|---------|----------|-------|
| barcode | string | yes | yes | Not unique (same product, different dates) |
| name | string | | | Product name |
| brand | string | | yes | |
| category_id | string | yes | | FK → categories |
| quantity | number | | | Current quantity |
| unit_id | string | yes | | FK → units |
| expiry_date | number | | yes | Epoch millis |
| location | string | yes | | `fridge`, `pantry`, or `freezer` |
| image_url | string | | yes | Product photo URL |
| added_date | number | | | When added to inventory |
| price | number | | yes | Purchase price |
| purchase_date | number | | yes | When purchased |
| notes | string | | yes | User notes |
| source_scan_id | string | | yes | FK → scanned_items (null for manual adds) |
| status | string | yes | | `active`, `consumed`, `expired`, `discarded` |
| consumed_date | number | | yes | Stage 3: when status changed |
| reason | string | | yes | `used_up`, `expired`, `discarded` |
| quantity_remaining | number | | yes | Amount left when consumed |
| user_id | string | yes | | Owner user ID |
| synced_to_cloud | boolean | | | Cloud sync status |
| is_important | boolean | | | Restock tracking (v4) |
| restock_threshold | number | | | Quantity threshold for restock alerts (v4) |
| expiry_confirmed | boolean | | | False until user sets expiry or confirms "no expiry" (v4) |
| needs_review | boolean | | | True when item data needs manual review in Firebase (v6) |
| created_at | number | | | |
| updated_at | number | | | |

#### shopping_lists

| Column | Type | Indexed | Optional | Notes |
|--------|------|---------|----------|-------|
| name | string | | | List name |
| created_date | number | | | When created |
| is_completed | boolean | yes | | Completion status |
| user_id | string | yes | | Owner user ID |
| is_checked_out | boolean | | | Purchase record tracking (v5) |
| checkout_date | number | | yes | When checkout was completed (v5) |
| store_id | string | | yes | FK → stores (v5) |
| total_price | number | | yes | Total purchase amount (v5) |
| notes | string | | yes | Per-list notes/instructions (v8) |
| created_at | number | | | |
| updated_at | number | | | |

#### list_items

| Column | Type | Indexed | Optional | Notes |
|--------|------|---------|----------|-------|
| list_id | string | yes | | FK → shopping_lists |
| item_name | string | | | Item name |
| quantity | number | | | Amount needed |
| unit_id | string | yes | | FK → units |
| is_purchased | boolean | yes | | Checked off |
| category_id | string | yes | | FK → categories |
| barcode | string | yes | yes | Product barcode (v5, from cart merge) |
| brand | string | | yes | Brand name (v5) |
| price | number | | yes | Item price (v5) |
| weight | number | | yes | Weight for price comparison (v5) |
| weight_unit | string | | yes | `g`, `kg`, `oz`, or `lb` (v5) |
| image_url | string | | yes | Product image (v5) |
| notes | string | | yes | Item notes (v5) |
| created_at | number | | | |
| updated_at | number | | | |

#### analytics_events

| Column | Type | Indexed | Notes |
|--------|------|---------|-------|
| event_type | string | yes | One of 21 event types |
| event_data | string | | JSON-stringified payload |
| timestamp | number | | Event timestamp |
| synced | boolean | yes | Cloud sync status |
| user_id | string | yes | Owner user ID |

#### stores (v2)
Physical store locations for price tracking.

| Column | Type | Indexed | Optional | Notes |
|--------|------|---------|----------|-------|
| name | string | yes | | Store name (e.g. "Walmart") |
| address | string | | yes | Physical address |
| latitude | number | | yes | GPS coordinates |
| longitude | number | | yes | GPS coordinates |
| user_id | string | yes | | Owner user ID |
| created_at | number | | | |
| updated_at | number | | | |

#### cart_items (v2)
Temporary shopping cart before checkout.

| Column | Type | Indexed | Optional | Notes |
|--------|------|---------|----------|-------|
| barcode | string | yes | yes | Product barcode |
| name | string | | | Product name |
| brand | string | | yes | Brand name |
| quantity | number | | | Item count |
| unit_id | string | | | FK → units |
| price | number | | yes | Item price |
| weight | number | | yes | Weight for price comparison |
| weight_unit | string | | yes | `g`, `kg`, `oz`, or `lb` |
| image_url | string | | yes | Product image |
| notes | string | | yes | User notes |
| expires_at | number | yes | | TTL auto-delete, 24h (v3) |
| user_id | string | yes | | Owner user ID |
| created_at | number | | | |
| updated_at | number | | | |

#### price_history (v2)
Historical price records for comparison across stores and dates.

| Column | Type | Indexed | Optional | Notes |
|--------|------|---------|----------|-------|
| barcode | string | yes | | Product barcode |
| name | string | | | Product name (denormalized) |
| store_id | string | yes | | FK → stores |
| price | number | | | Purchase price |
| weight | number | | yes | Weight for price-per-unit |
| weight_unit | string | | yes | `g`, `kg`, `oz`, or `lb` |
| price_per_unit | number | | yes | Calculated: price/weight |
| purchase_date | number | yes | | When purchased |
| notes | string | | yes | Purchase notes |
| user_id | string | yes | | Owner user ID |
| created_at | number | | | |
| updated_at | number | | | |

#### foodbanks (v7)
Global food bank locations synced from backend Firestore. Not per-user — shared globally.

| Column | Type | Indexed | Optional | Notes |
|--------|------|---------|----------|-------|
| name | string | | | Food bank name |
| description | string | | yes | Description |
| country | string | yes | | Country code (e.g. "MY") |
| state | string | yes | yes | State/region |
| location_name | string | | yes | Location display name |
| location_address | string | | yes | Physical address |
| location_link | string | | yes | Map/directions URL |
| latitude | number | | yes | GPS coordinates |
| longitude | number | | yes | GPS coordinates |
| source_url | string | | yes | Data source URL |
| source_name | string | | yes | Data source name |
| is_active | boolean | | | Active status |
| created_at | number | | | |
| updated_at | number | | | |

### Event Types (21)

`barcode_scan`, `item_added`, `item_removed`, `list_created`, `list_completed`, `purchase_recorded`, `item_scanned`, `scan_promoted`, `scan_discarded`, `item_consumed`, `sync_completed`, `app_opened`, `category_changed`, `settings_changed`, `search_performed`, `item_shared`, `item_deleted`, `item_expired_wasted`, `recipe_viewed`, `screen_view`, `feature_used`

## Models

Each table has a corresponding WatermelonDB Model class with:

- **Field decorators**: `@text`, `@field`, `@date`, `@readonly`, `@relation`
- **Computed properties**: `isExpired`, `isExpiringSoon`, `daysUntilExpiry`, `expiryStatus`
- **Writer methods**: `markConsumed()`, `adjustQuantity()`, `moveToLocation()`, `markSynced()`
- **Static validation**: `Model.validate(data)` using Zod schemas
- **Serialization**: `toJSON()` for Firestore sync

## Repositories

Ten repository classes providing typed CRUD operations:

| Repository | Table | Key Operations |
|-----------|-------|----------------|
| `CategoryRepository` | categories | getAll, getById, create, update, delete (blocks defaults) |
| `UnitRepository` | units | getAll, getByType, getByAbbreviation |
| `ScannedItemRepository` | scanned_items | create, getByBarcode, deleteExpired (TTL cleanup) |
| `InventoryRepository` | inventory_items | Full CRUD, getActive, getExpiring, getExpired, getByCategory, getByLocation, search, promoteFromScan, markConsumed, getConsumptionStats, getUnsynced, markSyncedBatch |
| `ShoppingListRepository` | shopping_lists + list_items | List CRUD, item CRUD, duplicateList, markAllPurchased, observeAll |
| `AnalyticsRepository` | analytics_events | logEvent, getUnsyncedBatch, markSynced, purgeOlderThan, countByType, getRecentEvents |
| `StoreRepository` | stores | CRUD, getByUserId, getOrCreate, search |
| `CartRepository` | cart_items | add, update, remove, clear, incrementQuantity, decrementQuantity, checkout |
| `PriceHistoryRepository` | price_history | getByBarcode, getByBarcodeAndStore, comparePricesAcrossStores, getPriceTrend, findBestDeal |
| `FoodbankRepository` | foodbanks | getAll, getByCountry, getByState, upsertFromBackend |

## Database Initialization

In `useDatabase.ts`:

1. Create WatermelonDB database with SQLite adapter
2. Register all 11 models
3. Run schema migrations
4. Instantiate 10 repositories
5. Call `seedDatabase()` — inserts default categories and units if tables are empty
6. Call `deleteExpired()` — purges Stage 1 scanned items past their TTL

## Cloud Database (Firestore)

### Document Structure

```
users/{userId}                         # User profile (email, tier, preferences)
  grocery_items/{itemId}               # Synced inventory items
  shopping_lists/{listId}              # Shopping list metadata
    items/{itemId}                     # List items (nested subcollection)
  analytics/{eventId}                  # Analytics events

products/{barcode}                     # Cached Open Food Facts data
contributed_products/{barcode}         # User-contributed product info
```

### Sync Strategy

- **Direction**: Bidirectional (mobile ↔ Firestore)
- **Conflict resolution**: Last-write-wins using `updatedAt` timestamps
- **Batch limits**: Firestore max 500 documents per batch (auto-chunked)
- **Frequency**: Every 15 minutes (foreground) / 30 minutes (background fetch) + manual trigger
- **Scope**: Analytics (all users), inventory + lists (paid tier only)

### Security Rules

Defined in `firestore.rules`:
- All data scoped to authenticated user (`request.auth.uid == userId`)
- Document structure validated on create (required fields, enum values)
- Status values validated: `active`, `consumed`, `expired`, `discarded`
- Location values validated: `fridge`, `pantry`, `freezer`
- Analytics events are immutable (no updates after creation)
- Default deny-all for unmatched paths

## 3-Stage Item Lifecycle

```
Stage 1 (Scan)                  Stage 2 (Active)              Stage 3 (Done)
┌──────────────┐   promote     ┌──────────────┐   consume    ┌──────────────┐
│ scanned_items│ ──────────→   │inventory_items│ ──────────→  │inventory_items│
│              │               │ status=active │              │ status=consumed│
│ TTL: 24h     │               │               │              │    /expired   │
│ No sync      │               │ Cloud sync    │              │    /discarded │
└──────────────┘               └──────────────┘              └──────────────┘
       ↑                              ↑
  Barcode scan              Manual add (bypasses Stage 1)
```

- **Stage 1**: Temporary scan data. Auto-deleted after 24 hours. Never synced.
- **Stage 2**: Active inventory items. Synced to Firestore for paid users.
- **Stage 3**: Same table as Stage 2, just different `status`. Tracked for analytics (waste %, spending).

## Shopping Cart Flow (v2)

```
Scan Item                     Cart                         Checkout
┌──────────────┐   add      ┌──────────────┐   confirm   ┌──────────────┐
│  Barcode     │ ────────→  │  cart_items  │ ──────────→ │inventory_items│
│  Scanner     │            │              │             │ + price_history│
└──────────────┘            │ Edit/Remove  │             └──────────────┘
       ↑                    │ Set price    │                    │
  Camera scan               │ Set weight   │                    ↓
                            └──────────────┘             Compare prices
                                   ↑                     across stores
                           Manual add
```

## Migrations

Schema migrations are defined in `src/database/migrations/migration_v1.ts`. WatermelonDB handles migrations automatically when the DB_VERSION constant is incremented.

### Version History

| Version | Changes |
|---------|---------|
| 1 | Initial schema (7 tables: categories, units, scanned_items, inventory_items, shopping_lists, list_items, analytics_events) |
| 2 | Added `stores`, `cart_items`, `price_history` tables |
| 3 | Added `expires_at` to cart_items for TTL auto-cleanup |
| 4 | Added `is_important`, `restock_threshold`, `expiry_confirmed` to inventory_items |
| 5 | Added checkout fields to shopping_lists (`is_checked_out`, `checkout_date`, `store_id`, `total_price`); added product fields to list_items (`barcode`, `brand`, `price`, `weight`, `weight_unit`, `image_url`, `notes`) |
| 6 | Added `needs_review` to inventory_items |
| 7 | Added `foodbanks` table (global, synced from backend) |
| 8 | Added `notes` to shopping_lists |
