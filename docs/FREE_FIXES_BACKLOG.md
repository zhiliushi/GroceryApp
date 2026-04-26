# Free Fixes Backlog

> **Purpose.** Things that improve GroceryApp **without spending money** — code, config, docs, or use of free-tier external services. Knock these out before any paid items in `docs/PAID_ENHANCEMENTS.md`.
>
> **Scope.** Each item includes effort estimate so we can budget time. None require purchases.

---

## Summary

| ID | Item | Effort | Priority | Status |
|---|---|---|---|---|
| F1 | Lighthouse audit on prod (`/dashboard`) | 10 min | HIGH | TODO |
| F2 | Sentry free tier integration (5k events/mo free) | 30 min | HIGH | TODO |
| F3 | Privacy policy + Terms placeholder | 30 min | HIGH | TODO |
| F4 | UptimeRobot free monitor (50 endpoints free) | 10 min | MEDIUM | TODO |
| F5 | Pydantic Firestore SDK deprecation warnings cleanup | 30 min | MEDIUM | TODO |
| F6 | Slow Firestore query logging (>2s WARN) | 1 hr | MEDIUM | TODO |
| F7 | Error-rate alerting middleware (5% in 5min → ERROR log) | 1 hr | MEDIUM | TODO |
| F8 | API versioning (`/api/v1/*`) refactor | 2 hr | MEDIUM | TODO |
| F9 | GitHub Actions: firestore rules deploy on push | 30 min | LOW | TODO |
| F10 | Backup cron — daily `export_user_data.py --all` | 30 min | LOW | TODO |
| F11 | Integration tests against local Firestore emulator | 1 day | LOW | TODO |
| F12 | Health-check trend chart (`/health-score` 30-day sparkline) | 1 day | LOW | TODO |

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

---

### F9 — GitHub Actions: firestore rules deploy

**TL;DR.** Existing CI runs pytest + tsc. Add a job that runs `firebase deploy --only firestore:rules` on push to main (using a service-account JSON in GitHub Secrets).

**Effort.** 30 min. New file `.github/workflows/firestore-rules.yml`.

**Why LOW.** Manual deploy works fine for now; this just removes one human step.

**Done when.** Push to main → workflow runs → rules updated automatically.

**Watch out.** Service account credentials in GitHub Secrets need careful permissions (only `cloud-rules-deployer` role, not full admin).

---

### F10 — Backup cron

**TL;DR.** Run `backend/scripts/export_user_data.py --all --output backups/$(date +%F)` daily on a server that's already running 24/7 (your local dev box, an Ubuntu VM, or as a separate Render Background Worker — but Background Workers are paid).

**Effort.** 30 min if running locally. Lift to GitHub Actions scheduled workflow for free hosting.

**Why LOW.** Firebase has automatic redundancy already. Backups are defense in depth, not primary.

**Done when.** A backup zip exists from "yesterday" on whichever box you choose. Test a `--restore` from one.

---

### F11 — Integration tests against Firestore emulator

**TL;DR.** The Luqman Dev Hub now has the Firestore emulator running locally. Write integration tests that point at it (set `FIRESTORE_EMULATOR_HOST=localhost:8080` env var) to test the data layer without mocking.

**Effort.** 1 day for ~10 tests covering the critical flows (create purchase, mark used, merge catalog, reparent events, FIFO use by barcode).

**Why LOW.** Unit tests cover the pure logic; integration tests cover the Firestore-specific edge cases. Plan B1 in ROADMAP.

**Done when.** `pytest backend/tests/integration/` runs against a live emulator, all green.

---

### F12 — Health-score 30-day trend chart

**TL;DR.** `/health-score` page currently shows current score. Plan called for a 30-day sparkline. Requires daily snapshot + chart component.

**Effort.** 1 day — scheduler job to write daily snapshot doc, new endpoint to read history, recharts component.

**Why LOW.** Polish, not blocking validation.

**Done when.** Score breakdown page shows a trend line.

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
