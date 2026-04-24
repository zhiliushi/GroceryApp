# Backend Documentation

## Overview

The GroceryApp backend is a Python FastAPI application that provides barcode scanning, analytics aggregation, and AI-powered insights. It uses Firebase Admin SDK for Firestore and Auth, and is deployed to Render.com via Docker.

## Architecture

```
backend/
├── main.py                        # App entry, Firebase init, CORS, SPA fallback, routers
├── app/
│   ├── core/
│   │   ├── config.py              # Pydantic settings from environment
│   │   └── auth.py                # Firebase token verification, UserInfo, role management
│   ├── schemas/
│   │   ├── barcode.py             # Barcode request/response models
│   │   ├── analytics.py           # Analytics + insights models
│   │   ├── foodbank.py            # Foodbank models, responses
│   │   ├── auth.py                # UserRoleUpdateRequest
│   │   └── web.py                 # Dashboard schemas
│   ├── services/
│   │   ├── barcode_service.py     # Firebase + OFF lookup, contribute
│   │   ├── analytics_service.py   # Batch sync, stats aggregation
│   │   ├── insights_service.py    # AI + rule-based insights engine
│   │   ├── foodbank_service.py    # CRUD + Malaysia seeding
│   │   ├── foodbank_sources.py    # Multi-source web scraping
│   │   ├── user_service.py        # User management, roles, tiers
│   │   ├── inventory_service.py   # Cross-user inventory queries
│   │   ├── shopping_list_service.py # Shopping lists across users
│   │   ├── product_service.py     # Product database management
│   │   ├── price_record_service.py # Price history queries
│   │   ├── config_service.py      # Page visibility, tier definitions
│   │   ├── exchange_rate_service.py # Currency conversion
│   │   ├── contributed_product_service.py # Review queue for user contributions
│   │   └── scheduler.py           # APScheduler for background tasks
│   ├── fsm/                       # Finite state machines
│   │   ├── engine.py              # Generic StateMachine with guards, actions, audit
│   │   ├── item_lifecycle.py      # scanned → active → consumed/expired/discarded
│   │   ├── foodbank_pipeline.py   # Foodbank data pipeline states
│   │   └── review_workflow.py     # Contributed product review states
│   └── api/routes/
│       ├── barcode.py             # /api/barcode/* endpoints
│       ├── analytics.py           # /api/analytics/* endpoints
│       ├── foodbank.py            # /api/foodbanks/* endpoints
│       ├── admin.py               # /api/admin/* endpoints (requires admin role)
│       └── web.py                 # Legacy Jinja2 routes (being replaced by SPA)
├── web-admin/                     # React SPA admin panel (Vite + React 19 + Tailwind 4)
├── static/                        # SPA build output served by FastAPI
├── templates/                     # Legacy Jinja2 templates (deprecating)
├── scripts/
│   ├── setup.bat                  # Windows local dev setup
│   └── setup.sh                   # macOS/Linux local dev setup
├── Dockerfile                     # Python 3.11-slim container
├── Procfile                       # Gunicorn start command
├── render.yaml                    # Render Blueprint config
├── requirements.txt               # Pinned dependencies
├── .env.example                   # Environment template
└── .gitignore
```

## Local Development

### Prerequisites

- Python 3.11+ (tested up to 3.14)
- Firebase service account JSON file

### Quick Setup

**Windows:**
```bash
cd backend
scripts\setup.bat
```

**macOS/Linux:**
```bash
cd backend
chmod +x scripts/setup.sh
./scripts/setup.sh
```

