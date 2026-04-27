# Market Validation — How to know it's working

> **Goal of this doc.** Stop the "what should I check?" panic. Give you a single page that tells you what to measure, where the lines are, and what to do when a number crosses a line. Same framework will work for product #2, #3, etc.

---

## The honest situation

- You just got laid off. Cash matters. Time matters more — every week without signal is a week you could have shipped product #2.
- This is a **free utility** with no paid tier yet. You won't see "revenue" naturally. You have to manufacture a path: voluntary tips (Buy Me a Coffee / Ko-fi), or a Stripe paid tier when the time is right.
- Friends and family are not real validation. They'll use it once to be polite. **Real validation = a stranger pays, OR a stranger refers another stranger.**
- $200 USD ≈ MYR 940 (rate ~4.7) — small enough to be reachable, big enough to mean *something*.

---

## The 5-step funnel

Every product you ship — grocery app, the next one, the one after — has the same five steps. Measure each.

```
        STRANGER
           ↓
       [1] FIND — they hear about you
           ↓
       [2] SIGN UP — they create an account
           ↓
       [3] ACTIVATE — they do the core thing once (add a purchase, set expiry)
           ↓
       [4] RETURN — they come back day 7, day 14, day 30
           ↓
       [5] PAY or REFER — they tell someone, or they pay
```

**Rule:** if step N is broken, fixing N+1 is wasted work. Fix from the top.

---

## Numbers to watch (and the lines)

For each metric: the **target** you're aiming for, and the **kill line** below which the next product is more interesting than this one.

| Metric | What it is | Target | Kill line | Why this matters |
|---|---|---|---|---|
| **Total signups** | unique uids | 50 by month 3 | <10 | If even free can't get 10 in 3 months, distribution is the problem, not product |
| **Activation rate** | % of signups with ≥1 purchase event | >60% | <30% | Below 30% = the onboarding is broken |
| **D7 retention** | % active 7 days after signup | >25% | <10% | <10% means people don't actually want it |
| **WAU/MAU** | weekly actives ÷ monthly actives | >0.4 | <0.2 | Stickiness. <0.2 = it's not a habit |
| **Items added per WAU** | total purchase events / WAU | >3/wk | <1/wk | <1/wk and they aren't really using it |
| **Median health score Δ** | this-week median minus 4-weeks-ago median | rising | falling | If product is working, users waste less, score rises |
| **Unsolicited referrals** | "X told me about it" in signup survey | ≥1/mo by month 2 | 0 in 60 days | Word of mouth = product-market fit signal |
| **Tips/donations USD** | $ received voluntarily | ≥$1 by month 1 | $0 in 90 days | Even one tip from a stranger = signal |
| **Distance to $200 USD goal** | sum of tips + paid-tier MRR×12 | 100% by month 6 | trending flat | Cashflow proxy |

The dashboard surfaces every one of these.

---

## When to escalate (spend time/money to grow)

Escalate ONLY when the foundation is solid:

1. **D7 retention >20%** for 4 weeks straight — people stick
2. **WAU/MAU >0.4** — they form a habit
3. **At least 1 unsolicited referral** — someone wanted to share it without you asking

Once those three are true, then it makes sense to:
- Buy the domain (✓ already planning this)
- Pay for upgraded Render tier (no cold starts)
- Pay for Sentry pro tier
- Run small paid acquisition (FB ads, Reddit micro-buy ~$20)

**Until those three are true, every dollar spent is wasted.** Friends-and-family validation does not count toward escalating.

---

## When to start charging

Don't turn on a paid tier until:

- **10+ MAU sustained for ≥6 weeks**
- **At least 1 person has asked unprompted: "can I pay you?"** OR
- A user says "I would pay X for it" when you ask them to put a number on it

Then charge. Suggested first-tier price for Malaysia market:

- **MYR 5/mo** (~$1 USD) — barely-there pricing, removes the "it's free so I won't bother" stigma without scaring users
- **MYR 15/mo** (~$3 USD) — if responses to "would you pay $X" cluster around 10-20

Keep a free tier — it's your acquisition funnel. Paid tier unlocks: unlimited catalog entries, financial tracking, telegram alerts, household sharing. (Currently all free; flag-gate the paid features when ready.)

**$200 USD goal math:**
- 40 paying users × MYR 5/mo × 12 months = MYR 2,400 ≈ $510 USD/yr
- 10 paying users × MYR 15/mo × 12 months = MYR 1,800 ≈ $383 USD/yr
- 5 one-time tips of MYR 50 each = MYR 250 ≈ $53 USD

Mix: 5-10 paying + a couple of supportive-friend tips realistically gets you to $200 in 6-12 months — IF retention is real.

