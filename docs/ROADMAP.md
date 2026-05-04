# GroceryApp Roadmap

Supersedes `C:\Users\Shahir\.claude\plans\hidden-yawning-shamir.md` (complete as of 2026-04-23).

**Pre-validation triage docs (use these first):**
- [`docs/FREE_FIXES_BACKLOG.md`](FREE_FIXES_BACKLOG.md) — code/config improvements that cost nothing. Knock these out before paid work.
- [`docs/PAID_ENHANCEMENTS.md`](PAID_ENHANCEMENTS.md) — items requiring subscriptions or paid services. Each has trigger criteria so we don't spend prematurely.

---

## ✅ Shipped — 2026-04-23 refactor

Summary only. Detailed phase log lives in `.claude/memory/MEMORY.md`.

- **Data model** — `catalog_entries` (global, `{uid}__{name_norm}` doc IDs) + `users/{uid}/purchases` + `users/{uid}/{reminders,cache,insights}`
- **Backend** — 159 routes (25 refactor-era) across 8 new routers, 8 new services, 9 scheduler jobs, 4 migration/integrity scripts, 73 pytests
- **Frontend (web admin)** — full refactor UX: QuickAddModal, MyItemsPage, PurchaseEventDetailPage, Catalog pages, Dashboard with HealthBar + 5 cards + nudges + insights, ContextualScannerModal + ScanResultPanel + FloatingScanButton + NameUnknownItemModal, ThrowAway + GiveAway modals, sidebar primary/More split, FeatureFlagsTab + route-level FeatureFlagGate
- **Safety** — firestore.rules for catalog/purchases/reminders/insights, 16 composite indexes, public `/api/features/public` endpoint, per-uid rate limit, integrity + rollback scripts
- **Docs** — API.md / WORKFLOWS.md / BACKEND.md appended, 6 page docs, operational checklist in MEMORY

**Mobile** still on legacy endpoints — works via `compat/legacy_item_shim.py` when `legacy_endpoints_use_new_model` flag is on post-migration.

---

## 🔴 Phase A — Production cutover (blocking; operational, no code)

Follow the ops checklist in [.claude/memory/MEMORY.md](../.claude/memory/MEMORY.md) before any new feature work touches prod.

1. `scripts/check_catalog_consistency.py` — snapshot state, expect 0 mismatches / 0 orphans
2. `scripts/migrate_grocery_items_to_purchases.py --dry-run` — verify counts match expectations
3. `scripts/migrate_grocery_items_to_purchases.py --execute --all` — live migration (logs per-user progress; idempotent)
4. `scripts/check_catalog_consistency.py --fix` — repair any counter drift
5. `scripts/fix_orphan_purchases.py --all --fix` — recreate missing catalog entries flagged for admin review
6. Firebase Console → Indexes — verify all 16 composite indexes "Enabled" (deploy `firestore.indexes.json` if manual)
7. `firebase deploy --only firestore:rules` — roll out Phase 2 security rules
8. Admin `/admin-settings` → Feature Flags → toggle `legacy_endpoints_use_new_model` **ON**
9. Monitor 24h: `/api/inventory/my` error rate · mobile app crash reports · `/api/purchases` 409 conflicts

**Rollback:** flag OFF + `scripts/rollback_purchases_migration.py --all --confirm-wipe`. Legacy `grocery_items` untouched by migration — source of truth preserved.

---

## 🟡 Phase B — Quality gates (before Phase D features)

Fill the testing gaps that were cut to ship Phase 5 on time.

### B1. Firestore emulator integration tests

- Files: `backend/tests/integration/test_catalog_txn.py`, `test_purchase_lifecycle.py`, `test_merge.py`
- Cover: concurrent catalog creates → one doc wins · status transitions → counters stay consistent · merge reparents events · barcode collision → 409
- Wiring: `FIREBASE_EMULATOR_HOST` env var, pytest fixture that starts emulator, fixture resets collections between tests
- Estimate: 1 day