**Manual:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux
python -m pip install -r requirements.txt
cp .env.example .env           # Configure credentials
python main.py                 # http://localhost:8000
```

### Using the PowerShell Script

```powershell
.\scripts\run-backend-local.ps1
```

This automatically creates the venv, installs dependencies, copies `.env.example` if needed, and starts the server with auto-reload.

## Configuration

All settings are loaded from environment variables (or `.env` file) via Pydantic Settings:

| Variable | Default | Description |
|----------|---------|-------------|
| `FIREBASE_CREDENTIALS_JSON` | `""` | JSON string of Firebase credentials (Priority 1, for cloud deployment) |
| `FIREBASE_CREDENTIALS_PATH` | `""` | Path to Firebase service account JSON (Priority 2, for local dev) |
| `FIREBASE_DATABASE_URL` | `""` | Firestore database URL |
| `FIREBASE_WEB_API_KEY` | `""` | Firebase web API key (for web SPA) |
| `FIREBASE_WEB_AUTH_DOMAIN` | `""` | Firebase web auth domain |
| `FIREBASE_WEB_PROJECT_ID` | `""` | Firebase project ID |
| `OPEN_FOOD_FACTS_API` | `https://world.openfoodfacts.org/api/v2` | OFF API base URL |
| `AI_SERVICE_URL` | `None` | Ollama or OpenAI-compatible endpoint |
| `AI_MODEL_NAME` | `llama3.2` | Model name for AI insights |
| `ADMIN_UIDS` | `""` | Comma-separated Firebase UIDs for bootstrap admin access |
| `ALLOWED_ORIGINS` | `["*"]` | CORS allowed origins |
| `ENVIRONMENT` | `development` | `development` or `production` |
| `GOOGLE_MAPS_API_KEY` | `""` | Google Maps API key (for foodbank locations) |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | — | Health check |
| `GET` | `/api/me` | Token | Current user info + Firestore profile |
| `GET` | `/api/config` | — | Public app config (visibility rules, tiers) |
| `GET` | `/api/exchange-rates` | — | Currency conversion rates |
| `POST` | `/api/barcode/scan` | — | Barcode lookup (multi-source) |
| `GET` | `/api/barcode/product/{barcode}` | — | Direct product lookup |
| `POST` | `/api/barcode/contribute` | — | User-contributed product |
| `POST` | `/api/analytics/batch` | — | Batch event sync to Firestore |
| `POST` | `/api/analytics/sync` | — | Legacy sync (backward compat) |
| `GET` | `/api/analytics/stats/{uid}` | Token | Aggregated user statistics |
| `GET` | `/api/analytics/insights/{uid}` | Token | AI-powered insights |
| `GET` | `/api/foodbanks` | — | List foodbanks (optional `?country=`) |
| `GET` | `/api/foodbanks/{id}` | — | Get single foodbank |
| `POST` | `/api/foodbanks/seed` | Admin | Seed Malaysia data |
| `POST` | `/api/foodbanks/refresh` | Admin | Manual refresh |
| `GET/POST/PUT/DELETE` | `/api/admin/*` | Admin | Dashboard, users, inventory, products, pricing, contributed products |

See [API.md](API.md) for complete request/response documentation.

## Barcode Lookup Workflow

The barcode service uses a cascading lookup strategy:

1. Check Firestore `products` collection (previously cached results)
2. Check Firestore `contributed_products` collection (user submissions)
3. Query Open Food Facts API (8s timeout, proper User-Agent header)
4. If found via OFF, cache result to Firestore `products` for future lookups
5. Return `{found, source, product}` with source tracking

Sources: `"firebase"`, `"contributed"`, `"openfoodfacts"`, `"not_found"`

## Analytics Service

### Batch Sync
- Receives events from mobile app in batches
- Groups by `user_id`, writes to `users/{uid}/analytics/` in Firestore
- Handles Firestore 500-document batch limit automatically

### Stats Aggregation
- Queries Firestore for a given user and time period
- Returns counts: scans, items added, consumed, expired, discarded
- Calculates waste percentage and total spending
- Period filtering: `day`, `week`, `month`, `year`, `all`

## AI Insights Engine

Two modes, with automatic fallback:

### AI Mode (when `AI_SERVICE_URL` is set)
- Sends inventory and analytics data summary to Ollama/OpenAI
- Parses structured JSON response into insight cards

### Rule-Based Fallback (default)
Five heuristic analyzers:

