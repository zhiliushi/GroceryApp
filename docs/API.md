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

## Authentication

### Token Sources

The backend accepts Firebase ID tokens from two sources (checked in order):
1. Cookie: `__session`
2. Header: `Authorization: Bearer <token>`

### Auth Dependencies

| Dependency | Effect |
|-----------|--------|
| `get_optional_user()` | Returns `UserInfo` if token present, `None` otherwise |
| `get_current_user()` | Returns `UserInfo`, raises 401 if not authenticated |
| `require_admin()` | Returns `UserInfo` with admin role, raises 403 otherwise |

### Role Determination (priority order)

1. Firebase custom claims (`admin` claim)
2. Firestore `users/{uid}` document `role` field
3. `ADMIN_UIDS` env var (comma-separated bootstrap list)

---

## App Config & Utility Endpoints

### GET /api/me

Returns the current authenticated user's info merged with Firestore profile.

**Auth:** Optional (returns `{authenticated: false}` if no token)

**Response (authenticated):**
```json
{
  "authenticated": true,
  "uid": "firebase-uid-123",
  "email": "user@example.com",
  "role": "admin",
  "display_name": "John",
  "tier": "plus",
  "status": "active",
  "selected_tools": ["cloud_sync", "price_tracking"],
  "country": "MY",
  "currency": "MYR"
}
```

### GET /api/config

Public app configuration — visibility rules and tier definitions. No auth required.

**Response:**
```json
{
  "visibility": { ... },
  "tiers": { ... }
}
```

### GET /api/exchange-rates

Public exchange rates for currency conversion. No auth required.

---

## Foodbank Endpoints

### GET /api/foodbanks

List all active foodbanks, optionally filtered by country.

**Parameters:**
- `country` (query, optional) — ISO country code (e.g. `MY`, `US`)

**Response:**
```json
{
  "count": 15,
  "foodbanks": [
    {
      "id": "abc123",
      "name": "Food Aid Foundation",
      "country": "MY",
      "state": "Selangor",
      "location_name": "Shah Alam HQ",
      "location_address": "...",
      "latitude": 3.07,
      "longitude": 101.5,
      "is_active": true
    }
  ]
}
```

### GET /api/foodbanks/sources

List all foodbank data sources with their current status.

### POST /api/foodbanks/sources/{source_id}/fetch

Manually trigger a fetch from a single source. **Requires admin.**

### POST /api/foodbanks/sources/{source_id}/reset

Reset a source's cooldown. **Requires admin.**

### POST /api/foodbanks/sources/{source_id}/toggle

Enable or disable a foodbank source. **Requires admin.**

### GET /api/foodbanks/{id}

Get a single foodbank by ID.

### POST /api/foodbanks

Create a new foodbank. **Requires admin.**

### PUT /api/foodbanks/{id}

Update a foodbank. **Requires admin.**

### DELETE /api/foodbanks/{id}

Delete a foodbank permanently. **Requires admin.**

### PATCH /api/foodbanks/{id}/toggle

Toggle a foodbank's active status. **Requires admin.**

### POST /api/foodbanks/{id}/refresh

Re-fetch and update a single foodbank entry. **Requires admin.**

### POST /api/foodbanks/seed

Seed Malaysian foodbank data. Safe to call multiple times (deduplicates).

### POST /api/foodbanks/refresh

Trigger a manual refresh (scrape sources for new entries).

---

## Admin Endpoints

All admin endpoints require admin role (`/api/admin/*`).

### Dashboard

#### GET /api/admin/dashboard

Aggregate stats for the admin dashboard.

### Users

#### GET /api/admin/users

List all users. **Params:** `limit` (1-200, default 50), `offset` (default 0).

#### GET /api/admin/users/{uid}

Get a single user profile.

#### PUT /api/admin/users/{uid}/role

Set a user's role. **Body:** `{"role": "admin"|"user"}`

#### PUT /api/admin/users/{uid}/tier

Change subscription tier. **Body:** `{"tier": "free"|"plus"|"pro"}`

#### PUT /api/admin/users/{uid}/status

Enable or disable a user. **Body:** `{"status": "active"|"disabled", "reason": "..."}`

#### PUT /api/admin/users/{uid}/approve

Approve a pending user.

#### DELETE /api/admin/users/{uid}

Delete a user completely (Firestore + Firebase Auth).

#### PUT /api/admin/users/{uid}/tools

Update a Smart Cart user's selected tools. **Body:** `{"selected_tools": [...]}`

### App Configuration

#### GET /api/admin/config/visibility

Get page visibility configuration.

#### PUT /api/admin/config/visibility

Update page visibility configuration.

#### GET /api/admin/config/tiers

Get tier definitions.

#### PUT /api/admin/config/tiers

Update tier definitions.

