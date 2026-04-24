# Admin Catalog Analysis

Cross-user aggregation view for the admin to monitor data quality, identify patterns, and promote user-contributed content to the global products catalog.

## Purpose

Users build up personal catalogs (name + optional barcode) over time. The admin view surfaces:

- **Naming inconsistencies** — same barcode, different user-provided names (e.g. "Milk" vs "Susu" vs "DL Milk" for 9555...)
- **Unnamed barcodes** — barcodes users scanned but didn't associate with a catalog entry
- **Popular unnamed items** — user-entered names without barcodes that appear across many users (candidates for global catalog addition)
- **Data quality** — catalog entries about to be auto-cleaned up
- **Spam/abuse** — bulk nonsense entries flagged for review

## Access

Admin-only page: `/admin/catalog-analysis`. Route protected by `Depends(require_admin)`.

## UI structure

```
┌──────────────────────────────────────────────────────────┐
│  Catalog Analysis                       [Refresh now]   │
│  Last analysed: 2h ago · 1,234 entries · 45 anomalies    │
├──────────────────────────────────────────────────────────┤
│  TABS: [Barcode→Names] [Unnamed] [No-Barcode] [Cleanup]  │
├──────────────────────────────────────────────────────────┤
│  ... tab content ...                                     │
└──────────────────────────────────────────────────────────┘
```

### Tab: Barcode → Names

Shows, for each barcode across all users, all distinct `display_name` values with counts.

```
┌────────────────────────────────────────────────────────────┐
│  9555012345678 (🇲🇾)                    12 users           │
│   → "Milk" (8 users)                                       │
│   → "Susu" (3 users)                                       │
│   → "DL Milk" (1 user)                                     │
│  [Promote "Milk" to global]  [Flag as spam]   [tap →]      │
└────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────┐
│  8801234567890 (🇰🇷)                    5 users            │
│   → "Butter" (5 users)    ✓ consistent                     │
│  [Promote to global]                          [tap →]      │
└────────────────────────────────────────────────────────────┘
```

Actions:
- **Promote to global** — creates/updates `products/{barcode}` with the chosen name, marks `source: "admin_promoted"`, logs to audit
- **Flag as spam** — marks the barcode as spam in `products/{barcode}.flagged: true`; future: exclude from scan responses
- **Tap row →** drill-down showing every user's entry + their purchase counts

Sort options: most users · most diverse (highest distinct names) · most recent

### Tab: Unnamed

Barcodes users scanned but for which no catalog entry was ever created (abandoned scans).

```
9555012345678 · scanned 8 times · never linked to a catalog entry
  [Create global product entry] [Research]
```

Usually means the user scanned, didn't like the result or lookup returned nothing, and abandoned. Admin can proactively create a `products/{barcode}` entry from external source (OFF lookup, manual entry).

### Tab: No-Barcode

User-entered names (no barcode link) sorted by frequency across users.

```
"Grandma's jam"     · 12 users (catalog entry only, no barcode)
"Homemade bread"    · 8 users
"Local honey"       · 5 users
```

Useful for identifying common unbranded items. Not auto-promotable (no barcode to key on), but surfaces gaps in the global products catalog.

### Tab: Cleanup Preview

Catalog entries scheduled for deletion in the next cleanup run (scheduler `catalog_cleanup` weekly Mon 03:00 UTC).

```
Will delete 23 entries next cleanup:
  - uid_abc__old_item      (no barcode, 0 active, 400d old)
  - uid_xyz__experiment    (no barcode, 0 active, 380d old)
  ...
```

Actions:
- Bulk preview per user
- "Exclude from cleanup" override (sets `last_purchased_at = now`, effectively resetting clock)

## Backend

### Service: `catalog_analysis_service.py`

