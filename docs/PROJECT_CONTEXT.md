# GroceryApp — Project Context

## Product Vision

GroceryApp is a **simple waste-prevention app**. It helps users minimise food waste by tracking what they buy, when it expires, and what they use vs throw away. The app gets out of the way: users add items via barcode scan or name entry, and the app surfaces expiring items before they go bad.

### Core principles

1. **Dumb-simple to use** — new users face minimum friction; a single "what did you buy?" input + optional scan is all that's required.
2. **Name-centric catalog** — items are identified by name; barcode is a helpful tool when available, not required.
3. **Progressive disclosure** — no forms upfront; the app nudges users to add expiry/price/volume after they've added N items and see the value.
4. **Waste-focused** — dashboard shows health bar, expiring items, untracked age buckets, and waste stats; not inventory count.
5. **State-driven UI** — every screen's actions appear/hide based on current data state (like a PO system where draft shows only "Publish", published shows stage-appropriate actions).
6. **Barcode as helper** — scanning auto-finds catalog entries when available; items without barcodes (user-entered names) are first-class.

### What this app is NOT

- Not a budget/expense tracker (basic finance only: cash vs card per purchase)
- Not a recipe app (though meals feature is retained for waste-prevention "cook these now" suggestions)
- Not an OCR/receipt-scanning app (OCR features hidden behind admin toggle during refactor)
- Not a complex inventory management system (no locations hierarchy, no batch operations default)

## Business Model

Tier-based feature gating (mostly retained, simplified):

### Free tier
- Local + cloud-synced grocery management
- Unlimited catalog entries
- Unlimited purchase events
- Barcode scanning (shared global products DB)
- Manual name entry (personal catalog)
- Expiry reminders (7/14/21-day nudges for untracked items)
- Waste tracking + health score
- Shopping lists
- Foodbank directory

### Plus tier ("Smart Cart")
- All free features
- 3 selected advanced tools from menu
- Premium insights (milestone analytics)
- Household sharing (up to 5 members)
- Priority feature unlock

### Pro tier ("Full Fridge")
- All features unlocked
- Unlimited household members (up to 10)
- All admin analytics
- Early access to new features

## Technology Stack

### Mobile App (React Native) — legacy, refactor deferred
- Framework: React Native + TypeScript
- Local DB: WatermelonDB (SQLite)
- Cloud: Firebase (Firestore + Auth)
- Barcode: react-native-vision-camera + ML Kit
- Nav: React Navigation v6+
- State: Zustand
- UI: react-native-paper
- HTTP: axios
- **Note:** currently consumes legacy `/api/inventory/my` endpoints via backward-compat shim. Migration to new `/api/purchases` + `/api/catalog` is deferred to `docs/FUTURE_MOBILE_REFACTOR.md`.

### Backend (FastAPI)
- Framework: FastAPI 2.2.0
- Python 3.11
- Firebase Admin SDK + Firestore
- Deploy: Render.com (Docker, rootDir: `backend/`)
- External APIs: Open Food Facts (product lookup)
- OCR providers (Tesseract/Mindee/Google Vision) — retained but feature-flag gated

### Web Admin SPA
- React 19 + TypeScript
- Vite 6 (build output to `backend/static/spa/`)
- Tailwind CSS v4 (light theme, purple accent)
- TanStack Query v5
- React Hook Form v7
- Zustand v5 (auth + UI)
- Chart.js 4
- Firebase client SDK (same auth as mobile)

### Infrastructure
- Firestore (primary DB)
- Firebase Auth (user identity)
- Firebase Storage (images)
- Render.com (backend hosting, free tier)
- Open Food Facts (product lookup)

## Architecture

### Data model (refactored)

**Global collections:**
- `catalog_entries/{user_id}__{name_norm}` — per-user name catalog (doc ID enforces uniqueness)
- `products/{barcode}` — global barcode-keyed product DB + country + verification
- `contributed_products/{barcode}` — user-submitted products awaiting admin review
- `countries/{code}` — country definitions with GS1 prefix ranges
- `foodbanks/{id}` — foodbank directory
- `households/{id}` — shared family groupings
- `app_config/*` — global config docs (features, ocr, visibility, tiers, locations, map, stores)

**Per-user subcollections:**
- `users/{uid}` — user profile
- `users/{uid}/purchases/{event_id}` — purchase events (status: active/used/thrown/transferred)
- `users/{uid}/recipes/{recipe_id}` — personal recipes
- `users/{uid}/price_records/{record_id}` — price history
- `users/{uid}/shopping_lists/{list_id}/items/{item_id}` — shopping lists
- `users/{uid}/reminders/{reminder_id}` — 7/14/21-day nudges
- `users/{uid}/insights/{milestone_id}` — milestone analytics output
- `users/{uid}/analytics_events/{event_id}` — behavior events

### Data flow — Add item (happy path)

