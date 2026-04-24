# Feature Flags Tab (admin)

Route: accessed via `/admin-settings` → "Feature Flags" tab (default active)
File: `pages/admin-settings/FeatureFlagsTab.tsx`

## Purpose

Admin UI for toggling feature flags at runtime. No redeploy needed — cache invalidates on save.

## Groups (UI ordering)

1. **OCR & Smart Camera** — `ocr_enabled` master + `receipt_scan`, `smart_camera`, `recipe_ocr`, `shelf_audit` (all dependent on `ocr_enabled`)
2. **User-Facing Features** — `progressive_nudges`, `financial_tracking`, `insights`, `nl_expiry_parser`
3. **Background Jobs** — `barcode_country_autodetect`, `catalog_cleanup`, `reminder_scan`, `milestone_analytics`
4. **Migration & Legacy** — `legacy_endpoints_use_new_model` (flip after `scripts/migrate_grocery_items_to_purchases.py --execute` completes)

## Dependencies

Flags with `dependsOn` auto-gray when their parent is off. Visual effect only — backend validates independently. Toggle child while parent is off → persisted but has no effect until parent is on.

## Save flow

- Uses local `pending` state for diff from server
- `[Save N change(s)]` button enabled only when `pending` non-empty
- Calls `useUpdateFeatureFlags.mutate(pending)` → `PATCH /api/admin/features`
- Backend invalidates 60s cache immediately → changes take effect on next request
- `onSuccess` clears pending + updates local query cache

## Nudge thresholds

Displayed read-only as JSON. Editable via raw flag update (no dedicated UI yet). Typical values: `{expiry: 5, price: 10, volume: 20}`.

## Gotchas

- Turning off `ocr_enabled` doesn't auto-turn-off the children — they stay "on" but effectively disabled by the dependency check. Future: auto-cascade in backend.
- `legacy_endpoints_use_new_model` has no dependency check but should be paired with migration-run confirmation. Flipping it without running the migration will cause the legacy endpoints to serve empty `/api/inventory/my` (no catalog entries exist).
