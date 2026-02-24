# Backend Documentation

## Overview

The GroceryApp backend is a Python FastAPI application that provides barcode scanning, analytics aggregation, and AI-powered insights. It uses Firebase Admin SDK for Firestore and Auth, and is deployed to Render.com via Docker.

## Architecture

```
backend/
├── main.py                        # App entry, Firebase init, CORS, routers
├── app/
│   ├── core/
│   │   └── config.py              # Pydantic settings from environment
│   ├── schemas/
│   │   ├── barcode.py             # Barcode request/response models
│   │   └── analytics.py           # Analytics + insights models
│   ├── services/
│   │   ├── barcode_service.py     # Firebase + OFF lookup, contribute
│   │   ├── analytics_service.py   # Batch sync, stats aggregation
│   │   └── insights_service.py    # AI + rule-based insights engine
│   └── api/routes/
│       ├── barcode.py             # /api/barcode/* endpoints
│       └── analytics.py           # /api/analytics/* endpoints
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
| `FIREBASE_CREDENTIALS_PATH` | `""` | Path to Firebase service account JSON |
| `FIREBASE_DATABASE_URL` | `""` | Firestore database URL |
| `OPEN_FOOD_FACTS_API` | `https://world.openfoodfacts.org/api/v2` | OFF API base URL |
| `AI_SERVICE_URL` | `None` | Ollama or OpenAI-compatible endpoint |
| `AI_MODEL_NAME` | `llama3.2` | Model name for AI insights |
| `ALLOWED_ORIGINS` | `["*"]` | CORS allowed origins |
| `ENVIRONMENT` | `development` | `development` or `production` |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | API info (name + version) |
| `GET` | `/health` | Health check |
| `POST` | `/api/barcode/scan` | Barcode lookup (multi-source) |
| `GET` | `/api/barcode/product/{barcode}` | Direct product lookup |
| `POST` | `/api/barcode/contribute` | User-contributed product |
| `POST` | `/api/analytics/batch` | Batch event sync to Firestore |
| `POST` | `/api/analytics/sync` | Legacy sync (backward compat) |
| `GET` | `/api/analytics/stats/{user_id}` | Aggregated user statistics |
| `GET` | `/api/analytics/insights/{user_id}` | AI-powered insights |

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

1. If `FIREBASE_CREDENTIALS_PATH` points to a valid file → uses Certificate auth
2. Otherwise → falls back to Application Default Credentials (for Render/Cloud Run)

Firestore collections used by the backend:

```
products/{barcode}                    # Cached OFF product data
contributed_products/{barcode}        # User-submitted product info
users/{userId}/
  analytics/{eventId}                 # Analytics events
  grocery_items/{itemId}              # Inventory items (for stats)
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `ModuleNotFoundError` | Run `python -m pip install -r requirements.txt` |
| `pip not recognized` | Use `python -m pip` instead of `pip` |
| Firebase init fails | Check `FIREBASE_CREDENTIALS_PATH` points to valid JSON |
| CORS errors | Add your frontend URL to `ALLOWED_ORIGINS` |
| Port 8000 in use | Kill existing process or change port in `main.py` |
