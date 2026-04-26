# Paid Enhancements — Backlog

> **Purpose.** Things that improve GroceryApp but cost money (subscription, hosting, services, paid tools, or significant non-trivial vendor purchases). Do NOT execute these without explicit user approval. Free alternatives are in `docs/FREE_FIXES_BACKLOG.md` — knock those out first.
>
> **For Claude.** When the user mentions a feature/concern, scan this file for an entry that matches. Quote the trigger criteria + cost so the user can decide if it's the right time. Don't propose paid work as the first option if a free alternative exists.
>
> **For human readers.** This doc is the source of truth for "what would unlock the next stage of the product if we paid for it." Each entry has: TL;DR, cost, trigger, effort, dependencies, links.

---

## Summary table

| ID | Item | Monthly cost (USD) | Trigger to act |
|---|---|---:|---|
| P1 | Render Starter tier | $7 | Before inviting any non-engineer beta user |
| P2 | Render Standard tier | $25 | At first paying customer or >100 DAU |
| P3 | Render Pro tier (autoscale) | $85+ | At sustained >500 DAU |
| P4 | Custom domain | ~$1 (~$12/yr registration) | Before any public marketing |
| P5 | Sentry Team plan (paid) | $26 | When free tier (5k events/mo) fills up — usually ~1k DAU |
| P6 | Datadog / structured logs | $15+ | Plan E1 in ROADMAP — at >100 DAU + paying users |
| P7 | Redis-backed rate limiter | $0–10 (Render Redis free tier 25 MB) | Plan E2 — when running multi-worker |
| P8 | Email transactional service | $0–20 (SendGrid 100/day free) | When implementing expiry email reminders |
| P9 | SMS notifications | ~$0.01/msg (Twilio) | Paid feature, not core |
| P10 | Customer support platform | $0–60 (Intercom free trial → paid) | At >100 paying users |
| P11 | Legal review of T&C / privacy | $200–2000 one-shot | Before public launch with payments |
| P12 | Penetration testing | $1000–5000 one-shot | Before payments + sensitive data |
| P13 | Native mobile app dev costs | $99/yr (Apple) + $25 once (Google) | Phase D2 in ROADMAP — separate decision |
| P14 | Professional brand artwork (icons, logo) | $50–500 one-shot | Before public marketing |
| P15 | Firebase Blaze plan upgrade | Pay-as-you-go | When Spark free quotas exceeded — typically ~50 DAU |

---

## Detail per item

### P1 — Render Starter tier

**TL;DR.** Eliminates 30–60s cold-start delays on the free tier. Free tier sleeps after ~15 min idle.

**Cost.** $7/month per service (currently 1 service: `groceryapp-backend`).

**Trigger.** Before inviting any non-engineer to test the live URL. Cold starts will make non-technical users think the app is broken. **This is the single highest-leverage paid item.**

**Effort.** 5 min in Render dashboard → Service → Settings → Plan → Starter. Zero code change.

**Dependencies.** None.

**Notes.** Starter also gives you persistent disk if you ever need it, and 0.5 GB RAM (vs 512 MB on free). For DB-only workloads this won't matter; for the FastAPI + Firestore SDK it's marginal.

---

### P2 — Render Standard tier

**TL;DR.** Move from Starter when single-instance starts queuing requests during peak. Standard gives 2 GB RAM + better CPU.

**Cost.** $25/month per service.

**Trigger.** At first paying customer (any payment is enough — uptime becomes contractual) OR sustained >100 DAU OR P95 latency > 1s.

**Effort.** 5 min plan upgrade.

**Dependencies.** P1 (have to be on Starter first to upgrade).

---

### P3 — Render Pro tier with autoscaling

**TL;DR.** Multi-instance with autoscale rules. Survives traffic spikes. Required if you want zero-downtime deploys with significant traffic.

**Cost.** $85/month base, scales up to ~$200+ at peak.

**Trigger.** Sustained >500 DAU, OR you experience first downtime incident from instance saturation.

