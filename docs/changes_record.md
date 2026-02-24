# Changes Record - GroceryApp

> **Usage**: Append-only log. Only read the latest entries to save context. Do not modify past entries.

---

## [2026-01-30] Session 1: Project Initialization

### Request
Create complete project structure for a React Native grocery management app with:
- Mobile app (React Native + TypeScript)
- Backend (Python FastAPI for Render)
- Documentation

### Changes Made
- Created project root at `F:\ClaudeProjects\GroceryApp\`
- Initialized React Native 0.83.1 project in `mobile-app/` with TypeScript
- Created FastAPI backend in `backend/` with barcode and analytics endpoints
- Created `docs/` with PROJECT_CONTEXT.md, DEVELOPMENT_RULES.md, CREDENTIALS.md, ACTIVE_TASKS.md
- Created `docs/subsystems/` with android-grocery-app.md and interface-grocery-app.md
- Created root README.md and .gitignore
- Set bundle ID to `com.groceryapp.mobile`

### Files Created/Modified
- `mobile-app/` (full React Native project)
- `backend/main.py`, `backend/requirements.txt`, `backend/.env.example`
- `backend/app/api/routes/barcode.py`, `backend/app/api/routes/analytics.py`
- `backend/app/core/config.py`
- `docs/PROJECT_CONTEXT.md`, `docs/DEVELOPMENT_RULES.md`, `docs/CREDENTIALS.md`, `docs/ACTIVE_TASKS.md`
- `docs/subsystems/android-grocery-app.md`, `docs/subsystems/interface-grocery-app.md`
- `README.md`, `.gitignore`

---

## [2026-01-30] Session 2: Dependency Installation & Configuration

### Request
Install and configure all necessary dependencies for the React Native app including navigation, database, Firebase, barcode scanning, API, state management, UI, and utilities.

### Changes Made
- Updated `mobile-app/package.json` with 20+ dependencies (all version-verified)
- Installed all packages via npm (1010 packages)
- Configured Android: added `google-services` plugin, camera permission, updated bundle ID
- Updated `babel.config.js` for WatermelonDB decorator support
- Updated `tsconfig.json` with strict mode and path aliases
- Created WatermelonDB schema (6 tables) and model classes
- Created API client with Axios interceptors
- Created Zustand stores (inventory, auth)
- Created navigation structure (AppNavigator, TabNavigator)
- Created hooks (useNetworkStatus, useFeatureAccess)
- Created BackgroundSyncService for periodic sync
- Created FirebaseAuth service wrapper
- Created TypeScript type definitions (models, navigation)
- Created theme system (colors, Paper theme integration)
- Created app constants and config

### Files Created/Modified
- `mobile-app/package.json` (updated with verified versions)
- `mobile-app/babel.config.js` (decorator support)
- `mobile-app/tsconfig.json` (strict mode, path aliases)
- `mobile-app/jest.setup.js` (test mocks)
- `mobile-app/.env.example`
- `mobile-app/android/app/build.gradle` (google-services, bundle ID)
- `mobile-app/android/build.gradle` (google-services classpath)
- `mobile-app/android/app/src/main/AndroidManifest.xml` (camera permission)
- `mobile-app/src/services/database/schema.ts`, `index.ts`
- `mobile-app/src/services/database/models/` (Item, Category, ShoppingList, ShoppingListItem, Purchase, UserSettings)
- `mobile-app/src/services/api/client.ts`, `barcode.ts`, `analytics.ts`
- `mobile-app/src/services/firebase/FirebaseAuth.ts`
- `mobile-app/src/services/sync/BackgroundSyncService.ts`
- `mobile-app/src/store/inventoryStore.ts`, `authStore.ts`
- `mobile-app/src/navigation/AppNavigator.tsx`, `TabNavigator.tsx`
- `mobile-app/src/hooks/useNetworkStatus.ts`, `useFeatureAccess.ts`
- `mobile-app/src/types/models.ts`, `navigation.ts`
- `mobile-app/src/constants/config.ts`
- `mobile-app/src/theme/colors.ts`, `index.ts`

---

## [2026-01-30] Session 2: Development Rules Update

### Request
1. Add rule: update all related documentation after each change.
2. Create append-only changes log at `docs/changes_record.md`.

### Changes Made
- Added "Golden Rule" section at top of `docs/DEVELOPMENT_RULES.md`
- Created `docs/changes_record.md` (this file)

### Files Created/Modified
- `docs/DEVELOPMENT_RULES.md` (added Golden Rule)
- `docs/changes_record.md` (created)

---

## [2026-01-30] Session 3: Clean Architecture Restructure

### Request
Restructure the mobile app `src/` directory to follow clean architecture with a specific 47-file layout organized into: config, database, services, hooks, screens, components, navigation, store, types, and utils.

### Changes Made
- Created `src/config/` layer: firebase.ts, api.ts (Axios with interceptors), constants.ts
- Created `src/database/` layer with WatermelonDB:
  - schema.ts (4 tables: grocery_items, shopping_lists, list_items, analytics_events)
  - 4 models: GroceryItem, ShoppingList, ListItem, AnalyticsEvent (with decorators)
  - 3 repositories: GroceryRepository, ShoppingListRepository, AnalyticsRepository
  - migrations/migration_v1.ts
- Created `src/services/` layer:
  - barcode/: BarcodeService (camera + scanner), BarcodeApiService (backend API)
  - firebase/: AuthService, FirestoreService, AnalyticsService
  - sync/: SyncService (background fetch + foreground periodic sync)
  - openFoodFacts/: OpenFoodFactsService (fallback product lookup)
- Created `src/hooks/`: useAuth, useDatabase, useBarcode, useSync
- Created `src/screens/` (9 screens): LoginScreen, RegisterScreen, HomeScreen, InventoryScreen, InventoryDetailScreen, BarcodeScannerScreen, ShoppingListsScreen, ListDetailScreen, SettingsScreen
- Created `src/components/`: common/ (Button, Input, Card, Loading), grocery/ (GroceryItemCard, CategoryFilter), scanner/ (BarcodeOverlay)
- Created `src/navigation/`: RootNavigator (auth gate), AuthNavigator, MainNavigator (bottom tabs with stacks)
- Created `src/store/`: authStore, groceryStore, settingsStore (Zustand with AsyncStorage persistence)
- Created `src/types/`: index.ts, database.ts, api.ts
- Created `src/utils/`: dateUtils.ts, validators.ts (Zod schemas), helpers.ts
- Removed old file structure (old services/database, services/api, store/inventoryStore, navigation/AppNavigator, etc.)

### Files Created (47 total)
- `src/config/firebase.ts`, `api.ts`, `constants.ts`
- `src/database/schema.ts`, `models/GroceryItem.ts`, `models/ShoppingList.ts`, `models/ListItem.ts`, `models/AnalyticsEvent.ts`
- `src/database/repositories/GroceryRepository.ts`, `ShoppingListRepository.ts`, `AnalyticsRepository.ts`
- `src/database/migrations/migration_v1.ts`
- `src/services/barcode/BarcodeService.ts`, `BarcodeApiService.ts`
- `src/services/firebase/AuthService.ts`, `FirestoreService.ts`, `AnalyticsService.ts`
- `src/services/sync/SyncService.ts`
- `src/services/openFoodFacts/OpenFoodFactsService.ts`
- `src/hooks/useAuth.ts`, `useDatabase.ts`, `useBarcode.ts`, `useSync.ts`
- `src/screens/auth/LoginScreen.tsx`, `RegisterScreen.tsx`
- `src/screens/home/HomeScreen.tsx`
- `src/screens/inventory/InventoryScreen.tsx`, `InventoryDetailScreen.tsx`
- `src/screens/scanner/BarcodeScannerScreen.tsx`
- `src/screens/lists/ShoppingListsScreen.tsx`, `ListDetailScreen.tsx`
- `src/screens/settings/SettingsScreen.tsx`
- `src/components/common/Button.tsx`, `Input.tsx`, `Card.tsx`, `Loading.tsx`
- `src/components/grocery/GroceryItemCard.tsx`, `CategoryFilter.tsx`
- `src/components/scanner/BarcodeOverlay.tsx`
- `src/navigation/RootNavigator.tsx`, `AuthNavigator.tsx`, `MainNavigator.tsx`
- `src/store/authStore.ts`, `groceryStore.ts`, `settingsStore.ts`
- `src/types/index.ts`, `database.ts`, `api.ts`
- `src/utils/dateUtils.ts`, `validators.ts`, `helpers.ts`

### Files Removed
- `src/services/database/` (old schema, models, index)
- `src/services/api/` (old client, barcode, analytics)
- `src/services/firebase/FirebaseAuth.ts` (replaced by AuthService.ts)
- `src/services/sync/BackgroundSyncService.ts` (replaced by SyncService.ts)
- `src/store/inventoryStore.ts` (replaced by groceryStore.ts)
- `src/navigation/AppNavigator.tsx`, `TabNavigator.tsx` (replaced by Root/Auth/MainNavigator)
- `src/hooks/useNetworkStatus.ts`, `useFeatureAccess.ts`
- `src/types/models.ts`, `navigation.ts` (replaced by database.ts, api.ts)
- `src/constants/`, `src/theme/` (consolidated into config/constants.ts)

---

## [2026-01-30] Session 4: WatermelonDB Database Layer Setup

### Request
Set up the local SQLite database using WatermelonDB with updated table schemas, model classes with decorators/relations/validation, repository classes with full CRUD operations, and migration infrastructure.

### Changes Made
- **Schema** (`schema.ts`): Updated all 4 tables with new column definitions:
  - `grocery_items`: Added `image_url` (replaces `image_uri`), `added_date`, `user_id`, `synced_to_cloud` (replaces `is_synced`); indexed `barcode`, `category`, `user_id`
  - `shopping_lists`: Replaced `is_active` → `is_completed`, added `created_date`, `user_id`
  - `list_items`: Renamed `name` → `item_name`, replaced `is_checked` → `is_purchased`, removed `price_estimate`/`notes`
  - `analytics_events`: Renamed `payload` → `event_data`, `is_synced` → `synced`, `created_at` → `timestamp`, added `user_id`

- **Models**: Updated all 4 with new field decorators, computed properties, and writer methods:
  - `GroceryItem`: Added `isExpired`/`isExpiringSoon()` getters, `softDelete()`, `markSynced()`, `adjustQuantity()`
  - `ShoppingList`: Added `remainingCount`/`purchasedCount` lazy queries, `markCompleted()`/`reopen()`
  - `ListItem`: Updated to `itemName`/`isPurchased`, added `togglePurchased()`/`updateQuantity()`
  - `AnalyticsEvent`: Expanded event types (9 types), added `getParsedData<T>()` with error handling

- **Repositories**: Full CRUD + typed input interfaces:
  - `GroceryRepository`: `insert`, `update`, `delete`, `destroyPermanently`, `getAll`, `getById`, `getByBarcode`, `getByCategory`, `getExpiring`, `getExpired`, `search`, `getUnsynced`, `markSyncedBatch`, `count`, `observeAll`, `observeByCategory`
  - `ShoppingListRepository`: `createList`, `renameList`, `markCompleted`, `reopenList`, `deleteList`, `addItem`, `updateItem`, `markPurchased`, `deleteItem`, `markAllPurchased`, `getAll`, `getAllIncludingCompleted`, `getById`, `getListItems`, `getUnpurchasedItems`, `observeAll`, `observeListItems`
  - `AnalyticsRepository`: `logEvent`, `markSynced`, `purgeOlderThan`, `getUnsyncedEvents`, `getByType`, `getByDateRange`, `unsyncedCount`, `totalCount`

- **Migration** (`migration_v1.ts`): Updated to match new schema columns, added future migration template comment
- **Types** (`database.ts`): Updated interfaces: `GroceryItemData`, `GroceryItemUpdateData`, `ShoppingListData`, `ListItemData`, `AnalyticsEventData` with expanded event types

### Files Modified
- `src/database/schema.ts`
- `src/database/models/GroceryItem.ts`
- `src/database/models/ShoppingList.ts`
- `src/database/models/ListItem.ts`
- `src/database/models/AnalyticsEvent.ts`
- `src/database/repositories/GroceryRepository.ts`
- `src/database/repositories/ShoppingListRepository.ts`
- `src/database/repositories/AnalyticsRepository.ts`
- `src/database/migrations/migration_v1.ts`
- `src/types/database.ts`

---

## [2026-01-30] Session 5: TypeScript Models, Interfaces & Validation

### Request
Create complete TypeScript models and interfaces for the database with:
- Updated field definitions (typed enums for location, required userId, Date types via @date decorator)
- TypeScript interfaces for each model (I-prefixed: IGroceryItem, IShoppingList, IListItem, IAnalyticsEvent)
- Validation methods on each model (static validate() + isValid getter)
- Helper methods for data transformation (model→interface, timestamp conversion, grouping/sorting)
- Zod schemas updated for all models
- Updated event types: 'barcode_scan', 'item_added', 'list_created', etc. (12 types)

### Changes Made
- **Schema** (`schema.ts`): Removed `price`, `notes`, `is_deleted` from grocery_items. Made `location`, `user_id` required across all tables. Made `category` required on list_items. Added `created_at`/`updated_at` to shopping_lists.

- **Models** — All 4 rewritten with:
  - `GroceryItem`: `StorageLocation` typed enum (`'fridge' | 'pantry' | 'freezer'`), `@date` decorators for expiryDate/addedDate, computed `isExpired`/`isExpiringSoon`/`daysUntilExpiry`/`expiryStatus`/`isLowStock`, static `validate()`, `toJSON()`, writer methods (markSynced, markDirty, adjustQuantity, moveToLocation)
  - `ShoppingList`: `@date` for createdDate, `@children` items relation, `@lazy` remainingItems/purchasedItems queries, static `validate()`, `toJSON()`, writer methods (markCompleted, reopen, rename)
  - `ListItem`: Required `category` (no longer optional), `displayText` computed prop, static `validate()`, `toJSON()`, writer methods (togglePurchased, markPurchased, updateQuantity)
  - `AnalyticsEvent`: 12 event types with `ANALYTICS_EVENT_TYPES` constant, `@date` for timestamp, `getParsedData<T>()`/`getDataField<T>()`, `formattedTimestamp`/`ageMs` computed props, static `validate()`, `toJSON()`

- **TypeScript Interfaces** (`types/database.ts`): Complete interface layer:
  - Record interfaces: `IGroceryItem`, `IShoppingList`, `IListItem`, `IAnalyticsEvent`
  - Input interfaces: `CreateGroceryItemInput`, `UpdateGroceryItemInput`, `CreateShoppingListInput`, `UpdateShoppingListInput`, `CreateListItemInput`, `UpdateListItemInput`, `CreateAnalyticsEventInput`
  - Typed event payloads: `BarcodeScanEventData`, `ItemAddedEventData`, `ItemRemovedEventData`, `ListCreatedEventData`, `ListCompletedEventData`, `PurchaseRecordedEventData`, `SyncCompletedEventData`
  - `AnalyticsEventDataMap` mapping event types to payload shapes

- **Validators** (`utils/validators.ts`): Zod schemas rewritten:
  - `groceryItemSchema` with `z.enum` for location, barcode regex, URL validation
  - `shoppingListSchema`, `listItemSchema`, `analyticsEventSchema`
  - Utility functions: `isValidBarcode`, `isValidLocation`, `isValidEventType`, `isValidExpiryDate`, `isValidQuantity`
  - Generic `validateWithSchema<T>()` for imperative validation

- **Helpers** (`utils/helpers.ts`): Added data transformation layer:
  - Model→interface converters: `groceryItemToInterface`, `shoppingListToInterface`, `listItemToInterface`, `analyticsEventToInterface`
  - Timestamp converters: `toTimestamp`, `fromTimestamp`
  - API→input mappers: `barcodeScanToGroceryInput`, `groceryItemToListItemInput`
  - Grouping/sorting: `groupBy`, `groupByCategory`, `groupByLocation`, `sortByExpiry`

- **Repositories**: Updated all 3 to use typed interfaces from `types/database.ts`, added validation calls before creates, removed `is_deleted` soft-delete pattern (using WatermelonDB built-in `markAsDeleted`), added `getByLocation`, `getByUserId`, `observeByLocation`, `getListItemCount`, `getByUserId` on analytics

- **Migration** (`migration_v1.ts`): Updated to match new schema (removed price/notes/is_deleted, required location/user_id/category)

### Files Modified
- `src/database/schema.ts`
- `src/database/models/GroceryItem.ts`
- `src/database/models/ShoppingList.ts`
- `src/database/models/ListItem.ts`
- `src/database/models/AnalyticsEvent.ts`
- `src/database/repositories/GroceryRepository.ts`
- `src/database/repositories/ShoppingListRepository.ts`
- `src/database/repositories/AnalyticsRepository.ts`
- `src/database/migrations/migration_v1.ts`
- `src/types/database.ts`
- `src/types/index.ts`
- `src/utils/validators.ts`
- `src/utils/helpers.ts`

---

## [2026-01-30] Session 7: Database Normalization & 3-Stage Item Lifecycle

### Request
Normalize the database schema around a 3-stage item data lifecycle:
- **Stage 1 (Scan)**: Temporary barcode scan data in `scanned_items` — ephemeral, auto-deleted after 24h TTL
- **Stage 2 (Active Inventory)**: Confirmed items in `inventory_items` with `status='active'`
- **Stage 3 (Consumed/Used)**: Same `inventory_items` table, `status` changed to `consumed`/`expired`/`discarded`

Key design decisions:
- Stage 2 and Stage 3 share the same table (differ only in status column)
- Manual adds go directly to Stage 2 (bypass Stage 1)
- Duplicate barcodes allowed (same product bought on different dates)
- Normalize `category` and `unit` into lookup tables with FK references
- Restore incorrectly removed fields (`price`, `purchaseDate`, `notes`)
- Fix 10+ bugs across services and UI

### Changes Made

**Documentation:**
- Added "Item Data Lifecycle (3-Stage Model)" section to `docs/DEVELOPMENT_RULES.md`

**Schema & Migrations (3 new tables, 4 modified):**
- Rewrote `src/database/schema.ts` — 7 tables: categories, units, scanned_items, inventory_items, shopping_lists, list_items, analytics_events
- Rewrote `src/database/migrations/migration_v1.ts` for all 7 tables

**New Models:**
- `src/database/models/Category.ts` — lookup table with name, icon, color, sortOrder, isDefault
- `src/database/models/Unit.ts` — lookup table with name, abbreviation, unitType (weight/volume/count)
- `src/database/models/ScannedItem.ts` — Stage 1 temporary scan with TTL, promotionData getter

**Updated Models:**
- `GroceryItem.ts` → `InventoryItem.ts` — renamed, added FK relations (categoryId, unitId), status lifecycle fields (status, consumedDate, reason, quantityRemaining), restored price/purchaseDate/notes, markConsumed() writer
- `ListItem.ts` — category→categoryId, unit→unitId, added timestamps and FK relations
- `AnalyticsEvent.ts` — added 4 new lifecycle event types (item_scanned, scan_promoted, scan_discarded, item_consumed)

**Seed Data:**
- Created `src/database/seed.ts` — 9 default categories + 14 common units, guarded by fetchCount()

**New Repositories:**
- `CategoryRepository.ts` — CRUD for categories, blocks default deletion
- `UnitRepository.ts` — read/observe by type and abbreviation
- `ScannedItemRepository.ts` — Stage 1 CRUD, TTL cleanup via deleteExpired()

**Updated Repositories:**
- `GroceryRepository.ts` → `InventoryRepository.ts` — renamed, added Stage 2/3 queries (getActive, getConsumed, getConsumptionStats), promoteFromScan(), markConsumed()
- `ShoppingListRepository.ts` — updated field names (unit→unitId, category→categoryId)

**Type Definitions:**
- Rewrote `src/types/database.ts` — new interfaces (ICategory, IUnit, IScannedItem, IInventoryItem), renamed inputs, added lifecycle event data types
- Updated `src/types/index.ts` — new exports for InventoryItemView, InventoryStatus, ConsumeReason, UnitType

**Hooks & Stores:**
- Rewrote `src/hooks/useDatabase.ts` — registers 7 models + 6 repositories, calls seedDatabase() and deleteExpired() on init
- `groceryStore.ts` → `inventoryStore.ts` — renamed, fields use categoryId/unitId/imageUrl/status
- Created `src/store/scanStore.ts` — Stage 1 scan state management

**Service Bug Fixes:**
- `FirestoreService.ts` — fixed import (GroceryItem→InventoryItem), removed isDeleted check, fixed field names (category→categoryId, unit→unitId, imageUri→imageUrl), fixed pushAnalytics param shape (payload→eventData, createdAt→timestamp)
- `SyncService.ts` — fixed import (GroceryRepository→InventoryRepository), fixed getUnsynced→getUnsyncedEvents, fixed e.payload→e.eventData, fixed e.createdAt→e.timestamp

**UI Components:**
- `HomeScreen.tsx` — uses InventoryRepository.getActive(), DB-driven category chips, resolves FK relations for display
- `CategoryFilter.tsx` — accepts categories as props (DB-driven), emits categoryId instead of name
- `GroceryItemCard.tsx` → `InventoryItemCard.tsx` — renamed, uses unitAbbreviation/categoryName from view
- `InventoryDetailScreen.tsx` — resolves category/unit via FK relations, added "Mark Used" button for Stage 2→3 transition

**Helpers & Validators:**
- `helpers.ts` — renamed all groceryItem* functions to inventoryItem*, added scannedItemToInventoryInput(), groupByCategoryId(), groupByStatus()
- `validators.ts` — renamed groceryItemSchema→inventoryItemSchema, added scannedItemSchema, consumeItemSchema, updated listItemSchema (unit→unitId, category→categoryId)

### Files Created
- `src/database/models/Category.ts`
- `src/database/models/Unit.ts`
- `src/database/models/ScannedItem.ts`
- `src/database/seed.ts`
- `src/database/repositories/CategoryRepository.ts`
- `src/database/repositories/UnitRepository.ts`
- `src/database/repositories/ScannedItemRepository.ts`
- `src/database/repositories/InventoryRepository.ts`
- `src/store/inventoryStore.ts`
- `src/store/scanStore.ts`
- `src/components/grocery/InventoryItemCard.tsx`

### Files Deleted (replaced by renamed versions)
- `src/database/models/GroceryItem.ts` → `InventoryItem.ts`
- `src/database/repositories/GroceryRepository.ts` → `InventoryRepository.ts`
- `src/store/groceryStore.ts` → `inventoryStore.ts`
- `src/components/grocery/GroceryItemCard.tsx` → `InventoryItemCard.tsx`

### Files Modified
- `docs/DEVELOPMENT_RULES.md`
- `src/database/schema.ts`
- `src/database/migrations/migration_v1.ts`
- `src/database/models/InventoryItem.ts`
- `src/database/models/ListItem.ts`
- `src/database/models/AnalyticsEvent.ts`
- `src/database/repositories/ShoppingListRepository.ts`
- `src/types/database.ts`
- `src/types/index.ts`
- `src/hooks/useDatabase.ts`
- `src/services/firebase/FirestoreService.ts`
- `src/services/sync/SyncService.ts`
- `src/screens/home/HomeScreen.tsx`
- `src/screens/inventory/InventoryDetailScreen.tsx`
- `src/components/grocery/CategoryFilter.tsx`
- `src/utils/helpers.ts`
- `src/utils/validators.ts`

---

## [2026-01-30] Session 8: Complete Firebase Setup

### Request
Set up complete Firebase integration for the React Native app: configuration, authentication (email + Google), Firestore sync with typed interfaces and conflict resolution, analytics with lifecycle helpers, shopping list sync, Firestore security rules.

### Changes Made

**Dependency:**
- Installed `@react-native-google-signin/google-signin` for Google Sign-In support

**Firebase Config (`src/config/firebase.ts`):**
- Added `LIST_ITEMS` subcollection constant for nested shopping list items
- Enabled Firestore offline persistence with unlimited cache size
- Added typed path helper functions: `userDocRef()`, `inventoryColRef()`, `shoppingListsColRef()`, `listItemsColRef()`, `analyticsColRef()`

**AuthService (`src/services/firebase/AuthService.ts`) — rewritten:**
- Added `signInWithGoogle()` — native Google Sign-In flow → Firebase credential
- Added `configureGoogleSignIn(webClientId)` — call once on app start
- Added `deleteAccount()` — GDPR-compliant account deletion
- Added `AuthError` interface and `toAuthError()` for consistent error handling
- Added `ERROR_MESSAGES` map for user-friendly error messages (wrong-password, user-not-found, etc.)
- Renamed `signIn()` → `signInWithEmail()` for clarity alongside Google sign-in
- `signOut()` now also revokes Google access if applicable
- All methods wrapped in try/catch with typed error surfaces

**FirestoreService (`src/services/firebase/FirestoreService.ts`) — rewritten:**
- Added typed Firestore document interfaces: `FirestoreUserProfile`, `FirestoreUserPreferences`, `FirestoreInventoryItem`, `FirestoreShoppingList`, `FirestoreListItem`, `FirestoreAnalyticsEvent`
- `syncInventoryItems()` — replaces `pushItems()`, handles >500 doc Firestore batch limit
- `fetchInventoryItems()` — replaces `pullItems()`, returns typed documents
- `syncShoppingLists()` — pushes lists with nested `items/` subcollection
- `fetchShoppingLists()` — pulls lists + all their nested items
- `saveUserPreferences()` / `fetchUserPreferences()` — user settings stored in profile doc
- `reconcileInventoryItems()` — bidirectional sync with last-write-wins conflict resolution via `updatedAt` timestamps
- `mergeWithConflictResolution()` — generic timestamp-based conflict resolver
- `deleteUserData()` — deletes all Firestore data for a user (GDPR)
- `pushAnalytics()` now handles >500 event batches
- Added `chunkArray()` and `deleteSubcollection()` helpers

**Firestore data structure:**
```
users/{userId}                    ← profile doc (email, tier, preferences)
  grocery_items/{itemId}          ← inventory items (all fields)
  shopping_lists/{listId}         ← list doc (name, isCompleted)
    items/{itemId}                ← list item doc (itemName, quantity, etc.)
  analytics/{eventId}             ← event doc (eventType, eventData, timestamp)
