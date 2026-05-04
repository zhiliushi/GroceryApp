---
title: Legal Launch Research — Business Advisor canonical reference
compiled: 2026-05-03
refresh_cadence_days: 90
next_review_due: 2026-08-01
scope: Malaysia + Singapore + Indonesia + Thailand + EU + US-California + Apple/Google global storefronts
applies_to: any consumer-facing software launched by a Malaysian sole proprietor with global app-store distribution and freemium/subscription billing
always_stale_items:
  - Apple App Store Review Guidelines (changes quarterly)
  - Google Play policy (changes quarterly)
  - Indonesia PDP Authority (Lembaga PDP) establishment status
  - EU subscription rules per-country
  - US-MY tax treaty status
  - Apple external-link commission (US currently 0% post Apr 2025 ruling; Supreme Court pending)
  - Apple EU CTF/CTC unification (sunset → unified CTC 2026-01-01)
  - Google Play fee restructuring (recurring subs 10%+5% billing fee from 2026-06-30 in US/UK/EEA, MY 2027-09-30)
  - Play Billing Library version (v6 deprecated, v7 deprecating 31 Aug 2026)
  - FTC Click-to-Cancel (vacated Jul 2025, FTC re-opened rulemaking Jan 2026)
  - EU Cyber Resilience Act phase-in (vulnerability/incident reporting from 11 Sep 2026; full SBOM 11 Dec 2027)
---

# Legal Launch Research — GroceryApp

**Status:** Research compiled 2026-05-03. Use as a launch-readiness checklist; cross-check vendor / counsel before signing anything legally binding. Treated as the **canonical Business Advisor reference** — see [`~/.claude/projects/C--Users-Shahir/memory/reference_business_advisor.md`](C:\Users\Shahir\.claude\projects\C--Users-Shahir\memory\reference_business_advisor.md) for the cross-project pointer.