### Inventory

#### GET /api/admin/inventory

List inventory items across all users. **Params:** `limit`, `offset`, `status`, `needs_review`, `location`.

#### GET /api/admin/inventory/{uid}/{item_id}

Get a single inventory item.

#### PUT /api/admin/inventory/{uid}/{item_id}

Update an inventory item.

### Shopping Lists

#### GET /api/admin/shopping-lists

List shopping lists across all users. **Params:** `limit`.

#### GET /api/admin/shopping-lists/{uid}/{list_id}

Get a shopping list with its items.

### Contributed Products (Review Queue)

#### GET /api/admin/contributed

List contributed products. **Params:** `limit`, `offset`, `search`, `status`.

#### GET /api/admin/contributed/counts

Get contributed product counts by status.

#### POST /api/admin/contributed/{barcode}/approve

Approve a contributed product.

#### POST /api/admin/contributed/{barcode}/reject

Reject a contributed product. **Params:** `reason` (query string).

#### DELETE /api/admin/contributed/{barcode}

Delete a single contributed product.

#### POST /api/admin/contributed/batch-delete

Batch delete. **Body:** `{"barcodes": [...]}`

### Needs Review

#### GET /api/admin/needs-review

Get inventory items flagged for review. **Params:** `limit`.

### Products (Database Management)

#### GET /api/admin/products/lookup/{barcode}

Lookup a barcode on Open Food Facts for pre-filling the form.

#### GET /api/admin/products

List all products. **Params:** `limit`, `offset`, `search`.

#### GET /api/admin/products/{barcode}

Get a single product.

#### POST /api/admin/products

Create a new product. **Body:** `{"barcode": "...", "name": "...", ...}`

#### PUT /api/admin/products/{barcode}

Update an existing product.

#### DELETE /api/admin/products/{barcode}

Delete a product.

### Price Records

#### GET /api/admin/price-records

List price records across all users. **Params:** `limit`, `offset`, `search`, `barcode`.

#### DELETE /api/admin/price-records/{user_id}/{record_id}

Delete a single price record.

#### POST /api/admin/price-records/batch-delete

Batch delete. **Body:** `{"records": [{"user_id": "...", "record_id": "..."}, ...]}`

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

Per-user in-memory token bucket: 60 writes/min, keyed by Firebase UID (`app.core.rate_limit.rate_limit`). Applied on write-path refactor endpoints (POST/PATCH/DELETE `/api/purchases`, `/api/catalog`, `/api/reminders`). Exceeds → 429 with `Retry-After` header. Admin/unauthenticated requests bypass. Open Food Facts traffic caches via `products/` collection.

---

# Refactor Phase 2–5 Endpoints (catalog + purchases + waste + insights)

All refactor endpoints require Firebase auth via `__session` cookie or `Authorization: Bearer <token>`. Admin endpoints additionally require `role=admin`. Errors are mapped from `DomainError` subclasses (`NotFoundError` → 404, `ConflictError` → 409, `ValidationError` → 400, `FeatureDisabledError` → 404, `RateLimitError` → 429, `TransientError` → 503).

## Catalog (`/api/catalog`)

User's personal reusable name catalog. Doc ID format: `{user_id}__{name_norm}`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/catalog` | List. Query: `?q=<prefix>&sort_by=last_purchased_at\|total_purchases\|display_name&limit=` |
| GET | `/api/catalog/lookup/barcode/{barcode}` | Find caller's catalog entry by barcode — returns `{entry: null}` if none |
| GET | `/api/catalog/{name_norm}` | Entry + `history` array (last 20 purchase events) |
| PATCH | `/api/catalog/{name_norm}` | Partial update: `display_name` / `barcode` (pass `""` to unlink) / `default_location` / `default_category` |
| POST | `/api/catalog/{name_norm}/merge` | Body `{target_name_norm}` — reparents all purchases to target, deletes source |
| DELETE | `/api/catalog/{name_norm}?force=false` | 409 if `active_purchases > 0` unless `force=true` |

## Purchases (`/api/purchases`)

