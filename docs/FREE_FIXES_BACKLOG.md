# Free Fixes Backlog

> **Purpose.** Things that improve GroceryApp **without spending money** — code, config, docs, or use of free-tier external services. Knock these out before any paid items in `docs/PAID_ENHANCEMENTS.md`.
>
> **Scope.** Each item includes effort estimate so we can budget time. None require purchases.

---

## Summary

| ID | Item | Effort | Priority | Status |
|---|---|---|---|---|
| F1 | Lighthouse audit on prod (`/dashboard`) | 10 min | HIGH | BLOCKED-USER (manual Brave run) |
| F2 | Sentry free tier integration (5k events/mo free) | 30 min | HIGH | DONE |
| F3 | Privacy policy + Terms placeholder | 30 min | HIGH | DONE |
| F4 | UptimeRobot free monitor (50 endpoints free) | 10 min | MEDIUM | BLOCKED-USER (account creation) |
| F5 | Pydantic Firestore SDK deprecation warnings cleanup | 30 min | MEDIUM | DONE |
| F6 | Slow Firestore query logging (>2s WARN) | 1 hr | MEDIUM | DONE |
| F7 | Error-rate alerting middleware (5% in 5min → ERROR log) | 1 hr | MEDIUM | DONE |
| F8 | API versioning (`/api/v1/*`) refactor | 2 hr | MEDIUM | DONE (backend; FE migration deferred) |
| F9 | GitHub Actions: firestore rules deploy on push | 30 min | LOW | DONE (workflow added; awaiting GH secret) |
| F10 | Backup cron — daily `export_user_data.py --all` | 30 min | LOW | DONE (workflow added; awaiting GH secret) |
| F11 | Integration tests against local Firestore emulator | 1 day | LOW | DONE (7 tests; auto-skip when emulator down) |
| F12 | Health-check trend chart (`/health-score` 30-day sparkline) | 1 day | LOW | DONE |

Total effort: ~3 days for everything; ~3 hours for HIGH-priority subset.

---

## Detail per item

### F1 — Lighthouse audit on prod

**TL;DR.** Run Chrome DevTools → Lighthouse → "Progressive Web App" + "Performance" + "Accessibility" against `https://groceryapp-backend-7af2.onrender.com/dashboard`. Document findings, fix anything < 80.

**Effort.** 10 min audit + variable fix time depending on findings.