```python
def aggregate_barcode_to_names(refresh: bool = False) -> list[dict]:
    """For each barcode across all users, list distinct display_names with counts.
    
    Returns cached result unless refresh=True. Recomputed by scheduled job weekly.
    """
    if not refresh:
        cached = db.collection("app_config").document("catalog_analysis_cache").get()
        if cached.exists and _is_fresh(cached, max_age_hours=168):
            return cached.to_dict()["barcode_to_names"]
    
    # Collection-wide query — potentially expensive
    entries = db.collection("catalog_entries").where("barcode", "!=", None).stream()
    
    by_barcode = defaultdict(lambda: {"count": 0, "names": Counter()})
    for entry in entries:
        data = entry.to_dict()
        bc = data["barcode"]
        by_barcode[bc]["count"] += 1
        by_barcode[bc]["names"][data["display_name"]] += 1
    
    result = [
        {
            "barcode": bc,
            "count": info["count"],
            "names": [{"name": n, "count": c} for n, c in info["names"].most_common()],
            "consistent": len(info["names"]) == 1,
            "country_code": ...,  # lookup from products
        }
        for bc, info in by_barcode.items()
    ]
    
    db.collection("app_config").document("catalog_analysis_cache").set({
        "barcode_to_names": result,
        "computed_at": SERVER_TIMESTAMP,
    })
    return result


def aggregate_unnamed_barcodes() -> list[dict]:
    """Barcodes in scan_logs or products but with no catalog entries."""
    ...


def aggregate_no_barcode_names() -> list[dict]:
    """User names without barcodes, counted across users."""
    ...


def cleanup_preview() -> list[dict]:
    """Catalog entries matching deletion criteria (no barcode, 0 active, >365d)."""
    cutoff = now() - timedelta(days=365)
    entries = db.collection("catalog_entries") \
        .where("barcode", "==", None) \
        .where("active_purchases", "==", 0) \
        .where("last_purchased_at", "<", cutoff) \
        .stream()
    return [{...} for e in entries]


def promote_to_global(barcode: str, canonical_name: str, admin_uid: str):
    """Write or update products/{barcode} with the admin-chosen name.
    Logs to catalog_analysis_audit.
    """
    ...


def flag_spam(barcode: str, admin_uid: str, reason: str):
    """Mark products/{barcode}.flagged = true."""
    ...
```

### API endpoints

```
GET  /api/admin/catalog-analysis                 # all tab data (paginated per tab)
GET  /api/admin/catalog-analysis/barcode/{bc}    # drill-down: all users' entries for this barcode
POST /api/admin/catalog-analysis/promote         # body: {barcode, canonical_name}
POST /api/admin/catalog-analysis/flag-spam       # body: {barcode, reason}
POST /api/admin/catalog-analysis/refresh         # force rebuild cache
```

### Scheduler job

`catalog_analysis_refresh` — weekly Sunday 02:00 UTC:

```python
@feature_flag("catalog_cleanup")  # same flag gates both cleanup and this
def refresh_catalog_analysis():
    aggregate_barcode_to_names(refresh=True)
    aggregate_unnamed_barcodes()
    aggregate_no_barcode_names()
    # Writes to app_config/catalog_analysis_cache for fast admin-page load
```

### Cache structure

`app_config/catalog_analysis_cache`:

```yaml
barcode_to_names:
  - barcode: "9555012345678"
    count: 12
    consistent: false
    names: [{name: "Milk", count: 8}, {name: "Susu", count: 3}, ...]
    country_code: "MY"
  ...
unnamed_barcodes:
  - barcode: "9557777777777"
    scan_count: 5
    first_seen_at: timestamp
    last_seen_at: timestamp
no_barcode_names:
  - name: "Grandma's jam"
    user_count: 12
    total_purchases: 47
cleanup_preview:
  - catalog_id: "uid_abc__old_item"
    display_name: "Old Item"
    user_id: "uid_abc"
    last_purchased_at: timestamp
    reason: "no_barcode_inactive_365d"
computed_at: timestamp
schema_version: 1
```

## Audit trail

Every admin action logs to `app_config/catalog_analysis_audit/{audit_id}`:

```yaml
audit_id: str
admin_uid: str
action: "promote" | "flag_spam" | "override_cleanup" | "manual_merge"
target:
  barcode: str (if applicable)
  catalog_id: str (if applicable)
before: object    # previous state snapshot
after: object     # new state snapshot
reason: str       # admin's comment
timestamp: timestamp
```

## Performance

- Collection-wide queries can be expensive at scale (1M+ catalog entries). Mitigation:
  - Cache refreshed weekly, not per-request
  - Admin page reads from cache (fast)
  - `[Refresh now]` button triggers rebuild in background (shows "refreshing..." state)
- Pagination on drill-down views (50 per page)
- Indexes: `(barcode ASC)` and `(barcode, user_id)` for analysis queries

## Security

- `/api/admin/catalog-analysis/*` all require `Depends(require_admin)`
- Promoting to global writes to `products/{barcode}` which is globally readable — ensure canonical_name is sanitised (no HTML/scripts)
- Audit logs immutable (no update/delete endpoints)
