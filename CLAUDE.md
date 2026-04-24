# GroceryApp

## Identity & Vision

**GroceryApp is a simple waste-prevention app.** Users minimise food waste by tracking what they buy, when it expires, and what they use vs throw. The app gets out of the way — entry is barcode-scan or name-type, no forms, no OCR complexity.

**Refactor shipped (2026-04-23):** pivoted from complex grocery manager with OCR to dumb-simple waste tracker. Catalog + purchase-events data model, barcode-first UX, state-driven actions, progressive nudges, milestone insights, OCR flag-gating. See `C:\Users\Shahir\.claude\plans\hidden-yawning-shamir.md` for the original plan. Mobile refactor deferred — web admin is the primary surface; legacy mobile endpoints keep working via the compat shim (`services/compat/legacy_item_shim.py`, flag `legacy_endpoints_use_new_model`).

## Core Principles

1. **Catalog is name-centric** — the reference is the user's named item, not the barcode. Items without barcodes are first-class.
2. **Barcode is a helper, not required** — when available it auto-finds catalog entries; otherwise user types name.
3. **State-driven UI** — every page's buttons/actions appear based on data state (like a PO system: draft shows only "Publish", published shows stage-appropriate actions).
4. **Progressive disclosure** — no forms upfront. Nudge for expiry/price/volume after N items.
5. **Waste-focused dashboard** — health bar (green/yellow/red), not inventory count.
6. **Simple actions** per item: Used / Thrown / Give Away. Conditional on state.
7. **Natural language expiry** — "tomorrow", "next week", ISO dates all work.
8. **Hide OCR behind feature flag** — admin toggles; not deleted.

## Data Model (new)

- `catalog_entries/{user_id}__{name_norm}` — global collection, composite doc id. One entry per (user, name). One barcode per entry, nullable.
- `users/{uid}/purchases/{event_id}` — purchase events (one per shopping trip or individual buy). Has expiry/price/status/location.
- `products/{barcode}` — global barcode catalog + country + verification.
- `countries/{code}` — country definitions with GS1 prefix ranges.
- `app_config/features` — feature flags (ocr_enabled, etc.).

See `docs/DATABASE.md` and `docs/CATALOG_SYSTEM.md` for full schema.

## Build & Run

```bash
# Backend
cd backend && pip install -r requirements.txt && uvicorn main:app --reload --port 8000

# Web Admin SPA (dev server with HMR)
cd backend/web-admin && npm install && npm run dev

# Web Admin SPA (production build → backend/static/spa)
cd backend/web-admin && npx vite build

# Mobile (Android) — SCOPE: mobile refactor deferred, uses backward-compat shim
export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.0.10.7-hotspot"
cd android && ./gradlew.bat app:installDebug
```

## Deploy

Two git remotes:
- `origin` → `github.com/zhiliushi/GroceryApp.git` (main)
- `render` → `github.com/zhiliushi/groceryapp-backend.git` (master)

Push to both for deploy:
```bash
git push origin main && git push render main:master
```

Render URL: `https://groceryapp-backend-7af2.onrender.com`

## Project Documentation

### What's next
- **`docs/ROADMAP.md`** — current forward plan. Production cutover (Phase A), quality gates (Phase B), UX completion (Phase C), deferred features (Phase D), observability (Phase E). **Update this for new work.**

### Architecture & principles
- `CLAUDE.md` — this file, entry point
- `docs/PROJECT_CONTEXT.md` — product vision, architecture
- `docs/DATABASE.md` — Firestore schema
- `docs/BACKEND.md` — FastAPI structure, services (includes refactor section)
- `docs/API.md` — HTTP endpoints (includes refactor section)
- `docs/WORKFLOWS.md` — user flows (includes refactor section)

### New system docs (refactor)
- `docs/CATALOG_SYSTEM.md` — name normalization, merging, cleanup
- `docs/FEATURE_FLAGS.md` — all flags, dependencies, admin UI
- `docs/STATE_DRIVEN_UI.md` — per-page state machines, action resolver
- `docs/HEALTH_SCORE.md` — dashboard health bar formula
- `docs/NUDGE_SYSTEM.md` — progressive disclosure thresholds
- `docs/MIGRATION_GUIDE.md` — grocery_items → catalog+purchases migration
- `docs/ADMIN_CATALOG_ANALYSIS.md` — admin aggregation view

### Future/deferred
- `docs/FUTURE_TELEGRAM_BOT.md` — Telegram integration design (deferred)
- `docs/FUTURE_MOBILE_REFACTOR.md` — mobile app migration (deferred)
- `docs/FUTURE_AI_CATALOG_DEDUP.md` — AI duplicate detection (deferred)
- `docs/FUTURE_ITEM_MOVEMENT.md` — scan-to-move-location (deferred)
- `docs/FUTURE_HOUSEHOLD_CATALOG_MERGE.md` — household merge (deferred)

### Claude memory
- `.claude/docs/project_context.md` — project summary for AI context
- `.claude/docs/pages/*` — per-page documentation
- `.claude/memory/MEMORY.md` — project decisions & patterns

## Key Patterns

- Shell: Git Bash on Windows (use `export` not `set`)
- Python: `cd backend && uvicorn main:app`
- Web admin: TypeScript must pass `tsc --noEmit` before build
- Firestore: all writes go through services (never direct `db.collection()` in routes)
- Every document has metadata: `created_at`, `updated_at`, `schema_version`, `created_by`, `source`
- Feature flag decorator `@require_flag("ocr_enabled")` gates OCR routes
- Barcode scanner = helper tool. Catalog is primary.