**Effort.** 1 day to: (a) move rate limiter to Redis (P7), (b) verify shared-state assumptions are clean, (c) configure autoscale rules.

**Dependencies.** P1, P2, P7.

---

### P4 — Custom domain

**TL;DR.** Replace `groceryapp-backend-7af2.onrender.com` with `app.yourdomain.com`. Improves trust + memorability.

**Cost.** Domain registration $10–15/year (Namecheap, Cloudflare). Render's "Custom domain" feature is free on Starter+ tiers. SSL auto-provisioned via Let's Encrypt (free).

**Trigger.** Before any public marketing or app-store listing.

**Effort.** ~30 min: register domain, point DNS at Render, add domain in Render dashboard, wait for SSL.

**Dependencies.** P1 (Starter or higher).

---

### P5 — Sentry Team plan (paid)

**TL;DR.** Error tracking. The free Developer plan covers 5,000 events/month — usually plenty for early beta. Upgrade when that fills up.

**Cost.** Developer (free) → Team ($26/mo) → Business ($80/mo).

**Trigger.** When you hit the free 5k events/month cap (Sentry will email you). Usually around 1k DAU if your error rate is <1%.

**Effort.** Zero code change at upgrade — same DSN, same SDK. Just pick a plan in Sentry dashboard.

**Dependencies.** Sentry already integrated (free tier in `docs/FREE_FIXES_BACKLOG.md` item F2).

---

### P6 — Datadog / structured log aggregation

**TL;DR.** Centralized log + metric + trace platform. Replaces grep-on-Render-logs. Required if you need to debug a prod issue across multiple services.

**Cost.** Datadog $15/host/month (1 host = your one Render service). Alternatives: Better Stack ($24/mo), Logtail (free tier 5 GB), Axiom (free 500 GB/mo — surprisingly generous).

**Trigger.** Plan E1 in ROADMAP. Concretely: at >100 DAU + paying users + first time you ask "why did this user's request fail?" without an answer.

**Effort.** ~2 hr: pick provider, instrument the FastAPI logger, add structured-log middleware.

**Dependencies.** None.

**Recommendation.** Try **Axiom free tier first** before paying for Datadog — 500 GB/mo is huge.

---

### P7 — Redis-backed rate limiter

**TL;DR.** Current rate limiter (`app/core/rate_limit.py`) is in-memory. Doesn't survive Render restart, doesn't work across multiple workers.

**Cost.** Render's Redis free tier is 25 MB — enough for ~50k user windows. Upgrade to $10/mo at higher volumes.

**Trigger.** Plan E2 in ROADMAP. Concretely: when moving to P3 (Pro tier with multi-instance), OR when you observe rate-limit bypass via deploy churn.

**Effort.** ~3 hr — swap implementation behind same interface. See ROADMAP §E2.

**Dependencies.** Render Redis add-on (or external Redis).

---

### P8 — Email transactional service

**TL;DR.** Send daily expiry reminders, weekly summaries, password resets. Currently no email path exists.

**Cost.** SendGrid free tier 100 emails/day → $19.95/mo for 50k. Mailgun free 100/day → $35/mo for 50k. Postmark $15/mo for 10k.

**Trigger.** When implementing the email reminder feature (referenced in `docs/NUDGE_SYSTEM.md` and `docs/FUTURE_TELEGRAM_BOT.md` as alternative to Telegram).

**Effort.** ~1 day: pick provider, wire SDK, write 3 email templates (welcome, expiry reminder, weekly summary), unsubscribe flow.

**Dependencies.** None.

**Recommendation.** Postmark for transactional (best deliverability), defer SendGrid until you need marketing emails.

---

### P9 — SMS notifications

**TL;DR.** SMS for high-priority "your milk expires today" alerts. Most users don't want this; few do strongly.

**Cost.** Twilio ~$0.01/SMS in MY/SG. Vonage similar.

**Trigger.** Paid-tier feature. Only if a user explicitly asks for SMS reminders.

