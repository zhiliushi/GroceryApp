# API Reference

**Base URL**: `http://localhost:8000` (development) | `https://groceryapp-api.onrender.com` (production)

**Interactive docs**: `{base_url}/docs` (Swagger UI) | `{base_url}/redoc` (ReDoc)

---

## Health & Info

### GET /

Returns API info.

**Response:**
```json
{
  "message": "GroceryApp API",
  "version": "2.0.0"
}
```

### GET /health

Health check endpoint used by Render for deployment verification.

**Response:**
```json
{
  "status": "healthy"
}
```

---

## Barcode Endpoints

### POST /api/barcode/scan

Lookup a barcode using the cascading multi-source strategy.

**Request:**
```json
{
  "barcode": "5901234123457",
  "user_id": "firebase-uid-123"
}
```

**Response (found):**
```json
{
  "found": true,
  "source": "openfoodfacts",
  "product": {
    "barcode": "5901234123457",
    "name": "Organic Whole Milk",
    "brand": "Farm Fresh",
    "image_url": "https://images.openfoodfacts.org/...",
    "categories": "Dairy, Milk",
    "nutrition_grade": "b",
    "ingredients_text": "Whole milk",
    "nutriments": {
      "energy_kcal": 64,
      "fat": 3.5,
      "carbohydrates": 4.7,
      "proteins": 3.3
    }
  }
}
```

**Response (not found):**
```json
{
  "found": false,
  "source": "not_found",
  "product": null
}
```

**Source values**: `"firebase"`, `"contributed"`, `"openfoodfacts"`, `"not_found"`

### GET /api/barcode/product/{barcode}

Direct barcode lookup without full pipeline.

**Parameters:**
- `barcode` (path) — The barcode string

**Response:** Same format as `/scan` response.

**Error (404):**
```json
{
  "detail": "Product not found"
}
```

### POST /api/barcode/contribute

Submit a user-contributed product for an unrecognized barcode.

**Request:**
```json
{
  "barcode": "1234567890123",
  "product_name": "Local Organic Yogurt",
  "brand": "FarmHouse",
  "category": "Dairy",
  "image_url": "https://firebasestorage.googleapis.com/..."
}
```

**Validation:**
- `barcode`: required, non-empty
- `product_name`: required, minimum 2 characters
- `brand`: optional
- `category`: optional
- `image_url`: optional

**Response:**
```json
{
  "status": "saved",
  "barcode": "1234567890123",
  "message": "Product contribution saved"
}
```

**Backend behavior:**
1. Saves to Firestore `contributed_products/{barcode}` (merge mode, `pending_review` status)
2. Best-effort submission to Open Food Facts Write API (non-blocking)

---

## Analytics Endpoints

### POST /api/analytics/batch

Sync a batch of analytics events to Firestore.

**Request:**
```json
{
  "events": [
    {
      "event_type": "barcode_scan",
      "event_data": "{\"barcode\":\"123\",\"source\":\"openfoodfacts\"}",
      "timestamp": 1706659200000,
      "user_id": "firebase-uid-123"
    },
    {
      "event_type": "item_added",
      "event_data": "{\"name\":\"Milk\",\"categoryId\":\"abc\"}",
      "timestamp": 1706659300000,
      "user_id": "firebase-uid-123"
    }
  ]
}
```

**Limits:**
- Maximum 500 events per batch (Firestore batch write limit)
- Events grouped by `user_id` internally

**Response:**
```json
{
  "synced": 2,
  "errors": []
}
```

**Error Response:**
```json
{
  "synced": 1,
  "errors": ["Failed to sync event at index 1: ..."]
}
```

### POST /api/analytics/sync

Legacy sync endpoint. Same behavior as `/batch`, maintained for backward compatibility.

### GET /api/analytics/stats/{user_id}

Aggregated statistics for a user.

**Parameters:**
- `user_id` (path) — Firebase UID
- `period` (query, optional) — `day`, `week`, `month`, `year`, `all` (default: `all`)

