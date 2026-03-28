# Tier System — Subscription Plans & Feature Gating

## Tier Overview

| Tier Key | Name | Price | Billing |
|----------|------|-------|---------|
| `free` | **Basic Basket** | RM 0 | — |
| `plus` | **Smart Cart** | RM 5.99 | Monthly |
| `pro` | **Full Fridge** | RM 12.99 | Monthly |
| `ai_chef` | **AI Chef** (add-on) | TBD | Separate |

Tier hierarchy: `free (0) < plus (1) < pro (2) < admin (3)`

## Tier Limits

| Limit | Basic Basket | Smart Cart | Full Fridge |
|-------|-------------|------------|-------------|
| Max active items | 50 | Unlimited (-1) | Unlimited (-1) |
| Max shopping lists | 3 | Unlimited (-1) | Unlimited (-1) |
| Data retention | 90 days | 365 days | Unlimited (-1) |
| Barcode scans/day | 20 | Unlimited (-1) | Unlimited (-1) |

### Item Count Rules
- Only items with `status === 'active'` count toward the limit
- Consumed, expired, and discarded items do NOT count (slot freed)
- Restoring an item checks the limit (fails if at max)
- Enforcement: client-side check + backend validation on write
- Sync conflict: if offline add exceeds limit, allow but warn on next sync

### Data Retention Rules
- Implemented via **query filter**, NOT data deletion
- Free: `where('addedDate', '>', threeMonthsAgo)`
- Data beyond retention period still exists in Firestore (admin can see it)
- Upgrading instantly reveals all historical data
- Downgrading hides data beyond new limit (not deleted)

## Feature Matrix

| Feature | Basic Basket | Smart Cart | Full Fridge |
|---------|-------------|------------|-------------|
| Inventory management | ✓ | ✓ | ✓ |
| Shopping lists | ✓ | ✓ | ✓ |
| Barcode scanning | ✓ | ✓ | ✓ |
| Manual entry | ✓ | ✓ | ✓ |
| Foodbank finder | ✓ (always free) | ✓ | ✓ |
| **Selectable tools** | **None** | **Pick 3** | **All included** |
| Cloud Sync + Multi-Device | ✗ | Selectable | ✓ |
| Price Tracking | ✗ | Selectable | ✓ |
| Checkout Flow | ✗ | Selectable | ✓ |
| Basic Analytics | ✗ | Selectable | ✓ |
| Advanced Analytics | ✗ | Selectable | ✓ |
| Price Comparison | ✗ | Selectable | ✓ |
| Data Export | ✗ | Selectable | ✓ |
| Receipt Scanning (OCR) | ✗ | Selectable | ✓ *(future)* |
| AI features | ✗ | ✗ | ✗ (AI Chef add-on) |

## Smart Cart — "Pick 3" Model

Smart Cart users select **3 tools** from the tool menu when subscribing. This makes the mid-tier feel personalized and avoids feature overwhelm.

### Tool Menu (8 options, pick 3)

1. **Cloud Sync + Multi-Device** (`cloud_sync_multi_device`) — Sync data between web and phone
2. **Price Tracking** (`price_tracking`) — Record and view price history per store
3. **Checkout Flow** (`checkout_flow`) — Shopping trip checkout with totals
4. **Basic Analytics** (`basic_analytics`) — Status/location/expiry charts
5. **Advanced Analytics** (`advanced_analytics`) — Trends, predictions, spending
6. **Price Comparison** (`price_comparison`) — Compare prices across stores/countries
7. **Data Export** (`export`) — Export inventory/lists/prices to CSV
8. **Receipt Scanning** (`receipt_scanning_ocr`) — Scan receipts to auto-add *(future)*

### Tool Selection Rules
- Selection stored in `users/{uid}.selected_tools[]`
- Can change selection **once per billing cycle**
- Lock tracked by `tools_locked_until` timestamp
- Data from deselected tools persists (read-only)
- Re-selecting a tool restores write access to that data
- Admin can override selection via Admin Settings → User Approval → Tools button

