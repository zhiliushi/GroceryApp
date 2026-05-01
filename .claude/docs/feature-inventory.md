# Feature Inventory

> **Purpose**: single source of truth for what user-visible features exist,
> where they live, and which tier owns them. Read this BEFORE adding a new
> feature — most "new" surfaces already exist somewhere.
>
> **Update rule**: when you add/move/remove a feature, update this doc AND
> the user manual (`backend/web-admin/src/pages/help/UserManualPage.tsx`)
> in the same PR. Stale inventory is worse than no inventory.

## Tier model

Defined in `backend/app/services/config_service.py:_DEFAULT_TIERS`.
Enforced in the frontend via `useVisibility()` hook
(`backend/web-admin/src/hooks/useVisibility.ts`).

| Key | Name | Price | Items | Lists | Retention | Scans/day |
|-----|------|-------|-------|-------|-----------|-----------|
| `free` | Basic Basket | RM 0 | 50 | 3 | 90d | 20 |
| `plus` | Smart Cart | RM 5.99 / mo | unlimited | unlimited | 365d | unlimited |
| `pro` | Full Fridge | RM 12.99 / mo | unlimited | unlimited | unlimited | unlimited |
| `admin` | (admin role) | — | bypass all gates | — | — | — |

`always_free`: foodbank_finder. `admin_only`: contribute_products. AI Chef
is a separate add-on (pricing TBD).

`plus` users pick 3 tools from a menu (`tool_menu` in tier config). `pro`
gets all of them. `free` gets none.

## Pages × tier matrix

User-facing pages (admin-only pages omitted — see `Sidebar.tsx adminNav`).

| Page | Route | File | Min tier | Tier-gated sections |
|------|-------|------|----------|---------------------|
| Dashboard | `/dashboard` | `pages/dashboard/DashboardPage.tsx` | free | `receipt_scanning` (plus) |
| My Items | `/my-items` | `pages/my-items/MyItemsPage.tsx` | free (was `inventory`) | `bulk_actions` (plus), `receipt_scanning` (plus), `export` (pro, disabled by default) |
| Catalog | `/catalog` | `pages/catalog/CatalogListPage.tsx` | free | — |
| Storage (card dashboard) | `/storage` | `pages/storage/StoragePage.tsx` | free | One card per location, clickable → detail. Admin gets edit/reorder controls inline. |
| Storage Detail | `/storage/:locationKey` | `pages/storage/StorageDetailPage.tsx` | free | Per-location current-state view: hero, urgency banner, pack list with inline actions. |
| Shopping Lists | `/shopping-lists` | `pages/shopping-lists/ShoppingListsPage.tsx` | free | `checkout_flow`, `trip_notes`, `receipt_scanning` (all plus) |
| Foodbanks | `/foodbanks` | `pages/foodbanks/FoodbanksListPage.tsx` | always-free | `sources_panel` (admin) |
| Meals | `/meals` | `pages/meals/MealsPage.tsx` | free | — |
| Waste | `/waste` | `pages/waste/WastePage.tsx` | free | — |
| Spending | `/spending` | `pages/spending/SpendingPage.tsx` | free | — |
| Reminders | `/reminders` | `pages/reminders/RemindersPage.tsx` | free | — |
| Insights | `/insights` | `pages/insights/InsightsPage.tsx` | flag-gated (`insights`) | — |
| Health Score | `/health-score` | `pages/health-score/HealthScorePage.tsx` | free | — |
| Settings | `/settings` | `pages/settings/SettingsPage.tsx` | free | — |
| User Manual | `/help` | `pages/help/UserManualPage.tsx` | free (always) | — |

Pages NOT in the visibility config get fail-open `true` from
`useVisibility.canAccessPage`. The visibility config is in
`config_service._DEFAULT_VISIBILITY` and overridable in Firestore at
`app_config/visibility`.

## Tools × tier matrix

Tools are tier-gated separately from pages. Listed in
`_DEFAULT_TIERS.tiers.plus.tool_menu`.

| Tool | Where used | free | plus | pro |
|------|------------|------|------|-----|
| `barcode_scan` | Scan pill, ContextualScannerModal | ✓ | ✓ | ✓ |
| `manual_entry` | QuickAddModal | ✓ | ✓ | ✓ |
| `basic_inventory` | My Items, Catalog | ✓ | ✓ | ✓ |
| `shopping_lists` | Shopping Lists | ✓ | ✓ | ✓ |
| `cloud_sync_multi_device` | (server-side) | — | optional | ✓ |
| `price_tracking` | Item detail price chart | — | optional | ✓ |
| `checkout_flow` | Shopping List trip mode | — | optional | ✓ |
| `basic_analytics` | Insights, dashboard charts | — | optional | ✓ |
| `advanced_analytics` | Insights deep-dive | — | optional | ✓ |
| `price_comparison` | Catalog entry price-by-store | — | optional | ✓ |
| `export` | Settings → Export data | — | optional | ✓ |
| `receipt_scanning_ocr` | Receipt scan flow | — | optional | ✓ |

