---
title: IP Codebase Audit — what is genuinely worth protecting
compiled: 2026-05-03
linked_from: legal_launch_research.md
purpose: Pin which files / modules / data structures qualify as trade secrets vs generic boilerplate. Used to draft IP-assignment Schedule A in employment contracts and to brief investor DD.
---

# IP Codebase Audit

**TL;DR:** 3 candidates worth contract-protecting. Everything else is competent boilerplate — over-protecting it costs hiring friction with zero defensibility benefit. **The real long-term moat is aggregated user data + the rebranded trademark, not the algorithms.**

## The three candidates

| # | Asset | File:line | Defensibility | Containment cost |
|---|---|---|---|---|
| 1 | **Health-score formula** (70/30 inventory:waste split, item-state weights expired=0 / expiring-3d=0.5 / healthy=1.0) | [waste_service.py:77–150](../../../backend/app/services/waste_service.py#L77-L150) + [HEALTH_SCORE.md](../../../docs/HEALTH_SCORE.md) | Medium–High | Medium — must move HEALTH_SCORE.md out of public repo |
| 2 | **Tier × quota × pricing matrix** (Free 50-item / Plus RM 5.99 / Pro RM 12.99 + per-tier feature gates) | [config_service.py:81–132](../../../backend/app/services/config_service.py#L81-L132) + [quota_service.py:32–35](../../../backend/app/services/quota_service.py#L32-L35) | Medium–High | Medium — decision-rights stay with founder + GM |
| 3 | **Catalog similarity + dedup thresholds** (Levenshtein ∨ token-Jaccard, thresholds 0.6 / 0.7 / 0.95-on-barcode) | [catalog_similarity_service.py:45–68](../../../backend/app/services/catalog_similarity_service.py#L45-L68) | Medium | Low — keep thresholds in backend config |

## What is NOT worth protecting (boilerplate)

| Asset | Why not |
|---|---|
| Firebase Auth + Firestore integration | Standard Firebase setup, anyone can replicate |
| Barcode scanning | Calls Open Food Facts (public API) |
| Shopping list CRUD, household sharing | Textbook patterns |
| Receipt OCR | Calls Mindee / Google Vision / Mistral (3rd party) |
| Foodbank source list | Public NGOs, public URLs ([foodbank_sources.py:27–52](../../../backend/app/services/foodbank_sources.py#L27-L52)) |
| Insights heuristics | Rule-based, simple counts ([insights_service.py:22–150](../../../backend/app/services/insights_service.py#L22-L150)) |
| Database schema | Best-practice Firestore, not proprietary |
| UX patterns (state-driven UI, health bar, quick-add) | Discoverable from the app itself |
| Brand name "GroceryApp" | Descriptive — likely refused at MyIPO §14(1)(b), EUIPO Art. 7(1)(c), USPTO §2(e)(1) |

## What the audit DIDN'T flag but is higher-value long-term

The audit identified algorithms. The real durable assets are:

1. **Aggregated user catalog data** — once N thousand users contribute (barcode, name, price, location, expiry-decay-rate), the merged dataset becomes proprietary in a way no formula will. Wire into terms-of-service from day 1: "anonymised, aggregated usage data may be retained and used for product improvement after account deletion."
2. **Rebranded trademark** — "GroceryApp" is descriptive-refusal-bait. Once renamed and filed at MyIPO + Madrid Protocol, the mark is more durable than any code asset.
3. **No hardcoded secrets in repo** (verified: [.gitignore:81–88](../../../.gitignore#L81-L88) covers `serviceAccountKey.json`, `*firebase-adminsdk*.json`, `*.pem`, `*.key`. [config.py:1–59](../../../backend/app/core/config.py#L1-L59) reads everything from env vars). Engineer offer letter must classify committing credentials as gross misconduct.

## The honest assessment

Software trade secrets are structurally weak. The 70/30 health-score split isn't algorithmically novel — a competent engineer with two weeks of user feedback would converge on a similar formula independently. Treat the three candidates as **IP-assignment hygiene** (so an engineer can't walk away claiming personal authorship; so investor DD has a clean answer), but don't price the company as if these are unreplicable.

## Three concrete actions tied to the hiring sequence

### Action 1 — Before public launch (phase 1, founder-only, ~30 min)

Move `docs/HEALTH_SCORE.md` from the public repo into a private founder-only board (Notion / 1Password / private GitHub repo). The implementation stays in code; the *reasoning + future tuning rationale* moves out. Cost: 30 min. Benefit: the formula's *why* is no longer self-serve for an engineer who departs.

### Action 2 — In the principal-engineer offer letter (phase 4)

Add **Schedule A — Founder-Reserved Decisions** to the employment contract:

> The following decisions are reserved to the Founder + General Manager and are not delegated to engineering:
> 1. Health-score formula weights and structure (currently 70/30 inventory:waste; item-state weights expired=0, expiring-3d=0.5, healthy=1.0).
> 2. Tier matrix: tier names, prices, item-cap, feature-per-tier.
> 3. Quota enforcement rules: which catalog modes count against quota.
> 4. Catalog similarity thresholds: 0.6 (suggestion), 0.7 (duplicate), 0.95 (barcode-match).
>
> Engineering's role with respect to these is implementation only. Any change requires written sign-off from a Founder.

Enforceable as a scope-of-employment clause. Gives clean answer to "who owns the pricing IP" in investor DD.

### Action 3 — In the GM offer letter (phase 5)

Add the **aggregated-data-asset clause**:

> The Employee acknowledges that the Company's aggregated, anonymised user-contributed data (catalog entries, purchase events, price records, household consumption patterns) constitutes a trade secret of the Company. The Employee shall not, during or after employment, transfer, copy, extract, or transmit any portion of this dataset off Company-controlled infrastructure, nor shall the Employee solicit, communicate with, or do business with any Customer or User of the Company for a period of 24 months following termination.

This is the higher-leverage clause than any code-related IP since the dataset is where the durable moat actually lives.

## Cross-references

- Critical-path filings: [legal_launch_research.md "IP critical path"](../legal_launch_research.md) — IP-1 (free pre-clearance) → IP-3 (MyIPO RM 1,900) → IP-4 (domains)
- Trade-secret framework: [ip.md](ip.md) §7 (vendor IP assignment) extended to employees
- Hiring contract framework: [BOOTSTRAP_ROADMAP.md](../../../docs/BOOTSTRAP_ROADMAP.md)
