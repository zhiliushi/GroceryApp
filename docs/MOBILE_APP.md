# Mobile App Documentation

## Overview

The GroceryApp mobile client is a React Native 0.83.1 application written in TypeScript. It runs on Android and iOS with an offline-first architecture using WatermelonDB (SQLite) for local storage and Firebase for cloud sync and authentication.

## Project Setup

### Requirements

- Node.js 20+
- React Native CLI (not Expo)
- Android Studio with SDK 34+ (Android)
- Xcode 15+ (iOS)
- JDK 17+

### Installation

```bash
cd mobile-app
npm install

# iOS only
cd ios && pod install && cd ..
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
API_BASE_URL=http://localhost:8000
FIREBASE_WEB_CLIENT_ID=your-google-web-client-id
```

### Running

```bash
# Development
npx react-native start              # Metro bundler
npx react-native run-android        # Android
npx react-native run-ios            # iOS

# Or use scripts
..\scripts\run-android-debug.ps1    # Full Android debug workflow
```

## Source Structure

```
src/
├── config/               # App configuration
│   ├── firebase.ts       # Firebase SDK init, path helpers, offline persistence
│   ├── api.ts            # Axios client with Bearer token + error classification
│   └── constants.ts      # App constants, feature flags, DB version
├── database/             # WatermelonDB local database
│   ├── schema.ts         # 11-table schema definition (v8)
│   ├── seed.ts           # Default categories (9) and units (14)
│   ├── migrations/       # Schema migration scripts
│   ├── models/           # 11 WatermelonDB model classes
│   └── repositories/     # 10 repository classes with typed CRUD
├── services/             # Business logic layer
│   ├── barcode/          # BarcodeService (7-step lookup), BarcodeApiService
│   ├── firebase/         # AuthService, FirestoreService, AnalyticsService, ImageUploadService
│   ├── notifications/    # NotificationService, notificationHandler
│   ├── openFoodFacts/    # Direct OFF API client (fallback)
│   └── sync/             # SyncService (background + foreground)
├── hooks/                # React hooks bridging services → UI
│   ├── useAuth.ts        # Firebase auth state, sign in/out
│   ├── useDatabase.ts    # DB initialization, model + repository registration
│   ├── useBarcode.ts     # Barcode scanning with Stage 1 integration
│   ├── useSync.ts        # Sync orchestration + network monitoring
│   ├── useNotifications.ts # Notification scheduling + permission handling
│   ├── useGeolocation.ts # GPS for store location
│   └── useAppTheme.ts    # Theme (light/dark/system)
├── screens/              # Screen components
│   ├── auth/             # LoginScreen, RegisterScreen, OnboardingScreen
│   ├── home/             # HomeScreen (dashboard)
│   ├── inventory/        # InventoryScreen, InventoryDetailScreen, AddInventoryItemScreen,
│   │                     # RestockScreen, PastItemsScreen
│   ├── scanner/          # BarcodeScannerScreen
│   ├── lists/            # ShoppingListsScreen, ListDetailScreen, AddListItemScreen,
│   │                     # EditListItemScreen, ShoppingCheckoutScreen, ListPickerScreen
│   ├── common/           # AddMethodScreen, ContextScannerScreen
│   └── settings/         # SettingsScreen
├── components/           # Reusable UI components
│   ├── common/           # Button, Card, Input, Loading*, Error*, EmptyState,
│   │                     # Toast, SyncStatusBar, OfflineIndicator, ErrorBoundary
│   ├── grocery/          # InventoryItemCard, CategoryFilter
│   ├── scanner/          # BarcodeOverlay, ContributeProductModal, RecordPriceCard,
│   │                     # PriceHistoryPreview
│   ├── cart/             # CartItemCard
│   └── prices/           # PriceComparisonChart
├── navigation/           # React Navigation setup
│   ├── RootNavigator.tsx # Auth gate: authenticated → Main, else → Auth
│   ├── AuthNavigator.tsx # Login + Register stack
│   └── MainNavigator.tsx # Bottom tabs: Home, Inventory, Scan, Lists, Settings
├── store/                # Zustand state stores (persisted to AsyncStorage)
│   ├── authStore.ts      # User, token, tier
│   ├── inventoryStore.ts # Filter, sort, view mode preferences
│   ├── scanStore.ts      # Stage 1 scan state
│   ├── settingsStore.ts  # App preferences, notification settings
│   └── syncStore.ts      # Sync status, online state, last result
├── types/                # TypeScript interfaces
│   ├── index.ts          # Shared types (InventoryItemView, status enums)
│   ├── database.ts       # Model interfaces, input types, event payloads
│   └── api.ts            # API request/response types
└── utils/                # Utility functions
    ├── dateUtils.ts      # Date formatting, timeAgo, expiryStatus
    ├── validators.ts     # Zod schemas, barcode/location validation
    ├── helpers.ts        # Model converters, groupBy, sortByExpiry
    └── errors.ts         # AppError, classifyError, getErrorMessage
```

