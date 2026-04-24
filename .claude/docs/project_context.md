# GroceryApp — Project Context

## Identity
Simple waste-prevention app. Users minimise food waste by tracking what they buy, when it expires, and what they use vs throw. Web admin + mobile app.

**Refactor shipped (2026-04-23):** pivoted from complex OCR-heavy inventory manager to dumb-simple waste tracker. Original plan at `C:\Users\Shahir\.claude\plans\hidden-yawning-shamir.md`. All phases complete: backend foundation, API + compat shim, scheduler jobs, frontend UX (incl. barcode-first flow + state-driven actions), production safety (rules/indexes/pytests), rich milestone insights. 159 routes, 73 pytests, `tsc -b` clean.

## Stack
- **Mobile**: React Native, WatermelonDB (SQLite), Zustand, React Navigation, react-native-paper (**refactor deferred** — see `docs/FUTURE_MOBILE_REFACTOR.md`)
- **Backend**: FastAPI 2.2.0, Firebase Admin SDK, Firestore, Jinja2 templates
- **Web Admin SPA**: React 19 + Vite 6 + TanStack Query + Tailwind 4 (`backend/web-admin/`)
- **Deploy**: Render.com (Docker, `render.yaml`, rootDir: backend)
- **GitHub**: https://github.com/zhiliushi/GroceryApp

## Build (Mobile)
```bash
export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.0.10.7-hotspot"
cd android && ./gradlew.bat app:installDebug
```
- Device: SM-N960F (Samsung Galaxy Note 9, Android 10)

## Build (Web Admin)
```bash
cd backend/web-admin && npm install && npm run dev    # dev server with HMR
cd backend/web-admin && npx vite build               # production → backend/static/spa
```

## Build (Backend)
```bash
cd backend && pip install -r requirements.txt && uvicorn main:app --reload --port 8000
```

## Core Principles (post-refactor)

1. **Catalog is name-centric** — user's named item is the reference; barcode is optional metadata
2. **Barcode is a helper** — not required; items without barcodes are first-class
3. **State-driven UI** — buttons appear based on data state + required fields (like a PO: draft shows "Publish", published shows stage-appropriate actions)
4. **Progressive disclosure** — nudges for expiry/price/volume after 5/10/20 items
5. **Waste-focused dashboard** — health bar (green/yellow/red) + expiring items, not inventory count
6. **Hide OCR via feature flag** — admin toggle; not deleted

## Data Model (refactored)

- `catalog_entries/{user_id}__{name_norm}` — global collection, per-user name catalog (doc ID = composite key)
- `users/{uid}/purchases/{event_id}` — purchase events with expiry/price/status
- `products/{barcode}` — global barcode DB (extended with country_code)
- `countries/{code}` — country definitions with GS1 prefix ranges
- `app_config/features` — feature flags
- Users have `purchases` replacing old `grocery_items` (migrated, source preserved)

## Key Patterns
- Shell: Git Bash on Windows (use `export` not `set`)
- Catalog uniqueness: `(user_id, name_norm)` via doc ID; `(user_id, barcode)` via API-layer check
- Every Firestore doc has metadata: `created_at`, `updated_at`, `schema_version`, `created_by`, `source`
- Services: `catalog_service`, `purchase_event_service`, `country_service`, `nudge_service`, `waste_service`, `nl_expiry`
- All writes through services (never `db.collection()` in routes)
- Feature flag decorator: `@require_flag("ocr_enabled")` on routes; `@feature_flag("reminder_scan")` on scheduler
- State resolver: pure function `getAvailableActions(data, user) → Action[]` drives button visibility
- Health score: weighted formula on active items + monthly waste rate (see `docs/HEALTH_SCORE.md`)

## Documentation Map

- `CLAUDE.md` — entry point, quick reference
- `docs/PROJECT_CONTEXT.md` — product vision
- `docs/DATABASE.md` — Firestore schema (refactored)
- `docs/CATALOG_SYSTEM.md` — name normalization, merging, cleanup
- `docs/FEATURE_FLAGS.md` — all flags + dependencies + admin UI
- `docs/STATE_DRIVEN_UI.md` — per-page state machines + action resolvers
- `docs/HEALTH_SCORE.md` — formula + drill-down
- `docs/NUDGE_SYSTEM.md` — progressive disclosure thresholds
- `docs/MIGRATION_GUIDE.md` — grocery_items → catalog+purchases migration
- `docs/ADMIN_CATALOG_ANALYSIS.md` — admin aggregation view
- `docs/FUTURE_*.md` — deferred designs (Telegram, mobile, AI dedup, item movement, household merge)
