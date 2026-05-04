---
title: Bootstrap Roadmap — what to do at each cash tier
compiled: 2026-05-03
audience: Shahir (founder)
philosophy: Broke-mode default. Each ringgit earned upgrades the business by one notch. Ship-then-spend, not spend-then-ship.
linked_from: legal_launch_research.md, .claude/docs/legal_research/ip_codebase_audit.md
---

# Bootstrap Roadmap

This is the cash-tiered playbook. **Don't spend a tier until the milestone for that tier is actually hit.** Every line that says "free" is something to do today.

---

## Production-grade verdict (point-in-time, 2026-05-03)

**Closed beta with friends/family/early users:** YES, current setup is safe enough.
**Public launch with paying users globally:** NO, three blockers must clear first.

### Blocker 1 — CORS wildcard with credentials (security, must fix before public launch)

[`backend/main.py:140-146`](../backend/main.py#L140-L146) sets:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,  # ["*"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

[`render.yaml:13`](../render.yaml#L13) ships `ALLOWED_ORIGINS=["*"]` to production.

**Fix:** lock `ALLOWED_ORIGINS` to your actual domain list once you know them. For now (closed beta) the wildcard is OK because you control all the clients (your own SPA + your own mobile app). Before public launch:
```yaml
- key: ALLOWED_ORIGINS
  value: '["https://app.<brand>.com", "https://www.<brand>.com", "https://<brand>.com"]'
```

### Blocker 2 — Firestore region (legal + performance, must fix before user data lands)

Per [Decision #1 in legal_launch_research.md](../.claude/docs/legal_research/legal_launch_research.md), Firestore region cannot be changed after creation. Recommended: `asia-southeast1` (Singapore). Last verified region: `asia-northeast2` (Osaka).

**Fix path:** if Firestore still has no production data, recreate the Firebase project with `asia-southeast1` and re-deploy rules + indexes. If production data already exists, you must export → recreate → import (~1 day of work + tested cutover).

**Verify:** Firebase Console → Project Settings → look at "Default GCP resource location."

### Blocker 3 — Render free tier (capacity, fix when first paying user lands)

`plan: free` in [`render.yaml:5`](../render.yaml#L5) means:
- 750 instance hours/month (one always-on service ≈ 720 hrs — single service maxes the budget)
- Sleeps after 15 min idle → cold start ~30s
- 100 GB egress/month
- 512 MB RAM
- Region `oregon` → Firestore `asia-northeast2` (or `asia-southeast1`) trans-Pacific RTT 150ms+

**Fix:** upgrade to Render Starter (USD 7/month ≈ RM 33) when free tier becomes the bottleneck. Move region to `singapore` to match Firestore. Or switch to a Hetzner / Contabo VPS (USD 4–6/month) if Render starter pricing creeps.

### Other gaps (not blockers, but visible)

- **Rate limit module exists** ([`app/core/rate_limit.py`](../backend/app/core/rate_limit.py)) **but is not applied** in `main.py`. Adding it as a middleware is a 5-min change. Without it, a single user can blow your Firestore daily quota.
- **`/health` is hardcoded** ([`main.py:286-288`](../backend/main.py#L286-L288)) — returns "healthy" without probing Firestore. Misleading on dashboards. Fix: do a 1-doc read against `app_config/features` and return 503 on Firestore failure.
- **No security headers** — no CSP / X-Frame-Options / Strict-Transport-Security. Add via FastAPI middleware. 30 min.
- **Sentry is wired but optional** ([`main.py:67-89`](../backend/main.py#L67-L89), `SENTRY_DSN` env). Set up the free tier (5k events/month) and put DSN in Render env. 15 min.

---

## Cash-tiered roadmap

| Tier | Cash needed | Trigger to spend | What you buy |
|---|---|---|---|
| 0 | RM 0 | This week | Free actions (below) |
| 1 | RM 200 | Brand decided + landing page going live | Domain bundle (`.com` + `.com.my` + `.my` + `.app`) + Cloudflare DNS |
| 2 | RM 2,000 | Brand pre-cleared at MyIPO | MyIPO Class 9 + 42 trademark filing |
| 3 | RM 5,000 | First paying user / closed-beta-success | Render Starter + Sentry paid (if needed) + Cloudflare paid (if needed) + buffer |
| 4 | RM 10,000 | Approaching first hire OR investor cheque | Sdn Bhd incorporation + Year 1 secretary + accounting |
| 5 | RM 30,000 | Term sheet signed | Lawyer (SAFE template + employment template + IP-assignment Schedule A) + cyber + PI insurance bind |
| 6 | RM 100,000+ | Angel cheque cleared | Principal engineer hire + payroll vendor + ESOP setup |

**Important:** these are upper bounds. Stay underneath. The full chain is RM ~150k of business spend before the first principal engineer's first paycheque — but you don't pay any of it from your pocket past tier 4.

---

## Tier 0 — RM 0 (this week)

These are all free and high-leverage. Do them in this order:

1. **Lock CORS for production** (Blocker 1) — edit `render.yaml` once you have a brand domain. For now leave wildcard, but **mark this as the gate before public launch**.
2. **Verify Firestore region** (Blocker 2) — Firebase Console → Project Settings. If wrong, recreate before any user data.
3. **Free trademark pre-clearance** — search TMview, USPTO `tmsearch.uspto.gov`, MyIPO online, WIPO Global Brand Database. This decides whether you can keep "GroceryApp" or must rebrand. **Critical input** for the domain decision below.
4. **Move `docs/HEALTH_SCORE.md` to a private board** — Notion / 1Password / private repo. Per [ip_codebase_audit.md](../.claude/docs/legal_research/ip_codebase_audit.md) Action 1.
5. **Set up Firebase budget alerts** — Firebase Console → Billing → Budget alerts. Even on Spark plan, you can attach a billing account ($0 spend) and set alerts at 50/80/100% of free quotas. Email Shahir.
6. **Set up Sentry free tier** — sentry.io (5k events/month). Set `SENTRY_DSN` in Render env. The integration is already coded ([`main.py:67-89`](../backend/main.py#L67-L89)).
7. **Wire rate-limit middleware** — `app/core/rate_limit.py` exists but isn't applied. Add it to `main.py` next to the CORS middleware. Default: per-user 100 req/min, anonymous 20 req/min.
8. **Fix `/health`** — make it probe Firestore. 5-min change.
9. **GitHub Actions uptime cron** (free for public repos, 2,000 min/month free for private) — ping `/health` every 10 min, email Shahir if 3 consecutive 5xx.

**Don't do yet at tier 0:**
- Don't buy domain (waiting on trademark pre-clearance)
- Don't incorporate Sdn Bhd (premature)
- Don't engage lawyer (premature)
- Don't move to Pi (see Pi vs cloud below)

---

## Tier 1 — RM 200

**Trigger:** brand name decided after pre-clearance, landing page ready to go live.

| Item | Cost | Notes |
|---|---|---|
| `<brand>.com` | RM 60/yr | Namecheap or Cloudflare Registrar |
| `<brand>.com.my` | RM 60/yr | MYNIC; requires SSM registration (you have this) |
| `<brand>.my` | RM 80/yr | MYNIC |
| `<brand>.app` | RM 80/yr | Google Domains / Cloudflare |
| Cloudflare DNS + SSL | RM 0 | Free tier covers DNS, SSL, basic DDoS, page rules |
| Cloudflare Email Routing | RM 0 | Forward `dpo@<brand>.com` and `support@<brand>.com` to your Gmail |

**Don't buy domain UNTIL trademark pre-clearance is done.** If "GroceryApp" gets refused (likely, descriptive), you'll have wasted ~RM 280.

If keeping "GroceryApp" (low likelihood): the descriptive nature means low squatter risk. Defer the registration entirely and use a free subdomain (`groceryapp.netlify.app` or similar) for closed beta.

---

## Tier 2 — RM 2,000

**Trigger:** brand pre-cleared, MyIPO online search and TMview both clean, no conflicting marks.

| Item | Cost | Notes |
|---|---|---|
| MyIPO trademark Class 9 (software) | RM 950 | [legal_launch_research.md "IP-3"](../.claude/docs/legal_research/legal_launch_research.md) |
| MyIPO trademark Class 42 (SaaS) | RM 950 | Same filing |
| Buffer | RM 100 | Filing-fee adjustments |

**Defer Madrid Protocol** (~RM 5–8k for international extension) until the MY mark is granted (~6–18 months) and you have ASEAN traction.

---

## Tier 3 — RM 5,000

**Trigger:** first paying user OR closed-beta success metrics hit (e.g., 30% W4 retention at user N=50).

This is the **post-market-validation** tier — closed beta confirmed the product is genuinely useful. Time to migrate the data layer to a production-ready region and start paid acquisition. The migration is the single biggest discrete action of this tier.

### Action 1 — Migrate Firestore to `asia-southeast1` (Singapore)

**Why now, not earlier:** if you migrated pre-Phase-1 you would have tested the migration with no real data, then found out about edge cases when real users started using it. By Tier 3 you have ~50 closed-beta users worth of data — a meaningful migration test that's still small enough to do in a 60-minute downtime window.

**Wife-doable runbook:** [`MIGRATION_FIRESTORE_RUNBOOK.md`](MIGRATION_FIRESTORE_RUNBOOK.md) — 10 steps, every command copy-paste, every step has a verification, rollback in Step 9 if anything fails.

**Migration helper UI:** Luqman → Business → Grocery → Launch Readiness → **Roadmap** → expand Tier 3. Enter source + target project IDs, helper generates customised commands. Source ≠ target is enforced before commands appear.

**Cost:** RM 0 (uses Blaze with $0.01 budget alert from Tier 0). **Duration:** 60–90 min including verification. **Risk:** Low — rollback is a 5-min env-var revert in Render.

### Action 2 — Render upgrade

| Item | Cost | Notes |
|---|---|---|
| Render Starter (USD 7/mo × 12) | RM 400/yr | Removes 15-min sleep, custom domain, single instance always-on |
| Render region migration to `singapore` | RM 0 | Just redeploy with `region: singapore`. Do this AFTER the Firestore migration so they're co-located |
| Buffer for marketing / paid ads | RM 4,600 | Test 2–3 channels with RM 1k each |

If Render becomes the bottleneck, alternatives:
- **DigitalOcean Singapore** (USD 6/mo, 1 GB): RM 350/yr — same region as Firestore SG.
- **Fly.io sin (Singapore)** (USD ~5/mo, 256 MB shared): RM 290/yr — best latency match.
- **Hetzner CX22** (USD 4.51/mo, 4 GB RAM, falkenstein-eu): RM 260/yr — but EU latency to Firestore SG is ~190ms. Falkenstein → SG is bad.

**Recommendation:** stay on Render Starter at this tier. Migrate only when you outgrow it.

---

## Tier 4 — RM 10,000

**Trigger:** approaching first hire (cannot issue ESOP without shares) OR investor cheque (cannot subscribe to Enterprise).

| Item | Cost | Notes |
|---|---|---|
| Sdn Bhd incorporation (SSM) | RM 1,500–4,000 | DIY MyCoID (cheap) or secretary firm (faster) |
| Company secretary year 1 | RM 1,500–3,000 | Mandatory |
| Audit + accounting year 1 | RM 3,000–6,000 | Mandatory once active |
| ESOP pool 10–15% setup | RM 0 | Allocate at incorporation, before any cheque |
| Buffer | RM 1,000 | Contingency |

**Allocate ESOP pool 10–15% AT incorporation.** Allocating later dilutes you, allocating now dilutes the future investor. This is a one-line decision in the Constitution.

---

## Tier 5 — RM 30,000

**Trigger:** term sheet signed.

| Item | Cost | Notes |
|---|---|---|
| Corporate lawyer (one-pass) | RM 5,000–15,000 | SAFE template + employment template + IP-assignment Schedule A. See [ip_codebase_audit.md](../.claude/docs/legal_research/ip_codebase_audit.md) for Schedule A draft |
| Cyber + PI insurance bind (Howden / Sime Darby Lockton) | RM 5,000/yr | [OR-1](../.claude/docs/legal_research/legal_launch_research.md) |
| Privacy-policy lawyer review | RM 1,500–3,000 | Per [legal_launch_research.md "Open question 5"](../.claude/docs/legal_research/legal_launch_research.md) |
| Buffer | RM 5,000–15,000 | Negotiation float |

---

## Tier 6 — RM 100,000+ (angel cheque)

**Trigger:** SAFE / convertible note / priced round closes.

Then in this exact order:
1. Hire principal engineer (RM 18–35k/month all-in)
2. Set up payroll vendor (BrioHR / Kakitangan / PayrollPanda — RM 10–20/employee/month)
3. Cloud infra upgrade (move off Render Starter to Render Pro or move to GCP/AWS if Firestore-adjacent compute makes sense)
4. After 6+ months and ops bandwidth bottleneck: hire Ops Manager / GM

---

## Pi vs cloud — answered

**Don't host the grocery app on Raspberry Pi.** Reasons:

| Argument for Pi | Counter |
|---|---|
| Save money | Render free tier is FREE — you save RM 0/month |
| Full control | You don't need control; Render's deploy → URL is the path of least resistance |
| Privacy | Firestore is in cloud regardless — Pi only moves the API layer, not data |
| Investor DD | "Where is your prod hosted?" "My bedroom" is a red flag |
| Reliability | Home power outages, ISP issues, Pi MicroSD failures, dynamic IP |
| DDoS | Your home internet goes down, your family suffers |
| Cold start | Pi cold start is ~30s same as Render free; no win |

**Where Pi DOES make sense:**
- **Dev/staging mirror** — local Firestore emulator + FastAPI on Pi for offline development
- **Self-hosted Ollama** — long-running LLM inference for `AI_SERVICE_URL` config (cloud LLM = pay-per-token; Pi-hosted = free-after-hardware)
- **Cron jobs Render free can't run** — long-running scheduled tasks, scrapers, batch jobs

**Recommendation:** keep Render for the API. If you want to use the Pi, point `AI_SERVICE_URL` at it via Cloudflare Tunnel (free, no port forwarding) and run Ollama locally for receipt-OCR / insights LLM calls. That's a real cost win (you pay Mistral / OpenAI per call today; Pi-Ollama is free after hardware).

---

## Domain timing — answered

**"Buy domain first for fast exposure" is the wrong instinct.** Here's why:

1. **Pre-trademark pre-clearance, you don't know what name to buy.** "GroceryApp" is a likely descriptive-refusal at MyIPO §14(1)(b) per [legal_launch_research.md "IP-2"](../.claude/docs/legal_research/legal_launch_research.md). If you buy `groceryapp.com` and then have to rebrand, you've wasted RM 60+ and confused early users.
2. **Domains aren't the load-bearing channel for early growth.** Most app discovery is app store search + word of mouth, not web search. A landing page on `groceryapp.netlify.app` is sufficient until brand decided.
3. **Squatter risk is low for descriptive names** — nobody is racing to grab "GroceryApp" or its variants because they can't trademark it either.
4. **Rebrand-and-rush risk is real** — once brand decided, register all 4 TLDs THE SAME DAY, before any public mention. Cybersquatters monitor MyIPO filings; same-day defensive registration neutralises them.

**Sequence:**
1. Free pre-clearance now (tier 0)
2. Decide brand (tier 0)
3. If keeping "GroceryApp": skip domain entirely; use `groceryapp.netlify.app` for closed beta
4. If rebranding: register all 4 TLDs on the same day (tier 1)

---

## Free-tier alerting — concrete setup

### Render free tier
- 750 instance hours/month
- 100 GB egress/month
- No email API on free; can't auto-alert from Render

**Setup:** GitHub Actions cron (free for public repos, 2,000 min/month for private):
- Every 10 min: ping `/health`, log uptime
- Daily 08:00 SGT: fetch Render API for current month usage; email Shahir if >80%
- Weekly: rotate logs into a CSV in the repo for trend visibility

### Firebase Firestore free tier (Spark plan)
- 1 GB stored / 50k reads/day / 20k writes/day / 20k deletes/day / 10 GB egress/month

**Setup (free, requires billing account but $0 spend):**
1. Firebase Console → Billing → upgrade to Blaze plan (pay-as-you-go) BUT set a budget alert at "$0.01" — this gives you alert capability with no actual cost
2. Cloud Monitoring → create alerts at 50% / 80% / 100% of each free-tier quota
3. Add `dpo@<brand>.com` as recipient (already a planned mailbox per [legal_launch_research.md "Critical path step 2"](../.claude/docs/legal_research/legal_launch_research.md))

**App-level metering (more granular):**
- Add `app/services/usage_meter.py` that wraps Firestore client, counts reads/writes per request, increments a per-day counter document (`metrics/daily_{YYYY-MM-DD}`)
- Per-user counter (`metrics/user/{uid}/daily_{date}`) — enables per-user tier enforcement
- GitHub Actions daily cron reads daily counter, alerts if >80% of Firestore quota

### Per-user rate limit (the most important part)

Without this, a single buggy client OR a malicious user can blow your daily Firestore quota in minutes.

`app/core/rate_limit.py` is already coded — wire it as middleware in `main.py`:

```python
# Add near the CORS middleware
from app.core.rate_limit import RateLimitMiddleware
app.add_middleware(RateLimitMiddleware,
    anonymous_limit="20/minute",
    free_tier_limit="100/minute",
    plus_tier_limit="500/minute",
    pro_tier_limit="2000/minute",
)
```

Backed by an in-memory LRU per worker process (fine for 2 gunicorn workers). Move to Redis only if you scale past one server.

### Daily-budget enforcement (kill switch)

If you cross 80% of Firestore daily reads, gracefully degrade rather than crash:
- Return cached responses where possible
- Disable expensive endpoints (`/api/insights/*`, `/api/admin/*`)
- Show a banner in the SPA: "Service running in light mode — some features paused until midnight UTC"

This is a `feature_flags.is_enabled("light_mode")` toggle that the daily cron flips when threshold is hit.

---

## Cross-references

- IP audit findings: [ip_codebase_audit.md](../.claude/docs/legal_research/ip_codebase_audit.md)
- Legal critical path: [legal_launch_research.md](../.claude/docs/legal_launch_research.md)
- Forward feature roadmap: [ROADMAP.md](ROADMAP.md)
- Hiring contracts framework + investor terms: this conversation's chat record (TBD: extract to a separate doc when first hire is imminent)