### B2. Security-rule tests

- Dep: `@firebase/rules-unit-testing`
- Files: `backend/tests/security/test_catalog_rules.py`, `test_purchases_rules.py`
- Cover: User A cannot read User B's catalog · cannot create catalog entry with forged uid in doc ID · cannot delete entry with `active_purchases > 0`
- Estimate: 0.5 day

### B3. Migration fixture tests

- File: `backend/tests/migration/test_migrate_rollback.py`
- Seed fake `grocery_items` in emulator, run migration, assert catalog + purchases shape, run rollback, assert cleanup
- Cover status mapping (consumed→used, expired/discarded→thrown+reason)
- Estimate: 0.5 day

### B4. ~~CI/CD pipeline~~ ✅ 2026-04-23

- Extended existing `.github/workflows/backend-deploy.yml` — added `pytest` run (previously only ran `ruff` + import check)
- New `.github/workflows/web-admin-ci.yml` — TypeScript type-check (`tsc -b`) on PRs touching `backend/web-admin/**`
- `.github/workflows/firestore-rules.yml` — still TODO, pending B2 rule tests

### B5. Firebase deploy guide

- New doc `docs/FIREBASE_DEPLOY.md` — how to deploy `firestore.rules` + `firestore.indexes.json` + check build status in Firebase Console
- Estimate: 1h

### B6. ~~Unit test coverage gaps~~ ✅ 2026-04-23 (pure portions)

- ~~`tests/services/test_country_service.py` — GS1 prefix detection~~ ✅ (10 tests)
- ~~`tests/services/test_catalog_upsert_merge.py` — pure `_compute_upsert_updates` + `_compute_merge_updates` (extracted from upsert/merge)~~ ✅ (17 tests)
- ~~`tests/services/test_purchase_transitions.py` — status transition validation (extracted `validate_status_transition`)~~ ✅ (22 tests)
- Remaining (move to B1 emulator): FIFO sort key in `find_purchases_by_barcode`; integration-level catalog/purchase round-trip

### B7. ~~GDPR + ops tooling~~ ✅ 2026-04-23

- ~~`backend/scripts/export_user_data.py` — GDPR data-portability, JSON cascade export~~ ✅
- ~~`backend/scripts/delete_user_data.py` — GDPR right-to-erasure, cascade delete with `--confirm-wipe`, optional `--export-first`, `--keep-profile`~~ ✅
- ~~`backend/scripts/rebuild_catalog_analysis.py` — script form of analysis cache refresh~~ ✅

**Phase B total: ~4.5 days.**

---

## 🟢 Phase C — UX completion (leftover plan items)

Finite scope — each is a plan item I explicitly deferred or noted as incomplete.

### C1. Shopping-list scanner integration

- `ShoppingListDetailPage` — when FloatingScanButton scanned barcode matches an item in list, mark `bought`; else offer "Add to list"
- `ContextualScannerModal.context='shopping-lists'` — default action becomes `add_to_list` (currently falls back to `add_purchase`)
- New mutation `useMarkShoppingListItemBought`
- Estimate: 0.5 day

### ~~C2. GlobalSearchBar~~ ✅ shipped (verified 2026-05-04)

- ~~Fuzzy search across user's catalog + active purchases + recipes~~
- ~~Keyboard shortcut: `Cmd/Ctrl+K`~~
- ~~Placement: sticky top of `AppLayout`~~
- ~~`components/search/GlobalSearchBar.tsx` + `hooks/useGlobalSearch.ts`~~
- File present at `backend/web-admin/src/components/search/GlobalSearchBar.tsx`; mounted in `AppLayout.tsx`

### C3. Bulk "Add expiry to all" on UntrackedAgeBuckets

- Click bucket on dashboard → drill to `/my-items?filter=untracked&age=7` — currently not filtered
- Implement filter param in `MyItemsPage` (new query flag in `usePurchases`)
- Add "Add expiry to all" bulk-action button that prompts one NL expiry → PATCH each event
- Estimate: 0.5 day