| Heuristic | Trigger | Output |
|-----------|---------|--------|
| Waste Reduction | Waste % > threshold | Category-specific waste tips |
| Shopping Frequency | > 3 trips/week | Consolidation suggestion |
| Expiry Warnings | Items expiring in 3 days | Urgent use-by-date alerts |
| Nutrition Balance | Low food group diversity | Missing category suggestions |
| Budget Alerts | Week-over-week increase | Spending trend warning |

Each insight has: `title`, `description`, `priority` (high/medium/low), `category`.

## Dependencies

```
fastapi==0.128.0
uvicorn[standard]==0.40.0
pydantic==2.12.5
pydantic-settings==2.12.0
firebase-admin==7.1.0
httpx==0.28.1
gunicorn==24.1.1
python-multipart==0.0.20
python-dotenv==1.0.1
jinja2==3.1.4
apscheduler==3.10.4
```

## Deployment

### Render (Production)

The project uses Render Blueprint (`render.yaml`) for deployment:

- **Runtime**: Docker (Python 3.11-slim)
- **Build**: Dockerfile with non-root user
- **Process**: Gunicorn with 2 Uvicorn workers
- **Auto-deploy**: Triggers on push to `main` branch
- **Health check**: `GET /health` every 30s

Deploy via:
```powershell
.\scripts\deploy-backend.ps1
```

This pushes to `origin/main` and polls the health endpoint until deployment succeeds.

### Docker (Manual)

```bash
cd backend
docker build -t groceryapp-api .
docker run -p 8000:8000 --env-file .env groceryapp-api
```

### CI/CD

`.github/workflows/backend-deploy.yml` runs on push to `main`:
1. Lint with Ruff
2. Verify all imports resolve
3. Deploy to Render via deploy hook

## Firebase Admin SDK

The backend initializes Firebase Admin SDK in `main.py`:

1. **Priority 1**: `FIREBASE_CREDENTIALS_JSON` env var → parses JSON string → Certificate auth (for cloud deployment on Render)
2. **Priority 2**: `FIREBASE_CREDENTIALS_PATH` file path → Certificate auth (for local development)
3. **Fallback**: Application Default Credentials (for GCP environments)

Firestore collections used by the backend:

```
products/{barcode}                    # Cached OFF product data
contributed_products/{barcode}        # User-submitted product info (with review status)
foodbanks/{id}                        # Global foodbank locations
users/{userId}                        # User profiles (email, tier, role, preferences)
  analytics/{eventId}                 # Analytics events
  grocery_items/{itemId}              # Inventory items (for stats + admin queries)
  shopping_lists/{listId}             # Shopping list metadata
    items/{itemId}                    # List items (nested subcollection)
```

## Authentication

Token-based authentication via Firebase ID tokens:

- **Token sources**: Cookie (`__session`) or `Authorization: Bearer <token>` header
- **Role determination** (priority order):
  1. Firebase custom claims
  2. Firestore user document
  3. Config `ADMIN_UIDS` list
- **Auth dependencies**: `get_optional_user()`, `get_current_user()`, `require_admin()`
- **Roles**: `user` (default), `admin`

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `ModuleNotFoundError` | Run `python -m pip install -r requirements.txt` |
| `pip not recognized` | Use `python -m pip` instead of `pip` |
| Firebase init fails | Check `FIREBASE_CREDENTIALS_PATH` points to valid JSON |
| CORS errors | Add your frontend URL to `ALLOWED_ORIGINS` |
| Port 8000 in use | Kill existing process or change port in `main.py` |

---

# Refactor Phase 2–5 Backend Architecture

Shipped 2026-04. Backend now has a catalog + purchase-events model alongside legacy `grocery_items`. Switchover to the new model for legacy endpoints is flag-gated (`legacy_endpoints_use_new_model`, default `false`).

## Module layout