```

**AnalyticsService (`src/services/firebase/AnalyticsService.ts`):**
- Added `setUserProperties()` — batch set multiple user properties
- Added lifecycle helpers: `logScanPromoted()`, `logScanDiscarded()`, `logItemConsumed()`
- Added shopping list helpers: `logListCreated()`, `logListCompleted()`
- Updated `logItemAdded()` to accept `categoryId` + `source`

**SyncService (`src/services/sync/SyncService.ts`):**
- Added `ShoppingListRepository` import and initialization
- Sync now pushes shopping lists (with nested items) alongside inventory and analytics
- Uses new `syncInventoryItems()` and `syncShoppingLists()` method names

**useAuth hook (`src/hooks/useAuth.ts`):**
- Now creates Firestore profile document on first sign-in (new user)
- Uses `setUserProperties()` to set both `tier` and `sign_in_method` analytics properties

**Firestore Security Rules (`firestore.rules`) — new:**
- All data scoped to authenticated user (`request.auth.uid == userId`)
- Validates document structure on create (required fields, enum values)
- Validates status values (`active/consumed/expired/discarded`) and locations (`fridge/pantry/freezer`)
- Analytics events are immutable (no updates)
- Default deny-all for unmatched paths
- Helper functions: `isAuthenticated()`, `isOwner()`, `hasString()`, `hasNumber()`

### Files Created
- `firestore.rules`

### Files Modified
- `src/config/firebase.ts`
- `src/services/firebase/AuthService.ts`
- `src/services/firebase/FirestoreService.ts`
- `src/services/firebase/AnalyticsService.ts`
- `src/services/sync/SyncService.ts`
- `src/hooks/useAuth.ts`
- `package.json` (new dependency)

---

## [2026-01-30] Session 9: Barcode Scanning Feature Enhancement

### Request
Enhance the barcode scanning feature with complete 7-step lookup workflow, torch toggle, scan animation, camera permissions UI, retry logic, offline queue, contribute endpoint, and Stage 1 (ScannedItem) integration.

### Changes Made

**BarcodeApiService.ts** — Rewritten with:
- Retry logic (up to 2 retries with linear backoff for 5xx/network errors)
- In-memory offline queue (auto-queues failed requests, 24h expiry)
- `flushQueue()` to drain queued requests when connectivity restores
- `contributeProduct()` for submitting user-contributed product data
- `getProduct()` with proper 404 handling
- `BarcodeApiError` typed error class with codes (offline/timeout/server/unknown)

**BarcodeService.ts** — Rewritten with full 7-step lookup workflow:
1. Check local in-memory cache (10-minute TTL)
2. Query backend API (server-side cache + Firebase)
3. Query Open Food Facts directly (offline-first fallback)
4. Mark as not-found if all sources fail
5. Cache the result locally
6. Log analytics event via AnalyticsService
7. Return result with source tag for Stage 1 save
- Uses `BARCODE_FORMATS` from constants for code scanner
- Exports `LookupResult` type with source tracking

**useBarcode.ts** — Rewritten with Stage 1 integration:
- Uses BarcodeService.lookupBarcode() (7-step pipeline) instead of direct API calls
- Saves every scan result to WatermelonDB `scanned_items` table (Stage 1)
- Non-blocking DB writes (scan succeeds even if local save fails)
- Exposes `source` field (local_cache/backend/openfoodfacts/not_found)
- Reads auth state from useAuthStore for userId

**BarcodeOverlay.tsx** — Enhanced with animated scan line:
- Animated green line oscillates up/down inside the viewfinder
- Animation controlled by `active` prop (pauses when not scanning)
- Uses native driver for smooth 60fps animation

**BarcodeScannerScreen.tsx** — Enhanced with:
- Camera permission handling UI (not-determined → request prompt, denied → settings link)
- Torch/flashlight toggle button in top-right corner
- Camera deactivates when screen loses focus (battery optimization via useFocusEffect)
- Product image display in result view
- Source tag display (shows which lookup source returned the result)
- "Enter Manually Instead" option on permission screens
- Better layout with proper spacing and backgrounds

**api.ts types** — Added:
- `ScanResponse` interface
- `ContributeRequest` / `ContributeResponse` interfaces

**config/api.ts** — Added `contribute` endpoint path

### Files Modified
- `src/types/api.ts`
- `src/config/api.ts`
- `src/services/barcode/BarcodeApiService.ts`
- `src/services/barcode/BarcodeService.ts`
- `src/hooks/useBarcode.ts`
- `src/components/scanner/BarcodeOverlay.tsx`
- `src/screens/scanner/BarcodeScannerScreen.tsx`

---

## [2026-01-30] Session 10: Barcode Contribution Feature

### Request
Create a feature for users to contribute new barcodes when a scanned product is not found in any database. Includes a modal form with photo capture, validation, backend endpoint to save to Firestore and submit to Open Food Facts, and image upload to Firebase Storage.

### Changes Made

**ContributeProductModal.tsx** — New component (`src/components/scanner/`):
- Full-screen modal with 3 states: form, submitting, success
- Form fields: product name (required), brand (optional), category (required via chip selector), photo (optional)
- 11 category options matching user's spec (Produce, Dairy & Eggs, Meat & Seafood, etc.)
- Photo capture via `react-native-image-picker` (camera or gallery)
- Client-side validation with inline error messages
- Submits to backend via `BarcodeApiService.contributeProduct()`
- Uploads photo to Firebase Storage via `ImageUploadService`
- Logs `barcode_contributed` analytics event
- Thank-you success screen after submission
- Calls `onContributed` callback so parent can navigate to AddItem with data
- Reset on close (form fields, photo, errors)

**ImageUploadService.ts** — New service (`src/services/firebase/`):
- `capturePhoto()` — launches device camera with compression (800x800, 70% quality)
- `pickFromGallery()` — opens photo library picker with same compression
- `uploadProductImage(image, userId, barcode)` — uploads to Firebase Storage at `barcode_contributions/{userId}/{barcode}_{timestamp}.jpg` with metadata
- `deleteImage(storagePath)` — cleanup helper
- Returns download URL for inclusion in contribute request

**BarcodeScannerScreen.tsx** — Updated:
- Split product result view into found vs. not-found branches
- Not-found shows "Contribute Product Info" CTA button + "Add to Inventory Manually" fallback
- Opens `ContributeProductModal` on contribute tap
- On successful contribution, navigates to AddItem with contributed data pre-filled

**api.ts types** — Updated:
- `ContributeRequest` now includes optional `imageUrl` field
- Added `ContributeCategory` interface and `CONTRIBUTE_CATEGORIES` constant array (11 categories)

**Backend barcode.py** — Updated (`backend/app/api/routes/`):
- Added `POST /api/barcode/contribute` endpoint
- Pydantic `ContributeRequest` model with validation (barcode not empty, productName >= 2 chars)
- Saves contribution to Firestore `contributed_products/{barcode}` (merge mode, `pending_review` status)
- Best-effort (non-blocking) submission to Open Food Facts Write API (`product_jqm2.pl`)
- Returns `ContributeResponse` with status and barcode

**Backend main.py** — Updated:
- Added Firebase Admin SDK initialization (supports credentials file path or Application Default Credentials)

### Dependencies Installed
- `react-native-image-picker` — photo capture and gallery picker
- `@react-native-firebase/storage` — Firebase Cloud Storage for image upload

### Files Created
- `src/components/scanner/ContributeProductModal.tsx`
- `src/services/firebase/ImageUploadService.ts`

### Files Modified
- `src/screens/scanner/BarcodeScannerScreen.tsx`
- `src/types/api.ts`
- `backend/app/api/routes/barcode.py`
- `backend/main.py`
- `mobile-app/package.json` (new dependencies)

---

## [2026-01-30] Session 11: Inventory Screen Feature

### Request
Create a full-featured Inventory/Grocery Items screen with grid/list toggle, category filter, search, sort options, pull-to-refresh, empty states, expiry color coding, location badges, swipe-to-edit/delete, FAB for adding items, and FlatList performance optimization.

### Changes Made

**InventoryScreen.tsx** — Rewritten (`src/screens/inventory/`):
- Grid/list view toggle (top-right button swaps between FlatList and 2-column grid)
- Category filter chips bar (horizontal scroll, from WatermelonDB categories)
- Quick filter chips: All, Expiring Soon (next 7 days), Expired, Fridge, Pantry, Freezer
- Sort dropdown menu: Date Added, Expiry Date, Name, Category
- Search bar with real-time filtering across name/brand/category
- Pull-to-refresh via RefreshControl
- Item count + current sort label
- Swipe-to-reveal Edit and Delete actions (using react-native-gesture-handler Swipeable)
- Delete confirmation alert
- FAB button "Add Item" at bottom-right
- Two empty states: filtered (no matches) vs. empty (no items at all)
- FlatList optimization: removeClippedSubviews, maxToRenderPerBatch=12, windowSize=5, initialNumToRender=10
- O(1) category lookup via Map instead of per-item fetch
- All filtering, sorting, search done client-side via useMemo for instant response

**InventoryItemCard.tsx** — Rewritten (`src/components/grocery/`):
- Two layouts: full (list mode) and compact (grid mode) controlled by `compact` prop
- Product image display (or food-variant placeholder icon)
- Name, brand, quantity with unit abbreviation
- Category color badge with category name
- Expiry date with color coding: green=fresh, yellow=expiring (<=3 days), red=expired
- Expiry icon changes by status (calendar-check, clock-alert, alert-circle)
- Human-friendly expiry labels: "Expires today", "Expires tomorrow", "3d left", or formatted date
- Location badge with icon: Fridge (blue), Pantry (orange), Freezer (cyan)
- Category color accent line at card bottom
- Fully memoized with React.memo

**inventoryStore.ts** — Updated (`src/store/`):
- `InventoryItemView` expanded: added `categoryColor`, `location`, `addedDate` fields
- New types: `SortOption` ('date_added'|'expiry_date'|'name'|'category'), `FilterOption` ('all'|'expiring_soon'|'expired'|'fridge'|'pantry'|'freezer'), `ViewMode` ('list'|'grid')
- New store actions: `setSortBy`, `setFilterBy`, `setViewMode`

### Files Modified
- `src/screens/inventory/InventoryScreen.tsx`
- `src/components/grocery/InventoryItemCard.tsx`
- `src/store/inventoryStore.ts`

---

## [2026-01-30] Session 12: Shopping Lists Feature

### Request
Create full shopping list functionality with:
- ShoppingListsScreen.tsx — list of all lists, create dialog, item count, completion status, swipe-to-delete/duplicate, share (paid), context menu
- ListDetailScreen.tsx — editable name, checkboxes, progress indicator, category grouping, edit quantity, add-to-inventory on purchase
- AddListItemScreen.tsx — manual add form with category/unit chips, search, quick-add suggestions (low stock, recent items)
- Features: mark purchased, add to inventory, remove, edit quantity, duplicate list, template lists

### Changes Made

**ShoppingListRepository.ts** — Updated (`src/database/repositories/`):
- Added `duplicateList(list, userId)` — duplicates a list and all its items in a single write transaction
- Added `observeAllIncludingCompleted()` — reactive observer for all lists including completed
- Added `getPurchasedItemCount(listId)` — count purchased items for progress display

**ShoppingListsScreen.tsx** — Rewritten (`src/screens/lists/`):
- Create list via Portal Dialog (replaces inline input)
- Each card shows item count (purchased/total), creation date, and progress bar
- Completion status: green check icon + strikethrough for completed lists
- "Show completed" toggle chip to include/exclude completed lists
- Swipe-to-reveal actions: duplicate (copy icon) and delete (trash icon)
- Context menu (3-dot) per list: Mark Complete/Reopen, Duplicate, Share, Delete
- Share action gated behind paid tier via `isFeatureAvailable('cloud_sync', tier)`
- FAB with "New List" label
- Empty state with prompt to create first list
- Reloads on screen focus

**ListDetailScreen.tsx** — Rewritten (`src/screens/lists/`):
- Progress header: "X of Y items" with percentage and colored ProgressBar (blue → green at 100%)
- SectionList grouped by category with colored dot, section name, section count
- Category sections sorted: incomplete sections first, then alphabetical
- Items within sections: unpurchased first, then alphabetical
- Checkbox toggles purchased status via repository
- Long-press on item opens Edit Quantity dialog
- Purchased items show "Add to Inventory" button (package icon) — creates InventoryItem in pantry
- Remove item with confirmation alert
- Header menu (3-dot): Rename List, Mark All Purchased, Complete List
- Rename dialog with TextInput
- FAB navigates to AddListItem screen

**AddListItemScreen.tsx** — New screen (`src/screens/lists/`):
- Searchbar filters both suggestion sections
- Manual add form: item name + quantity inputs, category chips (horizontal scroll), unit chips
- "Add Custom Item" section always visible at top
- Suggestions section via SectionList:
  - "Low Stock" — inventory items with quantity <= 1
  - "Recent Items" — last 10 items added to inventory (sorted by addedDate)
- Quick-add button on each suggestion adds to list with 1 tap
- Added items removed from suggestions list for visual feedback
- "Done" button returns to ListDetailScreen
- Category dot + meta info (quantity, unit, brand) on each suggestion row

**MainNavigator.tsx** — Updated (`src/navigation/`):
- Imported AddListItemScreen
- Added `AddListItem` route to ListsStackNavigator

### Files Created
- `src/screens/lists/AddListItemScreen.tsx`

### Files Modified
- `src/database/repositories/ShoppingListRepository.ts`
- `src/screens/lists/ShoppingListsScreen.tsx`
- `src/screens/lists/ListDetailScreen.tsx`
- `src/navigation/MainNavigator.tsx`

---

## [2026-01-30] Session 13: Home Dashboard Screen

### Request
Create a full Home Dashboard screen with: welcome header with user name, date, subscription badge; quick stats cards (total items, expiring this week, active lists, scans); expiring soon horizontal scroll with urgency indicators; quick actions grid (scan, add item, new list, recipes as paid feature); recent activity list; insights section with waste reduction + usage summary (paid) and upgrade teaser (free). Pull-to-refresh, fade-in animation, color-coded sections.

### Changes Made

**HomeScreen.tsx** — Full rewrite (`src/screens/home/`):

*Header:*
- Time-aware greeting (Good morning/afternoon/evening) with user's first name
- Current date formatted as "Thursday, January 30"
- Subscription badge: "Free" (grey) or "Premium" (purple with crown icon)

*Quick Stats Cards (2x2 grid):*
- Total Items — green, counts active inventory items
- Expiring Soon — orange, counts items expiring within 7 days
- Active Lists — blue, counts non-completed shopping lists
- Scans — purple, counts all scanned items
- Each card has colored icon background + large value + label

*Expiring Soon Section:*
- Horizontal ScrollView of items expiring within 3 days
- Each card has urgency bar at top (red=expired, deep orange=tomorrow, orange=2-3 days)
- Avatar image or category-colored icon placeholder
- Item name, quantity with unit, days-left chip
- Tap navigates to InventoryDetail
- "View All" button navigates to Inventory tab
- Section hidden when no expiring items

*Quick Actions (2x2 grid):*
- Scan Barcode (green) → navigates to ScanTab
- Add Item (blue) → navigates to InventoryTab
- New List (orange) → navigates to ListsTab
- Recipes (purple if paid, grey if free) → locked with "PRO" chip for free tier

*Recent Activity:*
- Card with last 5 items added to inventory
- Category color dot + item name + category name + added date
- Chevron right for navigation to InventoryDetail
- "See All" button navigates to Inventory tab
- Section hidden when no items

*Insights (paid tier):*
- Waste Reduction card: count of expired+discarded items in last 30 days with contextual tip
- Usage Summary card: count of used-up items in last 30 days with tip
- Smart Tip card (full-width): contextual message based on expiring items count
- Free tier: lock icon + description + "Upgrade to Premium" button

*Technical:*
- Animated fade-in on first load (400ms via RN Animated API, native driver)
- Pull-to-refresh via RefreshControl
- Reloads data on screen focus
- O(1) category and unit lookups via Map
- All stats fetched in parallel via Promise.all
- Conditional rendering: expiring section, recent section, paid/free insights

### Files Modified
- `src/screens/home/HomeScreen.tsx`

---

## [2026-01-30] Session 14: Background Sync Service & Analytics

### Request
Create complete background sync service with: periodic sync every 6 hours, network/battery preflight checks, batched analytics (max 100), retry logic with exponential backoff, per-category sync functions (analytics/inventory/lists), conflict resolution, sync status indicator, manual sync trigger, new event types (item_deleted, item_expired_wasted, recipe_viewed, screen_view, feature_used).

### Changes Made

**SyncService.ts** — Full rewrite (`src/services/sync/`):
- 6-hour background fetch interval via `react-native-background-fetch`
- Preflight `canSync()` check: verifies network connectivity before syncing
- Three separate sync functions:
  - `syncAnalyticsEvents(userId)` — batched in groups of 100, all users
  - `syncInventoryItems(userId)` — unsynced items to Firestore, paid only
  - `syncShoppingLists(userId)` — all lists with nested items, paid only
- `sync(userId, isPaid)` orchestrator: runs all sync functions, collects per-category results and errors
- Exponential backoff retry: `withRetry()` — 3 attempts, delays 2s→4s→8s, checks connectivity between retries
- `purgeOldAnalytics()` — deletes synced events older than 30 days
- `reconcileInventory()` — bidirectional sync with last-write-wins conflict resolution via FirestoreService
- Listener pattern: `addListener()` → UI subscribes to `SyncResult` updates
- `SyncResult` type: status, inventoryPushed, listsPushed, eventsPushed, eventsPurged, errors[], timestamp
- `configureBackgroundFetch(userId)` — registers background task with headless support
- Error isolation: each sync category catches independently, partial success possible

**syncStore.ts** — New Zustand store (`src/store/`):
- State: status ('idle'|'syncing'|'success'|'error'), lastSyncAt, lastResult, isOnline, errorMessage
- Actions: setStatus, setLastSyncAt, setLastResult, setOnline, setError, updateFromResult

**useSync.ts** — Rewritten (`src/hooks/`):
- Initializes SyncService with database on mount
- Subscribes SyncService listener → updates syncStore
- Monitors network via NetInfo → updates isOnline
- `syncNow()` — manual trigger, guards against concurrent syncs
- 6-hour periodic foreground interval via setInterval
- Background fetch registration on mount (for all authenticated users)
- Returns: status, isOnline, lastSyncAt, lastResult, errorMessage, syncNow

**SyncStatusBar.tsx** — New component (`src/components/common/`):
- Horizontal bar with colored left border indicating status
- Idle: grey cloud icon, "Last synced X ago" or "Not synced yet"
- Syncing: blue spinner, "Syncing..."
- Success: green cloud-check, last sync time
- Error: red cloud-alert, error message, retry button
- Offline: grey cloud-off, "Offline"
- Manual sync button (sync icon) on all non-syncing states
- Tap-to-sync on the entire bar

**AnalyticsRepository.ts** — Enhanced (`src/database/repositories/`):
- `getUnsyncedBatch(limit)` — fetches limited batch of unsynced events (for incremental sync)
- `countByType(eventType)` — count events by type (for dashboard)
- `getRecentEvents(days)` — events within last N days
- `purgeCandidateCount(daysAgo)` — count of synced events eligible for purge

**AnalyticsEvent.ts** — Updated model (`src/database/models/`):
- Added 5 new event types: `item_deleted`, `item_expired_wasted`, `recipe_viewed`, `screen_view`, `feature_used`
- Updated `ANALYTICS_EVENT_TYPES` constant array (now 21 event types total)

**AnalyticsService.ts** — Updated (`src/services/firebase/`):
- `logItemDeleted(itemId, name)` — permanent deletion tracking
- `logItemExpiredWasted(itemId, name, daysExpired)` — waste tracking
- `logRecipeViewed(recipeId, recipeName)` — paid feature usage
- `logScreen(screenName)` — dual: Firebase screen_view + local event
- `logFeatureUsed(featureName, details?)` — generic feature usage

**HomeScreen.tsx** — Updated to integrate sync:
- Imports and calls `useSync()` hook
- Added `SyncStatusBar` component below header, above quick stats
- Tap-to-sync wired to `syncNow()`

### Files Created
- `src/store/syncStore.ts`
- `src/components/common/SyncStatusBar.tsx`

### Files Modified
- `src/services/sync/SyncService.ts`
- `src/hooks/useSync.ts`
- `src/database/repositories/AnalyticsRepository.ts`
- `src/database/models/AnalyticsEvent.ts`
- `src/services/firebase/AnalyticsService.ts`
- `src/screens/home/HomeScreen.tsx`

---

## [2026-01-30] Session 15: Web Analytics Dashboard — Plan Documented

### Request
Create analytics and insights dashboard for paid users (web-only, not in mobile app). Features: time period selector, shopping patterns with charts, waste reduction analysis, nutrition overview, spending analysis, AI insights, export reports.

### Decision
Feature deferred for future web development phase. Full implementation plan saved as documentation.

### Changes Made
- Created `docs/subsystems/web-analytics-dashboard.md` — comprehensive implementation plan covering:
  - Backend API enhancements (7 new files, 4 modified files)
  - New React + Vite + TypeScript web dashboard app (~24 files)
  - Firebase Auth integration (same project as mobile)
  - Recharts for data visualization
  - Rule-based AI insights engine
  - PDF export (browser print) + email export (SendGrid)
  - Full API endpoint design, data flow, and verification checklist

### Files Created
- `docs/subsystems/web-analytics-dashboard.md`

### Status
Planned — not yet implemented. Saved for future web development sprint.

---

## [2026-01-30] Session 16: Local Notifications for Expiry Alerts

### Request
Implement local notifications using @notifee/react-native for expiry alerts, low stock, shopping reminders, with full preferences (per-type enable/disable, quiet hours, sound), notification tap navigation, and background event handling.

### Changes Made

**NotificationService.ts** — New service (`src/services/notifications/`):
- `scheduleExpiryNotifications(itemId, itemName, expiryDate)` — schedules 3 notifications per item:
  - 3 days before expiry (EXPIRING_SOON)
  - 1 day before expiry (EXPIRING_SOON)
  - On expiry day at 9 AM (EXPIRING_TODAY)
- `cancelItemNotifications(itemId)` — cancels all 4 notification types for an item
- `showLowStockNotification(itemId, itemName)` — immediate LOW_STOCK notification
- `scheduleShoppingReminder(listId, listName, date)` — scheduled SHOPPING_REMINDER
- `cancelShoppingReminder(listId)` — cancel shopping reminder
- `checkExpiredItems(items)` — batch check for already-expired items (on app launch)
- `handleNotificationEvent(event)` — returns navigation data for tap handling
- `rescheduleAll(activeItems)` — reschedule all expiry notifications (after preference changes)
- Quiet hours support: adjusts notification timestamps to avoid 10 PM - 8 AM window
- Per-type enable/disable via NotificationPreferences
- Sound toggle support
- Three Android notification channels: expiry_alerts (HIGH), low_stock_alerts (DEFAULT), shopping_reminders (DEFAULT)
- Unique notification IDs using prefixes (exp3d_, exp1d_, exp0d_, lowstock_, shop_) + item/list ID
- Permission request and check methods
- Preferences persisted to AsyncStorage (`@groceryapp_notification_prefs`)

**Notification types**:
- EXPIRING_TODAY: "⚠️ {item_name} expires today!"
- EXPIRING_SOON: "📅 {item_name} expires in {days} days" / "expires tomorrow"
- EXPIRED: "🚫 {item_name} has expired"
- LOW_STOCK: "🛒 Running low on {item_name}"
- SHOPPING_REMINDER: "📝 Time to shop! ({list_name})"

**notificationHandler.ts** — New (`src/services/notifications/`):
- `registerNotificationHandler()` — registers notifee background event handler, must be called at top level in index.js
- `getInitialNotification()` — checks if app was launched from notification tap, returns navigation data

**useNotifications.ts** — New hook (`src/hooks/`):
- Initializes NotificationService on mount
- Requests notification permissions on mount
- Checks for expired items on app launch and shows EXPIRED notifications
- Foreground event listener: navigates to InventoryDetail or ListDetail on notification tap
- Syncs notification preferences from settings store to service
- Exposes: scheduleExpiryNotifications, cancelItemNotifications, scheduleShoppingReminder, cancelShoppingReminder, showLowStockNotification, updatePreferences

**settingsStore.ts** — Updated (`src/store/`):
- Added `notificationPrefs: NotificationPreferences` state
- Added `setNotificationPrefs(prefs)` action
- NotificationPreferences includes: enabled, expiringToday, expiringSoon, expired, lowStock, shoppingReminder, quietHoursEnabled, quietHoursStart (22), quietHoursEnd (8), soundEnabled
- Persisted to AsyncStorage alongside other settings

**InventoryDetailScreen.tsx** — Updated (`src/screens/inventory/`):
- Added `useNotifications` hook
- Delete action now calls `cancelItemNotifications(item.id)` before deleting
- All three consume actions (Used Up, Expired, Discarded) call `cancelItemNotifications(item.id)` before marking consumed

**HomeScreen.tsx** — Updated (`src/screens/home/`):
- Added `useNotifications()` call to initialize notification system on app launch

**index.js** — Updated (project root):
- Added `registerNotificationHandler()` call before app registration for background notification handling

**package.json** — Updated:
- Added `@notifee/react-native` dependency

### Files Created
- `src/services/notifications/NotificationService.ts`
- `src/services/notifications/notificationHandler.ts`
- `src/hooks/useNotifications.ts`

### Files Modified
- `src/store/settingsStore.ts`
- `src/screens/inventory/InventoryDetailScreen.tsx`
- `src/screens/home/HomeScreen.tsx`
- `index.js`
- `package.json`

---

## [2026-01-30] Session 17: Loading States & Error Handling

### Request
Implement comprehensive loading states and error handling: reusable components (LoadingSpinner, LoadingOverlay, ErrorView, EmptyState, OfflineIndicator), global ErrorBoundary with Crashlytics, toast/snackbar system, error classification utility, and integration into existing screens and services.

### Changes Made

**errors.ts** — New utility (`src/utils/`):
- `AppError` class with `code`, `statusCode`, `retryable`, `originalError` fields
- `AppErrorCode` union type: NETWORK_OFFLINE, NETWORK_TIMEOUT, API_BAD_REQUEST, API_UNAUTHORIZED, API_FORBIDDEN, API_NOT_FOUND, API_RATE_LIMITED, API_SERVER_ERROR, DB_READ_ERROR, DB_WRITE_ERROR, PERMISSION_DENIED, VALIDATION_ERROR, UNKNOWN
- `classifyError(error)` — classifies any thrown value (Axios, Firebase, generic) into an AppError
- `getErrorMessage(code)` — user-friendly message per error code
- Type guards for Axios and Firebase error shapes

**LoadingSpinner.tsx** — New component (`src/components/common/`):
- Full-screen centered spinner with optional message
- Configurable size and color
- Replaces the old `Loading.tsx` in usage

**LoadingOverlay.tsx** — New component (`src/components/common/`):
- Transparent modal overlay with centered spinner card
- For blocking operations (save, delete, sync)
- Semi-transparent backdrop, elevation shadow, customizable message

**ErrorView.tsx** — New component (`src/components/common/`):
- Two modes: full-screen (for page-level errors) and compact (for inline sections)
- Icon, title, message, and optional retry button
- Compact mode: horizontal row with red background tint
- Full-screen mode: centered icon, title, message, and "Try Again" button

**EmptyState.tsx** — New component (`src/components/common/`):
- Icon, title, description, and optional action button
- Two modes: full-screen and compact (for list sections)
- Configurable icon color

**OfflineIndicator.tsx** — New component (`src/components/common/`):
- Animated banner that slides in when device goes offline
- Red "No internet connection" when offline
- Green "Back online" when reconnected (auto-dismisses after 2s)
- Uses syncStore.isOnline for state
- Positioned absolutely at top with z-index 999

**ErrorBoundary.tsx** — New component (`src/components/common/`):
- React class component error boundary
- Catches unhandled JS errors in component tree
- Logs to Firebase Crashlytics via `crashlytics().recordError()`
- Shows friendly error screen with "Restart App" button
- In __DEV__ mode: shows error message in debug panel
- Wraps entire app in App.tsx

**ToastProvider.tsx** — New component (`src/components/common/`):
- React context + provider for app-wide toast messages
- Uses react-native-paper Snackbar under the hood
- `useToast()` hook exposes: showToast, showSuccess, showError, showInfo, showUndo, dismiss
- Color-coded: green (success), red (error), orange (warning), dark grey (info)
- Supports action buttons (e.g. "Retry", "Undo")
- Queue system: if a toast is visible, new ones are queued and shown sequentially
- Configurable duration (default 3s, error 5s)

**App.tsx** — Rewritten:
- Replaced default React Native template with proper app shell
- Provider hierarchy: ErrorBoundary > SafeAreaProvider > PaperProvider > QueryClientProvider > ToastProvider
- Added OfflineIndicator at top of root view
- Added QueryClient with retry (2 for queries, 1 for mutations) and 5-min stale time
- Renders RootNavigator

**api.ts** — Updated (`src/config/`):
- Replaced stub error interceptor with `classifyError()` integration
- All API errors are now classified into AppError before rejection
- Request errors also classified

**InventoryScreen.tsx** — Updated (`src/screens/inventory/`):
- Replaced `Loading` with `LoadingSpinner`
- Added `loadError` state; shows `ErrorView` with retry on data load failure
- Replaced inline empty state with `EmptyState` component (filter-aware)
- Empty inventory state now has "Add Item" action button
- Delete action shows toast on success/failure via `useToast()`
- Removed unused `Icon` import and inline empty state styles

**InventoryDetailScreen.tsx** — Updated (`src/screens/inventory/`):
- Added `LoadingSpinner` for initial load state
- Added `ErrorView` for item-not-found / load failure
- Added loading and loadFailed state management
- Delete and all consume actions wrapped in try/catch with toast feedback
- Success toasts: "Item deleted", "marked as used up", "marked as expired", "discarded"
- Error toasts on failure

**RootNavigator.tsx** — Updated (`src/navigation/`):
- Replaced `Loading` with `LoadingSpinner` for auth loading state

### Files Created
- `src/utils/errors.ts`
- `src/components/common/LoadingSpinner.tsx`
- `src/components/common/LoadingOverlay.tsx`
- `src/components/common/ErrorView.tsx`
- `src/components/common/EmptyState.tsx`
- `src/components/common/OfflineIndicator.tsx`
- `src/components/common/ErrorBoundary.tsx`
- `src/components/common/ToastProvider.tsx`

### Files Modified
- `App.tsx`
- `src/config/api.ts`
- `src/screens/inventory/InventoryScreen.tsx`
- `src/screens/inventory/InventoryDetailScreen.tsx`
- `src/navigation/RootNavigator.tsx`

---

## Session 18 — FastAPI Backend (Full Implementation)
**Date**: 2026-01-30

### Summary
Rewrote the FastAPI backend from stubs to fully functional endpoints. Added a layered architecture with Pydantic schemas, service layer (barcode, analytics, insights), and Render deployment configuration. Barcode scan now uses a Firebase-first lookup workflow (Firestore cache → contributed products → Open Food Facts → not_found). Analytics endpoints store batched events to Firestore and aggregate stats. AI insights use Ollama/OpenAI when available, with rule-based heuristic fallback covering waste reduction, shopping frequency, expiry warnings, nutrition balance, and budget alerts.

### Architecture

```
backend/
├── main.py                           # App entry, Firebase init, CORS, routers
├── app/
│   ├── core/
│   │   └── config.py                 # Pydantic settings (env vars)
│   ├── schemas/
│   │   ├── barcode.py                # Barcode request/response models
│   │   └── analytics.py             # Analytics + insights models
│   ├── services/
│   │   ├── barcode_service.py        # Firebase + OFF lookup, contribute
│   │   ├── analytics_service.py      # Batch sync, stats aggregation
│   │   └── insights_service.py       # AI + rule-based insights engine
│   └── api/routes/
│       ├── barcode.py                # /api/barcode/* endpoints
│       └── analytics.py             # /api/analytics/* endpoints
├── requirements.txt
├── render.yaml                       # Render deployment config
├── Procfile                          # Gunicorn start command
├── .gitignore
└── .env.example
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/barcode/scan` | Lookup barcode: Firebase → contributed → OFF → not_found |
| GET | `/api/barcode/product/{barcode}` | Direct product lookup |
| POST | `/api/barcode/contribute` | User-contributed product (Firestore + OFF) |
| POST | `/api/analytics/batch` | Batch event sync (max 500 events) |
| POST | `/api/analytics/sync` | Legacy sync endpoint (backward compat) |
| GET | `/api/analytics/stats/{user_id}` | Aggregated stats (day/week/month/year/all) |
| GET | `/api/analytics/insights/{user_id}` | AI insights with rule-based fallback |
| GET | `/health` | Health check |

### Barcode Lookup Workflow
1. Check Firestore `products` collection (cached OFF results)
2. Check Firestore `contributed_products` collection
3. Query Open Food Facts API (8s timeout, User-Agent header)
4. If found in OFF, cache to Firestore `products` for future lookups
5. Return `{found, source, product}` — source is "firebase", "contributed", "openfoodfacts", or "not_found"

### Analytics Service
- **Batch sync**: Groups events by user_id, writes to `users/{uid}/analytics/` in Firestore batches (500 per commit)
- **Stats**: Aggregates event counts (scans, items added/consumed/expired/discarded), waste %, total spent
- **Period filtering**: Converts day/week/month/year to epoch-millis cutoff

### AI Insights Engine
**AI mode** (when `AI_SERVICE_URL` set): Sends data summary to Ollama/OpenAI, parses JSON response
**Rule-based fallback** (5 heuristics):
1. **Waste reduction** — High waste % alert with category breakdown
2. **Shopping frequency** — Detects daily shopping pattern
3. **Expiry warnings** — Items expiring within 3 days
4. **Nutrition balance** — Food group coverage analysis
5. **Budget alerts** — Week-over-week spending increase

Each insight: `{title, description, priority: high|medium|low, category}`

### Deployment (Render)
- `render.yaml` — Web service config, Gunicorn + UvicornWorker, 2 workers
- `Procfile` — `gunicorn main:app --workers 2 --worker-class uvicorn.workers.UvicornWorker`
- Production URL: `https://groceryapp-api.onrender.com`
- Firebase via `GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_CREDENTIALS_PATH`