### C4. Dashboard state machine visual distinction

- Plan called for 4 states: empty / active / warning / critical (driven by health score)
- Currently all 4 render the same layout with different numbers
- Add conditional styling: `critical` (score <50) tints the whole dashboard red; `empty` collapses cards and shows hero CTA only
- Estimate: 0.5 day

### ~~C5. Replace legacy AnalyticsPage~~ ✅ resolved via redirect (verified 2026-05-04)

- ~~`/analytics` still renders legacy inventory-based charts using `useInventory` (legacy endpoint)~~
- ~~Decide: delete the route, or rebuild against new model~~
- Picked the simplest path: `router.tsx:215` now reads `{ path: 'analytics', element: <Navigate to="/insights" replace /> }`. Old bookmarks land on `/insights`; legacy AnalyticsPage component no longer mounted.

### C6. Admin-level merge duplicates on CatalogAnalysisPage

- Plan's "merge duplicates" action was noted as not-yet — admin cross-user merge is complex because it requires writing into each affected user's collection
- Alternative approach: admin flags a barcode for "use canonical name X" → next time any user scans it, the UI prompts the mismatch for resolution. Non-destructive; lets users opt in.
- Design first, code later — put a design stub in `docs/FUTURE_ADMIN_MERGE.md`
- Estimate: 0.5 day design + ~1 day code (after design sign-off)

### C7. ~~Undo toasts for destructive actions (plan: "Undo over confirm")~~ ✅ 2026-04-23

- Implemented: `hooks/useUndoableAction.ts` — 5s deferred-mutation + sonner toast with Undo button.
- Wired: `MyItemsPage` row (mark_used, delete) · `PurchaseEventDetailPage` (mark_used, delete) · `ThrowAwayModal` · `GiveAwayModal`
- Mutations (`useChangePurchaseStatus`, `useDeletePurchase`) accept `silent` flag to suppress double-toast
- Remaining: extend to reminder dismissal (`useDismissReminder`) in Phase C continuation

### C8. ~~Flatten modal chains (plan: "Max 1 modal deep")~~ ✅ 2026-04-23

- Inlined NameUnknownItemModal into ContextualScannerModal as a state (`namingStep`)
- Scanner hides when QuickAddModal opens — guaranteed max 1 modal deep
- Deleted `NameUnknownItemModal.tsx` (no references remain)

### C9. ~~Breadcrumbs on drill-down pages~~ ✅ 2026-04-23

- `components/shared/Breadcrumbs.tsx` — accepts `BreadcrumbItem[]`; last item is current page (no link)
- Wired: MyItems + MyItems detail · Catalog + Catalog entry · Health Score · Waste · Spending · Reminders · Insights (8 pages)
- Each drill-down page passes its own items (no magic route-param parsing) — keeps component dumb

### C10. ~~Skeleton loaders~~ ✅ 2026-04-23

- `components/shared/Skeleton.tsx` + `SkeletonRow` + `SkeletonList` + `SkeletonDashboardCard`
- Wired: MyItemsPage (6 rows), CatalogListPage (8 rows), RemindersPage (4 rows)
- LoadingSpinner still used for blocking writes (saving, deleting)

### ~~C11. Health score trend chart~~ ✅ shipped (verified 2026-05-04)

- ~~`/health-score` currently shows score + JSON dump~~
- ~~Add 30-day sparkline/line chart from cached health history~~
- ~~Optional: expose `/api/waste/health-score/history?days=30` endpoint~~
- `<HealthTrendChart />` at `backend/web-admin/src/components/waste/HealthTrendChart.tsx`, wired into `HealthScorePage.tsx:107`. Daily snapshots written by scheduler at 23:30 UTC; gap-fill carries last value forward across missing days.

### C12. Settings page refactor (plan: "TelegramLinkCard, notification prefs")

