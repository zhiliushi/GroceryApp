# Catalog Evolution — Plan

**Status:** awaiting sign-off → Phase F → Phase 0 → Phase A...
**Owner:** Shahir + Claude (co-design)
**Drafted:** 2026-04-30
**Source:** ultrathink-mode design conversation, journal entry `[2026-04-30 (this session)] SUCCESS_PATTERN — pause-before-code on schema evolution`
**Sign-off gate:** Shahir says "go phase F" before any code.

---

## 1. Context

### Triggering need
Shahir's verbatim requirement (paraphrased into 4 axes):

> 1. **Two catalog ownership modes** with different cost/lifetime: barcode-rooted canonical names (`global_linked`, no quota, no TTL) vs user-renamed-or-no-barcode (`user_custom`, 50-cap quota, 30-day idle TTL, paid users exempt).
> 2. **Same-name awareness** — not auto-merge, but select-or-create with similarity hints, plus a transfer-history button between rows.
> 3. **My Items quick-view completeness** — Name, Location, Qty per row, Expiry status badge.
> 4. **Pricing with pack size + per-unit calculation + store of purchase**, optional toggle, multi-pack auto-generate of collapsible child entries.

### Triggering symptom
"the numbering all not tally" (smoke test on production data, 2026-04-30). Phase 1-4 partial-action splits inflated `total_purchases` event-count beyond the user's mental "logical purchases" model. Surface bug; root cause = schema needs evolution to separate event counts from purchase counts AND the pricing/quota/TTL layer needs to land for the app to be analytics-honest.

### What this plan does
Land the catalog model, pricing model, quota system, store catalog, and overview rewrite in a phased, idempotent rollout. Migration is big-bang on a tiny user base; future scaling can revisit.