### Config Settings
- `FIREBASE_CREDENTIALS_PATH` — Path to service account JSON
- `FIREBASE_DATABASE_URL` — Firestore database URL
- `OPEN_FOOD_FACTS_API` — OFF API base URL
- `AI_SERVICE_URL` — Optional Ollama/OpenAI endpoint
- `AI_MODEL_NAME` — Model name (default: llama3.2)
- `ALLOWED_ORIGINS` — CORS origins list
- `ENVIRONMENT` — development/production

### Dependencies Added
- `gunicorn==23.0.0` — Production WSGI server for Render

### Files Created
- `backend/app/schemas/__init__.py`
- `backend/app/schemas/barcode.py`
- `backend/app/schemas/analytics.py`
- `backend/app/services/__init__.py`
- `backend/app/services/barcode_service.py`
- `backend/app/services/analytics_service.py`
- `backend/app/services/insights_service.py`
- `backend/render.yaml`
- `backend/Procfile`
- `backend/.gitignore`

### Files Rewritten
- `backend/app/api/routes/barcode.py` — Full implementation with service layer
- `backend/app/api/routes/analytics.py` — Batch sync, stats, insights endpoints

### Files Modified
- `backend/main.py` — Logging, version bump to 2.0.0, structured docs
- `backend/app/core/config.py` — Added AI_SERVICE_URL, AI_MODEL_NAME settings
- `backend/requirements.txt` — Added gunicorn
- `backend/.env.example` — Added AI service vars

