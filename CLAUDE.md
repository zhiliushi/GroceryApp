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

**Launching: always use `start.bat` (or Luqman's Developer Dashboard) — never raw `python -m uvicorn` in a cmd window.**

Why: a raw cmd window does not bind its child python.exe to a Win32 Job Object. If the cmd dies (crash, X-button, OS shutdown) before graceful teardown, the uvicorn child orphans and squats on port 8000 indefinitely — survivable only by reboot or admin `taskkill`. We hit this Apr 26 → Apr 29: a backend started Apr 26 from a raw cmd kept blocking port 8000 across two days of "restarts" because no restart actually killed it.

`start.bat` (forwards to `start.ps1`) assigns every spawned process to a `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` job. The OS terminates the entire job the instant the launcher's PowerShell handle closes, however it closes. No race, no orphan possible. Same pattern Luqman uses (`F:\ClaudeProjects\AI-Shaman\luqman\start.ps1`).

```bash
# Local dev — preferred path
F:\ClaudeProjects\GroceryApp\start.bat
# Spawns backend (:8000) + web-admin SPA (:5173), opens http://localhost:5173.
# Closing the window kills both. Logs at logs/{backend,frontend}.{out,err}.log.

# Alternative — launch via Luqman Developer Dashboard (also Job-Object protected)
# http://localhost:1420 → Dev Hub → Developer Dashboard → GroceryApp → Start

# Production build of the SPA → backend/static/spa
cd backend/web-admin && npx vite build

# Mobile (Android) — SCOPE: mobile refactor deferred, uses backward-compat shim
export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.0.10.7-hotspot"
cd android && ./gradlew.bat app:installDebug
```

Backend interpreter selection (inside `start.ps1`): if `backend\venv\Scripts\python.exe` exists, the launcher uses it; otherwise it falls back to `python` on PATH.

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
- `.claude/docs/project_context.md` — project summary for AI context (includes Glossary)
- `.claude/docs/feature-inventory.md` — **canonical** feature × tier × page × API map. Read BEFORE adding any user-visible feature.
- `.claude/docs/pages/*` — per-page documentation. `dashboard.md`, `my-items.md`, `quickadd.md`, `insights.md`, `catalog-analysis.md`, `feature-flags.md`, `user-manual.md`, `storage.md`, `storage-detail.md`, `shopping-lists.md`, `waste.md`, `spending.md`, `spending-history.md`, `health-score.md`, `reminders.md`, `settings.md`, `meals.md`, `meals-form.md`, `catalog.md`, `catalog-entry.md`, `purchase-event-detail.md`, `foodbanks.md`, `about.md`.
- `.claude/memory/MEMORY.md` — project decisions & patterns

### Cross-page hooks (frontend integrations)

When adding entries to features from another page or via an agent-driven
flow, **use the existing integration helper** instead of hand-rolling a
fetch + cache-invalidate:

| Target | Helper | Doc |
|--------|--------|-----|
| Shopping list (add primary entry) | `addItemToShoppingList(payload)` from `@/api/integrations/addToShoppingList` — also dispatchable as `window.dispatchEvent(new CustomEvent('grocery:add-to-shopping-list', { detail: payload }))` | [pages/shopping-lists.md](.claude/docs/pages/shopping-lists.md) "Cross-page hook" |

The async function returns the created item; the window event is fire-
and-forget and toasts on success/error. Both invalidate the relevant
React Query caches so any open page refreshes.

## Discipline rules

### Update the user manual when shipping features
The user manual lives at `/help` (`backend/web-admin/src/pages/help/UserManualPage.tsx`). When a feature lands or changes, update the manual section AND `feature-inventory.md` in the same PR. The manual is one file (10 sections) so the diff is visible in PR review — that's intentional.

### Read feature-inventory.md BEFORE adding a new feature
Most "new" surfaces already exist somewhere. The inventory tells you which page already owns the concern, which tier should gate the feature, and which API the backend expects. Adding a sibling page when an existing page should hold the feature is a Mistake (captured 2026-04-28 from a similar case in the Luqman/business sibling-vs-tab incident).

### Tier and feature flag changes must propagate
Changing `_DEFAULT_TIERS` in `config_service.py` requires:
1. Updating section 9 (`Tiers`) of `UserManualPage.tsx`.
2. Updating the tier matrix in `feature-inventory.md`.
3. Verifying `useVisibility()` consumers still work (TierRoute gated pages, `canUseTool` for tools).

### Read preppers_principles.md BEFORE editing the preppers feature
The preppers tier is positioned for **archetype B (hobbyist-preserver /
smart-pantry rotation)** — NOT survival prep. The full design framework
lives in [`.claude/docs/preppers_principles.md`](.claude/docs/preppers_principles.md), which has four operational layers:

1. **Positioning + canonical references** (NCHFP, Ball Blue Book,
   Sandor Katz, USDA) — what archetype we're building for and what
   sources defaults trace to.
2. **Design principles P1–P8** — durable house rules for edge-case
   judgment. Read them first; the reasoning paragraphs matter more
   than the rule statements.
3. **Workflow conventions** — synchronized changes for adding a
   prep_type, seeding a new preserve, changing defaults, evolving
   the recommendation algorithm.
4. **Code-review checklist** — 10-item gate for any preppers PR.

Read this before changing `prep_*_service.py`,
`common_preserves_service.py`, `PreppersPage.tsx`,
`PrepRecipeFormPage.tsx`, the admin toggles, the seed, or User Manual
section 11. When seeding new presets or adjusting default ready_after /
shelf_life values, cite which canonical reference (NCHFP / Ball /
Katz / USDA) you got the figure from in the seed entry's `description`
or the PR body.

### UI labels must be static (data-model leak prevention)
Column headers, section titles, and form field labels MUST be static strings — never composed from runtime data-model values like `pack_label`, `unit_type`, `name_norm`. The classic leak: `<label># {packLabel}</label>` rendered as "# LOOSE" when `pack_label="loose"`. Discipline + risky-name list in `.claude/docs/project_context.md` "UI label discipline". Quick post-build check: `cd backend/web-admin && npm run check:label-leaks` (also runs as part of `npm run build`).

## Key Patterns

- Shell: Git Bash on Windows (use `export` not `set`)
- Python: `cd backend && uvicorn main:app`
- Web admin: TypeScript must pass `tsc --noEmit` before build
- Firestore: all writes go through services (never direct `db.collection()` in routes)
- Every document has metadata: `created_at`, `updated_at`, `schema_version`, `created_by`, `source`
- Feature flag decorator `@require_flag("ocr_enabled")` gates OCR routes
- Barcode scanner = helper tool. Catalog is primary.