`plus` users select up to 3 from this menu via the Settings →
Subscription tool picker. `pro` gets all unlocked.

## Feature flags (admin-toggleable)

Source: `backend/app/services/feature_flag_service.py` defaults.
Documented in detail at `docs/FEATURE_FLAGS.md`.

| Flag | Default | Effect when off |
|------|---------|-----------------|
| `ocr_enabled` | true | Hides all OCR surfaces (children: `receipt_scan`, `smart_camera`, `recipe_ocr`, `shelf_audit`) |
| `financial_tracking` | true | Hides price/payment fields in QuickAdd; SpendingScoreboard self-hides |
| `progressive_nudges` | true | ProgressiveNudge component returns null |
| `insights` | true | Insights sidebar entry hidden; backend returns empty |
| `nl_expiry_parser` | true | "tomorrow"/"next week" no longer parsed; ISO only |
| `barcode_country_autodetect` | true | Scheduler job no-op |
| `catalog_cleanup` | true | 30-day idle counter pause; cleanup banner hidden |
| `reminder_scan` | true | Reminder scheduler no-op |
| `milestone_analytics` | true | Milestone insights not auto-generated |
| `legacy_endpoints_use_new_model` | false until migrated | Mobile clients see legacy data shape |

## Major actions × where they live

The user manual (section 4) explains these in plain language. This table
is the engineer's index.

| Action | Component / hook | API |
|--------|------------------|-----|
| Add purchase | `QuickAddModal` → `useCreatePurchase` | `POST /api/purchases` |
| Scan barcode | `FloatingScanButton` → `ContextualScannerModal` | `POST /api/scan/barcode` |
| Mark used (partial-pack) | `MarkUsedModal` → `useChangePurchaseStatus` | `POST /api/purchases/{id}/status` |
| Mark thrown | `ThrowAwayModal` → `useChangePurchaseStatus` | `POST /api/purchases/{id}/status` |
| Give away | `GiveAwayModal` → `useChangePurchaseStatus` | `POST /api/purchases/{id}/status` |
| Move location | `MoveLocationModal` → `useMovePurchase` | `POST /api/purchases/{id}/move` |
| Restore (terminal → active) | `useRestoreEvent` button on PurchaseEventDetailPage | `POST /api/purchases/{id}/restore` |
| Restore bulk (admin disaster recovery) | (no UI; curl only) | `POST /api/admin/purchases/restore-recent` |
| Catalog rename / merge / delete | CatalogEntryPage actions | `PATCH /api/catalog/{name_norm}`, etc. |
| Update unit_type | UnitTypeEditor inside CatalogEntryPage | `PATCH /api/catalog/{name_norm}` `{unit_type}` |
| Set currency preference | SettingsPage | `PATCH /api/users/me` `{currency_preference}` |

## Currency model

Read-time conversion. Each spending/waste figure is converted on read
from the event's stored `amount + currency` to the user's
`currency_preference` via `currency_service.display_amount_for_user`.
Backend returns `display_currency` on the response so frontend can
render the right symbol via `formatCurrencyWithSymbol`.

The original purchase currency is preserved on the event and shown on
the item detail page.

## Catalog cleanup (free-tier idle counter)

`free`-tier users have a 30-day idle counter on barcodeless catalog
rows. Touching the row (open, edit, add purchase) resets the counter.
The CatalogCleanupBanner on the top of every page surfaces this with
"Show me" / "Dismiss" actions. `plus`/`pro` users are exempt — see
`backend/app/services/quota_service.py` for enforcement.

## What's NOT in the inventory

- Mobile (legacy) — mobile refactor deferred. Legacy endpoints work via
  `services/compat/legacy_item_shim.py` when
  `legacy_endpoints_use_new_model` is on.
- Telegram bot — design at `docs/FUTURE_TELEGRAM_BOT.md`, not built.
- Household sharing — design at
  `docs/FUTURE_HOUSEHOLD_CATALOG_MERGE.md`, not built.
- AI Chef recipe suggestions — separate add-on, design pending pricing.