---

## Session 19 — Deployment Configuration & Documentation
**Date**: 2026-01-31

### Summary
Added complete deployment configuration for Render and local development. Created Dockerfile, setup scripts for Windows and macOS/Linux, GitHub Actions CI/CD workflow, and rewrote README with full API documentation, deployment guides, and troubleshooting. Updated dependency versions to latest stable releases with Python 3.14 wheel support.

### Deployment Stack
- **Docker**: Python 3.11-slim base, non-root user, gunicorn + uvicorn workers
- **Render**: Blueprint via `render.yaml` with Docker runtime, auto-deploy, health check
- **CI/CD**: GitHub Actions — lint with Ruff, verify imports, auto-deploy to Render on push to main

### Dependency Updates
All pinned to latest stable with Python 3.14 prebuilt wheels:
- `fastapi==0.128.0` (was 0.115.5)
- `uvicorn[standard]==0.40.0` (was 0.32.1)
- `pydantic==2.12.5` (was 2.10.3 — no 3.14 wheels)
- `pydantic-settings==2.12.0` (was 2.6.1)
- `firebase-admin==7.1.0` (was 6.6.0)
- `gunicorn==24.1.1` (was 23.0.0)

### Files Created
- `backend/Dockerfile`
- `backend/.dockerignore`
- `backend/scripts/setup.bat` — Windows local dev setup
- `backend/scripts/setup.sh` — macOS/Linux local dev setup
- `.github/workflows/backend-deploy.yml` — CI/CD pipeline