- `/settings` currently legacy — no notification prefs UI, no Telegram pairing card (Telegram deferred → D1)
- Add: per-channel notification toggles (daily expiry email, weekly summary, nudges), tier info, country/currency
- Leave a `<TelegramLinkCard />` placeholder slot to drop in post-D1
- Estimate: 0.5 day

### C13. Desktop split-pane for MyItems (plan UI principle)

- Plan: "Desktop: summary (left) + detail (right) split-pane where appropriate (e.g. My Items list + selected item detail)"
- Current: full-page navigate to `/my-items/:eventId`
- Refactor: on `md:` breakpoint, render detail in a right pane when eventId is in URL; mobile keeps full-page push
- Estimate: 1 day

### C14. ~~Sticky primary action~~ ✅ 2026-04-23

- `components/layout/StickyAddButton.tsx` — mobile bottom-left FAB + desktop top-right pill
- Zustand `uiStore` gained `quickAddOpen` / `openQuickAdd` / `closeQuickAdd`
- `QuickAddModal` mounted once in `AppLayout` (reads store) — no more per-page modal instances needed
- Paired with `FloatingScanButton` (bottom-right) so add + scan are both always reachable

**Phase C total: ~5.5 days remaining** (after C2/C5/C11 verified shipped, ~3 days off the original 8.5).

---

## 🔵 Phase D — Deferred feature executions

Each references an existing `docs/FUTURE_*.md` design doc. Pick based on user priority — they're independent.

### D1. Telegram bot integration — **2-3 weeks**

See [`docs/FUTURE_TELEGRAM_BOT.md`](FUTURE_TELEGRAM_BOT.md). Adds `/api/telegram/webhook`, pairing code flow, bot commands (`/add`, `/list`, `/expiring`, `/used`, `/thrown`). NL chat phase gated on LLM integration readiness.

### D2. Mobile app refactor — **3-4 weeks**

See [`docs/FUTURE_MOBILE_REFACTOR.md`](FUTURE_MOBILE_REFACTOR.md). React Native app still hits legacy endpoints. Plan:
1. Update endpoints to `/api/purchases` / `/api/catalog`
2. Replace WatermelonDB `grocery_items` schema with `catalog_entries` + `purchases`
3. Rebuild Add Item flow as QuickAddModal parity
4. Rebuild Inventory tab as MyItemsPage parity
5. Add barcode-first flow matching `ContextualScannerModal`
6. Remove compat-shim dependency: flip `legacy_endpoints_use_new_model` → 410 Gone on old endpoints

### D3. AI catalog dedup — **1-2 weeks**

See [`docs/FUTURE_AI_CATALOG_DEDUP.md`](FUTURE_AI_CATALOG_DEDUP.md). Uses `catalog_entry.needs_review=true` flag (set by stage-3 reminder scan). Batch job sends flagged entries to LLM for duplicate detection suggestions → admin approves → merges happen via existing `merge_catalog`.

### D4. Scan-to-move-location — **partial / verify before scoping**

See [`docs/FUTURE_ITEM_MOVEMENT.md`](FUTURE_ITEM_MOVEMENT.md). Original plan: add `context='my-items'` scanner action for "Move location" — scan barcode → find the single matching active event → dropdown → PATCH location.

**Verification 2026-05-04:** `backend/web-admin/src/components/barcode/ContextualScannerModal.tsx` now has a `moveStep` state (lines 286, 380, 385, 393) — the move-via-scan branch is at least partially wired. Walk through the actual UX before declaring fully shipped or estimating residual work.

### D5. Household catalog merging — **1-2 weeks**

See [`docs/FUTURE_HOUSEHOLD_CATALOG_MERGE.md`](FUTURE_HOUSEHOLD_CATALOG_MERGE.md). When multiple household members have "milk" / "Milk" / "Organic Milk" → admin view offers household-level merge. Reuses `merge_catalog` but scoped to household members.

### D6. LLM narrative for milestone insights — **2-3 days**

