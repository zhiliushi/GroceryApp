# GroceryApp Backend API

FastAPI backend for GroceryApp — barcode scanning, analytics sync, and AI-powered grocery insights.

## Features

- **Barcode Scanning**: Firebase-first lookup with Open Food Facts fallback
- **Product Contributions**: Users contribute unknown products to shared database
- **Analytics Batch Sync**: Mobile app syncs events to Firestore in batches
- **Stats Aggregation**: Purchase, waste, and spending stats by period
- **AI Insights**: Ollama/OpenAI-powered insights with rule-based fallback
- **Firebase Integration**: Firestore for data, Firebase Auth for users

## Quick Start

### Windows

```bash
cd backend
scripts\setup.bat
venv\Scripts\activate
python main.py
```

### macOS / Linux

```bash
cd backend
chmod +x scripts/setup.sh
./scripts/setup.sh
source venv/bin/activate
python main.py
```

Server starts at `http://localhost:8000`. API docs at `http://localhost:8000/docs`.

### Manual Setup

```bash
python -m venv venv
venv\Scripts\activate          # Windows
source venv/bin/activate       # macOS/Linux
python -m pip install -r requirements.txt
cp .env.example .env           # Edit with your credentials
python main.py
```

## Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your GroceryApp project
3. Enable **Firestore Database** (if not already)
4. Go to **Project Settings > Service Accounts**
5. Click **Generate New Private Key**
6. Save as `serviceAccountKey.json` in the `backend/` directory
7. Update `.env`:
   ```
   FIREBASE_CREDENTIALS_PATH=serviceAccountKey.json
   FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
   ```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FIREBASE_CREDENTIALS_PATH` | Yes | — | Path to Firebase service account JSON |
| `FIREBASE_DATABASE_URL` | Yes | — | Firestore database URL |
| `ENVIRONMENT` | No | `development` | `development` or `production` |
| `ALLOWED_ORIGINS` | No | `["*"]` | CORS allowed origins (JSON array) |
| `OPEN_FOOD_FACTS_API` | No | `https://world.openfoodfacts.org/api/v2` | OFF API base URL |
| `AI_SERVICE_URL` | No | — | Ollama or OpenAI-compatible endpoint |
| `AI_MODEL_NAME` | No | `llama3.2` | AI model name |

## API Endpoints

### Health

```
GET /health
→ {"status": "healthy"}
```

### Barcode

#### Scan Barcode
```
POST /api/barcode/scan
Content-Type: application/json

{"barcode": "012345678905", "user_id": "optional-uid"}

→ {
    "found": true,
    "source": "openfoodfacts",
    "product": {
      "barcode": "012345678905",
      "product_name": "Example Product",
      "brands": "Brand",
      "categories": "Snacks",
      "image_url": "https://...",
      "nutrition_data": {...}
    }
  }
```

Lookup order: Firestore `products` → Firestore `contributed_products` → Open Food Facts API.

#### Get Product
```
GET /api/barcode/product/{barcode}
```

#### Contribute Product
```
POST /api/barcode/contribute
Content-Type: application/json

{
  "barcode": "012345678905",
  "name": "My Product",
  "brand": "Brand",
  "category": "Snacks",
  "image_url": "https://...",
  "contributed_by": "user-uid"
}

→ {"success": true, "message": "Product 012345678905 contributed successfully"}
```

### Analytics

#### Batch Sync Events
```
POST /api/analytics/batch
Content-Type: application/json

{
  "events": [
    {
      "event_type": "item_added",
      "event_data": {"name": "Milk", "price": 3.99},
      "timestamp": 1706572800000,
      "user_id": "user-uid"
    }
  ]
}

→ {"success": true, "synced_count": 1}
```

#### Legacy Sync (backward compat)
```
POST /api/analytics/sync
```
Same request/response as `/batch`.

#### Get Stats
```
GET /api/analytics/stats/{user_id}?period=month

→ {
    "user_id": "user-uid",
    "period": "month",
    "stats": {
      "total_scans": 45,
      "items_added": 32,
      "items_consumed": 28,
      "items_expired": 3,
      "items_discarded": 1,
      "waste_percentage": 12.5,
      "total_spent": 187.43,
      "event_count": 120
    }
  }
```

Period options: `day`, `week`, `month`, `year`, `all`.

#### AI Insights
```
GET /api/analytics/insights/{user_id}?period=month

→ {
    "insights": [
      {
        "title": "3 items expiring soon",
        "description": "Use Milk, Yogurt, Bread before they expire.",
        "priority": "high",
        "category": "expiry_warning"
      }
    ],
    "generated_at": 1706572800000
  }
```

## Project Structure

```
backend/
├── main.py                           # FastAPI app, Firebase init, CORS
├── Dockerfile                        # Docker image (Python 3.11-slim)
├── Procfile                          # Gunicorn start command
├── render.yaml                       # Render deployment config
├── requirements.txt                  # Python dependencies
├── .env.example                      # Environment variable template
├── scripts/
│   ├── setup.bat                     # Windows setup script
│   └── setup.sh                      # macOS/Linux setup script
└── app/
    ├── core/
    │   └── config.py                 # Pydantic settings
    ├── schemas/
    │   ├── barcode.py                # Barcode request/response models
    │   └── analytics.py              # Analytics + insights models
    ├── services/
    │   ├── barcode_service.py        # Firebase + OFF lookup, contribute
    │   ├── analytics_service.py      # Batch sync, stats aggregation
    │   └── insights_service.py       # AI + rule-based insights
    └── api/routes/
        ├── barcode.py                # /api/barcode/* endpoints
        └── analytics.py              # /api/analytics/* endpoints
```

## Docker

### Build and Run

```bash
docker build -t groceryapp-api .
docker run -p 8000:8000 --env-file .env groceryapp-api
```

## Deploy to Render

### Option 1: Blueprint (render.yaml)

1. Push code to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com/)
3. Click **New > Blueprint**
4. Connect your repo — Render reads `render.yaml` automatically
5. Set secret env vars in the dashboard:
   - `FIREBASE_CREDENTIALS_PATH`
   - `FIREBASE_DATABASE_URL`

### Option 2: Manual

1. **New > Web Service** on Render
2. Connect GitHub repo, set root directory to `backend/`
3. **Environment**: Docker
4. **Health Check Path**: `/health`
5. Set environment variables in dashboard
6. Deploy

### Firebase on Render

Two options for Firebase credentials on Render:

**Option A — Service account file**: Upload `serviceAccountKey.json` as a secret file and set `FIREBASE_CREDENTIALS_PATH` to its path.

**Option B — Application Default Credentials**: Set `GOOGLE_APPLICATION_CREDENTIALS` env var to the service account JSON path. Firebase Admin SDK picks it up automatically.

## Troubleshooting

### "Firebase initialized with Application Default Credentials"
No `serviceAccountKey.json` found. Server starts but Firestore operations will fail. Set `FIREBASE_CREDENTIALS_PATH` in `.env`.

### CORS Errors
Update `ALLOWED_ORIGINS` in `.env`:
```
ALLOWED_ORIGINS=["http://localhost:8081", "http://localhost:3000"]
```

### Port Already in Use
```bash
python -m uvicorn main:app --port 8001 --reload
```

### Python 3.14 Compatibility
All pinned dependencies have prebuilt wheels for Python 3.14. If you hit build issues, ensure `pydantic>=2.12` (pulls `pydantic-core>=2.39`).

## License

Copyright 2026 GroceryApp. All rights reserved.
