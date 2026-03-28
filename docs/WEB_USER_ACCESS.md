# Web User Access — Architecture & Data Flow

## Overview

GroceryApp has two client interfaces: **Mobile App** (React Native) and **Web Admin** (React SPA). Users can access both, but they serve different purposes and have different data flows.

## Client Comparison

| Aspect | Mobile App | Web |
|--------|-----------|-----|
| **Primary purpose** | Full grocery management | Quick access + admin panel |
| **Storage** | WatermelonDB (local SQLite) + optional Firestore sync | Firestore only (via backend API) |
| **Offline** | Yes (local-first) | No (requires internet) |
| **Data ownership** | Phone is the primary copy | Firestore is the primary copy |
| **Feature set** | Full (gated by tier) | Limited (gated by tier, no OCR/camera) |
| **Tier enforcement** | Client-side + Firestore rules | Backend API + TierRoute component |

## Data Flow

```
┌─────────────────┐         ┌──────────────┐         ┌─────────────────┐
│   Mobile App    │         │   Firestore  │         │    Web SPA      │
│                 │         │              │         │                 │
│ WatermelonDB    │  sync   │  users/{uid} │  API    │  React +        │
│ (local SQLite)  │◄───────►│  /grocery_   │◄───────►│  TanStack Query │
│                 │  (if    │  items/...   │  calls  │                 │
│ Camera/Scanner  │  cloud  │              │         │  No camera      │
│ GPS/Location    │  sync)  │  products/   │         │  No GPS         │
│ Notifications   │         │  contributed │         │  No offline     │
└─────────────────┘         └──────────────┘         └─────────────────┘
```

### Data Sync Direction

| Direction | Condition | What syncs |
|-----------|-----------|------------|
| **Web → Phone** | User has cloud_sync tool | Web writes to Firestore → phone pulls on next sync |
| **Phone → Web** | User has cloud_sync tool | Phone pushes to Firestore → web reads via API |
| **Phone → Phone (local only)** | Free tier (no cloud_sync) | Data stays on device, never reaches Firestore |
| **Web → Firestore** | Always (web has no local storage) | All web actions write directly to Firestore |

### Free Tier Data Isolation

```
Free user (no cloud_sync):
  Phone: local WatermelonDB only — independent data
  Web:   reads/writes Firestore via API — independent data
  Result: Phone and Web have SEPARATE, UNLINKED data

Plus/Pro user (with cloud_sync):
  Phone: WatermelonDB ↔ Firestore (bidirectional sync)
  Web:   reads/writes Firestore via API
  Result: Phone and Web share the SAME data via Firestore
```

## API Layer for Web Users

### Current State (Admin-Only APIs)

All data endpoints are under `/api/admin/*` and require `require_admin` auth. Regular users hitting these get 403.

### Required: User-Scoped API Endpoints

For regular users to access the web, we need new endpoints:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/user/inventory` | `get_current_user` | Current user's grocery items (respects tier limits) |
| POST | `/api/user/inventory` | `get_current_user` | Add item (checks max_items limit) |
| PUT | `/api/user/inventory/{item_id}` | `get_current_user` | Update own item |
| DELETE | `/api/user/inventory/{item_id}` | `get_current_user` | Delete own item |
| GET | `/api/user/shopping-lists` | `get_current_user` | Current user's lists (respects max_lists) |
| POST | `/api/user/shopping-lists` | `get_current_user` | Create list (checks limit) |
| GET | `/api/user/shopping-lists/{list_id}` | `get_current_user` | List detail with items |
| PUT | `/api/user/shopping-lists/{list_id}` | `get_current_user` | Update own list |
| DELETE | `/api/user/shopping-lists/{list_id}` | `get_current_user` | Delete own list |
| GET | `/api/user/price-records` | `get_current_user` | Own price records (filtered by country for shared data) |
| GET | `/api/user/analytics` | `get_current_user` | Own analytics stats |
| GET | `/api/user/profile` | `get_current_user` | Own profile with tier/tools/limits |
| PUT | `/api/user/profile` | `get_current_user` | Update own profile (country, display name) |

These endpoints enforce:
- **Data isolation**: Only returns `users/{current_uid}/*` data
- **Tier limits**: Checks `max_items`, `max_lists`, `data_retention_days` before allowing writes
- **Data retention**: Free users only see last 90 days via query filter

### Implementation Status

| Component | Status |
|-----------|--------|
| TierRoute (page-level gating) | ✅ Built, wired in router |
| useVisibility (section-level gating) | ✅ Built |
| Admin Settings page (configure tiers/visibility) | ✅ Built |
| Visibility config in Firestore | ✅ Built + seeded |
| User-scoped API endpoints | ❌ Not built yet |
| Web user dashboard (non-admin view) | ❌ Not built yet (pages exist but call admin APIs) |
| Tier limit enforcement on writes | ❌ Not built yet |

## Tier Gating in Web SPA

### Page-Level Gating (TierRoute)

The router wraps user-facing pages in `<TierRoute page="pageKey">`:

```tsx
// If user tier < page's minTier → shows UpgradeBanner
<TierRoute page="analytics">
  <AnalyticsPage />
</TierRoute>
```

Pages and their minimum tier (configurable by admin):

| Page | Default minTier | Always Free? |
|------|----------------|--------------|
| Dashboard | free | No |
| Inventory | free | No |
| Shopping Lists | free | No |
| Foodbanks | free | Yes |
| Analytics | plus | No |
| Price Tracking | plus | No |
| Settings | free | No |

Admin-only pages (Products, Users, Contributed, Needs Review, Price Records, Admin Settings) are gated by `<AdminRoute>`, not TierRoute.

### Section-Level Gating (useVisibility)

Within pages, individual sections are gated:

```tsx
const { canAccessSection } = useVisibility();

{canAccessSection('inventory', 'bulk_actions') && <BulkActionBar />}
{!canAccessSection('inventory', 'export') && <UpgradeBanner feature="Export" requiredTier="Full Fridge" compact />}
```

### Tool-Level Gating (canUseTool)

For Smart Cart users who pick 3 tools:

```tsx
const { canUseTool } = useVisibility();

{canUseTool('price_tracking') ? <PriceWidget /> : <UpgradeBanner feature="Price Tracking" />}
```

## Web Feature Limitations vs Mobile

Features that work on Web:
- View inventory, shopping lists
- Add/edit/delete items (within tier limits)
- View analytics charts
- View price history
- Foodbank finder
- Settings

Features that DON'T work on Web (mobile only):
- Barcode scanning (requires camera)
- Receipt scanning / OCR (requires camera)
- GPS-based store detection (requires location)
- Push notifications
- Offline access
- Background expiry checks