### Files Rewritten
- `backend/README.md` — Full docs: API reference, deployment, Docker, troubleshooting
- `backend/render.yaml` — Docker runtime, AI service vars, auto-deploy

### Files Modified
- `backend/requirements.txt` — Updated all versions to latest stable

---

## Session 20 — Comprehensive Testing Setup
**Date**: 2026-01-31

### Summary
Set up comprehensive testing infrastructure for the React Native mobile app. Enhanced jest.setup.js with mocks for Firebase (auth, firestore, analytics, crashlytics, storage), camera, notifications, background fetch, NetInfo, and navigation. Created test utilities with custom render, mock data builders, and async helpers. Wrote unit tests for all 4 utility modules, service tests for barcode and sync, repository tests for inventory, component tests for InventoryItemCard and screens, and integration tests for the complete barcode scanning workflow.

### Test Structure

```
mobile-app/
├── jest.setup.js                              # Enhanced: 15 module mocks
├── src/
│   ├── __tests__/
│   │   ├── testUtils.tsx                      # Custom render, builders, helpers
│   │   └── integration/
│   │       └── barcodeWorkflow.test.ts        # 5 end-to-end scenarios
│   ├── utils/__tests__/
│   │   ├── dateUtils.test.ts                  # 12 tests
│   │   ├── validators.test.ts                 # 22 tests
│   │   ├── helpers.test.ts                    # 20 tests
│   │   └── errors.test.ts                     # 18 tests
│   ├── services/
│   │   ├── barcode/__tests__/
│   │   │   ├── BarcodeService.test.ts         # Lookup, cache, permissions
│   │   │   └── BarcodeApiService.test.ts      # API calls, offline queue
│   │   └── sync/__tests__/
│   │       └── SyncService.test.ts            # Connectivity, listeners, tier gating
│   ├── database/repositories/__tests__/
│   │   └── InventoryRepository.test.ts        # CRUD, stats, queries
│   ├── components/grocery/__tests__/
│   │   └── InventoryItemCard.test.tsx         # List/grid mode, expiry, location
│   └── screens/
│       ├── inventory/__tests__/
│       │   └── InventoryScreen.test.tsx        # Data loading, rendering
│       └── scanner/__tests__/
│           └── BarcodeScannerScreen.test.tsx   # Camera, permissions, scan handling
```

