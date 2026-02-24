# Workflows Documentation

## Barcode Scanning Workflow

### 7-Step Lookup Pipeline

```
User scans barcode
    │
    ▼
1. Check local in-memory cache (10-min TTL)
    │ miss
    ▼
2. Query backend API → Firebase `products` collection
    │ miss
    ▼
3. Query backend API → Firebase `contributed_products` collection
    │ miss
    ▼
4. Query Open Food Facts API directly (8s timeout)
    │ miss
    ▼
5. Mark as not-found
    │
    ▼
6. Cache result locally (in-memory, 10-min TTL)
    │
    ▼
7. Log analytics event + save to WatermelonDB scanned_items (Stage 1)
```

Each result includes a `source` tag: `local_cache`, `backend`, `openfoodfacts`, or `not_found`.

### Scan → Inventory Flow

1. User scans barcode → result shown on scanner screen
2. If found: user can "Add to Inventory" → navigates to add form with pre-filled data
3. If not found: user can "Contribute Product Info" → opens ContributeProductModal
4. Contributing: name, brand, category (chips), optional photo → submits to backend
5. Backend saves to Firestore `contributed_products` + best-effort Open Food Facts submission
6. After contribution: navigates to add form with contributed data pre-filled
7. Adding to inventory: Stage 1 scan promoted to Stage 2 inventory item

### Offline Handling

- `BarcodeApiService` has retry logic (2 retries with linear backoff for 5xx/network errors)
- Failed requests are queued in-memory (24h expiry)
- `flushQueue()` drains queued requests when connectivity restores
- If API unreachable, falls back to direct Open Food Facts query
- Scans always saved locally regardless of API availability

## Authentication Workflow

### Sign-In Flow

```
App Launch
    │
    ▼
RootNavigator checks Firebase onAuthStateChanged
    │
    ├─ Not authenticated → AuthNavigator
    │   ├─ LoginScreen
    │   │   ├─ Email + Password → signInWithEmailAndPassword
    │   │   └─ Google Sign-In → signInWithPopup → Firebase credential
    │   └─ RegisterScreen
    │       └─ createUserWithEmailAndPassword
    │
    └─ Authenticated → MainNavigator
        └─ useAuth hook:
            1. Creates Firestore profile doc (first sign-in)
            2. Sets Firebase Analytics user properties (tier, method)
            3. Configures background sync
```

### Auth State Management

- Firebase `onAuthStateChanged` listener → updates `authStore`
- Bearer token obtained via `auth.currentUser.getIdToken()`
- Token attached to all API requests via Axios interceptor
- Sign-out revokes Google access if applicable + clears stores

## Sync Workflow

### Background Sync (6-hour interval)

```
react-native-background-fetch triggers
    │
    ▼
SyncService.sync(userId, isPaid)
    │
    ├─ canSync() preflight: check network connectivity
    │   └─ No network → abort, report offline
    │
    ├─ syncAnalyticsEvents(userId)           [all users]
    │   └─ Batch unsynced events (100/batch) → Firestore
    │
    ├─ syncInventoryItems(userId)            [paid only]
    │   └─ Push unsynced items → Firestore
    │
    ├─ syncShoppingLists(userId)             [paid only]
    │   └─ Push all lists with nested items → Firestore
    │
    ├─ reconcileInventory()                  [paid only]
    │   └─ Bidirectional sync with last-write-wins
    │
    └─ purgeOldAnalytics()
        └─ Delete synced events older than 30 days
```

### Retry Logic

- `withRetry()`: 3 attempts with exponential backoff (2s → 4s → 8s)
- Connectivity checked between retries
- Each sync category (analytics, inventory, lists) catches errors independently
- Partial success is possible (e.g., analytics synced but inventory failed)

### Sync Status UI

- `SyncStatusBar` component on HomeScreen shows real-time status
- States: idle (last sync time), syncing (spinner), success (green), error (red + retry), offline (grey)
- Manual sync via tap on status bar or sync button

### Conflict Resolution

- Bidirectional sync uses `FirestoreService.reconcileInventoryItems()`
- Strategy: last-write-wins based on `updatedAt` timestamps
- Local changes with newer timestamps overwrite cloud
- Cloud changes with newer timestamps overwrite local