```
User enters name OR scans barcode
    ↓
API: POST /api/purchases
    ↓
Backend (purchase_event_service.create_purchase):
    1. Normalize name → name_norm
    2. Upsert catalog_entries/{uid}__{name_norm}
       - If barcode provided: check no other entry has it (composite uniqueness)
       - If country_code unknown + barcode: detect via GS1 prefix
    3. Create users/{uid}/purchases/{event_id}
       - Parse natural-language expiry if provided
       - Default location from catalog.default_location
    4. Increment catalog counters (total_purchases, active_purchases)
    5. Fire analytics event (for milestone triggers)
    ↓
Return PurchaseEvent to client
```

### Data flow — Expiry reminder scan (daily scheduler)

```
08:00 UTC cron fires
    ↓
nudge_service.scan_reminders (feature-flag guarded)
    ↓
Query collection-group users/{uid}/purchases
   where status == 'active' AND expiry_date == null
    ↓
For each purchase:
   age = now - date_bought (days)
   IF age >= 7 AND reminder_stage < 1 → create reminder (stage=1)
   IF age >= 14 AND reminder_stage < 2 → create reminder (stage=2)
   IF age >= 21 AND reminder_stage < 3 → create reminder (stage=3)
                                         + flag catalog.needs_review=true
    ↓
Future: push notification to mobile / Telegram
```

## Core Features

1. **Simple Add Item** — name input with catalog autocomplete + optional barcode scan
2. **Catalog Management** — user's reusable name catalog; case-insensitive dedup per user
3. **Purchase Tracking** — each shopping trip = multiple purchase events referring to catalog
4. **Expiry Management** — natural language input, visual chips, state-driven action buttons
5. **Waste Prevention Dashboard** — health bar, expiring cards, untracked age buckets
6. **Simple Actions** — Used / Thrown / Give Away per item, conditional on state
7. **Household Sharing** — tier-gated, up to 5/10 members
8. **Shopping Lists** — scan-to-add, scan-at-checkout-to-mark-bought
9. **Foodbank Finder** — "Give Away" links to local foodbanks via map
10. **Basic Finance** — per-purchase cash/card toggle, monthly summary
11. **Progressive Nudges** — contextual prompts at 5/10/20/50/100/500 items
12. **Milestone Insights** — AI-generated patterns at thresholds
13. **Admin Catalog Analysis** — cross-user aggregation view for data quality

### Hidden during refactor (feature flag)

- Receipt OCR scanning
- Smart camera scans (product label, expiry, shelf audit)
- OCR test scanner (admin tool)
- Recipe image OCR

## Development Phases (current refactor)

See `C:\Users\Shahir\.claude\plans\hidden-yawning-shamir.md` for detailed plan.

- **Phase 0** (this phase) — Documentation update
- **Phase 1** — Backend foundation (feature flags, core services, migration script)
- **Phase 2** — API endpoints + backward-compat shim + run migration
- **Phase 3** — Scheduler jobs
- **Phase 4** — Frontend refactor (Dashboard, My Items, Catalog, QuickAdd, etc.)
- **Phase 5** — Insights + analytics UI
- **Phase 6** — Documentation update (page docs)
- **Future** — Telegram integration, mobile refactor, AI dedup

## Key Technical Decisions

- **Global `catalog_entries` collection (not subcollection)** — enables admin cross-user analysis queries without expensive collection_group scans
- **Doc ID = `{user_id}__{name_norm}`** — composite uniqueness enforced at Firestore level, no app-level checks needed
- **One barcode per catalog entry** — forces clean data; different package sizes = separate entries
- **Transactional purchase creation** — atomic catalog upsert + event create + counter increment
- **State-driven UI** — pure function `getAvailableActions(data)` drives button visibility; no hardcoded conditions scattered across components
- **Backward-compat shim** — new data model backs old `/api/inventory/my` endpoints so existing mobile app keeps working during transition
- **Feature flags 60s cache** — admin toggles propagate within 60s without deploys

## Security Considerations

1. Firestore security rules enforce doc-ID uniqueness and user-ownership
2. Admin-only routes use `Depends(require_admin)` + Firestore role check
3. Rate limiting per-user (60 writes/min) prevents abuse
4. OCR API keys in environment vars, feature-flag gated at API layer
5. Audit trail on admin actions (`updated_by`, `updated_at`, dedicated audit logs)
6. All metadata writes (created_at, etc.) use `SERVER_TIMESTAMP` not client time

## Performance Targets

- Add item via name: < 500ms (incl. Firestore write)
- Add item via barcode: < 1s (incl. cascade lookup)
- Dashboard load: < 1s
- Catalog autocomplete: < 200ms (cached in React Query)
- Expiry scan (daily scheduler): < 60s for 1000 active users

## Monetization

- Free tier: full core waste-tracking features
- Plus ($4.99/mo or $49.99/yr): "Smart Cart" with 3 premium tools picked from menu
- Pro ($9.99/mo or $99.99/yr): "Full Fridge" — everything unlocked + priority support
- 7-day free trial for paid tiers

## Success Metrics

- **Primary:** waste rate reduction (% items thrown vs total purchased)
- User retention (30/60/90 day)
- Catalog growth rate (items added per active user)
- Expiry-tracking adoption (% of purchase events with expiry set)
- Nudge engagement (% of nudges actioned vs dismissed)
- Milestone insight views (user returns to see insights)
