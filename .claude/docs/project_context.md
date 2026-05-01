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

### Claude-context docs (read these BEFORE building features)

- `.claude/docs/feature-inventory.md` — **canonical** list of user-visible
  features × tier × page × API. Single source of truth for "where does X
  live, who can use it, and what API does it call". Update this in lockstep
  with code changes.
- `.claude/docs/pages/user-manual.md` — page doc for the user-facing manual
  at `/help`. Update discipline: when a feature changes, update
  `pages/help/UserManualPage.tsx` AND `feature-inventory.md` in the same PR.
- `.claude/docs/pages/*.md` — per-page documentation (dashboard, my-items,
  quickadd, insights, catalog-analysis, feature-flags, user-manual).

## Layout — global floating-action safe-zone

The fixed Add (`StickyAddButton`) and Scan (`FloatingScanButton`) pills
live at `top-4 right-4 z-30` in `AppLayout.tsx`. They're hidden on
mobile (replaced by `PrimaryActionFab` at bottom-right). On desktop
they overlap the top-right of every page.

To prevent collisions, `AppLayout` wraps `<Outlet />` in a div with
`md:pr-[260px] pb-24 md:pb-0`:

- `md:pr-[260px]` reserves 260px of right-side space on desktop,
  enough to clear "Scan" + "Add item" pills + their margins.
- `pb-24 md:pb-0` gives mobile pages bottom-padding so the FAB
  doesn't cover the last list item.
- `min-w-0` lets flex/grid children shrink properly.

**Implication for new pages**: Don't add per-page `md:pr-[*]` to
header rows. The wrapper handles it. The only sibling of the wrapper
is `CatalogCleanupBanner` (full-width by design), which carries its
own `md:pr-[260px]` for content clearance.

If a page genuinely needs to use the right strip (e.g. a custom
floating widget that should NOT be obscured by the pills), it must
either fight the wrapper (`md:!pr-0` + own clearance) or extend
beyond the wrapper via `position: fixed`.

## Glossary

User-facing and engineering terms whose meaning isn't obvious from
context. Pin new domain terms here the first time they resolve in a
session — drift compounds across sessions.

- **Catalog row / catalog entry** — one user-defined named item
  (`catalog_entries/{user_id}__{name_norm}`). Stable across purchases;
  the autocomplete + frequently-bought list uses this.
- **Purchase event** — one purchase, possibly partially consumed
  (`users/{uid}/purchases/{event_id}`). Many events can map to one
  catalog row.
- **Base unit** — the actual countable thing (eggs, ml, g), as opposed
  to event-quantity which is in pack-multiples. A "1 pack × 6 eggs"
  event has `quantity=1, pack_size=6`, so `totalBaseUnits = 6`. The
  Use modal works in base units; the API converts back to event-qty.
- **unit_type** — classification on a catalog row: `count`, `volume`,
  `weight`, `container`. Drives the input shape on the Use modal
  (count → integer spinner; volume → ml slider; weight → g slider;
  container → whole-pack confirmation).
- **Display currency** — user's `currency_preference`. All spending +
  waste figures are converted at read time via
  `currency_service.display_amount_for_user`. Original currency is
  preserved on each event.
- **Tier** — `free` (Basic Basket), `plus` (Smart Cart), `pro` (Full
  Fridge). `admin` bypasses all tier checks. Defined in
  `config_service._DEFAULT_TIERS`.
- **Tool (Smart Cart sense)** — a tier-gated feature that `plus` users
  pick up to 3 of (e.g. `price_tracking`, `receipt_scanning_ocr`).
  Different from a feature flag, which is admin-only.
- **Idle counter** — the 30-day clock on barcodeless catalog rows for
  free-tier users. Resets on any "touch" (open, edit, new purchase).
  Paid users exempt.
- **Restore** — flips a terminal-status event (`used`/`thrown`/
  `transferred`) back to `active`. Per-event button on the detail
  page; bulk admin endpoint for disaster recovery.
- **Partial action / split** — when a user marks part of a multi-pack
  used or thrown, the API splits one event into two: a child of the
  partial qty in the new status, and a child with the remainder still
  active. Both reference the original parent via
  `split_from_event_id`.