## Notification Workflow

### Expiry Notifications

When an item with an expiry date is added to inventory:

```
Item added to inventory
    │
    ▼
NotificationService.scheduleExpiryNotifications(itemId, name, expiryDate)
    │
    ├─ Schedule: 3 days before expiry → "expires in 3 days"
    ├─ Schedule: 1 day before expiry → "expires tomorrow"
    └─ Schedule: On expiry day (9 AM) → "expires today!"
```

### Notification Types

| Type | Channel | Priority | Trigger |
|------|---------|----------|---------|
| EXPIRING_TODAY | expiry_alerts | HIGH | Day of expiry, 9 AM |
| EXPIRING_SOON | expiry_alerts | HIGH | 1 or 3 days before |
| EXPIRED | expiry_alerts | HIGH | On app launch check |
| LOW_STOCK | low_stock_alerts | DEFAULT | When quantity <= 1 |
| SHOPPING_REMINDER | shopping_reminders | DEFAULT | Scheduled by user |

### Quiet Hours

- Default: 10 PM to 8 AM
- Notifications scheduled during quiet hours are shifted to 8 AM
- Configurable per-user in settings

### Notification Tap Navigation

- Tap on expiry/low stock notification → navigates to InventoryDetailScreen
- Tap on shopping reminder → navigates to ListDetailScreen
- Background event handler registered in `index.js` via `registerNotificationHandler()`

## Item Lifecycle Workflow

### Adding Items

**Via barcode scan:**
1. Scan barcode → Stage 1 (scanned_items)
2. User confirms details → promote to Stage 2 (inventory_items, status=active)
3. Original scan record remains until TTL expires

**Via manual add:**
1. User fills form → directly to Stage 2 (bypasses Stage 1)

### Consuming Items

```
Active Item (Stage 2)
    │
    ├─ "Used Up" → status=consumed, reason=used_up
    ├─ "Expired" → status=expired, reason=expired
    └─ "Discarded" → status=discarded, reason=discarded

    All paths:
    ├─ Set consumed_date to now
    ├─ Record quantity_remaining
    ├─ Cancel any scheduled notifications
    └─ Log analytics event (item_consumed / item_expired_wasted)
```

### Shopping List → Inventory

When a shopping list item is marked as purchased:
1. "Add to Inventory" button appears on the list item
2. Tapping creates a new inventory item in Stage 2 (location: pantry)
3. Pre-filled with list item data (name, quantity, unit, category)

## Error Handling Workflow

### Error Classification

All errors flow through `classifyError()` in `src/utils/errors.ts`:

```
Error thrown
    │
    ▼
classifyError(error) → AppError
    │
    ├─ Axios error → API_BAD_REQUEST / API_UNAUTHORIZED / API_NOT_FOUND / API_SERVER_ERROR
    ├─ Firebase error → maps auth/firestore codes
    ├─ Network error → NETWORK_OFFLINE / NETWORK_TIMEOUT
    └─ Unknown → UNKNOWN
```

### UI Error Handling

- **Screen-level**: `ErrorView` component with retry button
- **Operation-level**: Toast messages via `useToast()` (success/error/info)
- **Global**: `ErrorBoundary` catches unhandled JS errors → Crashlytics
- **Network**: `OfflineIndicator` banner slides in/out based on connectivity
- **API**: Axios interceptor classifies all HTTP errors before rejection

## Free vs Paid Feature Gating

| Feature | Free | Paid |
|---------|------|------|
| Local inventory | Yes | Yes |
| Barcode scanning | Yes | Yes |
| Shopping lists | Yes | Yes |
| Notifications | Yes | Yes |
| Cloud sync | No | Yes |
| Inventory sync | No | Yes |
| Shopping list sharing | No | Yes |
| AI insights | No | Yes |
| Advanced analytics | No | Yes |
| Recipes | No | Yes |

Feature checks use `isFeatureAvailable(feature, tier)` from `src/utils/helpers.ts`. UI shows lock icons and "Upgrade to Premium" prompts for gated features.