```
backend/app/
├── core/
│   ├── auth.py              Firebase ID token verification + UserInfo + require_admin
│   ├── config.py            pydantic Settings (env vars)
│   ├── exceptions.py        DomainError + NotFoundError (404) / ConflictError (409) /
│   │                        ValidationError (400) / PermissionError (403) /
│   │                        FeatureDisabledError (404) / RateLimitError (429) /
│   │                        TransientError (503). Mapped to HTTP by main.py handler.
│   ├── feature_flags.py     is_enabled / get_all_flags / require_flag / feature_flag decorator
│   │                        Defaults in DEFAULT_FLAGS. 60s in-process cache.
│   ├── metadata.py          apply_create_metadata / apply_update_metadata — enforces
│   │                        created_at, updated_at, schema_version, created_by, source.
│   └── rate_limit.py        Per-uid in-memory token bucket (60 writes/min).
│
├── schemas/                 Pydantic models (BaseDoc common base)
│   ├── catalog.py           CatalogEntry / Create / Update / MergeRequest
│   ├── purchase.py          PurchaseEvent / Create / Update / StatusUpdate +
│   │                        VALID_STATUSES / VALID_CONSUME_REASONS / VALID_PAYMENT_METHODS
│   ├── country.py           Country + GS1PrefixRange
│   ├── waste.py             HealthScore / HealthComponents / WasteSummary
│   ├── feature_flag.py      FeatureFlags / NudgeThresholds
│   └── reminder.py          Reminder / ReminderDismissRequest
│
├── services/                Business logic (one file per domain)
│   ├── catalog_service.py             CRUD + normalize + merge + counters + cleanup
│   ├── purchase_event_service.py      Create (txn), list, status, FIFO consume, flag expired
│   ├── country_service.py             Seed + GS1 prefix lookup + product backfill
│   ├── nudge_service.py               scan_reminders (scheduler) + list + dismiss
│   ├── waste_service.py               compute_health_score + waste/spending summaries
│   ├── nl_expiry.py                   parse_expiry (tomorrow/next week/ISO/DD-MM-YYYY/etc.)
│   ├── catalog_analysis_service.py    Admin aggregations + promote/flag_spam (audit logged)
│   ├── insights_service.py            (extended) check_user_milestones + check_milestones +
│   │                                  _aggregate_user_stats + _build_milestone_doc + _narrative
│   ├── scheduler.py                   APScheduler: 9 jobs
│   └── compat/
│       └── legacy_item_shim.py        new_event_to_legacy_item / legacy_item_to_new_payload
│
├── api/routes/
│   ├── catalog.py         /api/catalog
│   ├── purchases.py       /api/purchases — POST fires BackgroundTasks(check_user_milestones)
│   ├── countries.py       /api/countries
│   ├── reminders.py       /api/reminders
│   ├── waste.py           /api/waste
│   ├── insights.py        /api/insights
│   ├── admin.py           (+ /api/admin/features + /api/admin/catalog-analysis/*)
│   ├── barcode.py         (+ /api/barcode/{bc}/scan-info)
│   ├── receipt.py         /api/receipt — include-level Depends(require_flag("ocr_enabled"))
│   ├── scan.py            /api/scan    — include-level Depends(require_flag("ocr_enabled"))
│   └── meals.py           /api/meals/scan-recipe gated by recipe_ocr
│
└── tests/services/        pytest suite (73 tests)
    ├── test_nl_expiry.py           28 tests
    ├── test_catalog_normalize.py   27 tests
    ├── test_health_score.py        10 tests
    └── test_milestone_insights.py   8 tests
```

## Key invariants

- **(user_id, name_norm) uniqueness** enforced at the storage layer by doc ID `{user_id}__{name_norm}` — backed up by security rule `entryId == request.auth.uid + "__" + request.resource.data.name_norm` on create.
- **(user_id, barcode) uniqueness** enforced at the application layer via `_check_barcode_not_linked_elsewhere` — raises ConflictError (409) before mutation.
- **Catalog counters** maintained transactionally by `catalog_service.increment_counters_tx`. Drift repair: `scripts/check_catalog_consistency.py --fix`.
- **Status transitions are terminal** — active → used/thrown/transferred; no further changes. Attempting raises ValidationError 400.
- **Every Firestore write goes through `apply_{create,update}_metadata`**. Source values constrained to VALID_SOURCES.