Purchase events — one per shopping trip / individual buy.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/purchases` | Create (transactional catalog upsert + event + counter increment). Body: `name` OR `catalog_name_norm` (one required), `barcode?`, `quantity=1.0`, `expiry_raw?` (NL string), `expiry_date?`, `price?`, `currency?`, `payment_method?` (cash\|card), `location?`, `date_bought?`. **Fires milestone check via BackgroundTasks.** |
| GET | `/api/purchases` | List. Query: `?status=&location=&catalog_name_norm=&limit=` |
| GET | `/api/purchases/{event_id}` | Single event |
| PATCH | `/api/purchases/{event_id}` | Partial update (NOT status). Fields: `quantity`, `unit`, `expiry_raw`, `expiry_date`, `price`, `payment_method`, `location` |
| POST | `/api/purchases/{event_id}/status` | Terminal status transition. Body: `{status: used\|thrown\|transferred, reason?: used_up\|expired\|bad\|gift, transferred_to?}` |
| POST | `/api/purchases/consume` | FIFO consume by catalog. Body: `{catalog_name_norm, quantity=1}` — marks oldest-expiry active events as used |
| DELETE | `/api/purchases/{event_id}` | Hard delete (prefer status transition for history) |

## Countries (`/api/countries`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/countries` | Seeded list (MY, SG, ID, TH, US, GB, CN, JP, KR, AU) with GS1 prefix ranges |
| GET | `/api/countries/lookup/{barcode}` | 3-digit GS1 prefix → ISO country code → `{barcode, country_code}` |

## Reminders (`/api/reminders`)

7/14/21-day nudges written by `nudge_service.scan_reminders` scheduler (daily 08:00 UTC).

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/reminders?include_dismissed=false&limit=20` | List (stage desc) |
| GET | `/api/reminders/{reminder_id}` | Single |
| POST | `/api/reminders/{reminder_id}/dismiss` | Body: `{action: used\|thrown\|still_have\|snooze, reason?}`. `used`/`thrown` also transition the linked purchase event. |

## Waste + Spending + Health Score (`/api/waste`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/waste/summary?period=week\|month\|year\|all` | Thrown count + value + top-10 wasted |
| GET | `/api/waste/spending?period=...` | Cash / card / untracked totals |
| GET | `/api/waste/health-score?no_cache=false` | Score 0-100, grade green/yellow/red, components, `waste_rate_month`. Cached 5min at `users/{uid}/cache/health`. See `docs/HEALTH_SCORE.md`. |

## Insights (`/api/insights`)

Milestone-driven insight docs emitted at 50/100/500/1000 total purchases.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/insights` | Active (non-dismissed) insights. Gated behind `insights` flag — returns `{count:0, insights:[]}` when off. Rich content: `top_purchased`, `waste_breakdown`, `spending`, `shopping_frequency`, `avoid_list`, `description` narrative. |
| GET | `/api/insights/{insight_id}` | Single |
| POST | `/api/insights/{insight_id}/dismiss` | Mark dismissed |

## Barcode scan-info (`/api/barcode/.../scan-info`)

Unified post-scan result for the new catalog+purchases model.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/barcode/{barcode}/scan-info?user_id=` | Returns `{barcode, country_code, user_catalog_match, global_product, user_history: {count_purchased, active_stock, last_bought, avg_price, waste_rate, active_items}, suggested_actions[]}` |

## Feature Flags

Public subset (no auth) used by UI gating; full set (admin) used by `FeatureFlagsTab`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/features/public` | Subset: `ocr_enabled`, `receipt_scan`, `smart_camera`, `recipe_ocr`, `shelf_audit`, `progressive_nudges`, `financial_tracking`, `insights`, `nl_expiry_parser`, `legacy_endpoints_use_new_model` |
| GET | `/api/admin/features` | Full flag dict (admin-only) |
| PATCH | `/api/admin/features` | Body: `{<flag>: <value>, ...}`. Rejects unknown flags. Invalidates 60s in-process cache immediately. See `docs/FEATURE_FLAGS.md`. |

## Admin catalog analysis (`/api/admin/catalog-analysis`)

Cross-user aggregations. Cached at `app_config/catalog_analysis_cache` — refreshed weekly (Sun 02:00) or via `?refresh=true`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/catalog-analysis?refresh=false` | `{barcode_to_names[], no_barcode_names[], cleanup_preview[], computed_at}` |
| POST | `/api/admin/catalog-analysis/promote` | Body: `{barcode, canonical_name}` — writes global `products/{barcode}` + audit log |
| POST | `/api/admin/catalog-analysis/flag-spam` | Body: `{barcode, reason?}` |

See `docs/ADMIN_CATALOG_ANALYSIS.md`.

## Legacy endpoints (backward-compat shim)

Old mobile endpoints (`/api/inventory/my`, `/api/barcode/{bc}/add-to-inventory`, `/api/barcode/{bc}/use-one`, `/api/barcode/{bc}/inventory`) continue to work. When feature flag `legacy_endpoints_use_new_model=true` (flip after running migration), they serve from the new catalog+purchases model via `app/services/compat/legacy_item_shim.py` — response shape translated back to legacy `grocery_items` format. Default is `false` to preserve pre-migration behaviour.

## OCR-gated endpoints

`/api/receipt/*` and `/api/scan/*` routers are mounted with `Depends(require_flag("ocr_enabled"))`. When OFF → 404. Recipe OCR `/api/meals/scan-recipe` is gated by `recipe_ocr`.
