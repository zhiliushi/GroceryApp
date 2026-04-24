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

### Sync (15-min foreground / 30-min background)

```
react-native-background-fetch triggers (every 30 min) or foreground timer (every 15 min)
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

---

# Refactor Phase 2–5 Workflows (catalog + purchases + waste model)

These flows reflect the shipped 2026-04 refactor. Web admin is the primary surface; mobile continues to work via the compat shim (see `FUTURE_MOBILE_REFACTOR.md`).

## Quick-Add (name-first, default path)

Primary write-path replacing the old "Add Item" form.

```
User clicks "+ Add item" (dashboard or MyItems)
  → QuickAddModal opens
  → User types name
    → CatalogAutocomplete fetches GET /api/catalog?q=<prefix>
    → If match exists → tap suggestion → defaults prefilled (barcode, default_location)
    → If new name → proceed with fresh entry
  → Optional expiry: ExpiryInput renders live NL preview ("tomorrow" → actual date)
  → Progressive disclosure: ▼ More reveals barcode / price / payment
    → Price + payment_method gated by `financial_tracking` flag
  → Save → POST /api/purchases
    → Backend: transactional catalog_service.upsert_catalog_entry + purchase_event_service
                   + catalog counter increment
    → BackgroundTasks.add_task(insights_service.check_user_milestones, uid)
  → Toast "Added" → modal closes → queries invalidated (purchases, catalog, waste, reminders)
```

See: `components/quickadd/{QuickAddModal,CatalogAutocomplete,ExpiryInput}.tsx`.

## Barcode-first scan flow

Primary path for items with a barcode (user scans → app resolves → one action).

```
User taps FloatingScanButton (bottom-right, persistent via AppLayout)
  → ContextualScannerModal opens
    → useScannerEngine starts camera (native BarcodeDetector → html5-qrcode → manual fallback)
    → Also accepts manual numeric entry
  → Detected barcode → GET /api/barcode/{bc}/scan-info?user_id=<uid>
    → ScanResultPanel renders one of three branches:

  [A] user_catalog_match exists
      → Shows display_name, history (count_purchased, last_bought, avg_price, waste_rate, active_stock)
      → Primary action: Add new purchase (or Mark Used (FIFO) if context=my-items + stock > 0)
      → Tap → opens QuickAddModal prefilled with matched entry

  [B] no match but global_product known
      → "Not in your catalog yet. Global database says this is X."
      → Primary: "Add to catalog → purchase"
      → Tap → NameUnknownItemModal (suggestedName prefilled) → QuickAddModal

  [C] fully unknown barcode
      → Primary: "Name this item" → NameUnknownItemModal → user types name
                                  → QuickAddModal prefilled with name + barcode

  Context derivation (ContextualScannerModal useLocation):
    /my-items  → mark_used is primary when stock > 0
    /shopping-lists → add_to_list (TODO — routes to add_purchase)
    /catalog → add_purchase
    default → add_purchase
```

## FIFO consume

Scan or select a catalog entry → oldest-expiry active event gets marked `used`.

```
Scanner (context=my-items) → ScanResultPanel with active_stock > 0
  → "Mark one as used (FIFO, N in stock)"
  → POST /api/purchases/consume {catalog_name_norm, quantity:1}
    → purchase_event_service.consume_one_by_catalog
      → Queries active events, sorts by expiry_date asc (nulls last), date_bought asc
      → For quantity N, transitions top-N events status=active → used
      → Each transition decrements catalog.active_purchases counter (in-transaction)
  → Toast "Marked 1 '<display>' as used"
```

## Status transitions (used / thrown / transferred)

State-driven — buttons appear from `getPurchaseEventActions(event)` based on state key (draft / active_no_expiry / active_fresh / active_expiring_soon / active_expiring_urgent / active_expired / terminal).

```
active → used
  User taps "Used" → POST /api/purchases/{id}/status {status:'used', reason:'used_up'}

active → thrown
  User taps "Throw" → ThrowAwayModal (reason radios: expired / bad / used_up / gift)
  → POST /api/purchases/{id}/status {status:'thrown', reason}

active → transferred
  User taps "Give away" → GiveAwayModal (foodbank picker OR free-text recipient)
  → POST /api/purchases/{id}/status {status:'transferred', reason:'gift', transferred_to}

Terminal states cannot transition further (ValidationError 400).
Each transition decrements catalog.active_purchases (transactional).
```

## 7/14/21-day reminders (nudge_service)

Daily scheduler scans active purchases with no expiry. Creates reminder docs as items age.

```
Scheduler (daily 08:00 UTC) → nudge_service.scan_reminders
  → collection_group('purchases').where(status==active, reminder_stage<3)
  → For each event with expiry_date=null and age≥7d:
      stage 1 (7d),  2 (14d),  3 (21d)
      → Create reminder doc at users/{uid}/reminders/{id}
      → Update event.reminder_stage = stage
      → At stage 3, also set catalog_entry.needs_review = true