---

## When to kill (move on to product #2)

Kill criteria are deliberately strict — you only have so many weeks before money pressure forces a job. Time-box this product.

**Hard kill at 90 days post-launch** if ALL of:

- D7 retention <10% for 4 weeks
- WAU/MAU <0.2
- Zero unsolicited referrals
- Zero tips/donations
- You no longer want to use it yourself

If any 3 of 5 — kill. If 2 of 5 — give it 30 more days and one feature change. If 0-1 of 5 — keep going.

**Keep the codebase.** GroceryApp's catalog/purchases/health-score work is reusable IP. The "next product" might be the same backbone with a different UX.

---

## The weekly review ritual (15 min, every Sunday)

Block 15 min on Sunday night. Open `/admin/business-metrics`. Walk the dashboard top-to-bottom. Fill in this table in your head (or in a journal):

```
Week of: 2026-04-27
- Signups this week: ___
- WAU: ___   (vs last week: ___)
- D7 retention this cohort: ___%
- Items added per WAU: ___
- Median health score: ___ (vs 4w ago: ___)
- Tips received: $___ MYR ___
- Distance to $200 goal: ___%

What I'll do this week:
1. ___
2. ___
3. ___

What I'll NOT do this week:
1. ___ (because the data doesn't support it yet)
```

The "what I'll NOT do" line matters — saves you from feature-creep'ing instead of doing acquisition.

### Auto-generated signals on the dashboard

The dashboard's **Signals** card surfaces these automatically:

| Trigger | Action it suggests |
|---|---|
| MAU < 5 | "Text 3 friends today. No friend lookups, no excuses." |
| D7 retention < 10% | "Do a 15-min call with 1 churned user this week." |
| 30 days since last revenue entry, no tips | "Ask 3 active users: 'Would you pay MYR 5/mo for this?'" |
| Median health score rising | "Product works. Tell that story to next 3 prospects." |
| WAU/MAU > 0.4 + ≥1 referral | "Foundation solid — buy domain + start paid tier prep." |
| 90 days post-launch + all kill criteria hit | "Time to ship product #2." |

You don't have to act on all of them. You do have to *read* all of them.

---

## Domain purchase — yes, but do it right

You said you're planning to buy a domain. Recommendation:

- **Cloudflare Registrar** — at-cost pricing (~$10 USD/yr for `.com`), free WHOIS privacy, no upsell garbage. Use this.
- **`.my` if you want a Malaysia signal** — exabytes.my, ~MYR 90/year. Slightly more friction (NIC verification).
- Avoid GoDaddy (overpriced) and any registrar that pre-checks a "premium" SSL upsell.

Total domain cost for a `.com`: ~MYR 47/year. Safe spend.

After purchase:
1. Add the apex + `www` as A/CNAME records pointing to Render.
2. In Render dashboard → Settings → Custom Domain → add both. Render auto-provisions Let's Encrypt SSL within 15 min.
3. Update `ALLOWED_ORIGINS` in `backend/.env` (Render env tab) to include the new domain.
4. Update `web-admin/.env` build-time vars if any reference the bare onrender URL.

---

## What this dashboard does NOT cover (intentionally)

- **Cohort analysis beyond D7/D30.** Too thin a dataset until you have 50+ users.
- **Marketing attribution.** Skip until you're spending on paid acquisition.
- **NPS / surveys.** Single-digit users — just ask them in WhatsApp.
- **A/B testing.** Pointless below ~500 users.
- **MRR forecasting curves.** Pointless below ~10 paying users.

Keep it stupid simple until the numbers force you to upgrade the dashboard.

---

## Reusing this for future products

The backend endpoint `GET /api/admin/business-metrics` returns a standard shape (see `docs/API.md`). For the next product:

1. Implement the same endpoint shape — same metric keys, same revenue model.
2. Future Luqman Dev Hub will get a "Business Metrics" tile that reads from `projects.json` and shows a per-product side-by-side. Today it's just one product so the tile lives inside the product itself.
3. The MARKET_VALIDATION.md framework copies verbatim — replace `GroceryApp` with the new name.

---

## Cross-references

- Dashboard route: `/admin/business-metrics` (admin-only)
- Backend endpoint: `GET /api/admin/business-metrics`
- Revenue log: Firestore `app_config/revenue_log` (manual entry until Stripe)
- Operational checklist: `.claude/memory/MEMORY.md` → "Post-refactor operational checklist"
- Free fixes (do first if any pending): `docs/FREE_FIXES_BACKLOG.md`
- Paid spend triggers: `docs/PAID_ENHANCEMENTS.md`
