# Feature Flags

Feature flags let admins toggle experimental/hideable features without redeploying code. Stored in `app_config/features` Firestore doc; cached 60s in-process.

## Storage

```yaml
# Firestore: app_config/features
ocr_enabled: bool                 # Master OCR switch — child flags auto-disable when false
receipt_scan: bool                # Receipt image → cascading OCR → parsed items
smart_camera: bool                # Product label / expiry / shelf audit scans
recipe_ocr: bool                  # Recipe image → ingredient extraction
shelf_audit: bool                 # Shelf/fridge photo → match inventory
progressive_nudges: bool          # Contextual nudges at item-count thresholds
financial_tracking: bool          # Cash/Card toggle + spending summary
insights: bool                    # Milestone analytics (50/100/500/1000)
barcode_country_autodetect: bool  # Auto-fill country_code from GS1 prefix
catalog_cleanup: bool             # Weekly cleanup job (unlinked catalog >365d)
reminder_scan: bool               # Daily 7/14/21-day reminder scan job
milestone_analytics: bool         # Hourly milestone check job
nl_expiry_parser: bool            # Natural language expiry parsing
legacy_endpoints_use_new_model: bool  # Refactor cutover — flip after migration runs (default false)
nudge_thresholds:                 # Per-nudge item count triggers
  expiry: int = 5
  price: int = 10
  volume: int = 20
# Metadata
updated_at: timestamp
updated_by: str                   # admin uid
```

## Reading flags (backend)

`app/core/feature_flags.py`:

```python
import time
from firebase_admin import firestore

_cache: dict[str, Any] = {}
_cache_ts: float = 0.0
_CACHE_TTL = 60.0

def _refresh_cache():
    global _cache, _cache_ts
    doc = firestore.client().collection("app_config").document("features").get()
    _cache = doc.to_dict() or {}
    _cache_ts = time.time()

def is_enabled(flag: str) -> bool:
    """Check if a feature flag is enabled. Fail-open (True) for unknown flags."""
    if time.time() - _cache_ts > _CACHE_TTL:
        _refresh_cache()
    return bool(_cache.get(flag, True))

def get_threshold(name: str, default: int) -> int:
    """Get nudge threshold value."""
    if time.time() - _cache_ts > _CACHE_TTL:
        _refresh_cache()
    return int(_cache.get("nudge_thresholds", {}).get(name, default))
```

## Enforcement

### FastAPI route guard

```python
from fastapi import Depends, HTTPException
from app.core.feature_flags import is_enabled

def require_flag(flag: str):
    def checker():
        if not is_enabled(flag):
            raise HTTPException(404, f"Feature '{flag}' is disabled")
    return Depends(checker)

# Usage:
@router.post("/scan", dependencies=[require_flag("receipt_scan")])
async def scan_receipt(...):
    ...
```

When flag is off → route returns **404 Not Found** (not 403), so it looks like the endpoint doesn't exist. Prevents revealing disabled features.

### Scheduler job guard

```python
from functools import wraps
from app.core.feature_flags import is_enabled

def feature_flag(flag: str):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if not is_enabled(flag):
                logger.info(f"Skipping {fn.__name__}: flag '{flag}' disabled")
                return None
            return fn(*args, **kwargs)
        return wrapper
    return decorator

# Usage:
@feature_flag("reminder_scan")
def scan_reminders():
    ...
```

### Service-level check

```python
def create_purchase(uid: str, data: PurchaseCreate) -> PurchaseEvent:
    if data.expiry_raw and is_enabled("nl_expiry_parser"):
        expiry_date = nl_expiry.parse(data.expiry_raw)
    else:
        expiry_date = data.expiry_date  # ISO only
    ...
```

## Frontend enforcement

Public flags exposed via `GET /api/config` (sensitive admin-only flags redacted). React uses `useFeatureFlags` hook with 60s React Query stale time.

```tsx
const { data: flags } = useFeatureFlags();

return (
    <div>
        {flags?.ocr_enabled && <ScanReceiptButton />}
        {flags?.financial_tracking && <PaymentMethodToggle />}
    </div>
);
```

When admin toggles off → 60s cache TTL → React Query refetches → button disappears.

## Child flag dependencies

Some flags depend on parent flags. When parent is off, children are auto-disabled in UI and API:

- `ocr_enabled = false` → `receipt_scan`, `smart_camera`, `recipe_ocr`, `shelf_audit` all grayed out (shown disabled, can't be toggled on individually)
- `insights = false` → `milestone_analytics` scheduler job doesn't run
- `progressive_nudges = false` → `nudge_thresholds` irrelevant

Dependency graph encoded in `FeatureFlagsTab.tsx`:

```typescript
const FLAG_DEPS = {
  receipt_scan: ['ocr_enabled'],
  smart_camera: ['ocr_enabled'],
  recipe_ocr: ['ocr_enabled'],
  shelf_audit: ['ocr_enabled'],
  milestone_analytics: ['insights'],
};
```

## Admin UI

New tab in Admin Settings: `FeatureFlagsTab.tsx`.

For each flag, show:
- Title + description
- Toggle (disabled if parent flag is off)
- "Dependencies" list (which flags require this one)
- "Used by" list (which services/routes reference this flag)
- "Currently enabled for" (always "all tiers" for now; future: per-tier)
- Save triggers PATCH `/api/admin/features`

## Audit

Every change persists:
- `updated_at: SERVER_TIMESTAMP`
- `updated_by: <admin_uid>`

Future: `app_config/features_audit/{id}` — full history of toggles.

## Default values

All flags default to `true` on first read (fail-open for unknown keys). Initial seed creates the doc with refactor-appropriate defaults:

```yaml
ocr_enabled: false                # Hidden during refactor
receipt_scan: false
smart_camera: false
recipe_ocr: false
shelf_audit: false
progressive_nudges: true
financial_tracking: true
insights: true
barcode_country_autodetect: true
catalog_cleanup: true
reminder_scan: true
milestone_analytics: true
nl_expiry_parser: true
legacy_endpoints_use_new_model: false   # Flip after running scripts/migrate_grocery_items_to_purchases.py --execute
nudge_thresholds: {expiry: 5, price: 10, volume: 20}
```

## Public endpoint (added Phase 5a)

Non-admin frontend components need to read flags for UI gating. `/api/admin/features` is admin-only, so a public-safe subset is exposed at `/api/features/public` — returns only display-safe flags (`ocr_enabled`, `receipt_scan`, `smart_camera`, `recipe_ocr`, `shelf_audit`, `progressive_nudges`, `financial_tracking`, `insights`, `nl_expiry_parser`, `legacy_endpoints_use_new_model`). The `useFeatureFlags` frontend hook routes to either endpoint based on `useAuthStore.isAdmin`.

## Route-level flag gate (added Phase 6a)

`components/layout/FeatureFlagGate.tsx` wraps routes that should vanish when a flag is off. Used on `/admin-settings/test-scan` (gated by `ocr_enabled` → redirects to `/admin-settings`).

Seed logic in `feature_flag_service.seed_defaults()` runs on app startup if doc doesn't exist.