User on dashboard → NudgeBanner reads useReminders(false)
  → Displays top reminder with inline [Used] [Thrown] [Still have]
  → POST /api/reminders/{id}/dismiss {action} triggers linked event's status transition.
```

## Progressive threshold nudges (5 / 10 / 20 items)

Distinct from 7/14/21 reminders — these are onboarding-style UX nudges driven by total purchase count.

```
useNudges hook (components/nudge/ProgressiveNudge.tsx) computes highest-priority:
  total_bought == 0             → 'welcome' banner
  total_bought >= 5 + no expiry → 'nudge_expiry'
  total_bought >= 10 + no price + financial_tracking on → 'nudge_price'
  total_bought >= 20 + no quantity/unit → 'nudge_volume'

Gated behind `progressive_nudges` flag.
Dismissed via uiStore.dismissedNudges[] (zustand persist middleware, localStorage).
Thresholds configurable via app_config/features.nudge_thresholds.
```

## Milestone insights (50 / 100 / 500 / 1000)

Rich narrative insights emitted when a user crosses a total-purchase threshold.

```
Trigger:
  POST /api/purchases → BackgroundTasks.add_task(check_user_milestones, uid)
                      → after response returned, runs in-process.

  Backstop: scheduler.check_milestones (hourly) iterates all users with catalog entries.
            Idempotent via doc ID f"milestone_{N}" .get().exists check.

check_user_milestones(uid):
  Pass 1 (cheap): sum catalog_entries.total_purchases where user_id == uid
    → If no milestone crossed, stop.
  Pass 2 (heavy, only when emitting):
    _aggregate_user_stats(uid) — one catalog query + one purchase events stream
      → top_purchased (by total_purchases, top 10)
      → waste_breakdown (status=thrown, grouped by catalog_name_norm)
      → spending (cash/card/total across all purchases)
      → shopping_frequency (avg_days_between gaps + peak weekday)
      → avoid_list (entries with waste_rate ≥ 30% and ≥ 3 thrown)
    → _build_milestone_doc + _narrative (rule-based summary)
    → write to users/{uid}/insights/milestone_{N}

User dashboard → InsightsCard shows top active insight inline.
Click "View all →" → /insights → InsightsPage renders rich content per doc
  → Each catalog mention cross-links to /catalog/{name_norm}.
```

## Health score (dashboard hero)

```
Frontend: useHealthScore → GET /api/waste/health-score (cached 5min server-side)
Formula (waste_service.compute_health_score):
  active_component = Σ(count × weight) / active_total
    where weight: healthy 1.0 · expiring_7d 0.8 · expiring_3d 0.5 · expired 0.0 · untracked 0.6
  waste_component = 1 - (thrown_this_month / (used_this_month + thrown_this_month))
  score = round(100 × (0.7 × active_component + 0.3 × waste_component))
Grades: green ≥80 · yellow ≥50 · red <50
Cached at users/{uid}/cache/health (5min TTL). Recomputed on purchase mutation via query invalidation.
```

See `docs/HEALTH_SCORE.md` for worked examples.

## OCR flag-gated flows

Receipt scan, smart camera, recipe OCR, shelf audit — all OFF by default post-refactor.

```
Admin toggles via /admin-settings → FeatureFlagsTab → PATCH /api/admin/features
Backend cache invalidates within 60s.

When ocr_enabled = false:
  - /api/receipt/* + /api/scan/* routes return 404 (Depends(require_flag) at include-level)
  - Dashboard ScanReceiptButton hidden (useFeatureFlags)
  - RecipeFormPage scan-recipe button hidden (recipe_ocr flag)
  - AdminSettingsPage OCR tab + "Test Scanner" button hidden
  - /admin-settings/test-scan redirects to /admin-settings (FeatureFlagGate)
```

## Legacy mobile via compat shim

```
Mobile app (unchanged) → GET /api/inventory/my
  if feature_flags.legacy_endpoints_use_new_model == true:
    → purchase_event_service.list_purchases(user, status='active')
    → each event passed through compat.legacy_item_shim.new_event_to_legacy_item
      (field rename: catalog_display → name, expiry_date → expiryDate ms, status mapping)
  else:
    → legacy inventory_service.get_household_items (pre-refactor path)

Mobile → POST /api/barcode/{bc}/add-to-inventory
  if flag on → purchase_event_service.create_purchase (transactional)
  else → direct grocery_items doc write

Flip the flag AFTER running scripts/migrate_grocery_items_to_purchases.py --execute.
```

See `docs/MIGRATION_GUIDE.md`.
