# Database Documentation

> **REFACTORED 2026-04:** Data model pivoted to catalog + purchase-events pattern. This document reflects the NEW schema. Legacy `grocery_items` collection is preserved read-only during migration; see `docs/MIGRATION_GUIDE.md`.

## Overview

GroceryApp uses two database layers:

1. **WatermelonDB (SQLite)** — Local database on the mobile device (mobile app only, deferred refactor). Offline-first, reactive queries, automatic change tracking.
2. **Firebase Firestore** — Cloud database for sync, shared data, backend queries, and the single source of truth for the refactored web admin.

## Firestore Schema (Refactored)

### Global Collections

#### `catalog_entries/{user_id}__{name_norm}`

Per-user name catalog. Doc ID is composite: `{user_id}__{name_norm}` where `name_norm = re.sub(r"[^\w\s]", "", name.strip().lower()).replace(" ", "_")`. This enforces (user_id, name) uniqueness at the Firestore key level.

```yaml
user_id: str                      # FK to users, redundant with doc-id prefix
name_norm: str                    # normalized name, redundant with doc-id suffix
display_name: str                 # user's preferred casing ("Organic Milk")
aliases: str[]                    # other casings seen when user re-entered name
barcode: str | null               # SINGLE barcode (not array), nullable
country_code: str | null          # inherited from barcode prefix or manual
default_location: str | null      # last-used location (fridge/pantry/freezer)
default_category: str | null      # inferred or user-chosen
image_url: str | null             # from linked product
total_purchases: int              # all-time count (not decremented)
active_purchases: int              # current active count (inc/dec by events)
last_purchased_at: timestamp | null
needs_review: bool                # flagged by reminder stage-3 or AI dedup
# Standard metadata:
created_at: timestamp
updated_at: timestamp
schema_version: int = 1
created_by: str                   # uid or "system" or "migration"
source: str                       # "api" | "migration" | "barcode_scan" | "admin"
```

**Uniqueness rules:**
- `(user_id, name_norm)` — enforced by doc ID
- `(user_id, barcode)` when barcode != null — enforced by API transaction (409 on conflict)

**Indexes:**
- `(user_id, barcode)` — scan lookup
- `(user_id, last_purchased_at DESC)` — recent catalog
- `(user_id, total_purchases DESC)` — frequently bought
- `(barcode)` collection-wide — admin barcode→names aggregation

---

#### `products/{barcode}`

Global barcode-keyed product DB (kept from existing).

```yaml
barcode: str                      # doc id
product_name: str
brands: str | null
categories: str | null
image_url: str | null
nutrition_data: object | null
source: str                       # "openfoodfacts" | "contributed" | "manual" | "unknown"
# NEW fields (added during refactor):
country_code: str | null          # ISO alpha-2, detected from GS1 prefix
country_source: str               # "gs1_prefix" | "off" | "manual" | "unknown"
name_norm: str                    # normalized product_name for case-insensitive dedup
barcode_prefix: str               # first 3 digits, cached for fast filter
verified: bool                    # admin-verified
last_verified_at: timestamp | null
# Standard metadata
cached_at: timestamp
updated_at: timestamp
schema_version: int = 1
```

---

#### `contributed_products/{barcode}`

User-submitted products awaiting admin review (kept from existing).

```yaml
barcode: str                      # doc id
product_name: str
brands: str | null
categories: str | null
image_url: str | null
contributed_by: str               # uid or email
contributed_at: timestamp
status: str                       # "pending_review" | "approved" | "rejected"
reviewed_by: str | null
reviewed_at: timestamp | null
rejection_reason: str | null
```

---

#### `countries/{code}` — NEW

Country definitions with GS1 barcode prefix ranges for auto-detection.

```yaml
code: str                         # ISO alpha-2, doc id ("MY", "SG", "US")
name: str                         # "Malaysia"
currency: str                     # "MYR"
currency_symbol: str              # "RM"
gs1_prefix_ranges: object[]       # [{start: "955", end: "955"}, ...]
flag_emoji: str                   # "🇲🇾"
locale: str                       # "ms-MY"
enabled: bool
# Standard metadata
created_at: timestamp
updated_at: timestamp
```

Seeded once at startup. Referenced by `barcode_service` for country detection on unknown barcodes.

---

#### `foodbanks/{id}` — existing (unchanged)

Foodbank directory with lat/lng, hours, country filtering.

---

#### `households/{id}` — existing (unchanged)

Shared family groupings with member roles and tier-based limits.

---

#### `app_config/*` — global config docs

- `app_config/features` — **NEW** — feature flags:
  ```yaml
  ocr_enabled: bool
  receipt_scan: bool
  smart_camera: bool
  recipe_ocr: bool
  shelf_audit: bool
  progressive_nudges: bool
  financial_tracking: bool
  insights: bool
  nudge_thresholds: {expiry: 5, price: 10, volume: 20}
  updated_at: timestamp
  updated_by: str                 # admin uid
  ```
- `app_config/ocr` — OCR provider config (existing, feature-flag gated)
- `app_config/visibility` — page visibility by tier (existing)
- `app_config/tiers` — tier definitions (existing)
- `app_config/locations` — storage locations list (existing)
- `app_config/map` — map center (existing)
- `app_config/stores` — manual store list (existing)
- `app_config/exchange_rates` — currency rates (existing)
- `app_config/migrations/{name}` — **NEW** — migration progress tracking
- `app_config/catalog_analysis_cache` — **NEW** — pre-computed admin aggregation