### Test Coverage by Layer

| Layer | Files | Key Tests |
|-------|-------|-----------|
| **Utils** | 4 test files | Date formatting, Zod schema validation, error classification, grouping/sorting |
| **Services** | 3 test files | 7-step barcode lookup, cache TTL, offline queue, sync orchestration |
| **Repository** | 1 test file | CRUD operations, consumption stats, query filters |
| **Components** | 1 test file | List/grid rendering, expiry display, press handlers |
| **Screens** | 2 test files | Data loading, camera permissions, navigation |
| **Integration** | 1 test file | Scan→found, scan→contribute, scan→offline, backend fallback |

### Mock Implementations
- **Firebase**: Auth (sign in/out, state listener), Firestore (collection/doc CRUD, batch), Analytics, Crashlytics, Storage
- **Camera**: Vision Camera permission checks, device hooks
- **Notifications**: Notifee channel creation, trigger notifications, permission
- **Network**: NetInfo connectivity checks (online/offline toggle)
- **Navigation**: useNavigation, useRoute, useFocusEffect
- **Database**: WatermelonDB collection/query mocks

### Integration Test Scenarios
1. Scan → product found in backend → cached for reuse
2. Scan → not found → user contributes product
3. Scan → offline → graceful fallback to not_found
4. Scan → backend error → Open Food Facts fallback
5. Scan → passes user context to backend

