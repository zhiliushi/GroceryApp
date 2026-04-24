# FUTURE: Mobile App Refactor

**Status:** Deferred. Mobile app continues to work via backward-compat shim on legacy endpoints. Full refactor plan captured here.

## Current state

- Mobile app (React Native) at `F:/ClaudeProjects/GroceryApp/mobile-app/`
- Uses legacy endpoints: `/api/inventory/my`, `/api/barcode/{bc}/add-to-inventory`, `/api/barcode/{bc}/use-one`
- Backend routes these through `legacy_item_shim` which converts between old `grocery_items` shape and new `catalog_entries + purchases` model
- Mobile app unaware of refactor; works as-is

## Migration plan

### Phase M1 — Types & API layer

- Add new TypeScript types in `mobile-app/src/types/`:
  - `CatalogEntry`, `PurchaseEvent`, `FeatureFlags`, `Nudge`, `WasteSummary`, `Insight`
- Add API client functions in `mobile-app/src/services/api/`:
  - `purchases.ts` — create/get/update/throw/consume
  - `catalog.ts` — get/search/merge
  - `countries.ts`, `reminders.ts`, `waste.ts`
  - `featureFlags.ts`
- Keep existing `inventory.ts` API layer calling legacy endpoints — to be removed in phase M4

### Phase M2 — WatermelonDB schema migration

- Replace `InventoryItem` model with two models:
  - `CatalogEntry` (local mirror of user's catalog)
  - `PurchaseEvent` (local mirror of events)
- Migration script in `src/database/migrations/` — converts existing local `inventory_items` → catalog + events
- Sync layer updates: `syncStore` pulls from new endpoints, writes to new local models

### Phase M3 — Screen refactors

Screens to rewrite (mirror web admin changes):

- `HomeScreen` → add health bar, expiring hero, waste stats
- `InventoryScreen` → 3-group layout (Expiring / Active / No Expiry Tracked)
- `InventoryDetailScreen` → state-driven action buttons (same resolver as web)
- `AddInventoryItemScreen` → QuickAdd pattern (name autocomplete from catalog)
- `ScannerScreen` → contextual scanner (add-to-list / add-to-inventory / mark-used / alternative-check)
- New: `CatalogScreen` + `CatalogEntryDetailScreen`
- New: `HealthScoreDetailScreen`
- New: `InsightsScreen`

### Phase M4 — Remove legacy

- Delete legacy API layer (`inventory.ts`)
- Delete shim on backend
- Legacy `grocery_items` collection can be dropped from Firestore

### Phase M5 — Mobile-specific enhancements

- Push notifications for expiry reminders (replacing Telegram for mobile-first users)
- Offline queue for purchase events (already WatermelonDB)
- Camera barcode scanner continues via `react-native-vision-camera`
- Floating scan button persistent across screens

## Breaking changes required on mobile side

- State management (Zustand stores) need new shape for catalog vs events
- Navigation stack updates (new detail screens)
- Barcode lookup flow changes (scan-info endpoint replaces separate calls)

## When to start

After web admin refactor is complete, stable in production, and users are actively using it. Mobile refactor is a ~2-3 week project and should not start until backend/web changes have soaked.

## Rollout strategy

- **Option A:** Ship mobile refactor as new app version; users upgrade at their own pace. Backend supports both legacy (old app) and new (new app) until majority upgrades.
- **Option B:** Force upgrade via app store. Simpler but disruptive. Only if legacy endpoints are being removed.

Recommended: Option A, with a 90-day deprecation notice before removing legacy endpoints.

## File structure changes (preview)

```
mobile-app/src/
├── services/
│   ├── api/
│   │   ├── purchases.ts        # NEW
│   │   ├── catalog.ts          # NEW
│   │   ├── countries.ts        # NEW
│   │   ├── reminders.ts        # NEW
│   │   ├── waste.ts            # NEW
│   │   ├── featureFlags.ts     # NEW
│   │   └── inventory.ts        # DELETE after phase M4
│   └── ...
├── database/
│   ├── models/
│   │   ├── CatalogEntry.ts     # NEW
│   │   ├── PurchaseEvent.ts    # NEW
│   │   └── InventoryItem.ts    # DELETE after M4
│   └── migrations/
│       └── v2_catalog_schema.ts # NEW
├── screens/
│   ├── catalog/                # NEW directory
│   │   ├── CatalogScreen.tsx
│   │   └── CatalogEntryDetailScreen.tsx
│   ├── health/                 # NEW
│   │   └── HealthScoreDetailScreen.tsx
│   ├── insights/               # NEW
│   │   └── InsightsScreen.tsx
│   └── inventory/              # refactored
```

## Rolled-forward patterns

- Same `getAvailableActions()` pure function ported to mobile (shared logic)
- Same `_normalize(name)` for catalog keys
- Same natural-language expiry parser (chrono-node available in RN)
- Same health score formula
- Same state machines