## Scheduler jobs

Registered in `services/scheduler.py`. All refactor jobs are feature-flag gated.

| Job | Schedule | Flag | Purpose |
|---|---|---|---|
| foodbank_scrape | every 10 min | — | legacy |
| exchange_rate_update | daily | — | legacy |
| expiry_check | daily 09:00 | — | legacy grocery_items |
| reminder_scan | daily 08:00 | reminder_scan | 7/14/21-day nudges |
| purchase_expiry_check | daily 09:15 | — | flag expired purchase events |
| catalog_cleanup | Mon 03:00 | catalog_cleanup | delete 365d-stale unlinked catalog entries |
| country_backfill | every 6h | barcode_country_autodetect | fill products.country_code |
| catalog_analysis_refresh | Sun 02:00 | — | rebuild admin aggregation cache |
| milestone_check | hourly | milestone_analytics | emit 50/100/500/1000 insights |

## Data-integrity scripts (`backend/scripts/`)

- `migrate_grocery_items_to_purchases.py` — `--dry-run` default. Idempotent (sets `_migrated=true`). Per-user lock docs at `app_config/migrations/grocery_items_v1/{uid}`.
- `rollback_purchases_migration.py` — requires `--confirm-wipe`. Deletes catalog + purchases for uid(s) and clears `_migrated` markers.
- `check_catalog_consistency.py` — counter drift detector. `--fix` rewrites counters to match actual event counts.
- `fix_orphan_purchases.py` — recreates missing catalog entries from orphan events (sets `needs_review=true` for admin review).

Run these BEFORE `--execute` migration + flipping `legacy_endpoints_use_new_model` in production.

## Firestore security + indexes

- `firestore.rules` — catalog_entries / purchases / reminders / insights / cache / countries rules enforce per-user read + `{uid}__{name_norm}` doc-ID shape on create.
- `firestore.indexes.json` — 16 composite indexes covering:
  - `catalog_entries`: `(user_id, name_norm)`, `(user_id, barcode)`, `(user_id, last_purchased_at DESC)`, `(user_id, total_purchases DESC)`, `(active_purchases, last_purchased_at)`
  - `purchases` (collection + group): `(status, expiry_date)`, `(status, date_bought)`, `(status, consumed_date)`, `(status, barcode)`, `(status, catalog_name_norm)`, `(catalog_name_norm, date_bought)`, `(status, reminder_stage)` as collection-group
  - legacy `grocery_items` retained

## Feature flag defaults

- OFF: `ocr_enabled`, `receipt_scan`, `smart_camera`, `recipe_ocr`, `shelf_audit`, `legacy_endpoints_use_new_model`
- ON: `progressive_nudges`, `financial_tracking`, `insights`, `nl_expiry_parser`, `barcode_country_autodetect`, `catalog_cleanup`, `reminder_scan`, `milestone_analytics`
- Thresholds: `nudge_thresholds={expiry:5, price:10, volume:20}`

See `docs/FEATURE_FLAGS.md` for the full matrix + admin UI description.

## Startup sequence (main.py)

1. Firebase Admin initialized (`FIREBASE_CREDENTIALS_JSON` env → `FIREBASE_CREDENTIALS_PATH` file → ADC fallback)
2. On `@app.on_event("startup")`: `feature_flags.seed_defaults()` merges DEFAULT_FLAGS into `app_config/features`
3. `scheduler.start()` registers 9 jobs
4. Routers mounted; OCR routers get include-level flag guard; refactor routers under `/api/{catalog,purchases,countries,reminders,waste,insights}`
5. Custom exception handlers for `HTTPException` and `DomainError`
6. SPA fallback middleware serves index.html for non-API 404s

## Verification commands

```bash
cd backend && python -m pytest tests/ -q      # 73 tests
cd backend && python -c "import main"         # main.py import smoke (expects 159 routes)
cd backend/web-admin && npx tsc -b             # frontend type check
```