### Jest Configuration Updates
- Added `moduleNameMapper` for path aliases (@utils, @services, etc.)
- Added `@notifee` and `react-native-background-fetch` to transformIgnorePatterns
- Added `collectCoverageFrom` for coverage reporting

### Files Created
- `src/__tests__/testUtils.tsx`
- `src/__tests__/integration/barcodeWorkflow.test.ts`
- `src/utils/__tests__/dateUtils.test.ts`
- `src/utils/__tests__/validators.test.ts`
- `src/utils/__tests__/helpers.test.ts`
- `src/utils/__tests__/errors.test.ts`
- `src/services/barcode/__tests__/BarcodeService.test.ts`
- `src/services/barcode/__tests__/BarcodeApiService.test.ts`
- `src/services/sync/__tests__/SyncService.test.ts`
- `src/database/repositories/__tests__/InventoryRepository.test.ts`
- `src/components/grocery/__tests__/InventoryItemCard.test.tsx`
- `src/screens/inventory/__tests__/InventoryScreen.test.tsx`
- `src/screens/scanner/__tests__/BarcodeScannerScreen.test.tsx`

### Files Modified
- `jest.setup.js` — Expanded from 6 to 15 module mocks
- `package.json` — Jest config: moduleNameMapper, transformIgnorePatterns, collectCoverageFrom