**Effort.** ~1 day to wire + opt-in flow.

**Dependencies.** P8 (email infrastructure first; SMS is a follow-on).

---

### P10 — Customer support platform

**TL;DR.** Intercom-style in-app chat for user support. Replaces "email me at..." in settings.

**Cost.** Intercom Starter $74/mo (5 seats). Crisp.chat free tier exists. Front $19/mo.

**Trigger.** At >100 paying users OR when support emails exceed 1 hr/day to handle.

**Effort.** Half day to embed widget + train on canned responses.

**Dependencies.** None.

---

### P11 — Legal review of T&C and privacy policy

**TL;DR.** Get a lawyer to review the auto-generated templates before you accept payments or store sensitive data.

**Cost.** $200–2000 one-shot depending on jurisdiction (MY/SG cheapest, US most expensive).

**Trigger.** Before accepting any payment OR before launching to users in the EU/UK (GDPR) / California (CCPA).

**Effort.** Depends on lawyer. Send them the templates from `docs/legal/` (created in F-series fixes).

**Dependencies.** Free templates committed first.

---

### P12 — Penetration testing

**TL;DR.** Hire a security firm to look for vulnerabilities. Required for SOC2-adjacent compliance and for handling payment data.

**Cost.** $1000–5000 one-shot. Cobalt.io, Cure53, or local boutique firms.

**Trigger.** Before processing payments OR before storing PII beyond what Firebase already does (anything specific to grocery purchases is already PII).

**Effort.** ~1 week for the firm, plus ~3 days of your time fixing findings.

**Dependencies.** None.

---

### P13 — Native mobile app costs

**TL;DR.** App Store + Play Store distribution. Currently mobile app is rolled back (see `docs/MOBILE_D2_STATUS.md`); revisit only if web/PWA proves insufficient.

**Cost.** Apple Developer Program $99/yr. Google Play one-time $25. Plus engineering time.

**Trigger.** Users explicitly request native app OR web/PWA conversion drops below acceptable.

**Effort.** Phase D2 in ROADMAP — 3–4 weeks engineering. See `docs/FUTURE_MOBILE_REFACTOR.md`.

**Dependencies.** None — but expensive in time, not just money.

---

### P14 — Professional brand artwork

**TL;DR.** Replace the placeholder PIL-generated icons with real brand artwork (logo, app icons, marketing assets).

**Cost.** $50–500 depending on designer (Fiverr to local studio).

**Trigger.** Before public marketing or app-store screenshots.

**Effort.** Half day to brief designer + integrate deliverables.

**Files affected.**
- `backend/web-admin/public/icons/icon-192.png`
- `backend/web-admin/public/icons/icon-512.png`
- `backend/web-admin/public/icons/icon-mask.png`
- `backend/web-admin/public/favicon.svg`

---

### P15 — Firebase Blaze plan upgrade

**TL;DR.** Free Spark plan has hard quotas (50k Firestore reads/day, 20k writes/day, 1 GB stored). Blaze is pay-as-you-go.

**Cost.** Pay-per-use. At <50 DAU on the current data model, expect ~$0–5/mo. At ~500 DAU, ~$10–30/mo.

**Trigger.** When Firebase Console shows Spark quota approaching 80%. Concretely: ~50 active users in a single day, especially if any are heavy.

**Effort.** 5 min — Firebase Console → Upgrade to Blaze, attach a billing account, set a budget alert at $X/month.

**Dependencies.** None. Set a budget alert immediately so you don't get surprised.

---

## How to use this doc

- **Adding an item.** Insert as `Pn` in numeric order, fill TL;DR + Cost + Trigger + Effort + Dependencies + Notes. Update the summary table at top.
- **Removing an item.** Don't — mark it as ✅ DONE with the date + commit hash.
- **From Claude:** when scanning user requests, search for matches in the summary table first, then deep-link to the entry.
- **From a UI later:** the summary table is parseable as markdown; a future Dev Hub "Roadmap" page can render it.