---

### Per-User Subcollections

#### `users/{uid}` — existing profile

```yaml
uid: str                          # doc id
email: str
display_name: str
role: str                         # "user" | "admin"
tier: str                         # "free" | "plus" | "pro"
status: str                       # "active" | "disabled" | "pending"
approved: bool
approved_at: timestamp | null
approved_by: str | null
selected_tools: str[]             # for plus tier "Smart Cart"
household_id: str | null
household_role: str | null        # "owner" | "member"
country: str | null
currency: str | null
# Standard metadata
created_at: timestamp
updated_at: timestamp
```

---

#### `users/{uid}/purchases/{event_id}` — NEW

Individual purchase events. Replaces `users/{uid}/grocery_items`.

```yaml
catalog_name_norm: str            # FK to catalog_entries
catalog_display: str              # denormalized for list views
barcode: str | null               # denormalized at time of purchase
country_code: str | null
quantity: float                   # supports 0.5kg etc
unit: str | null                  # "pcs" | "g" | "kg" | "ml" | "L"
expiry_date: timestamp | null
expiry_source: str | null         # "user" | "nlp" | "ocr" | "none"
expiry_raw: str | null            # original input ("tomorrow")
price: float | null
currency: str | null
payment_method: str | null        # "cash" | "card" | null
date_bought: timestamp
location: str | null              # pantry/fridge/freezer/...
status: str                       # active | used | thrown | transferred
consumed_date: timestamp | null
consumed_reason: str | null       # "used_up" | "expired" | "bad" | "gift" | null
transferred_to: str | null        # uid or foodbank_id
reminder_stage: int               # 0=none, 1=7d, 2=14d, 3=21d
last_reminded_at: timestamp | null
source: str                       # manual | barcode_scan | receipt | migration
source_ref: str | null            # migration link, scan_id, receipt_id
household_id: str | null
# Standard metadata
created_at: timestamp
updated_at: timestamp
schema_version: int = 1
created_by: str
```

**Indexes:**
- `(status, expiry_date ASC)` — expiring soon
- `(status, date_bought DESC)` — untracked age buckets
- `(catalog_name_norm, status)` — per-catalog history
- `(status, date_bought ASC)` — FIFO use
- Collection-group `purchases` with `(status, expiry_date)` — admin expiry flagging

---

#### `users/{uid}/reminders/{reminder_id}` — NEW

7/14/21-day reminder queue.

```yaml
purchase_event_id: str
catalog_name_norm: str
display_name: str
stage: int                        # 7 | 14 | 21
message: str
created_at: timestamp
dismissed_at: timestamp | null
acted_at: timestamp | null
action_taken: str | null          # "used" | "thrown" | "snooze" | "still_have"
```

---

#### `users/{uid}/insights/{milestone_id}` — NEW

Milestone analytics output (at 50/100/500/1000 purchases).

```yaml
milestone: int                    # 50 | 100 | 500 | 1000
triggered_at: timestamp
purchase_count_at_trigger: int
generated_at: timestamp
top_purchased: [{name, count}]    # top 10
waste_breakdown: [{name, count, rm_value}]
spending: {cash: float, card: float, total: float}
shopping_frequency: {avg_days_between, peak_day}
avoid_list: [{name, waste_rate}]  # high-waste items
summary_text: str                 # LLM-generated narrative
status: str                       # "pending" | "complete" | "failed"
```

---

#### Existing per-user subcollections (retained)

- `users/{uid}/recipes/{recipe_id}`
- `users/{uid}/price_records/{record_id}`
- `users/{uid}/shopping_lists/{list_id}/items/{item_id}`
- `users/{uid}/analytics_events/{event_id}`
- `users/{uid}/grocery_items/{id}` — **LEGACY** — kept read-only during migration window, marked `_migrated: true`

---

### Standard Metadata Fields (every document)

Every Firestore document must include:

```yaml
created_at: timestamp             # SERVER_TIMESTAMP on create
updated_at: timestamp             # SERVER_TIMESTAMP on every write
schema_version: int = 1           # for future migrations
created_by: str                   # uid or "system" | "migration" | "scheduler"
source: str                       # "api" | "migration" | "scheduler" | "admin" | "telegram"
```

Enforced by `app/core/metadata.py` helpers `apply_create_metadata()` and `apply_update_metadata()`.

---

## Firestore Security Rules (key rules)

```
match /catalog_entries/{entry_id} {
  allow read: if request.auth != null && resource.data.user_id == request.auth.uid;
  allow create: if request.auth != null 
                && request.resource.data.user_id == request.auth.uid
                && entry_id == request.auth.uid + "__" + request.resource.data.name_norm;
  allow update: if request.auth != null && resource.data.user_id == request.auth.uid;
  allow delete: if request.auth != null 
                && resource.data.user_id == request.auth.uid
                && resource.data.active_purchases == 0;
}

match /users/{uid}/purchases/{event_id} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}

match /products/{barcode} {
  allow read: if true;  // public
  allow write: if request.auth != null && exists(...isAdmin check...);
}
```

Admin SDK bypasses rules. Composite `(user_id, barcode)` uniqueness enforced at API layer with transactions (see `BACKEND.md`).

---

## Legacy Sections (pre-refactor, retained for historical reference)



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
