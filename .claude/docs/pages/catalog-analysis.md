# Catalog Analysis (admin)

Route: `/admin/catalog-analysis`
File: `pages/admin/CatalogAnalysisPage.tsx`

## Purpose

Cross-user admin aggregation view. Surfaces:
- **Duplicate naming** — same barcode named differently by different users
- **Unnamed / no-barcode catalog entries** — user-typed names with no global product match
- **Cleanup candidates** — stale entries the scheduler will delete next Monday 03:00

## Data source

Cached doc at `app_config/catalog_analysis_cache`. Refreshed:
- Scheduler: weekly (Sunday 02:00 UTC) via `catalog_analysis_refresh` job
- Manual: `GET /api/admin/catalog-analysis?refresh=true`

### Service

`app/services/catalog_analysis_service.py`:
- `aggregate_barcode_to_names()` — groups `catalog_entries` by barcode, counts distinct `display_name` per
- `aggregate_no_barcode_names()` — names-only entries grouped by `name_norm`
- `aggregate_cleanup_preview()` — `active_purchases == 0 AND last_purchased_at < now-365d AND barcode IS null`
- `promote_to_global(barcode, canonical_name, admin_uid)` — writes `products/{barcode}` + audit log
- `flag_spam(barcode, admin_uid, reason)` — sets `products/{barcode}.flagged=true`
- `refresh_cache()` — rebuilds all three aggregates into `app_config/catalog_analysis_cache`

Audit trail: `app_config/catalog_analysis_audit/entries/*` — records every promote/flag_spam with `{action, admin_uid, barcode, ...}`.

## Tabs

1. **Barcode → Names** — each row = one barcode with distinct user names + counts.
   - Consistent (1 distinct name) → green border
   - Inconsistent (multiple names) → orange border
   - Actions: `[Promote]` (prompts canonical name) · `[Flag spam]` (prompts reason)
2. **Unnamed / No-barcode** — user-typed entries without barcodes, grouped.
3. **Cleanup Preview** — entries scheduled for deletion next Monday.

## Refresh UX

Header button "Refresh now" issues `GET /api/admin/catalog-analysis?refresh=true` synchronously and invalidates the query. Typical refresh takes a few seconds for small datasets.

## Not yet implemented

- Bulk merge (plan item "merge duplicates") — admin merging across users is complex (would require cross-user data modification). User-level merge exists on `CatalogEntryPage` via `useMergeCatalogEntry`.
- Promote-to-global with image — currently name-only.
