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

## Architectural Principles (canonical — refer when designing)

These three principles govern any feature that touches items, money, or
inventory state. Captured 2026-05-04 from Shahir's checkout_flow design
discussion. Violating them causes data drift, currency math errors, or
state-machine confusion.

### P1 — Catalog is the source of truth; values change over time

The catalog (`catalog_entries/{uid}__{name_norm}`) is canonical for
*identity* — what the named item is. Weight, volume, count, and price
are **not** canonical there; they vary per purchase / candidate / time.

- Each purchase event carries its own `quantity`, `pack_size`, `price`,
  `expiry_date` — a snapshot at purchase time.
- Each shopping-list alternative carries its own `pack_count × pack_size`,
  `weight_value`, `volume_value`, `price` — a snapshot at the time of
  comparison.
- The catalog row holds: `display_name`, `name_norm`, `barcode` (when
  applicable), `default_location`, `unit_type`, aggregated counters.
- **Do NOT** put "current price" or "current weight" on the catalog row.
  Aggregations like `avg_price`, `last_purchased_at` are derived stats,
  fine to denormalize for reads but never the *source* of value.

### P2 — Currency value is UI-only; paid value is what remains

Money is stored exactly as it was paid: `(amount, currency)` pair, e.g.
`(12.50, "SGD")`. Database persists that pair forever. Never store
converted values.

- Display-time conversion using current FX (via `fx_rate_service`) is a
  view-layer concern. Render as: `MYR 38.40 ≈ SGD 11.32` — the original
  is the truth, the conversion is an estimate of present worth.
- A purchase made for `MYR 50` ten years ago stays `MYR 50` in DB
  forever. Showing it in SGD next year uses today's FX, which differs
  from yesterday's — but the DB value never moves.
- Implication: aggregate spending across currencies in the UI layer (or
  with a clearly-labeled "as-of" timestamp); do NOT pre-aggregate to a
  single currency in DB.

### P3 — Item state machine: transit → storage → past

Every item the user interacts with is in one of three conceptual states:

| State | Meaning | Storage | Value handling |
|---|---|---|---|
| **transit** | planned to have, not yet owned | shopping list (primary + alternatives) | no real value; can be lost without loss; intent only |
| **storage** | physically owned; needs management | `purchase_events.status='active'` | real value; managed (use, move, throw, donate) |
| **past** | once existed, no longer | `purchase_events.status in {consumed, expired, transferred, discarded}` | historical; measurable for analytics; immutable |

Transitions:
- **transit → storage**: shopping-list checkout (alts ticked → purchases created); cascade-deletes the parent primary + sibling alts.
- **storage → past**: Use / Throw / GiveAway action on a purchase event; status transitions one-way per `purchase_event_service.validate_status_transition`.
- **transit → gone (no past record)**: shopping-list TTL sweep (30d) or manual delete; nothing kept in `past` because it never reached `storage`.

Implications:
- Don't track waste/spending on transit items — they had no real value.
- Don't allow "ungrade" transitions (past → storage). One-way only.
- When designing a new feature that involves items, first ask: *which
  state(s) does it operate on?* That answer constrains where the data
  lives and what mutations are valid.

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

THREE fixed pills live at `top-4 ... z-30` in `AppLayout.tsx` on desktop:
  - `GlobalSearchBar`  — `top-4 left-64`  (left side, ~360px wide)
  - `FloatingScanButton` — `top-4 right-36` (right side, ~85px wide)
  - `StickyAddButton`  — `top-4 right-4`  (right side, ~110px wide)

All three end at y≈56px (`top-4` 16px + ~40px button height). They're
hidden on mobile and replaced by `PrimaryActionFab` at bottom-right.

**The fix** lives in `AppLayout.tsx`: a wrapper around `<Outlet />`
with `md:pt-16 pb-24 md:pb-0 min-w-0`.

- `md:pt-16` (64px top reservation) pushes EVERY page's content
  below the entire pill row — clears LEFT and RIGHT at once. Earlier
  attempts used `md:pr-[260px]` which only fixed the right side; the
  GlobalSearchBar pill on the left still blocked page titles. Switched
  to top-padding 2026-05-01 after the Shopping Lists / Foodbanks /
  Dashboard screenshots showed left-side cropping.
- `pb-24 md:pb-0` keeps the last list row above the mobile FAB.
- `min-w-0` lets flex/grid children shrink properly inside.

The banner (`CatalogCleanupBanner`) is a SIBLING of the wrapper, NOT
a child. Its background spans full main width. It uses `z-40` so the
floating pills (z-30) hide behind it where they overlap — banner
needs no extra padding.

**Discipline rule (TAGGED in AppLayout.tsx)**: don't add per-page
`md:pl-*` / `md:pr-*` / `md:pt-*` hacks for floating-pill clearance.
The wrapper already handles it. New pages get clearance for free.

If a page legitimately needs the top strip (rare — a hero image, a
full-bleed map), it can fight the wrapper with `md:!pt-0` and
position its own pill clearance.

## UI label discipline (data-model leak prevention)

**Rule**: User-facing UI labels (column headers, section titles, field
labels, modal headers) MUST be static strings. Never compose them at
render-time from raw data-model values (enum keys, snake_case property
names, location keys, technical IDs).

**The classic leak** (caught May 2026 in QuickAddModal):

```tsx
// ❌ BAD — composes data-model values into column headers
<label># {packLabel}{packCount === 1 ? '' : 's'}</label>
<label>{unit}/{packLabel}</label>
<label>Price/{packLabel}</label>
```

When `pack_label="loose"`, these render as "# LOOSE", "COUNT/LOOSE",
"Price/loose" — confusing the user with internal jargon.

```tsx
// ✓ GOOD — static labels, descriptive and stable
<label># Packs</label>
<label>Items / pack</label>
<label>Size / item</label>
```

**Variables that should never be rendered directly as UI text** (the
risky-name list):
- `pack_label`, `packLabel`
- `unit_type`, `unitType`
- `name_norm`, `nameNorm`
- `base_unit_label`, `baseUnitLabel`

These hold technical enum/key values. If they happen to be display-clean
in a specific case (e.g. `base_unit_label="ml"` is fine to render), tag
the line with `// LABEL_OK: <reason>` to acknowledge.

**Quick check**: `cd backend/web-admin && npm run check:label-leaks`.
Greps `src/**/*.{ts,tsx}` for known leak patterns. Run automatically as
part of `npm run build`. Use `npm run build:no-checks` to skip when you
need to ship a hotfix and have a known acceptable leak.

**Related canonical doc**: `.claude/docs/unit-type-method.md`
"static labels rule".

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