**Constraints locked:**
- Owner: Malaysian sole proprietor / Enterprise (registered with SSM, not yet Sdn Bhd)
- Distribution: Apple App Store + Google Play, **global storefronts** (so EU + US + ASEAN downloads will happen even with MY-focused marketing)
- Business model: freemium + paid subscription tier (Apple/Google in-app purchases)
- Stack: FastAPI + React Native + Firestore (region currently default — must change before any production data lands; see Decision #1 below)
- Sensitive features: user accounts (email + password), camera (barcode scanning), location data
- NOT in scope: marketplace/commerce-between-users, children under 13, health-data claims, ads/analytics monetization

---

## Deep-dive reports

The detailed research with live-source citations lives in six sibling files (3 original + 3 deep-dives added 2026-05-03 to fill gaps):

| File | Scope | Compiled |
|------|-------|----------|
| [`legal_research/malaysia.md`](legal_research/malaysia.md) | PDPA 2010 + 2024 amendments (effective Apr–Jun 2025), CMA / MCMC, Consumer Protection Act, SSM entity timing, SST (8% digital tax), MY-storefront submission rules — 393 lines | 2026-05-03 |
| [`legal_research/global_app_stores_eu_us.md`](legal_research/global_app_stores_eu_us.md) | Apple App Store Review Guidelines (current), Google Play policy, GDPR (incl. Article 27 EU representative), CCPA/CPRA, Firestore cross-border (SCCs vs DPF), EU subscription law incl. Germany § 312k cancel button, US-MY tax treaty status — 598 lines. **Stale figures patched 2026-05-03**: Apple US external-link commission (was 27%, now 0% post Apr 2025 ruling); Apple minimum payout (was $150, now $40). | 2026-05-03 |
| [`legal_research/asean.md`](legal_research/asean.md) | Singapore PDPA, Indonesia UU PDP (PDP Authority establishment status), Thailand PDPA, cross-border strategy across the 4-country ASEAN footprint, Indonesia PSE registration — 397 lines | 2026-05-03 |
| [`legal_research/ip.md`](legal_research/ip.md) | **Intellectual Property** — trademark registration matrix (MyIPO/IPOS/DGIP/DIP/EUIPO/USPTO/WIPO Madrid — Indonesia IS a Madrid member since 2018), copyright (MY auto + MyIPO voluntary notification, US registration for statutory damages), open-source license compliance + SBOM (EU CRA effective 11 Sep 2026 / 11 Dec 2027), trade secrets (no MY Act yet — common-law only), domain defensive strategy, vendor IP assignment, anti-counterfeiting, brand strategy — 580 lines | 2026-05-03 |
| [`legal_research/app_store_deep_compliance.md`](legal_research/app_store_deep_compliance.md) | **App-store deep compliance** — Apple Small Business Program (15% commission), server-side IAP validation (StoreKit 2 + Play Billing v8), Apple Sign-In requirement triggers, subscription price-increase rules, ATT applicability, Family Sharing (iOS 26.4 removed payment-method requirement), vendor contracts (PLA / DDA / Firebase MSA), Editorial featuring eligibility | 2026-05-03 |
| [`legal_research/operational_risk.md`](legal_research/operational_risk.md) | **Operational risk + EU/MY-specific gaps** — cyber + PI insurance for MY indie (Howden / Sime Darby Lockton ~RM 5k/yr), WCAG 2.1 AA + EAA effective 28 June 2025, ePrivacy cookie consent, MY Cybersecurity Act 2024 (NCII threshold doesn't catch indie), MY Section 233A CMA UCEM (live 11 Feb 2025), TIA / Schrems II, subprocessor management, EU AI Act phased timeline, FTC Click-to-Cancel status (vacated July 2025, FTC re-opened rulemaking Jan 2026), T&C standard clauses, SLA commitments | 2026-05-03 |
| [`legal_research/ip_codebase_audit.md`](legal_research/ip_codebase_audit.md) | **Codebase IP audit** — 3 candidates worth contract-protecting (health-score formula / tier×quota×pricing matrix / catalog similarity thresholds) with file:line citations. Boilerplate explicitly NOT to over-protect. Founder-Reserved Decisions Schedule A draft for engineer offer letter + aggregated-data-asset clause for GM offer letter. Honest assessment: software trade secrets are weak; aggregated user data + rebranded mark are the real moats. | 2026-05-03 |
| [`../../docs/BOOTSTRAP_ROADMAP.md`](../../docs/BOOTSTRAP_ROADMAP.md) | **Cash-tiered bootstrap roadmap** — production-grade verdict (3 blockers: CORS wildcard, Firestore region, Render free tier) with file:line refs. Tier-0-to-tier-6 spend plan (RM 0 → RM 100k+). Pi-vs-cloud answered. Domain timing answered. Free-tier alerting setup (Firebase budget alerts, app-level metering, per-user rate limit, light-mode kill switch). | 2026-05-03 |
| [`market_research/adoption_by_country.md`](market_research/adoption_by_country.md) | **Adoption + market data by country** — 17-country table: per-capita household food waste (kg/yr from UNEP 2024), smartphone penetration, top 1–2 incumbent apps, cultural fit, app-store revenue tier. 3-tier ranking (T1: AU/UK/US/SG/MY, T2: UAE/KSA/NL/SE/DK/DE, T3: JP/KR/FR/TH/ID/PH). 27 inline-numbered footnotes. | 2026-05-03 |
| [`market_research/policy_media_competitive.md`](market_research/policy_media_competitive.md) | **Policy + media + competitive landscape** — regulatory-loudness scorecard (FR/KR/UK/DK/SG/JP/AU/UAE all = 3), media/NGO loudness (UK/FR/US/AU/DK), full competitor breakdown (7 surplus-rescue + 9 inventory-tracking + 7 pantry-recipe). **Key findings**: NoWaste (DK) is closest direct competitor at $5.99/yr; CozZo (UK) sunsetting Dec 30 2025 = whitespace; Asian inventory-tracking apps essentially absent at consumer scale; Too Good To Go absent from MY/SG/ID/TH/PH. | 2026-05-03 |
| [`market_research/market_fit_recommendation.md`](market_research/market_fit_recommendation.md) | **Phased launch recommendation** synthesising the two above. Phase 1 = Malaysia closed beta. Phase 2 = MY+SG soft launch. Phase 3 = AU + UK (with CozZo-migration play, time-bound to Q4 2026). Phase 4 = UAE/KSA Year 2 with Arabic localisation. Skip: US (saturated), FR/DE (localisation), KR (RFID preempted), ID/TH/PH (low awareness + low spend). Reduces near-term legal critical-path weight (defer EU rep purchase until Phase 3 trigger). | 2026-05-03 |
| [`../../docs/MIGRATION_FIRESTORE_RUNBOOK.md`](../../docs/MIGRATION_FIRESTORE_RUNBOOK.md) | **Wife-doable Firestore migration runbook** — 10 steps from Osaka → Singapore region with verification and rollback. Triggers at Tier 3 (post-market-validation, ~50 beta users, 60-min downtime window). Uses gcloud export/import via Blaze plan. Companion Migration Helper UI in Luqman → Business → Grocery → Launch Readiness → Roadmap → Tier 3. | 2026-05-03 |
| [`../../docs/PLAN_ONBOARDING_V2.md`](../../docs/PLAN_ONBOARDING_V2.md) | **Onboarding & Auth v2 plan** — closes 5 audit gaps: first-login profile creation, hybrid access model (invitation auto-approve / self-signup pending), email-verification hard-block, email-bound invitation acceptance, admin-configurable web URL + maintenance banner. 6-phase rollout (~4 days). All changes behind `onboarding_v2_enabled` feature flag. Includes full `/api/me` state-machine handler in Appendix A. | 2026-05-03 |
| [`../../docs/LOCAL_AI_HELP.md`](../../docs/LOCAL_AI_HELP.md) | **Local Ollama setup** — point GroceryApp's `AI_SERVICE_URL` at a local Ollama instance to cut pay-per-token AI costs to $0 in dev. Includes 4-step install + Luqman Developer-Dashboard registration + table of "how Luqman helps" scenarios (logs / flags / RAG / drafting / pre-flight / monitoring). Production exposure deferred to Tier 3+ via Cloudflare Tunnel. | 2026-05-04 |

---

## Decision #1 — irreversible, do BEFORE writing any production data

**Pick Firestore region `asia-southeast1` (Singapore) at project creation.** This is irreversible — Firestore region cannot be changed after creation; you'd have to migrate data manually. Putting Firestore in Singapore eliminates the hardest cross-border question across all four ASEAN jurisdictions (Singapore is broadly considered "comparable protection" for MY PDPA purposes; SG hosting is also accepted by ID/TH cross-border rules with consent), and avoids the US-transfer trap that would otherwise force you to layer SCCs onto every privacy policy.

**Verify before launch:** open Firebase Console → Project Settings → look at "Default GCP resource location." If it shows `nam5`, `us-central1`, or any non-`asia-southeast1`/`asia-southeast2` value, **stop and migrate the project to a fresh one with the right region** before adding production users. The rest of this checklist assumes `asia-southeast1`.

---

## Cross-jurisdiction critical path (ordered)

Do these in this order. Each step gates the next.

| # | Action | Source | Why it gates the next |
|---|--------|--------|------------------------|
| 1 | **Confirm/migrate Firestore region to `asia-southeast1`** | All three reports | Cross-border data transfer mechanisms differ wildly by region — locking this first removes 5+ downstream legal artifacts |
| 2 | **Self-appoint DPO** (founder is fine) and stand up `dpo@<your-domain>` mailbox | ASEAN report (SG mandates for all orgs); MY/EU mandate accessibility | Privacy policy needs DPO contact before submission to either app store |
| 3 | **Engage EU Article 27 representative** | Global report — EUverify Startup ~£399/yr is cheapest defensible | Privacy policy must name the EU rep + EU address; required for global app store launch from MY |
| 4 | **Sign Google Cloud DPA** (Firebase Data Processing Addendum) | MY + Global reports | Required for all of: PDPA s.129 explicit-consent route, GDPR processor-controller chain, ASEAN cross-border |
| 5 | **Draft bilingual (EN + Bahasa Malaysia) Privacy Notice covering all 6 frameworks** (PDPA-MY, PDPA-SG, UU PDP-ID, PDPA-TH, GDPR-EU, CCPA-US) | All three reports | Must be live on marketing site + linked from app *before* App Store submission |
| 6 | **Build data-subject rights endpoints**: in-app account-delete UI + public `/account/delete` web URL + email-based access/portability request handler | Global report — Apple § 5.1.1(v) + Google Play Data Deletion URL | Apple and Google both reject submissions missing these |
| 7 | **Implement granular consent capture** at signup + first-use of camera + first-use of location, with independent toggles + withdrawal flow | ASEAN report (ID/TH strictest) | Required to satisfy "separable consent" under TH PDPA + ID UU PDP + GDPR Art. 7(2) |
| 8 | **Set up 72-hour breach-response runbook** with bilingual notification templates and country-specific clock-start logic (see matrix below) | All three reports | Mandatory once production data exists; missing the deadline is RM250k / 2-year offence in MY alone |
| 9 | **Submit W-8BEN to Apple + Google, leave Part II blank** | Global report | Required to enable payouts; expect 30% US withholding (no MY-US tax treaty) — see Watch List for treaty-shopping option later |
| 10 | **Submit Indonesia PSE registration** if expecting >1,000 ID users or >1% ID traffic share | ASEAN report — Permendag 31/2023 | Indonesia can block your app at carrier/DNS level if you cross the threshold without registration |
| 11 | **Apple Privacy Nutrition Labels + Google Data Safety form** completed truthfully (matches actual data flows in code) | Global report | False declarations are an automatic-rejection trigger and can trigger app pulls post-launch |
| 12 | **German-locale in-app cancel button** (two-click) for the subscription page | Global report — § 312k BGB extended to apps by 2025 BGH rulings | Required for German users; cannot rely on deep-link to Apple/Google subscription manager |

### IP critical path (added 2026-05-03 — see [`ip.md`](legal_research/ip.md))

| # | Action | Source | Notes |
|---|--------|--------|-------|
| IP-1 | **Free pre-clearance trademark search** (TMview, USPTO `tmsearch.uspto.gov`, MyIPO online search, WIPO Global Brand Database) | ip.md §9 | Costs **RM 0**; do BEFORE settling on brand. Highest-leverage IP step. |
| IP-2 | **Decide brand name** — confirm "GroceryApp" or rebrand to coined/arbitrary mark (e.g. "Pantra", "Spiska") | ip.md §9 | "GroceryApp" is descriptive → likely refused at MyIPO §14(1)(b), EUIPO Art. 7(1)(c), USPTO §2(e)(1). Rebrand pre-filing saves wasted fees + forced rebrand later. |
| IP-3 | **File MY trademark, Class 9 + 42 at MyIPO** | ip.md §1 | RM 1,900 baseline. Establishes the mark; downstream Madrid extension; gives App Store / Play Store takedown standing. |
| IP-4 | **Register domains**: `<brand>.com` + `<brand>.com.my` + `<brand>.my` + `<brand>.app` | ip.md §6 | ~RM 200/yr. .com.my requires SSM registration (you have this). |
| IP-5 | **Open-source license audit + Acknowledgements screen** | ip.md §3 | Run `license-checker` (npm) + `pip-licenses`; ship `LICENSES.md` + an Acknowledgements page. Apple/Google submission may flag missing OSS attribution. |
| IP-6 | **Add IP-assignment clause to all freelancer / designer contracts** | ip.md §7 | Default in MY: contractor owns copyright → must assign explicitly. Get logo + brand assets assigned in writing before payment. |
| IP-7 | **Move `docs/HEALTH_SCORE.md` to private board** | [ip_codebase_audit.md](legal_research/ip_codebase_audit.md) Action 1 | 30-min task, do before public launch. Implementation stays in code; *reasoning* moves out of public repo so a departing engineer can't walk away with the tuning rationale. |
| IP-8 | **Founder-Reserved Decisions Schedule A in principal-engineer offer letter** | [ip_codebase_audit.md](legal_research/ip_codebase_audit.md) Action 2 | Reserves health-score weights, tier matrix, quota rules, similarity thresholds to founder + GM. Engineer implements only. Clean answer to investor DD on pricing-IP ownership. |
| IP-9 | **Aggregated-data-asset clause in GM offer letter** | [ip_codebase_audit.md](legal_research/ip_codebase_audit.md) Action 3 | Higher leverage than any code-IP clause — the dataset is where the durable moat lives. 24-month customer non-solicit + dataset non-transfer post-termination. |

### App-store deep critical path (added 2026-05-03 — see [`app_store_deep_compliance.md`](legal_research/app_store_deep_compliance.md))

| # | Action | Source | Notes |
|---|--------|--------|-------|
| AS-1 | **Enroll Apple Small Business Program Day 1** | app_store_deep §1 | 15% commission instead of 30% for devs <$1M/yr. 15-day-after-fiscal-month effective date. At modest scale ~RM 36K/yr saved. |
| AS-2 | **Build server-side IAP validation before v1 submission** | app_store_deep §4 | StoreKit 2 + App Store Server Notifications V2 webhook (Apple); Play Developer API + Real-time Developer Notifications via Pub/Sub (Google). Or use RevenueCat as shortcut (free <$10k MTR). Without this, refunded users keep premium features → revenue leakage. |
| AS-3 | **Wire `BillingClient.acknowledgePurchase` within 3 days** (Android) | app_store_deep §2 | Missed acknowledgments trigger Google **auto-refund**. Wire client + server paths from day 1. |
| AS-4 | **Upgrade to Play Billing Library v8** | app_store_deep §2 | v6 deprecated, v7 deprecating 31 Aug 2026 (same date as Android target API 36 — both gates landing simultaneously). Plan RN client upgrade alongside the API 36 work. |
| AS-5 | **Apple Sign-In if offering social login** | app_store_deep §3 | Guideline 4.8: any third-party social login → must also offer Sign in with Apple. Email-only login skips this requirement. |

### Operational risk critical path (added 2026-05-03 — see [`operational_risk.md`](legal_research/operational_risk.md))

| # | Action | Source | Notes |
|---|--------|--------|-------|
| OR-1 | **Get insurance quotes from 2 MY brokers** for cyber liability + PI (RM 1M each) | operational_risk §1 | Howden Malaysia + Sime Darby Lockton (or Contingent). Bind before first paid customer. ~RM 5,000/yr combined for indie scale. |
| OR-2 | **Implement Firebase consent-mode** for EU users | operational_risk §3 | Analytics + Crashlytics must NOT initialize until explicit opt-in. Regulators verify via network monitoring + SDK decompilation, not UI inspection. High enforcement risk in 2026. |
| OR-3 | **Run Transfer Impact Assessment (TIA)** for SG-region Firestore + EU users | operational_risk §8 | Free CNIL template; 1-2 days self-service. Required post-Schrems II since SG is not on EU adequacy list. |
| OR-4 | **WCAG 2.1 AA accessibility audit** | operational_risk §2 | EAA effective 28 June 2025 — already in force. Free axe DevTools + Lighthouse for first pass; ~RM 5k for one-time external audit. |
| OR-5 | **EU CRA preparation** (vulnerability/incident reporting from 11 Sep 2026) | ip.md §3 + operational_risk | Set up vulnerability disclosure process + incident reporting pipeline before Sep 2026 cutoff. SBOM by 11 Dec 2027. Commercial app does NOT get OSS carve-out. |
| OR-6 | **EU cookie consent banner** | operational_risk §3 | Web admin needs ePrivacy-compliant banner with reject-all default. DIY home-grown is fine for indie; vendors (Cookiebot/Usercentrics/OneTrust) are overkill at this scale. |

---

## Decision matrices

### DPO / Representative requirement matrix

| Jurisdiction | Requirement for a small app | Vendor cost (2026) |
|---|---|---|
| Malaysia (PDPA) | DPO accessible — founder may self-appoint | RM 0 (self) |
| Singapore (PDPA) | **Mandatory** for all organizations, including sole props. ACRA BizFile+ DPO registration is **suspended since 1 Dec 2024** — use PDPC online form + public website listing | S$ 0 (self) — or DPO-as-a-service ~S$200–500/mo |
| Indonesia (UU PDP) | Mandatory for "large-scale" or "sensitive data" processing — small grocery app likely below threshold but should still publish DPO contact | IDR 0 (self) |
| Thailand (PDPA) | Mandatory for "large-scale" processing of sensitive data — likely below threshold for an indie app | THB 0 (self) |
| EU (GDPR) | Article 27 EU representative is **mandatory for non-EU developers offering services to EU residents** — separate from DPO | £399/yr (EUverify Startup) up to ~£2k/yr larger vendors |
| US (CCPA) | None until $25M revenue or 100k CA records | $0 |

**Practical pattern:** one founder-DPO covers MY/SG/ID/TH; EU representative is a separate paid vendor; CCPA does not apply at launch volume.

### 72-hour breach notification clock-start matrix (subtle but critical)

| Jurisdiction | Clock starts at | Recipient | Penalty for missing |
|---|---|---|---|
| Malaysia (PDPA, since 1 Jun 2025) | Awareness of breach | Personal Data Protection Department + affected individuals if significant harm | RM 250k / 2 years |
| Singapore (PDPA) | **Determination of notifiability** (after assessment) | PDPC + individuals if significant harm | S$ 1M or 10% turnover |
| Indonesia (UU PDP) | Awareness | Komdigi (acting until Lembaga PDP is established) + affected individuals | Up to 2% of global revenue |
| Thailand (PDPA) | Awareness | OPDC + affected individuals if high risk | THB 5M admin + criminal |
| EU (GDPR) | Awareness | Lead supervisory authority + individuals if high risk | €20M / 4% global turnover |

**Runbook implication:** the playbook needs two clocks — one starting at "first credible signal" (covers MY/ID/TH/EU/GDPR-72h) and one starting at "post-assessment determination" (covers SG). Naming the SG variant explicitly in the runbook avoids missing it.

### Cross-border transfer mechanism matrix (assumes Firestore in `asia-southeast1`)

| User origin | Transfer mechanism | Effort to satisfy |
|---|---|---|
| Malaysia → Singapore (Firestore) | **Explicit consent route under PDPA s.129** (whitelist abolished Apr 2025) — needs CBPDT-Guidelines-compliant notice | Medium — requires the bilingual privacy notice to name "Google LLC, Singapore region" + risks |
| Singapore → Singapore (same region) | No cross-border issue | Trivial |
| Indonesia → Singapore (Firestore) | Consent + appropriate safeguards (Google Cloud DPA carries SCCs) | Low if DPA signed |
| Thailand → Singapore (Firestore) | Consent + Google Cloud DPA SCCs | Low if DPA signed |
| EU → Singapore (Firestore) | EU-Singapore: no adequacy decision; **rely on Google Cloud DPA's SCCs** + verify Firebase is on the EU-US DPF list (Google is) for any incidental US support staff | Medium — lock vendor DPA + record in RoPA |
| US/CA → Singapore (Firestore) | No US legal export restriction; CCPA notice in privacy policy is sufficient at launch volume | Trivial |

### Subscription billing disclosure matrix

| Jurisdiction | Requirement on top of Apple/Google flows | Implementation impact |
|---|---|---|
| Malaysia (CPA) | Plain-language auto-renewal disclosure, easy cancellation, refund of unused period if mis-sold | Privacy/T&C addendum; Apple/Google's flow generally satisfies |
| EU (Omnibus Directive 2019/2161) | 14-day right of withdrawal for digital subscriptions; can be waived with express consent at first use of digital content | Must show waiver-consent checkbox before granting paid-tier features |
| Germany (§ 312k BGB, BGH-extended to apps in 2025) | **In-app two-click cancel button**; cannot rely on deep-link to Apple/Google subscription manager | Must ship a German-locale subscription cancel UI |
| Italy / France | Country-specific cooling-off rules — generally aligned with Omnibus, no separate work needed | None at launch |

---

## First 30 days — pre-launch checklist (concrete)

Day 1–7 (constitutional decisions):
- [ ] Verify Firestore region; migrate to `asia-southeast1` if needed
- [ ] Register `dpo@<your-domain>` mailbox + forward to founder
- [ ] Pick + engage EU Article 27 representative vendor; receive their EU address for the privacy policy
- [ ] Sign Google Cloud / Firebase Data Processing Addendum (free, click-through)

Day 8–14 (artifacts):
- [ ] Draft bilingual EN+BM Privacy Notice covering all 6 frameworks (use a template + local counsel review for MY-specific clauses; budget RM 1.5–3k for review)
- [ ] Draft bilingual EN+BM Terms of Service with subscription-billing clauses
- [ ] Build `/account/delete` public web URL + in-app account-delete flow
- [ ] Implement consent-capture screens (signup + camera + location, with separable toggles)
- [ ] Implement consent withdrawal flow (settings page)

Day 15–21 (operational):
- [ ] 72-hour breach runbook document with bilingual templates + country-specific clock logic
- [ ] DSAR (data subject access request) intake email + 30-day turnaround SLA documented
- [ ] Records of Processing Activities (RoPA) — required under GDPR Art. 30 for non-occasional processing; one-page spreadsheet is fine
- [ ] DPIA short-form for camera + location processing — required if "high risk to data subjects" under GDPR Art. 35; spec says barcode scanning is low-risk but document the assessment

Day 22–30 (submission):
- [ ] Apple Privacy Nutrition Labels questionnaire — verify against actual data flows in code
- [ ] Google Play Data Safety form — same verification
- [ ] German-locale subscription cancel UI shipped + tested
- [ ] W-8BEN submitted to Apple + Google (Part II blank)
- [ ] Test subscription flow on both stores in sandbox mode for at least one EU + one ASEAN locale
- [ ] PSE registration assessment: do you expect to cross 1,000 ID users in year 1? If yes, file now; if no, monitor and file at threshold

---

## Watch list (revisit at growth milestones)

| Trigger | Action |
|---|---|
| Approaching RM 500k annual revenue | **Register for SST** (8% digital service tax since 1 Mar 2024) — see [malaysia.md](legal_research/malaysia.md) |
| Approaching RM 100k+/month revenue OR foreign-investor pitch | **Convert sole prop → Sdn Bhd** for liability + tax structure + treaty access |
| US storefront sales reach ~USD 5–10k/month | **Consider Singapore Pte Ltd subsidiary** (0% US-SG treaty rate) to reclaim 30% US withholding via Apple/Google's annual W-8 refresh — at this revenue, the ~SGD 3k/year SG company maintenance cost pays back |
| App approaching 1,000 transacted ID users or 1% ID traffic | **File Indonesia PSE registration** (Permendag 31/2023) — without this, ID can block at carrier/DNS level |
| Adding ads / analytics SDKs | Re-do Apple Privacy Nutrition Labels + Google Data Safety; trigger ATT prompt review; revise GDPR lawful-basis analysis |
| Adding camera flow that extracts biometrics (face/fingerprint features) | **Triggers PDPA "sensitive personal data" rules** (added 2024 amendment) — explicit consent + DPIA mandatory |
| Adding marketing email/SMS to MY users | DNC compliance under Communications and Multimedia Act 1998 |
| App approaching 8M+ MY users | MCMC ASP(C) class licence assessment (only kicks in at this scale, per the 2025 changes) |
| September 2026 | **Google Play developer-identity verification** cutover named for ID/SG/TH/Brazil — complete before deadline if launching to those storefronts |
| August 31, 2026 | **Google Play target API 36 (Android 16) deadline** for new apps and all updates — ensure RN 0.78+ or Expo SDK 54+ before this date |

---

## Open questions for human decision

These came up during research and need a founder-level call before drafting the privacy policy:

1. **Naming convention for the legal entity in T&C** — sole prop trades as "Enterprise <name>"; the privacy policy should name the legal entity (Enterprise registration name) as the data controller, not just the brand name. Confirm the Enterprise registration name with SSM record before drafting.
2. **Marketing-channel scope at launch** — if not sending email/SMS marketing to MY/SG/ID/TH numbers at launch, the DNC + spam-law analysis can be deferred. Confirm.
3. **EU users at launch — yes/no/best-effort** — if you want to actively exclude EU downloads at launch (using app store geo-restrictions), Article 27 EU representative becomes optional and you save ~£399/yr. Trade-off: harder to expand later, and Article 3 still catches "monitoring behaviour" if EU users find the app via VPN. Most indie devs accept the £399 and ship globally.
4. **Children under 13 explicit exclusion** — privacy policy needs a clause explicitly stating the app is not directed at children under 13 (MY: 18, but US COPPA + UK ICO Age-Appropriate Design Code use 13). Confirm "general audience" framing.
5. **Counsel budget for privacy-policy review** — recommend RM 1.5–3k for a one-pass review by a Malaysian privacy lawyer before app store submission. Templates from generic SaaS sources will not capture MY 2024 PDPA amendments correctly.

---

## Sources

All primary citations are inline in the three deep-dive files. Notable URLs:
- Malaysia: jpdp.gov.my, ssm.com.my, mysst.customs.gov.my, mcmc.gov.my, kpdn.gov.my
- ASEAN: pdpc.gov.sg, kominfo.go.id (now komdigi.go.id), pdpc.or.th, thaipdpa.com
- EU: gdpr.eu, edpb.europa.eu, commission.europa.eu, dataprivacyframework.gov
- Apple/Google: developer.apple.com/app-store/review/guidelines, support.google.com/googleplay/android-developer
- Tax/payouts: developer.apple.com/help, IRS Publication 901, PwC tax summaries