### What this plan deliberately does NOT do
- Does not redesign the iOS scanner (resolved 2026-04-30 separately).
- Does not redesign Phase 1-4 partial-action splits (they are correct as event-level lineage; the catalog counter math is what's fixed here).
- Does not implement paid-tier billing or Stripe integration — only the `is_paid` boolean flag on user docs, with manual admin toggle for now.
- Does not implement admin-approved-name registry — until that ships, first-user-to-name-it wins. Admin can overwrite via direct Firestore edit if needed.
- Does not implement display-currency change UI — v1 = display currency = profile currency, no historical re-aggregation.

---

## 2. Decisions reference

### 2.1 Catalog modes (corrected from initial draft)

| Mode | Trigger | Quota | TTL | Cascade on TTL hit |
|---|---|---|---|---|
| `global_linked` | barcode + canonical name (admin-approved if registry has it; else first-namer's name; admin may overwrite later) | NO | none | n/a |
| `user_custom` (a) | barcode + user-chosen rename (rename layer over a global barcode) | YES (50-cap) | 30d idle | catalog row removed; events stay, name reverts to canonical global_linked name |
| `user_custom` (b) | no barcode at all | YES (50-cap) | 30d idle | hard delete + cascade to events. Admin-toggle in settings can switch to soft-delete later when DB capacity improves |
| any user_custom, **paid** user | — | YES (still 50-cap until billing-tier upgrade) | NONE (no counter, no delete) | n/a |

**Waste history rule:** lives on the barcode if one exists (survives mode (a) cascade). For mode (b) — no barcode — waste history dies with the catalog at 30d (or admin-soft-delete later).

### 2.2 Decisions table

| # | Decision | Resolution |
|---|---|---|
| 1 | Cascade behavior on TTL expiry | mode (a) → catalog removed, events re-resolve to global; mode (b) → hard delete (admin-toggle for soft later); paid → never |
| 2 | What counts as "scan" for clock-reset | only when scan ends in adding/touching the entry (buy, add to grocery list, transfer); pure "view scan" does NOT reset |
| 3 | Quota-hit UX | user picks which to remove; sortable by oldest-first or by expiry-rank |
| 4 | My Items quick-view fields | Name, Location, Qty (per active row), Expiry status badge — that is the entire card payload |
| 5 | pack_size location | optional, hidden behind a toggle on the entry form. When opened: "N packs × M per pack" auto-generates N collapsible child entries, each with own qty + expiry. Per-pack price entered, total auto-computed |
| 6 | base_unit_label declaration | inferred from first purchase, toggle-able per current purchase, notes field for "I bought two types this time" |
| 7 | Existing-data migration | **big-bang, idempotent, with guardrails** — see §4 |
| 8 | Currency mixing | **per-event currency + save-time conversion** to user's display currency, both stored — see §5 |
| 9 | purchased_at / store catalog | per-user store_catalog collection; free text on first add; select-or-create on subsequent; 30-store cap for free users (analysis later for paid) |
| 10 | Same-name handling | not auto-merged; select-or-create with fuzzy hints; transfer-history button with audit log + 7-day reversal — see §6 |

---

## 3. Schema delta

### 3.1 `catalog_entries` (existing, modified)

```
catalog_entries/{user_id}/items/{name_norm}
{
  // EXISTING
  name: string,                     // user-facing display name
  name_norm: string,                // doc id (lowercased, trimmed, collapsed)
  barcode: string | null,
  total_purchases: int,             // see Phase F note: this becomes "logical_purchase_count" — see 3.7
  ...other existing aggregates...

  // NEW
  catalog_mode: "global_linked" | "user_custom",
  canonical_name: string,           // for global_linked: the admin-approved-or-first-namer name; for user_custom (a) it's the renamed version, with the global canonical accessible via barcode lookup
  idle_expires_at: Timestamp | null,// null for global_linked or paid user; otherwise scan-touch + 30d
  schema_version: 2,                // idempotency marker
}
```

### 3.2 `purchase_events` (existing, modified)

```
purchase_events/{user_id}/items/{event_id}
{
  // EXISTING
  catalog_id: string,               // points to catalog_entries doc
  quantity: float,
  status: "active" | "used" | "thrown" | "given" | "transferred",
  expiry: Timestamp | null,
  location: string,
  price: float,                     // existing — kept verbatim, treated as TOTAL paid
  split_from_event_id: string | null,
  ...other existing fields...

  // NEW (pricing rework)
  amount: float,                    // = price (renamed semantically; price stays for backward compat in v1)
  currency: string,                 // 3-letter ISO; default = user.currency_preference
  display_amount: float,            // computed at save in user's display currency
  display_currency: string,
  fx_rate_at_save: float,           // = 1.0 when currency == display_currency
  fx_rate_date: string,             // YYYY-MM-DD
  pack_size: int,                   // default 1; multi-pack rows have explicit
  unit_price: float,                // = display_amount / quantity / pack_size
  base_unit_label: string,          // default "unit"; user-overridable
  store_id: string,                 // points to store_catalog/{user_id}/stores/{store_id}
  multi_pack_parent_id: string | null, // for the N child rows under a single scan event

  // NEW (catalog counter math)
  contributes_to_logical_count: bool, // true for first event of a logical purchase, false for splits/moves; see 3.7

  schema_version: 2,
}
```

### 3.3 `users` (existing, modified)

```
users/{user_id}
{
  // EXISTING fields...

  // NEW
  is_paid: bool,                    // default false; admin-toggle for now
  currency_preference: string,      // default "SGD" (Shahir locale); user-changeable in settings
  catalog_quota_used: int,          // denormalized: count of user_custom rows
  catalog_quota_limit: int,         // 50 for free; higher tiers TBD
  store_quota_used: int,
  store_quota_limit: int,           // 30 for free
  schema_version: 2,
}
```

### 3.4 `store_catalog` (NEW)

```
store_catalog/{user_id}/stores/{store_id}
{
  store_id: string,                 // doc id (slug of name)
  name: string,                     // display name, free text
  auto_created: bool,               // true for "Unknown" store auto-created at migration
  created_at: Timestamp,
  last_used_at: Timestamp,
  use_count: int,                   // for sort-by-frequency in dropdown
}
```

### 3.5 `fx_rates` (NEW)

```
fx_rates/{from}_{to}_{date}
{
  from: string,                     // 3-letter ISO
  to: string,
  date: string,                     // YYYY-MM-DD
  rate: float,
  source: "exchangerate-api" | "fixer" | "manual",
  fetched_at: Timestamp,
  is_stale: bool,                   // true if API was down + fallback used
}
```

### 3.6 `migration_audit_log` (NEW, one-shot)

```
migration_audit_log/{run_id}
{
  run_id: string,
  started_at: Timestamp,
  completed_at: Timestamp | null,
  schema_version_target: 2,
  user_count: int,
  catalog_rows_processed: int,
  catalog_rows_global_linked: int,
  catalog_rows_user_custom: int,
  events_processed: int,
  events_with_pack_size_default: int,
  events_with_unit_label_inferred: int,
  events_with_unit_label_default: int,
  errors: [{user_id, doc_path, error_message}],
  status: "running" | "complete" | "failed" | "rolled_back",
}
```

### 3.7 Catalog counter math fix (root of "numbering not tally")

Current: `total_purchases` = count of all purchase_events. Phase 1-4 splits create new events for partial-actions, inflating count.

New:
- `total_purchases` is **renamed** to `logical_purchase_count` and tracks logical purchases (one per scan/add session).
- Fields:
  - `logical_purchase_count: int` — increments on first event of a purchase; does NOT increment for splits or moves
  - `total_event_count: int` — increments on every event (same as old `total_purchases`)
- Splits: `contributes_to_logical_count = false`. Moves: `contributes_to_logical_count = false`. First event from a scan: `contributes_to_logical_count = true`.
- Multi-pack auto-generated children: only the parent counts toward `logical_purchase_count`; children are `contributes_to_logical_count = false`.

### 3.8 `transfer_audit_log` (NEW, ongoing)

```
transfer_audit_log/{user_id}/items/{transfer_id}
{
  transfer_id: string,
  from_catalog_id: string,
  to_catalog_id: string,
  transferred_event_count: int,
  transferred_at: Timestamp,
  reversal_token: string,           // unique; required to undo
  reversal_expires_at: Timestamp,   // = transferred_at + 7d
  reversed_at: Timestamp | null,
  reversal_warned_unit_mismatch: bool,
}
```

---

## 4. Migration approach (resolves Q7)

**Strategy:** big-bang, idempotent script, manual trigger via admin endpoint.

### 4.1 Pre-flight (Phase 0)
1. **Firestore export to GCS** (`gcloud firestore export`) — non-negotiable.
2. **Emulator dress rehearsal** with snapshot of prod data. Diff a sample of 20 docs by hand.
3. **Pre-migration audit report** — Phase 0 dry-run endpoint prints per-user counts:
   - catalog rows by mode classification (predicted)
   - events by pack_size assumption
   - events with inferable vs default base_unit_label
   - store repoints to "unknown" store
   - any catalog rows that look ambiguous (e.g., both a barcode and signs of a rename)

### 4.2 Defaults table (when fields are missing in v1 docs)

| Doc type | Field | Default |
|---|---|---|
| catalog_entry | `catalog_mode` | `global_linked` if `barcode` non-empty; else `user_custom` |
| catalog_entry | `canonical_name` | existing `name` (for global_linked, current namer becomes canonical until admin overwrites) |
| catalog_entry | `idle_expires_at` | `null` for global_linked or if user.is_paid=true; else `now + 60d` (**60-day grace, not 30, since users couldn't have known the rule**) |
| purchase_event | `pack_size` | `1` |
| purchase_event | `base_unit_label` | inferred from catalog name heuristic (regex for "kg", "L", "ml", "pack", "box", "egg" etc.); else `"unit"` |
| purchase_event | `currency` | `user.currency_preference` (defaulted to `SGD`) |
| purchase_event | `display_amount` | = `amount` (no historical conversion) |
| purchase_event | `display_currency` | = `currency` |
| purchase_event | `fx_rate_at_save` | `1.0` |
| purchase_event | `fx_rate_date` | `YYYY-MM-DD` of migration run |
| purchase_event | `unit_price` | `amount / quantity / pack_size` |
| purchase_event | `store_id` | `"unknown"` (auto-created store per user) |
| purchase_event | `contributes_to_logical_count` | `true` if `split_from_event_id == null`; else `false` |
| user | `is_paid` | `false` |
| user | `currency_preference` | `SGD` |
| user | `catalog_quota_used` | computed from catalog_entries WHERE catalog_mode='user_custom' |
| user | `catalog_quota_limit` | `50` |
| user | `store_quota_used` | `1` (the auto-created Unknown store) |
| user | `store_quota_limit` | `30` |
| store_catalog | initial doc | `{store_id: "unknown", name: "Unknown", auto_created: true, created_at: now, last_used_at: now, use_count: <event count for that user>}` |

### 4.3 Idempotency
- Every doc gets `schema_version: 2` after migration.
- Re-running skips docs with `schema_version >= 2`.
- Run record in `migration_audit_log` with idempotency key.

### 4.4 Post-migration UX guardrail
First post-migration login: in-app banner.

> **Catalog cleanup is now active.** N items in your catalog have a 30-day idle counter. Touch them to keep, or remove from the list.
> [Show me] [Dismiss]

Banner stays until user clicks Show me OR dismisses. Cookie/local-storage flag.

### 4.5 Rollback
- Firestore export from §4.1 is the rollback artifact.
- `migration_audit_log` lets us identify what was changed.
- Rollback = `gcloud firestore import` from export. Manual, not automated.

---

## 5. Currency model (resolves Q8)

**Choice:** per-event `{amount, currency}` PLUS save-time conversion to `{display_amount, display_currency}` with FX rate locked at save.

### 5.1 Save flow

```
On price entry:
  amount = user input
  currency = user input (default = profile currency)
  IF currency == user.currency_preference:
    display_amount = amount
    display_currency = currency
    fx_rate_at_save = 1.0
    fx_rate_date = today
  ELSE:
    rate = fx_rates_lookup(currency, user.currency_preference, today)
    IF rate is None:
      rate = fetch_from_api()
      cache_to_firestore(rate)
    display_amount = amount * rate
    display_currency = user.currency_preference
    fx_rate_at_save = rate
    fx_rate_date = today
```

### 5.2 FX source
- Free tier of `exchangerate-api.com` (1500 req/month free).
- Cache: one Firestore doc per `(from, to, YYYY-MM-DD)` triple, populated lazily.
- API call only when cache miss.
- Stale fallback: if API fails, use last known rate within 7 days, mark `is_stale: true` so UI can flag price as approximate.

### 5.3 What v1 does NOT do
- No UI to change display currency historically.
- No re-aggregation of past data when user changes `currency_preference`.
- No multi-currency report views ("show me my MYR-only spend").

---

## 6. Same-name handling (resolves Q10)

### 6.1 Adopted design
- NOT auto-merged.
- Add-new-item form: select-or-create dropdown with **fuzzy match** (top 3 results) showing similar names, last-seen date, location, thumbnail.
- One-click "use this one" sets `catalog_id` to existing.
- Transfer-history button on item detail page.

### 6.2 Mitigation features
1. **Aggressive "did you mean?"** in add-new flow — top 3 fuzzy matches on `name_norm` via Levenshtein distance ≤ 3 OR token-overlap ≥ 0.6.
2. **Periodic merge nudge** widget on Settings → Catalog: "5 items look like duplicates — review?" with side-by-side comparison.
3. **Two-step transfer flow:**
   - Step 1: select source catalog row.
   - Step 2: select destination + see preview ("12 events, $87 of price history, 3 waste records will move").
   - Step 3: confirm → audit log entry written.
4. **7-day reversal** via `transfer_audit_log` + tombstone records on source catalog (soft-deleted with `reversal_pending` flag).
5. **base_unit_label conflict warning** when source ≠ destination ("Source uses 'egg' as base unit; destination uses 'pack'. Continue?").

### 6.3 Transfer mechanics
- Update every `purchase_event` row that pointed at source `catalog_id` → re-point to destination `catalog_id`.
- Aggregate destination's counters (`logical_purchase_count`, `total_event_count`, waste counters, price aggregates) by re-scanning re-pointed events.
- Source catalog row: soft-delete with tombstone for 7 days (so reversal is cheap), then hard-delete.
- All inside a Firestore transaction (or batched 500-write commits with re-try if exceeded).

### 6.4 What v1 does NOT do
- Does NOT support "split a catalog" (move *some* events from A to B). Whole-row transfer only. Split mode deferred.
- Does NOT support "duplicate" semantics (merge into B but keep A). Always consolidates.
- Does NOT auto-suggest transfers. User-initiated only (with the merge-nudge widget being a passive suggestion).

---

## 7. Phases

Total estimated: **27h** of focused work, paused per phase for sign-off.

Recommended order: **F → 0 → A → B → C → D → E → G**.
F first because it independently addresses the "numbering not tally" symptom without depending on any schema change.

---

### Phase F — Diagnostic audit endpoint (1h) — ✓ COMPLETE (local; awaiting deploy approval)

**Goal:** answer "is the numbering wrong?" without changing schema. Read-only.

**Delivered (local, unpushed):**
- [admin_diagnostic_service.py](F:\ClaudeProjects\GroceryApp\backend\app\services\admin_diagnostic_service.py) — `compute_catalog_counter_diagnostics(user_id)` recomputes per-row counters
- `GET /api/admin/diagnostic/catalog-counters?user_id=...` added to [admin.py](F:\ClaudeProjects\GroceryApp\backend\app\api\routes\admin.py)
- [CatalogCountersDiagnosticPage.tsx](F:\ClaudeProjects\GroceryApp\backend\web-admin\src\pages\admin\CatalogCountersDiagnosticPage.tsx) — summary cards + top-inflated + top-drift + full sortable table + orphan events
- Sidebar nav link 🩺 "Counter Diagnostic" added
- Router wired at `admin/catalog-counters`
- TypeScript types in [api.ts](F:\ClaudeProjects\GroceryApp\backend\web-admin\src\types\api.ts) + query hook + endpoint constant + qk key
- 5 integration tests in [test_admin_diagnostic.py](F:\ClaudeProjects\GroceryApp\backend\tests\integration\test_admin_diagnostic.py): baseline, partial-split inflation, full-terminal-no-inflation, storage drift detection, orphan event surfacing

**Verification:** `ast.parse` ✓ · `tsc --noEmit` ✓ · `vite build` ✓ (chunk: 9.64 kB) · `pytest tests/integration/` 26/26 passed

**Scope freeze:**
- IN: new admin-only endpoint `GET /api/admin/diagnostic/catalog-counters?user_id=...` that returns:
  - per catalog row: stored `total_purchases`, recomputed-from-events `logical_purchase_count`, `total_event_count`, delta
  - flags rows where stored ≠ recomputed
  - returns top 10 most-divergent rows
- IN: simple admin UI page to render the report
- NOT IN: any write/fix. Purely diagnostic.
- DEPENDS ON: nothing.

**Deliverables:**
- `backend/app/routers/admin_diagnostic.py` (new)
- `backend/web-admin/src/pages/AdminDiagnosticPage.tsx` (new)
- Tab/link added to existing Admin Settings page

**Verification:**
- `pytest backend/tests/integration/test_admin_diagnostic.py` (Firestore emulator, seeded with split-heavy data)
- `tsc --noEmit` + `vite build` for web-admin
- Smoke: hit production endpoint with Shahir's user_id, eyeball delta

**Output expected:** confirms or refutes the "numbering not tally" theory with a per-catalog-row delta table. Sets baseline for Phase A migration validation.

---

### Phase 0 — Pre-migration audit dry-run (1h) — ✓ COMPLETE (local; awaiting deploy approval)

**Goal:** know exactly what the migration WILL do before it does anything.

**Delivered (local, unpushed):**
- [migration_v2_dry_run.py](F:\ClaudeProjects\GroceryApp\backend\app\services\migration_v2_dry_run.py) — `dry_run_for_user(uid)` predicts every doc change per §4.2 defaults; `dry_run_all_users()` aggregates across all users
- `GET /api/admin/migration/dry-run-v2?user_id=...` (single-user) and `?all_users=true` (aggregate) added to admin.py
- [MigrationDryRunPage.tsx](F:\ClaudeProjects\GroceryApp\backend\web-admin\src\pages\admin\MigrationDryRunPage.tsx) — pass/fail banner, catalog/event/user/store sections, ambiguous tables, sample-diff JSON, all-users mode with per-user table
- Sidebar nav 📋 "Migration Dry-Run" link
- Router wired at `admin/migration-dry-run`
- TypeScript types + 2 query hooks (single-user + all-users) + endpoint constant + qk key
- Conftest extended to clean up `users/{fresh_uid}` doc after each test
- 7 integration tests in [test_migration_v2_dry_run.py](F:\ClaudeProjects\GroceryApp\backend\tests\integration\test_migration_v2_dry_run.py): fresh-install classification, paid-user-no-TTL, split-as-non-logical, multi-currency, currency-defaulted-flag, clean-data-passes-threshold, all-users-aggregate

**Hard vs soft flags:** ambiguity flags split into HARD (block migration; counted toward `ambiguous_pct`) and SOFT (informational only). HARD: `missing_display_name`, `garbage_row`, `missing_quantity`, `non_numeric_price_or_quantity`, `orphan_event`. SOFT: `very_short_display_name`, `currency_defaulted` (defaults are part of plan §4.2, not "needs human triage"). Avoids spurious threshold failures when real data is fine but applies known defaults.

**Verification:** `ast.parse` ✓ · `tsc --noEmit` ✓ · `vite build` ✓ · `pytest tests/integration/` 33/33 passed (no regressions)

**Scope freeze:**
- IN: `GET /api/admin/migration/dry-run-v2` — read-only, predicts every doc change, returns counts + sample diffs
- IN: report includes ambiguous-row flags (catalog with both barcode + signs of rename, events with no inferable base_unit, etc.)
- NOT IN: writes.
- DEPENDS ON: nothing.

**Deliverables:**
- `backend/app/services/migration_v2_dry_run.py` (new)
- Endpoint registered under existing admin router
- Report renderable in admin UI as collapsible sections

**Verification:**
- pytest with seeded mock data (fresh-install + split-heavy + multi-currency-hint scenarios)
- Manual: run on production data, eyeball ambiguous-row count; if > 5% of total, pause and triage

**Output:** PASS = report shows expected mode classification, defaults make sense, ambiguous rows are < 5% of total. FAIL = pause migration, address ambiguities first.

---

### Phase A — Schema + migration script (4h) — ✓ COMPLETE (local; awaiting deploy + production fire)

**Goal:** the actual one-shot migration.

**Delivered (local, unpushed):**
- [migration_v2.py](F:\ClaudeProjects\GroceryApp\backend\app\services\migration_v2.py) — `run_migration(actor_uid, confirm)` orchestrator + `_migrate_user`, `_build_catalog_update`, `_build_event_update`, `_build_user_update`, `_ensure_unknown_store`. 500-write batched commits, idempotent via `schema_version` markers, error-collecting per-doc.
- Endpoints in [admin.py](F:\ClaudeProjects\GroceryApp\backend\app\api\routes\admin.py): `POST /api/admin/migration/run-v2` (requires `{confirm: true}` body), `GET /api/admin/migration/audit-log`, `GET /api/admin/migration/audit-log/{run_id}`
- [AdminMigrationPage.tsx](F:\ClaudeProjects\GroceryApp\backend\web-admin\src\pages\admin\AdminMigrationPage.tsx) — three-checkbox pre-flight (Firestore export / dry-run reviewed / emulator dress-rehearsal) + type-RUN-MIGRATION confirmation modal + audit-log table with per-run detail
- [CatalogCleanupBanner.tsx](F:\ClaudeProjects\GroceryApp\backend\web-admin\src\components\banners\CatalogCleanupBanner.tsx) — post-migration nudge (visible when `user.schema_version >= 2` and not yet dismissed); persists dismissal in localStorage; mounted in AppLayout above `<Outlet />`
- `/api/me` extended to return `schema_version` (used by the banner)
- Sidebar nav ⚙️ "Migration Run" link (next to 📋 dry-run)
- Router wired at `admin/migration-run`
- 7 integration tests in [test_migration_v2.py](F:\ClaudeProjects\GroceryApp\backend\tests\integration\test_migration_v2.py): confirm-gate, fresh v1→v2 with full default verification, idempotent re-run, paid-user no-TTL, split events flagged non-logical, audit-log persistence, fx_rate=1.0 when currency==pref

**Idempotency contract:** every migrated doc gets `schema_version: 2` + `_migration_v2_applied_at` timestamp. Re-running skips matched docs. Per-user stats record `_skipped` counts so re-runs are visible in the audit log.

**Pre-flight gate (UI-enforced):** all three checkboxes + typed phrase "RUN MIGRATION" required to enable the fire button. Belt-and-braces backend `confirm=true` body check on the endpoint.

**Verification:** `ast.parse` ✓ · `tsc --noEmit` ✓ · `vite build` ✓ (chunk: AdminMigrationPage 7.97 kB) · `pytest tests/integration/` 40/40 passed (no regressions)

**Scope freeze:**
- IN: `POST /api/admin/migration/run-v2` — fires the migration. Idempotent. Batched. Logs to `migration_audit_log`.
- IN: all schema additions in §3 (new fields with defaults).
- IN: `schema_version: 2` markers on every migrated doc.
- IN: post-migration banner UI (frontend) with [Show me] [Dismiss] flow.
- NOT IN: pricing UI changes (Phase B). NOT IN: quota enforcement (Phase C). NOT IN: store_catalog UI (Phase D).
- DEPENDS ON: Phase 0 dry-run report shows < 5% ambiguity.

**Deliverables:**
- `backend/app/services/migration_v2.py` (new) — batched 500-write commits, idempotent, error-collecting
- Migration script triggered via admin endpoint, NOT auto-on-startup (explicit human gate)
- `backend/tests/integration/test_migration_v2.py` (new, emulator-based, idempotency + edge-cases tested)
- `backend/web-admin/src/pages/AdminMigrationPage.tsx` (new) — fire button + progress poll + audit-log viewer
- `backend/web-admin/src/components/banners/CatalogCleanupBanner.tsx` (new) — 60d-grace banner

**Verification:**
- pytest pass on emulator
- Manual: Firestore export taken; emulator dress-rehearsal diff vs production data; only after that, run on production
- Re-run migration; assert no doc changes (idempotency)
- Banner renders on first post-migration login; dismisses correctly

**Risk:** if migration partially fails (e.g., FX API down → no fallback yet because Phase B not shipped), some events miss display_amount/currency/fx fields. Phase A handles this by skipping FX call entirely and defaulting display_amount = amount; full FX wiring lands in Phase B.

---

### Phase B — Pricing + per-unit + currency (5h) — ✓ COMPLETE (local; awaiting deploy)

**Goal:** prices entered in any currency, stored with FX rate, displayed in user's preference, per-unit math correct.

**Delivered (local, unpushed):**
- [fx_rate_service.py](F:\ClaudeProjects\GroceryApp\backend\app\services\fx_rate_service.py) — Firestore-cached, frankfurter.app fetcher (free, no key), 7d stale fallback. Cache miss → API → 7d fallback → null. `list_recent` + `evict_cache` for admin inspection.
- [currency_service.py](F:\ClaudeProjects\GroceryApp\backend\app\services\currency_service.py) — `convert_to_display(amount, from, to, date)` returning `{display_amount, display_currency, fx_rate_at_save, fx_rate_date, is_stale}`. Identity short-circuit + graceful None handling.
- `purchase_event_service.create_purchase` — extended with `pack_size`, `base_unit_label`, `store_id`, `multi_pack_parent_id` params; computes display fields + `unit_price` (in display currency) at save; stamps `schema_version=2` on writes.
- `create_multi_pack` — N events sharing a uuid `multi_pack_parent_id`; each event = one pack (`quantity=1`, `pack_size=units_per_pack`, `price=price_per_pack`). Per-unit price falls out as `price_per_pack / units_per_pack`.
- New endpoints: `POST /api/purchases/multi-pack`, `PUT /api/me/currency-preference`, `GET/DELETE /api/admin/fx-rates`, `GET /api/admin/fx-rates/lookup`.
- `/api/me` extended with `currency_preference`.
- [QuickAddModal](F:\ClaudeProjects\GroceryApp\backend\web-admin\src\components\quickadd\QuickAddModal.tsx) — currency dropdown next to price (with cross-currency hint when ≠ user pref); multi-pack toggle that hides single-qty row and shows pack_count × units_per_pack × price_per_pack inputs with live total + per-unit auto-compute. Save button text adapts (`Save 6 packs`).
- [PurchaseEventDetailPage](F:\ClaudeProjects\GroceryApp\backend\web-admin\src\pages\my-items\PurchaseEventDetailPage.tsx) — new `PriceCell` component shows original currency, ≈ display-currency conversion with FX rate + locked date, per-unit price (`SGD 1.83 / egg`), pack-size row, multi_pack_parent_id row when applicable.
- [DisplayCurrencySection](F:\ClaudeProjects\GroceryApp\backend\web-admin\src\components\settings\DisplayCurrencySection.tsx) — Settings → "Display currency" picker that calls `PUT /api/me/currency-preference` and refreshes the auth-store snapshot so QuickAdd + banners pick up the change.
- 15 new integration tests in [test_currency_phase_b.py](F:\ClaudeProjects\GroceryApp\backend\tests\integration\test_currency_phase_b.py): FX identity / cache hit / API miss writes cache / stale fallback / no rate; currency convert identity / safe-none / via service; create_purchase locks fx=1 when matching / converts cross-currency / handles FX unavailable / defaults SGD; multi-pack 6×6@10.99 (parent_id, fields, total=65.94, validates inputs).
- Migration tests updated with `_downgrade_user_data_to_v1` helper since the production write path now stamps v2 directly.

**Subtle calls:**
- **unit_price is in display currency, not original.** Lets cross-store comparison work. Plan §3.2 implied this; tests pin the choice (`unit_price = display_amount / quantity / pack_size`).
- **fx_rate_at_save = None** when API fails AND no cache. Event still created; backfill is a future Phase B optional task.
- **Frankfurter.app** chosen over keyed APIs (exchangerate-api.com) — free, no signup, no key in repo. ECB-rate based. `urllib` sync calls with 5s timeout.
- **VALID_SOURCES** required `multi_pack` not added; multi-pack uses the existing `manual` source. Saves a metadata-validation update.

**Verification:** `ast.parse` ✓ · `tsc --noEmit` ✓ · `vite build` ✓ · `pytest tests/integration/` 55/55 passed (15 new + 40 prior, no regressions)

**Scope freeze:**
- IN: backend `fx_rate_service.py` with cache + fetch + stale fallback
- IN: `currency_service.py` — convert at save time
- IN: form UI: currency dropdown next to price input, defaults to user.currency_preference
- IN: per-unit display on item detail + My Items hover ("$1.83/egg")
- IN: pack_size toggle in QuickAddModal — if opened, generates N child rows under multi_pack_parent_id
- IN: settings → "Display currency" picker (write to user.currency_preference)
- NOT IN: historical re-aggregation when user changes preference
- NOT IN: multi-currency report views
- DEPENDS ON: Phase A (schema fields exist on events)

**Deliverables:**
- `backend/app/services/fx_rate_service.py` (new)
- `backend/app/services/currency_service.py` (new)
- `backend/app/routers/fx_rates.py` (new) — admin debug endpoint to inspect cache
- `backend/web-admin/src/components/quickadd/QuickAddModal.tsx` (modified) — pack_size toggle, currency dropdown
- `backend/web-admin/src/components/items/ItemDetailPage.tsx` (modified) — per-unit + currency display
- `backend/web-admin/src/pages/SettingsPage.tsx` (modified) — display currency picker
- Tests: integration tests for FX cache hit/miss/stale, multi-currency event create, pack_size auto-generation

**Verification:**
- pytest + tsc + vite build
- Manual: enter SGD price, confirm display = SGD, fx_rate_at_save = 1.0; enter MYR price, confirm display = SGD with conversion, fx_rate stored
- Manual: pack_size toggle creates N children, parent has multi_pack_parent_id null and is_parent flag, children point at parent
- Manual: 6 packs × 10.99 = 65.94 in display

---

### Phase C — Quota + idle TTL + cascade (5h) — ✓ COMPLETE (local; awaiting deploy)

**Goal:** the 50-cap quota is enforced, the 30d idle clock ticks, cascades fire correctly, paid users are exempt.

**Delivered (local, unpushed):**
- [quota_service.py](F:\ClaudeProjects\GroceryApp\backend\app\services\quota_service.py) — `get_quota_status` (with pre-migration fallback), `check_or_raise`, `consume`/`release` (firestore.Increment), `reconcile_count` (drift fix), `list_eviction_candidates` (sort by oldest / expiry).
- [idle_clock_service.py](F:\ClaudeProjects\GroceryApp\backend\app\services\idle_clock_service.py) — `tick(user_id, name_norm)` extends `idle_expires_at` 30d; no-ops for global_linked + paid users; `tick_safe` swallows errors. `cascade_one` is mode-aware (a: catalog removed, events stay; b: hard-delete catalog + events). `run_cascade` orchestrates with `cascade_audit_log` write.
- [QuotaExceededError](F:\ClaudeProjects\GroceryApp\backend\app\core\exceptions.py) → maps to HTTP 409 via existing DomainError handler with `details: {type, used, limit, eviction_candidates}` payload.
- `catalog_service.upsert_catalog_entry` — sets `catalog_mode` (barcode→global_linked, none→user_custom), stamps `canonical_name` + `idle_expires_at` (30d for free user_custom, null otherwise), enforces quota via `quota_service.check_or_raise`, consumes 1 slot post-create.
- `purchase_event_service.create_purchase` + `move_to_location` — call `idle_clock_service.tick_safe` after commit so buy/transfer counts as a "touch."
- 4 admin endpoints: `GET /admin/idle-clock/expired`, `POST /admin/idle-clock/cascade` (with `confirm: true` gate), `GET /admin/idle-clock/audit-log`, `POST /admin/quota/reconcile/{uid}`.
- 1 user endpoint: `GET /api/me/quota?sort_by=oldest|expiry` (status + eviction candidates).
- [QuotaHitPicker](F:\ClaudeProjects\GroceryApp\backend\web-admin\src\components\quota\QuotaHitPicker.tsx) — modal with sortable candidate list + Remove buttons (uses `force=true` so active purchases don't block eviction).
- QuickAddModal — wired with `isQuotaExceededError` interceptor; 409 → opens QuotaHitPicker → auto-retries `handleSave()` after user removes a row.
- 19 integration tests in [test_quota_phase_c.py](F:\ClaudeProjects\GroceryApp\backend\tests\integration\test_quota_phase_c.py): pre-migration live count, check_or_raise at cap, skip for global_linked, consume/release, reconcile drift, create blocked at cap, global_linked not blocked, user_custom consumes quota, paid no clock, free 30d clock, tick advances, tick no-op for global/paid, auto-tick on create, cascade mode-a (events stay), mode-b (events deleted), quota decrement on cascade, paid skipped, run_cascade audit log.

**Subtle calls:**
- **Phase C does NOT include an automatic scheduler.** Admin must POST `/admin/idle-clock/cascade` to fire it. Auto-scheduling lands when the project picks a job runner (likely with the Phase D paid-tier work).
- **Mode (a) cascade leaves events as orphans.** They display via `catalog_display` (denormalized) until reconciled. Phase F counter diagnostic surfaces them. Phase G transfer-history flow can re-attach.
- **`force=true` on quota eviction**: the user is consciously freeing a slot, so existing active purchases don't block the delete. The picker copy explains the behavior per mode.
- **Picker wired via mutation onError + retry recursion.** The `onResolved` callback re-invokes `handleSave()`, which submits the same payload. State persists in QuickAddModal across the picker open/close.

**Verification:** `ast.parse` ✓ · `tsc --noEmit` ✓ · `vite build` ✓ · `pytest tests/integration/` 74/74 passed (19 new + 55 prior, no regressions)

**Scope freeze:**
- IN: `quota_service.py` — check on catalog-create, return error or trigger picker UI
- IN: `idle_clock_service.py` — scheduled daily Cloud Function that checks `idle_expires_at < now`, fires cascade
- IN: cascade logic: mode (a) → remove catalog row, re-resolve events to global; mode (b) → hard-delete events + waste history
- IN: quota-hit picker UI — sortable by oldest / by expiry-rank
- IN: clock-reset hook on scan-touch events (buy, add to grocery list, transfer)
- IN: paid-user exemption — `is_paid=true` users have `idle_expires_at = null`
- NOT IN: paid billing/Stripe (manual admin toggle)
- NOT IN: admin soft-delete toggle (deferred until DB capacity becomes a real concern)
- DEPENDS ON: Phase A (schema), Phase B (so users have a settled UX before quota kicks in)

**Deliverables:**
- `backend/app/services/quota_service.py` (new)
- `backend/app/services/idle_clock_service.py` (new)
- `backend/app/scheduled/idle_cleanup_job.py` (new) — daily Cloud Function entry point
- `backend/web-admin/src/components/quota/QuotaHitPicker.tsx` (new) — sortable removal UI
- Frontend hooks in scan, grocery-list-add, transfer flows to call clock-reset
- Tests: cascade-on-mode-a (events stay), cascade-on-mode-b (events deleted), paid-user-no-cascade, quota-hit-picker-flow, clock-reset-on-touch (NOT on view-scan)

**Verification:**
- pytest + tsc + vite build
- Manual: create 50 user_custom items, attempt 51st, picker fires; pick oldest, 51st creates
- Manual: set `idle_expires_at` to past, run job, mode (a) cascade leaves events visible with reverted name; mode (b) cascade deletes
- Manual: scan-and-buy resets `idle_expires_at`; pure scan-and-back does NOT
- Manual: toggle is_paid=true on user, run job, no cascade

---

### Phase D — Store catalog + paid-tier flag (2h) — ✓ COMPLETE (local; awaiting deploy)

**Goal:** users can record where they bought, with select-or-create dropdown, 30-cap quota.

**Delivered (local, unpushed):**
- [store_catalog_service.py](F:\ClaudeProjects\GroceryApp\backend\app\services\store_catalog_service.py) — list / get / search (prefix + substring, ranked by use_count) / create (idempotent on dup name, 30-cap quota check) / update / delete (refuses to remove auto "unknown" sink) / `touch_store` to bump use_count + last_used_at.
- [stores.py router](F:\ClaudeProjects\GroceryApp\backend\app\api\routes\stores.py) — `GET /api/stores`, `GET /api/stores/quota`, `GET /api/stores/search?q=`, `GET/PUT/DELETE /api/stores/{id}`, `POST /api/stores`. Mounted under both `/api` and `/api/v1`.
- `purchase_event_service.create_purchase` + `create_multi_pack` now accept `store_id` and call `store_catalog_service.touch_store` after commit. `PurchaseCreate` schema extended with `store_id`.
- [StoreSelect](F:\ClaudeProjects\GroceryApp\backend\web-admin\src\components\stores\StoreSelect.tsx) — combobox: type-to-search → top match → Enter picks; `+ Create new "X"` prompt for unmatched names; surfaces 409 quota errors via `onQuotaExceeded`.
- QuickAddModal — new Store field in More-details section + multi-pack section, passes `store_id` to both create paths.
- PurchaseEventDetailPage — Store row shows resolved name (via cached `useStores`) or `Unknown / Other` for the auto sink.
- [TierToggle](F:\ClaudeProjects\GroceryApp\backend\web-admin\src\pages\users\UserDetailPage.tsx) — inline tier picker (`free / plus / pro`) on the admin user detail page using existing `useChangeTier` hook. Plus/Pro = paid for catalog idle-clock + cascade exemption.
- 11 integration tests in [test_stores_phase_d.py](F:\ClaudeProjects\GroceryApp\backend\tests\integration\test_stores_phase_d.py): create consumes quota, idempotent on dup name, blocks at 30-cap, validates empty name, search prefix-first ranking, delete releases quota, refuses unknown delete, NotFound on missing, purchase-with-store-id touches store, default to "unknown", pre-migration live count.

**Subtle calls:**
- **Idempotent create** — re-submitting the same store name returns the existing row instead of failing or creating a duplicate. Quota only consumed once.
- **"unknown" auto-sink protected** — delete refuses since it holds events the user hasn't categorized.
- **Tier toggle has no Stripe billing** — manual admin flip per scope freeze. The `is_paid` derived flag reads from `tier`, so flipping tier instantly affects quota / clock / cascade behavior (no separate sync needed).

**Verification:** `ast.parse` ✓ · `tsc --noEmit` ✓ · `vite build` ✓ · `pytest tests/integration/` 85/85 passed (11 new + 74 prior, no regressions)

**Scope freeze:**
- IN: `store_catalog_service.py` (CRUD + quota check)
- IN: store dropdown on QuickAddModal + ItemDetailPage edit form
- IN: select-or-create UX (free text input that auto-suggests existing matches)
- IN: store quota-hit UI (similar to catalog quota-hit)
- IN: admin user-management page with `is_paid` toggle
- NOT IN: store analytics page (deferred — "we will analysis later")
- DEPENDS ON: Phase A (store_catalog collection exists from migration)

**Deliverables:**
- `backend/app/services/store_catalog_service.py` (new)
- `backend/app/routers/stores.py` (new)
- `backend/web-admin/src/components/stores/StoreSelect.tsx` (new) — combobox with fuzzy match
- `backend/web-admin/src/pages/AdminUsersPage.tsx` (new) — is_paid toggle per user
- Tests: store create + quota check, select-existing, free-text-suggests-existing-match

**Verification:**
- pytest + tsc + vite build
- Manual: type "Tes" in store dropdown, see "Tesco" suggested; pick it, store_id assigned
- Manual: type "NewStore", confirm create, store_quota_used increments
- Manual: 30 stores → 31st triggers quota picker
- Manual: admin toggles user is_paid=true → user.is_paid reflects

---

### Phase E — My Items quick-view + overview rewrite (5h) — ✓ COMPLETE (local; awaiting deploy)

**Goal:** the per-item card shows Name + Location + Qty + Expiry badge cleanly. The item detail page shows complete history (lineage, movement, waste, pricing, store).

**Delivered (local, unpushed):**
- [catalog_overview_service.py](F:\ClaudeProjects\GroceryApp\backend\app\services\catalog_overview_service.py) — `compute_overview(user_id, name_norm)` aggregates per-catalog: counters (logical vs event), lifetime breakdown by quantity, waste rate by quantity, movement timeline (purchased / split_used / split_thrown / split_given / moved), split lineage (parent → children), price history per store with mean / min / max / latest unit_price.
- `GET /api/catalog/{name_norm}/overview` — full read-only aggregation. Existing `/api/catalog/{name_norm}` kept for backward compat.
- 4 new frontend components in `components/items/`:
  - [LifetimeUnitBreakdown](F:\ClaudeProjects\GroceryApp\backend\web-admin\src\components\items\LifetimeUnitBreakdown.tsx) — stacked bar + per-state qty breakdown + headline waste %
  - [MovementTimeline](F:\ClaudeProjects\GroceryApp\backend\web-admin\src\components\items\MovementTimeline.tsx) — chronological event list newest-first with action labels
  - [SplitLineageTree](F:\ClaudeProjects\GroceryApp\backend\web-admin\src\components\items\SplitLineageTree.tsx) — parent rows with nested split-children, status colors
  - [PriceHistoryTable](F:\ClaudeProjects\GroceryApp\backend\web-admin\src\components\items\PriceHistoryTable.tsx) — per-store cards (cheapest mean highlighted "Cheapest"), expandable per-sample drilldown
- [CatalogEntryPage](F:\ClaudeProjects\GroceryApp\backend\web-admin\src\pages\catalog\CatalogEntryPage.tsx) — replaces "Recent purchases" with the four new sections + uses `logical_purchase_count` for the headline counter (with explainer copy when split events inflate `total_event_count`).
- `useCatalogOverview` query hook + ~10 type exports for the overview shape.
- 8 backend integration tests in [test_catalog_overview_phase_e.py](F:\ClaudeProjects\GroceryApp\backend\tests\integration\test_catalog_overview_phase_e.py): 404 on missing catalog, logical vs event-count divergence on split, lifetime quantity-based (not event-based), waste-rate quantity-based (16.67% not 50%), lineage tree groups children, timeline ordered, price history per store with mean/min/max + cheapest-first sort, no-price events excluded.

**Subtle calls:**
- **logical_purchase_count is computed live**, not stored on the catalog row. The diagnostic endpoint already does this; the overview reuses the same math. Stored `total_purchases` left as the legacy event-count counter (renaming would touch many call sites — Phase G can finish the migration).
- **Waste rate is by quantity**, not event count. Throwing 2 of 12 eggs → 16.7% (not 50% as event-count would say).
- **Lifetime breakdown sums quantities** straight; multi-pack `pack_size` not multiplied (each event's quantity is "packs" in that schema). UI labels with `base_unit_label` so the user reads it correctly.
- **MyItemsPage card untouched.** Already has Name + Location + Qty + Expiry-badge + Price; the spec ("Name • Location • Qty • Expiry badge") is the minimum, and Price is welcome extra. Removing live functionality wasn't in scope.

**Verification:** `ast.parse` ✓ · `tsc --noEmit` ✓ · `vite build` ✓ · `pytest tests/integration/` 93/93 passed (8 new + 85 prior, no regressions)

**Scope freeze:**
- IN: My Items card redesign — Name • Location • Qty per active row • Expiry status badge (color-coded: green active, yellow expiring 1-3d, red expired, gray no-expiry)
- IN: item detail page — completes:
  - Split lineage tree (which events split from which)
  - Movement timeline (location changes via move_to_location)
  - Lifetime unit breakdown (X used, Y thrown, Z given, A active across all events)
  - Price history per store + per-unit comparison ("$1.83/egg @ Tesco vs $1.95/egg @ wet market")
  - Waste-rate per catalog (% by quantity, not by event count)
- IN: catalog counter math fix — use `logical_purchase_count` everywhere user-facing, `total_event_count` only on diagnostic page
- NOT IN: insight-tier analytics that span catalogs (already exists in InsightsPage; keep)
- DEPENDS ON: Phase A (schema), Phase B (pricing for per-unit comparison), Phase F (counter math validated)

**Deliverables:**
- `backend/web-admin/src/pages/MyItemsPage.tsx` (modified) — card redesign
- `backend/web-admin/src/components/items/ItemDetailPage.tsx` (heavily modified) — full history sections
- `backend/web-admin/src/components/items/SplitLineageTree.tsx` (new)
- `backend/web-admin/src/components/items/MovementTimeline.tsx` (new)
- `backend/web-admin/src/components/items/LifetimeUnitBreakdown.tsx` (new)
- `backend/web-admin/src/components/items/PriceHistoryTable.tsx` (new)
- Backend: ensure `logical_purchase_count` is the field returned in all catalog-list endpoints; legacy `total_purchases` returns same value for backward compat
- Tests: lineage-renders-correctly, movement-timeline-orders-by-time, lifetime-breakdown-quantities-not-events

**Verification:**
- pytest + tsc + vite build
- Manual: smoke test on Shahir's account post-migration — eggs purchase with splits/moves shows complete lineage; numbering tallies with mental model
- Manual: card on My Items shows Name + Location + Qty + Expiry, no clutter
- Manual: per-unit comparison renders for items with >1 store

---

### Phase G — Transfer-history flow + audit log (4h) — ✓ COMPLETE (local; awaiting deploy)

**Goal:** user can consolidate two catalog rows manually, safely, reversibly.

**Delivered (local, unpushed):**
- [catalog_similarity_service.py](F:\ClaudeProjects\GroceryApp\backend\app\services\catalog_similarity_service.py) — `similarity_score` (max of Levenshtein + token-jaccard), `find_similar` (top-N for "did you mean?"), `find_likely_duplicates` (pairwise sweep, capped at 200 rows, barcode-shared pairs auto-promoted to score 0.95).
- [catalog_transfer_service.py](F:\ClaudeProjects\GroceryApp\backend\app\services\catalog_transfer_service.py) — `preview_transfer` (event count + unit-mismatch warning), `execute_transfer` (re-point events in 450-batch chunks, soft-delete via audit log snapshot, 7d reversal token, quota release on user_custom), `reverse_transfer` (window check + restore from snapshot + re-point back + quota re-consume), `list_transfers`.
- 6 new endpoints under `/api/catalog/_/`: similar / duplicates / transfer/preview / transfer/execute / transfer/{id}/reverse / transfer/log.
- 3 new frontend components:
  - [TransferHistoryFlow](F:\ClaudeProjects\GroceryApp\backend\web-admin\src\components\items\TransferHistoryFlow.tsx) — 3-step wizard (pick destination via search + similarity ranking → preview with unit-mismatch warning → confirm), navigates to dst on success.
  - [DidYouMeanSuggestions](F:\ClaudeProjects\GroceryApp\backend\web-admin\src\components\quickadd\DidYouMeanSuggestions.tsx) — top 3 fuzzy matches inline in QuickAddModal name field; one-click "use this" sets matchedEntry to the existing row.
  - [MergeNudgeWidget](F:\ClaudeProjects\GroceryApp\backend\web-admin\src\components\settings\MergeNudgeWidget.tsx) — likely-duplicate pairs + collapsible recent-transfers log with Reverse button while window is open.
- Wired: Transfer button on CatalogEntryPage; DidYouMeanSuggestions in QuickAddModal; MergeNudgeWidget in Settings.
- 16 backend integration tests: similarity (identity / distant / typo), find_similar ranking, find_likely_duplicates barcode-shared, preview (event count / unit-mismatch / same-src-dst rejected / 404), execute (re-point + delete + quota release), overlapping dates kept, reverse (within 7d / after window / already-reversed / src-already-exists), list ordering.

**Subtle calls:**
- **Counter recompute over increment.** Both execute and reverse recompute dst counters (and src on reverse) from raw events. Re-pointing churn would corrupt incremental counters; reads are O(N) per affected catalog but N is per-catalog small.
- **Snapshot-before-delete.** Source catalog row is captured into the audit doc before deletion — reverse restores from the snapshot, no separate tombstone collection.
- **Reverse refuses if src exists.** If the user re-creates the same `name_norm` post-transfer, reverse blocks rather than clobbering. Operator must reconcile manually.
- **Re-pointed events check current location** on reverse. If the user manually moved an event to a third catalog after the transfer, reverse leaves it there rather than yanking it back.
- **`/api/catalog/_/...` namespace** — uses underscore prefix to avoid colliding with `/api/catalog/{name_norm}` (which would otherwise capture `transfer`, `similar`, etc.).

**Verification:** `ast.parse` ✓ · `tsc --noEmit` ✓ · `vite build` ✓ · `pytest tests/integration/` 109/109 passed (16 new + 93 prior, no regressions)

**Scope freeze:**
- IN: transfer-history button on item detail page
- IN: 3-step flow: source → destination + preview → confirm
- IN: `transfer_audit_log` writes
- IN: 7-day reversal via tombstone + reversal_token
- IN: base_unit_label mismatch warning
- IN: merge-nudge widget on Settings → Catalog (passive suggestion list of likely-duplicate pairs)
- IN: "did you mean?" in QuickAddModal add-new flow (top 3 fuzzy matches)
- NOT IN: split-mode (move some events, not all). Whole-row transfer only.
- NOT IN: duplicate-mode (merge but keep both). Consolidation only.
- DEPENDS ON: Phase E (item detail page rewrite)

**Deliverables:**
- `backend/app/services/catalog_transfer_service.py` (new)
- `backend/app/routers/catalog_transfer.py` (new) — POST/transfer, POST/reverse, GET/log
- `backend/app/services/catalog_similarity_service.py` (new) — Levenshtein + token-overlap fuzzy match
- `backend/web-admin/src/components/items/TransferHistoryFlow.tsx` (new) — 3-step wizard
- `backend/web-admin/src/components/quickadd/DidYouMeanSuggestions.tsx` (new)
- `backend/web-admin/src/components/settings/MergeNudgeWidget.tsx` (new)
- Tests: transfer-with-overlapping-dates-keeps-all, transfer-with-unit-mismatch-warns, reversal-within-7d-restores, reversal-after-7d-fails

**Verification:**
- pytest + tsc + vite build
- Manual: create 2 catalog rows ("Eggs" + "Free-range eggs") with overlapping events; transfer; events re-point; counters re-aggregate; tombstone exists
- Manual: reverse within 7d → restores
- Manual: type new item name in QuickAdd, see top 3 fuzzy matches; one-click reuse
- Manual: settings widget shows duplicate candidates correctly

---

## 8. Open risks & mitigations

| # | Risk | Mitigation |
|---|---|---|
| 1 | **60-day grace clock** silently deletes data for offline users | post-migration banner; email notice if email integration ships; admin can manually extend grace per user |
| 2 | **FX API failure during Phase B** | stale-rate fallback (7d window); flag price as approximate; manual rate override in admin |
| 3 | **Migration script bug** corrupts production data | mandatory Firestore export before run; emulator dress-rehearsal; idempotent re-run; rollback via import |
| 4 | **Pre-existing pagination bug** (fixed 2026-04-30) regresses across migration | regression test suite already in place; include in CI for Phase A |
| 5 | **Multi-pack auto-generated children desync** (parent counter wrong, children orphaned) | transactional create with parent_id link verified; integration test with 6-pack scenario |
| 6 | **Transfer-history corrupts counters** (drift between event sum and catalog counter) | post-transfer recompute step verifies counter == sum(events); fail loud, not silent |
| 7 | **Fuzzy-match false positives** ("Milk" suggests "Honey-flavored milk powder") | tune Levenshtein threshold during Phase G; show suggestions but never auto-apply |
| 8 | **Currency drift** (user changes profile currency mid-flight) | display_amount stays locked at save; profile change does NOT retroactively re-convert; documented behavior |

---

## 9. Verification gates (per phase)

| Gate | Command | When |
|---|---|---|
| Backend type check | `python -m py_compile <files>` or `ast.parse` per CLAUDE.md | every backend edit |
| Backend test | `pytest backend/tests/integration/<test_file>` (Firestore emulator) | end of phase |
| Frontend type check | `tsc --noEmit` | every frontend edit |
| Frontend bundle check | `vite build` | end of frontend phase or any new third-party import |
| Local smoke | manual checklist per phase | end of phase |
| Production deploy | two-remote: `git push origin main && git push render main:master` | after sign-off |
| Production smoke | manual checklist on Shahir's account | after deploy |

Render-push safeguard: first push hits "pushing to default branch bypasses PR review" warning. Surface to user, await explicit re-approval per push.

---

## 10. Sign-off and progress tracking

This plan file is the living source of truth. As phases complete, this file is updated:

- Phase headings get status markers: `✓ COMPLETE` / `⚠ PARTIAL` / `✗ BLOCKED` / `⏸ DEFERRED`
- Deviation notes appended under each phase as they happen
- Final deployment commit SHAs recorded per phase

**Current status:** awaiting sign-off → start Phase F.

**Sign-off checklist:**
- [ ] Decisions table (§2.2) reviewed; corrections flagged
- [ ] Schema delta (§3) reviewed; field names approved
- [ ] Migration approach (§4) reviewed; defaults table approved
- [ ] Currency model (§5) reviewed; FX provider acceptable
- [ ] Same-name handling (§6) reviewed; mitigation features approved
- [ ] Phase order (§7) reviewed; F-first agreed
- [ ] Open risks (§8) reviewed; mitigations acceptable
- [ ] **GO signal: "go phase F"** → I start coding

Until that signal, no implementation. This is the lock per the no-code-until-locked promise.