---

## Session 21 — Build Scripts & Project Documentation
**Date**: 2026-01-31

### Summary
Created PowerShell build/run/test/deploy scripts for Windows development workflow. Updated package.json with comprehensive npm scripts including build:android, build:ios, lint:fix, validate, and test variants. Generated complete project documentation covering all aspects of the application: mobile app architecture, backend API, database schema, workflows, development guide, and API reference.

### PowerShell Scripts Created (`scripts/`)

| Script | Purpose |
|--------|---------|
| `build-android.ps1` | Clean Gradle build → assembleRelease → copies APK to `builds/` with timestamp |
| `run-android-debug.ps1` | Checks adb devices, starts Metro in background, runs react-native run-android, streams logcat |
| `run-backend-local.ps1` | Creates/activates venv, installs deps, copies .env.example if needed, starts FastAPI with reload |
| `deploy-backend.ps1` | Checks git status, commits backend changes, pushes to main, polls health endpoint (20 attempts x 15s) |
| `test-all.ps1` | Runs Jest tests + coverage, Python syntax check, TypeScript type check, ESLint, prints summary |

### Package.json Scripts Updated

Added: `start:reset`, `test:unit`, `test:integration`, `lint:fix`, `format:check`, `validate`, `build:android`, `build:android:debug`, `build:ios`, `clean:ios`, `clean:cache`. Updated `test` and `test:coverage` to use `--ci --forceExit --passWithNoTests`. Updated `lint` to target `src/` with explicit extensions.

### Documentation Created (`docs/`)

| File | Content |
|------|---------|
| `README.md` (root) | Rewritten — tech stack table, architecture overview, quick start, npm scripts reference, documentation index |
| `docs/MOBILE_APP.md` | React Native setup, source structure, navigation, state management, component architecture, dependencies, testing, building |
| `docs/BACKEND.md` | FastAPI architecture, local dev setup, configuration, barcode lookup workflow, analytics service, AI insights engine, deployment (Render/Docker), troubleshooting |
| `docs/DATABASE.md` | WatermelonDB 7-table schema with all columns, models, repositories, Firestore document structure, sync strategy, 3-stage lifecycle diagram, security rules |
| `docs/WORKFLOWS.md` | Barcode scanning 7-step pipeline, auth flow, sync workflow (background + retry), notification scheduling, item lifecycle, error handling, free vs paid gating |
| `docs/DEVELOPMENT.md` | Prerequisites, project setup, dev workflow, code style (TS + Python), git workflow, testing guide, debugging tips, build scripts reference, environment variables |
| `docs/API.md` | Complete API reference — all endpoints with request/response examples, error formats, event types table, CORS config |

### Files Created
- `scripts/build-android.ps1`
- `scripts/run-android-debug.ps1`
- `scripts/run-backend-local.ps1`
- `scripts/deploy-backend.ps1`
- `scripts/test-all.ps1`
- `docs/MOBILE_APP.md`
- `docs/BACKEND.md`
- `docs/DATABASE.md`
- `docs/WORKFLOWS.md`
- `docs/DEVELOPMENT.md`
- `docs/API.md`

### Files Modified
- `README.md` (root) — Rewritten with comprehensive documentation
- `mobile-app/package.json` — Added/updated 12 npm scripts