## Always Free Features
- **Foodbank Finder** — Free forever, experimental feature
- **Product Contributions** — Admin-only action (users suggest products via scan, admin reviews)

## AI Chef Add-on (Separate Billing)
- Not tied to any tier — can be added to any paid tier
- Pricing TBD (depends on LLM API costs)
- Features: AI shopping suggestions, smart shopping list generation, recipe suggestions
- Requires separate cost calculation due to per-request API charges

## Downgrade Behavior

| Scenario | Behavior |
|----------|----------|
| Full Fridge → Basic Basket (200 active items) | All items remain visible. Cannot add new until active count < 50. Can still consume/discard. |
| Full Fridge → Basic Basket (10 lists) | All lists remain. Cannot create new until count < 3. |
| Smart Cart → Basic Basket (had cloud sync) | Sync stops. Local data persists. Cloud data persists (read-only via web). |
| Smart Cart tool change mid-cycle | Blocked until next billing cycle. Shows lock date. |
| Admin disables a page | Next navigation redirects to dashboard with toast. |
| Tier change while app is open | 403 on next API call → SPA refetches config → UI updates. |

## Firestore Storage

### Tier Config: `app_config/tiers`
Stores tier definitions (names, prices, limits, features, tool menu). Editable by admin via Admin Settings → Tier Plans tab.

### Visibility Config: `app_config/visibility`
Stores page/section visibility rules per tier. Editable by admin via Admin Settings → Page Management tab.

### User Fields
| Field | Type | Description |
|-------|------|-------------|
| `tier` | string | `"free"` / `"plus"` / `"pro"` |
| `selected_tools` | string[] | Smart Cart: which 3 tools are selected |
| `tools_locked_until` | number | Timestamp when tools can be changed again |
| `tools_changed_at` | number | Last tool selection change |
| `tier_changed_at` | number | Last tier change timestamp |
| `tier_changed_by` | string | Admin UID who changed tier |

## Multi-Currency Support

All prices are stored in the user's local currency at time of recording. Display converts using daily exchange rates.

### Storage
- Every price field has a companion `currency` field (ISO 4217: MYR, SGD, USD, etc.)
- Exchange rates cached in `app_config/exchange_rates` (updated daily from open.er-api.com)
- Conversion: `display = original × (target_rate / original_rate)`

### Country-Based Data Filtering
| Data | Normal User | Admin |
|------|------------|-------|
| Inventory | Own items only | All users, country toggle |
| Shopping Lists | Own lists only | All users, country toggle |
| Price Records | Own + same-country shared | All, country toggle |
| Products | Global (barcodes universal) | Global |
| Foodbanks | Filtered by user's country | All, country toggle |

### Supported Countries
MY (Malaysia), SG (Singapore), ID (Indonesia), PH (Philippines), TH (Thailand), US (United States), GB (United Kingdom), AU (Australia). Admin can add more.

## Implementation Status

| Component | Location | Status |
|-----------|----------|--------|
| Tier config in Firestore | `app_config/tiers` | ✅ Seeded |
| Visibility config in Firestore | `app_config/visibility` | ✅ Seeded |
| Config service (backend) | `backend/app/services/config_service.py` | ✅ Built |
| Exchange rate service | `backend/app/services/exchange_rate_service.py` | ✅ Built |
| Admin Settings page (web) | `web-admin/src/pages/admin-settings/` | ✅ Built |
| TierRoute component | `web-admin/src/components/layout/TierRoute.tsx` | ✅ Built |
| useVisibility hook | `web-admin/src/hooks/useVisibility.ts` | ✅ Built |
| UpgradeBanner component | `web-admin/src/components/shared/UpgradeBanner.tsx` | ✅ Built |
| Route wiring (TierRoute on pages) | `web-admin/src/router.tsx` | ✅ Wired |
| User-scoped API endpoints | `backend/app/api/routes/user.py` | ❌ Not built |
| Tier limit enforcement | Backend write validation | ❌ Not built |
| Mobile app config integration | Mobile reads `/api/config` | ❌ Not built |
| Payment integration | Stripe/RevenueCat | ❌ Not built |