## Navigation Structure

```
RootNavigator
├── Onboarding (shown before first login, checks @user_name in AsyncStorage)
├── Main → MainNavigator (bottom tabs)
│   ├── HomeTab (stack)
│   │   ├── Home (dashboard)
│   │   ├── InventoryDetail
│   │   ├── Restock
│   │   ├── AddMethod → ContextScanner or AddItem
│   │   ├── AddItem (AddInventoryItemScreen)
│   │   └── PastItems
│   ├── ScanTab (stack)
│   │   ├── Scanner (BarcodeScannerScreen)
│   │   ├── AddItem
│   │   ├── ListPicker
│   │   └── AddListItem
│   ├── InventoryTab (stack)
│   │   ├── Inventory (list/grid view)
│   │   ├── InventoryDetail
│   │   ├── AddMethod → ContextScanner or AddItem
│   │   ├── AddItem
│   │   └── PastItems
│   ├── ShoppingTab (stack)
│   │   ├── ShoppingLists
│   │   ├── ListDetail
│   │   ├── AddMethod → ContextScanner or AddListItem
│   │   ├── AddListItem
│   │   ├── EditListItem
│   │   ├── ShoppingCheckout
│   │   └── AddItem (for post-checkout inventory add)
│   └── SettingsTab → SettingsScreen
└── Login (modal presentation)
    └── Register (modal presentation)
```

Login and Register are presented as modals from the root stack, not a separate AuthNavigator.

## State Management

Five Zustand stores, each persisted to AsyncStorage:

| Store | Key State | Purpose |
|-------|-----------|---------|
| `authStore` | user, token, tier, isAuthenticated | Firebase auth state |
| `inventoryStore` | sortBy, filterBy, viewMode | Inventory UI preferences |
| `scanStore` | lastScan, scanResult | Stage 1 barcode scan state |
| `settingsStore` | notificationPrefs, theme | App preferences |
| `syncStore` | status, lastSyncAt, isOnline, lastResult | Sync monitoring |

## Component Architecture

### Provider Hierarchy (App.tsx)

```
ErrorBoundary
  SafeAreaProvider
    PaperProvider (react-native-paper theme)
      QueryClientProvider (TanStack React Query)
        ToastProvider
          OfflineIndicator
          RootNavigator
```

### Key Component Patterns

- **Screen components** use hooks for data and render presentation components
- **InventoryItemCard** supports list and grid (compact) layouts via `compact` prop
- **CategoryFilter** accepts DB-driven categories as props (not hardcoded)
- **SyncStatusBar** shows real-time sync status with tap-to-sync
- **ErrorBoundary** catches JS errors and logs to Firebase Crashlytics
- **ToastProvider** provides app-wide snackbar via `useToast()` hook

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@nozbe/watermelondb` | Local SQLite database with reactive queries |
| `@react-native-firebase/*` | Auth, Firestore, Analytics, Crashlytics, Storage |
| `react-native-vision-camera` | Camera for barcode scanning |
| `@notifee/react-native` | Local notifications with channels and triggers |
| `react-native-background-fetch` | Background sync every 30 minutes |
| `@tanstack/react-query` | Server state management with caching |
| `zustand` | Lightweight state management |
| `react-native-paper` | Material Design UI components |
| `zod` | Runtime validation schemas |
| `date-fns` | Date formatting utilities |
| `axios` | HTTP client with interceptors |

## Testing

```bash
npm test                  # All tests (CI mode)
npm run test:watch        # Interactive watch mode
npm run test:coverage     # With coverage report
npm run test:unit         # Utils + repositories only
npm run test:integration  # Integration tests only
```

### Test Structure

- `src/utils/__tests__/` — Unit tests for dateUtils, validators, helpers, errors
- `src/services/*/__tests__/` — Service tests for BarcodeService, BarcodeApiService, SyncService
- `src/database/repositories/__tests__/` — Repository CRUD tests
- `src/components/grocery/__tests__/` — Component rendering tests
- `src/screens/*/__tests__/` — Screen tests with mocked navigation
- `src/__tests__/integration/` — End-to-end barcode scanning workflow

### Mock Setup

`jest.setup.js` provides mocks for 15 native modules: Firebase (auth, firestore, analytics, crashlytics, storage), Vision Camera, Notifee, Background Fetch, NetInfo, Navigation, SafeAreaContext, and more.

## Building

### Android Release APK

```bash
npm run build:android
# Or use the script with timestamped output:
..\scripts\build-android.ps1
```

The APK is generated at `android/app/build/outputs/apk/release/app-release.apk`.

### iOS Release

```bash
npm run build:ios
```

Requires valid signing certificates configured in Xcode.