**Response:**
```json
{
  "user_id": "firebase-uid-123",
  "period": "month",
  "stats": {
    "total_scans": 47,
    "items_added": 32,
    "items_consumed": 25,
    "items_expired": 3,
    "items_discarded": 2,
    "waste_percentage": 9.4,
    "total_spent": 245.50,
    "unique_categories": 7
  }
}
```

**Period filtering:** Converts period to epoch-millis cutoff timestamp. `day` = last 24h, `week` = last 7d, `month` = last 30d, `year` = last 365d, `all` = no filter.

### GET /api/analytics/insights/{user_id}

AI-powered insights with rule-based fallback.

**Parameters:**
- `user_id` (path) — Firebase UID

**Response:**
```json
{
  "user_id": "firebase-uid-123",
  "insights": [
    {
      "title": "Reduce Dairy Waste",
      "description": "You've wasted 4 dairy items this month. Consider buying smaller quantities or checking expiry dates before purchasing.",
      "priority": "high",
      "category": "waste_reduction"
    },
    {
      "title": "Shopping Frequency",
      "description": "You've shopped 5 times this week. Consider planning weekly trips to save time and reduce impulse purchases.",
      "priority": "medium",
      "category": "shopping_optimization"
    },
    {
      "title": "Use Yogurt Soon",
      "description": "Your yogurt expires in 2 days. Consider using it in a smoothie or parfait.",
      "priority": "high",
      "category": "expiry_warning"
    }
  ],
  "generated_at": 1706659200000,
  "source": "rules"
}
```

**Insight categories:** `waste_reduction`, `shopping_optimization`, `expiry_warning`, `nutrition_balance`, `budget_alert`

**Priority levels:** `high`, `medium`, `low`

**Source:** `"ai"` (when AI_SERVICE_URL configured) or `"rules"` (default fallback)

---

## Error Responses

All endpoints return standard error responses:

### 400 Bad Request
```json
{
  "detail": "Validation error: barcode is required"
}
```

### 404 Not Found
```json
{
  "detail": "Product not found"
}
```

### 422 Unprocessable Entity (Pydantic validation)
```json
{
  "detail": [
    {
      "loc": ["body", "product_name"],
      "msg": "String should have at least 2 characters",
      "type": "string_too_short"
    }
  ]
}
```

### 500 Internal Server Error
```json
{
  "detail": "Internal server error"
}
```

---

## Event Types Reference

Valid values for `event_type` in analytics events:

| Event Type | Description | Key Data Fields |
|-----------|-------------|-----------------|
| `barcode_scan` | Barcode scanned | barcode, source, found |
| `item_added` | Item added to inventory | name, categoryId, source |
| `item_removed` | Item removed from inventory | name, categoryId |
| `item_consumed` | Item consumed/used up | name, reason, daysOwned |
| `item_deleted` | Item permanently deleted | itemId, name |
| `item_expired_wasted` | Item expired or wasted | name, daysExpired |
| `item_scanned` | Barcode scan initiated | barcode |
| `scan_promoted` | Stage 1 → Stage 2 promotion | barcode, name |
| `scan_discarded` | Stage 1 scan discarded | barcode |
| `list_created` | Shopping list created | listName |
| `list_completed` | Shopping list completed | listName, itemCount |
| `purchase_recorded` | Purchase logged | amount, itemCount |
| `sync_completed` | Cloud sync finished | itemsSynced, eventsSynced |
| `app_opened` | App launched | |
| `category_changed` | Item category updated | itemId, oldCategory, newCategory |
| `settings_changed` | User settings modified | setting, value |
| `search_performed` | Search executed | query, resultCount |
| `item_shared` | Item shared (paid) | itemId |
| `recipe_viewed` | Recipe viewed (paid) | recipeId, recipeName |
| `screen_view` | Screen navigation | screenName |
| `feature_used` | Feature interaction | featureName, details |

---

## CORS

The backend allows cross-origin requests from origins specified in `ALLOWED_ORIGINS` environment variable. Default: `["*"]` (all origins).

## Rate Limiting

No rate limiting is currently implemented. The Open Food Facts API has its own rate limits — the backend uses proper User-Agent headers and caches results in Firestore to minimize external calls.