Currently `insights_service._narrative(milestone, stats)` is rule-based. Swap to LLM call (Ollama local first, fallback to OpenAI). Tests become more flexible (look for key facts, not exact text).

### D7. Receipt-scan bulk import — **~4 days**

See [`docs/FUTURE_RECEIPT_OCR.md`](FUTURE_RECEIPT_OCR.md). User-flagged in the 2026-05-04 walkthrough as the single highest-leverage UX investment ("Saturday shop = a chore, 8-10 minutes to log 15 items"). Captures a receipt photo, returns parsed `{store, total, currency, lines: [{name, qty, price}]}`, draft purchase events on a confirmation page, bulk-save. Trigger when D2 mobile refactor is underway or real-user fatigue reports accumulate.

---

## ⚪ Phase E — Observability & scale (when the user base grows past ~100 DAU)

Not blocking today. Track here so they don't get lost.

### E1. Structured log aggregation

- Current: `logging` with extra fields in stdout
- Add: Datadog or Sentry (free tier) — ingest stdout, tag by `uid`, `operation`, `duration_ms`, `firestore_reads/writes`
- Alert: error rate > 5% in 5-min window, Firestore read > 2s

### E2. Redis-backed rate limiter

- Current: in-process token bucket → doesn't survive multi-worker deploy
- Switch to `redis-py` + sliding window. Render free Redis tier is 25MB — enough for N users × 64 bytes window state.
- File change: `app/core/rate_limit.py` (same interface; impl swap)

### E3. Migration throughput improvements

- Current `scripts/migrate_grocery_items_to_purchases.py` uses 400-batch writes sequentially
- For large user bases: parallelize across uids (asyncio + Firestore async client)
- Only worth doing if migration needs to run on 1000+ users

### E4. Scheduler → Cloud Scheduler

- APScheduler is in-process — restart loses state
- Firestore-persisted APScheduler OR swap to Google Cloud Scheduler + Cloud Run jobs
- Low priority while running on Render single-worker

### E5. Mobile telemetry parity

- Mobile currently logs to analytics via the old batch endpoint
- After D2 (mobile refactor), align with web admin's milestone/insight events

### E6. Slow Firestore query logging (plan observability spec)

- Plan: "Any Firestore read > 2s logged as WARNING with query details"
- Instrument service functions (catalog_service, purchase_event_service, waste_service) with time.perf_counter around `.stream()` / `.get()` calls
- Emit WARN with service + query shape + duration when ≥ 2000ms
- Estimate: 0.5 day

### E7. Error-rate alerting (plan observability spec)

- Plan: "If error rate > 5% in 5-min window, log ERROR (future: integrate with sentry/datadog)"
- Middleware counts 5xx responses per 5-min window; log ERROR when threshold crossed; reset counter
- Estimate: 0.5 day

### E8. Firestore read/write counters on structured logs

- Plan: "Structured JSON logs extended with uid, operation, duration_ms, firestore_reads, firestore_writes"
- Wrap Firestore client with a proxy that increments counters in `contextvars`; emit at response time
- Estimate: 0.5 day

### E9. ~~Migration metrics doc~~ ✅ 2026-04-23

- `migrate_grocery_items_to_purchases.py` now persists to `app_config/migrations/grocery_items_v1/metrics` after execute:
  - `started_at`, `finished_at`, `duration_sec`
  - `users_processed`, `totals` (per-field aggregate), `per_user` (dict of uid → stats), `errors[]`
- Skipped during `--dry-run`. Per-user failures captured in `errors` list (uid + type + message).

---

## 📅 Deprecation schedule (plan specified)

Plan: "Deprecation window: 90 days after web+mobile refactor complete → return 410 Gone."