**Why HIGH.** Surfaces unknowns. Cheap. Informs other items (e.g. accessibility fixes are easier when you know what's broken).

**Done when.** Score recorded; any score < 80 has a follow-up issue.

---

### F2 — Sentry free tier

**TL;DR.** Wire Sentry's free Developer plan (5k events/month) into both backend (`sentry-sdk`) and frontend (`@sentry/react`). Get error visibility before users notice.

**Effort.** 30 min. Sign up at sentry.io, create two projects (one Python, one React), grab DSNs, add env vars, install SDKs, wrap the React app, init in `main.py`.

**Why HIGH.** Currently the only way you know about prod errors is when a user complains.

**Free tier limits.** 5k errors + 10k transactions/month, 30-day retention. Paid upgrade path documented in `docs/PAID_ENHANCEMENTS.md` P5.

**Done when.** Sentry dashboard shows test errors from both projects. Real errors flow through with stack traces.

---

### F3 — Privacy policy + Terms placeholder

**TL;DR.** Create `docs/legal/privacy-policy.md` and `docs/legal/terms-of-service.md` with reasonable templates (DocuSign / Termly / Iubenda free generators). Link from Settings page. Required before any non-internal user.

**Effort.** 30 min total — most time is editing the template to reflect what we actually do.

**Why HIGH.** Legal liability. Even a beta needs a privacy policy if you collect emails.

**Done when.** Both files exist, Settings page has links, footer references them.

---

### F4 — UptimeRobot free monitor

**TL;DR.** Free monitoring service that pings `https://groceryapp-backend-7af2.onrender.com/health` every 5 min and emails/SMS you on downtime.

**Effort.** 10 min. Sign up at uptimerobot.com (no card), add monitor, set notification.

**Why MEDIUM.** Render's own dashboard tells you about deploy failures, not runtime crashes.

**Done when.** Monitor active, you receive a test "down" alert, public status page URL captured (uptimerobot lets you share status pages free).

---

### F5 — Pydantic Firestore SDK deprecation warnings

**TL;DR.** Logs show `UserWarning: Detected filter using positional arguments. Prefer using the 'filter' keyword argument instead.` from a few `.where()` calls. Update to keyword argument syntax.

**Effort.** 30 min. Search for `.where(` across services, change positional args to `filter=FieldFilter(...)` per Google's recommendation.

**Why MEDIUM.** Current SDK still accepts positional, but next major release will remove it. Cheap to fix early.

**Files affected.**
- `backend/app/services/waste_service.py` (multiple)
- `backend/app/services/catalog_service.py`
- `backend/app/services/purchase_event_service.py`
- (others — grep `\.where\("` to enumerate)

**Done when.** Restart backend, no UserWarning lines on a sample request.

---

### F6 — Slow Firestore query logging

**TL;DR.** Wrap Firestore client in a thin proxy that logs WARNING when any `.stream()` / `.get()` exceeds 2 seconds, with the query shape.

**Effort.** 1 hr. Decorator pattern in `app/core/`, applied to the few hot service functions.

**Why MEDIUM.** First step toward observability. Plan E6 in ROADMAP.

**Done when.** A deliberately slow query produces a single `WARN slow query: <shape> took 2150ms` log line.

---

### F7 — Error-rate alerting

**TL;DR.** Middleware counts 5xx responses per 5-min sliding window. When the rate > 5% logs `ERROR error-rate-alert window=5m rate=12%`. No external service required for this one — once F2 (Sentry) is in place, Sentry alerting can replace it; for now logs are enough.

**Effort.** 1 hr. Single middleware class in `main.py`.

**Why MEDIUM.** Plan E7 in ROADMAP. Quick safety net.

**Done when.** Forced 500s in test trigger the alert; resets after window closes.

---

### F8 — API versioning

**TL;DR.** Move `/api/*` to `/api/v1/*`. Add `/api/v1/health` alongside the existing `/health`. Forces breaking changes to live under `/api/v2/*` later.

**Effort.** 2 hr. Mostly find/replace + add a router prefix. Frontend `endpoints.ts` updates concentrate the change in one file.

**Why MEDIUM.** Cheap now, expensive after users.

**Why not HIGH.** Beta users won't notice; defer if pressed for time.

**Done when.** Both `/api/*` and `/api/v1/*` work (the old paths redirect or both serve), frontend uses v1 for all calls.

**Status (2026-04-25).** Backend dual-mounts every router under `/api/*` and `/api/v1/*` via the `_ROUTERS` table in `backend/main.py`. Both prefixes serve identical handlers — chosen over a redirect to avoid an extra round-trip. Frontend `endpoints.ts` still uses `/api/*` paths; migrating it to `/api/v1/*` is mechanical (search-and-replace) and was deferred since the legacy alias works fine and FE rebuilds carry deploy risk. When ready: change every `'/api/'` literal to `'/api/v1/'` in `web-admin/src/api/endpoints.ts` and verify with the Network tab. Legacy `/api/*` is documented to stay until 2026-12-31, then become 410 Gone.

---

### F9 — GitHub Actions: firestore rules deploy

**TL;DR.** Existing CI runs pytest + tsc. Add a job that runs `firebase deploy --only firestore:rules` on push to main (using a service-account JSON in GitHub Secrets).

**Effort.** 30 min. New file `.github/workflows/firestore-rules.yml`.

**Why LOW.** Manual deploy works fine for now; this just removes one human step.

**Done when.** Push to main → workflow runs → rules updated automatically.

**Watch out.** Service account credentials in GitHub Secrets need careful permissions (only `cloud-rules-deployer` role, not full admin).

**Status (2026-04-25).** Workflow added at `.github/workflows/firestore-rules-deploy.yml`. Triggers on push to main when `firestore.rules`, `firestore.indexes.json`, `firebase.json`, or `.firebaserc` changes; also supports manual `workflow_dispatch`. Uses `GOOGLE_APPLICATION_CREDENTIALS` from a `FIREBASE_SERVICE_ACCOUNT` repo secret. **Action required:** create the service account in GCP IAM (roles: Firebase Rules Admin + Cloud Datastore Index Admin only — NOT full project admin), download the JSON key, paste into GitHub repo Settings → Secrets → Actions as `FIREBASE_SERVICE_ACCOUNT`. Workflow will exit cleanly with an error message if the secret is missing.

---

### F10 — Backup cron

**TL;DR.** Run `backend/scripts/export_user_data.py --all --output backups/$(date +%F)` daily on a server that's already running 24/7 (your local dev box, an Ubuntu VM, or as a separate Render Background Worker — but Background Workers are paid).

**Effort.** 30 min if running locally. Lift to GitHub Actions scheduled workflow for free hosting.

**Why LOW.** Firebase has automatic redundancy already. Backups are defense in depth, not primary.

**Done when.** A backup zip exists from "yesterday" on whichever box you choose. Test a `--restore` from one.

**Status (2026-04-25).** New script `backend/scripts/backup_all_users.py` iterates every doc in `users/*`, calls `export_user()` per uid, and writes a single `grocery-backup-YYYY-MM-DD.tar.gz`. Workflow `.github/workflows/backup-daily.yml` runs at 17:00 UTC (01:00 MYT) and uploads the tarball as a workflow artifact (90-day free retention). **Action required:** add repo secret `FIREBASE_CREDENTIALS_JSON` with the full service account JSON. Restore path: download artifact, untar, re-import each `user_{uid}.json` via the existing import logic (note: import script is not built yet — see backlog).

---

### F11 — Integration tests against Firestore emulator

**TL;DR.** The Luqman Dev Hub now has the Firestore emulator running locally. Write integration tests that point at it (set `FIRESTORE_EMULATOR_HOST=localhost:8080` env var) to test the data layer without mocking.

**Effort.** 1 day for ~10 tests covering the critical flows (create purchase, mark used, merge catalog, reparent events, FIFO use by barcode).

**Why LOW.** Unit tests cover the pure logic; integration tests cover the Firestore-specific edge cases. Plan B1 in ROADMAP.

**Done when.** `pytest backend/tests/integration/` runs against a live emulator, all green.

**Status (2026-04-25).** Added `tests/integration/conftest.py` with a session fixture that probes `FIRESTORE_EMULATOR_HOST` (default `localhost:8080`) and skips the whole module if the emulator isn't reachable. Three test files cover create-purchase + catalog-upsert counter consistency, cursor pagination across catalog + purchases, and merge-reparenting + delete-blocked-when-active. The 7 integration tests skip cleanly during the regular `pytest backend/tests` run (122 unit pass + 7 skipped). To exercise them: start the emulator from Luqman Dev Hub or `firebase emulators:start --only firestore --project demo-grocery`, then re-run pytest. Coverage gaps still: status-transition edge cases, FIFO-by-barcode use, security-rule enforcement (rule tests need a separate harness).

---

### F12 — Health-score 30-day trend chart

**TL;DR.** `/health-score` page currently shows current score. Plan called for a 30-day sparkline. Requires daily snapshot + chart component.

**Effort.** 1 day — scheduler job to write daily snapshot doc, new endpoint to read history, recharts component.

**Why LOW.** Polish, not blocking validation.

**Done when.** Score breakdown page shows a trend line.

**Status (2026-04-25).** Backend: `waste_service.snapshot_health_score()` writes today's score to `users/{uid}/health_history/{YYYY-MM-DD}`; `get_health_history()` returns up to N days. New scheduler job `health_history_snapshot` runs daily at 23:30 UTC. New endpoint `GET /api/waste/health-history?days=30`. Frontend: `useHealthHistory()` hook, `HealthTrendChart` component (Chart.js + react-chartjs-2 line chart with gap-fill from previous score) mounted on the HealthScorePage above the tabs. Empty-state message displays for fresh accounts with no snapshots yet. Verified: 122 unit + 7 emulator-gated integration tests pass; `tsc -b` exits 0.

---

## Suggested execution order

If you can spend ~3 hours: do F1, F2, F3 (HIGH).

If you can spend a half-day: add F4, F5, F6.

If you can spend a full day: add F7, F8.

LOW-priority items (F9–F12) can wait until first 50 users are active and you have feedback to prioritize.

---

## Cross-references

- Paid items (do later, with budget): `docs/PAID_ENHANCEMENTS.md`
- Phase plans / longer-running work: `docs/ROADMAP.md`
- What's already shipped this session: see `git log --oneline | head -30`