| Date | Event | Owner |
|---|---|---|
| 2026-04-23 | Refactor shipped (today) | — |
| After Phase A | Legacy endpoints serve via compat shim (flag ON) | ops |
| **After D2** (mobile refactor ships) | Start 90-day deprecation clock | product |
| **D2 + 90 days** | Legacy endpoints return 410 Gone (`/api/inventory/my`, `/api/barcode/{bc}/add-to-inventory`, `/api/barcode/{bc}/use-one`, `/api/barcode/{bc}/inventory`) | backend |
| D2 + 90 days | Add `# DEPRECATED: removed YYYY-MM-DD` comments to legacy-only code paths that remain (inventory_service legacy branches) | backend |

Mechanism: add a middleware or route-level guard gated by `ENDPOINT_DEPRECATED_AT` env var that compares current time and returns 410. Toggle via deploy, not feature flag — irreversible.

---

## Edge cases / correctness follow-ups (plan edge cases)

Three un-codified items from plan's 16 edge cases:

- **#6 Past-dated expiry** — allowed but not explicitly tested. Add to `tests/services/test_purchase_transitions.py` — creating a purchase with `expiry_date < now` should succeed; scheduler flags it on next run via `flag_expired_purchases`.
- ~~**#12 Timezone for expiry** — plan said "store date-only, compute days-left client-side in user TZ"~~ **partial fix 2026-04-23**: `utils/actionResolver.ts::calendarDaysBetween` now snaps both dates to UTC-midnight, eliminating the near-midnight day-off boundary bug in timezones ≤ UTC+12. Full fix (server-side date-only storage) still pending — residual issue for UTC-10 users may see expiry 1 day off in a narrow window.
- **#13 Long catalog (500+)** — `list_catalog` has `limit` param. Frontend `useCatalog({ limit: 500 })` could time out. Add paginated autocomplete that fetches 20 at a time; stress-test with 1000-entry fixture.

Estimate to address: 1 day total (batch with B6 tests).

---

## Open decisions / tech debt

These haven't been made and block or complicate something above.

| # | Decision | Blocks |
|---|---|---|
| 1 | Keep or delete `/analytics`? | C5 |
| 2 | Admin cross-user merge approach (destructive vs flag-based)? | C6 |
| 3 | LLM vendor for D6 (Ollama local / OpenAI / Anthropic)? | D1 phase 2, D3, D6 |
| 4 | Mobile rewrite vs gradual migration? | D2 scope |
| 5 | Should `legacy_endpoints_use_new_model` ever return to `false` after cutover? | Rollback story for Phase A |
| 6 | Move to Firestore emulator for local dev by default? | B1/B2/B3 DX |
| 7 | What's the "green" threshold health score? Currently 80 — too lenient? | UX polish |

---

## Execution order recommendation

If a user wants "what's the critical path to a production-grade waste-prevention app":

```
Phase A (cutover) — 1 day, operational
  ↓
Phase B (quality gates + missing tests + GDPR scripts) — 4.5 days
  ↓
Phase C (UX completion: full plan-compliance — 14 items) — 8.5 days
  ↓
Phase D2 (mobile refactor) — 3-4 weeks, biggest single value
  ↓ (start 90-day deprecation clock per schedule)
Phase D1 (Telegram bot) OR D6 (LLM narrative) — user preference
```

Phase E is continuous / reactive. Phase D3-D5 are nice-to-haves. E6-E9 are from plan's observability spec — fold in opportunistically, don't block feature work.

### Minimum viable "plan-compliant" path

If the goal is "match the original plan's full intent" (not just Phase 1-5 code), the critical slice is:

- Phase A (cutover)
- B4 (CI) + B6 (missing unit tests) + B7 (GDPR scripts)
- C7 (Undo toasts) + C8 (modal chain) + C9 (breadcrumbs) + C10 (skeletons) + C14 (sticky + Add)
- E6 (slow query logs) + E9 (migration metrics)

That's ~7 days and closes every plan checklist item that wasn't shipped.

---

## How to update this doc

- Tick items off inline with `~~strikethrough~~` + date
- Add new items under the most appropriate phase
- When a phase empties, mark it `✅ complete YYYY-MM-DD` and collapse
- Deep dives go into `docs/FUTURE_*.md` or their own files — this is the index
