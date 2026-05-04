---
title: GroceryApp — Launch Concerns Checklist
compiled: 2026-05-03
source: .claude/docs/legal_launch_research.md (3-agent legal research pass)
refresh_cadence_days: 90
next_review_due: 2026-08-01
canonical_in_luqman: BusinessPage > Grocery > Launch (planned sub-tab)
---

# GroceryApp — Launch Concerns Checklist

This is the human-readable launch checklist for GroceryApp. The full legal research with citations and deep-dives lives in [`.claude/docs/legal_launch_research.md`](../.claude/docs/legal_launch_research.md) (and the three sibling files under `.claude/docs/legal_research/`).

**How to use this file:**
- Use the table below as the single source of truth for launch readiness
- The same data is mirrored into Luqman's BusinessPage > Grocery tab as a tickable checklist with per-item journal entries
- Refresh prompted every 90 days, or whenever an "always-stale" item triggers (Apple/Google policies, Indonesia PDP Authority status, EU subscription rules, US-MY tax treaty)

**Existing artifacts (do NOT recreate):**
- [`docs/legal/privacy-policy.md`](legal/privacy-policy.md) — TEMPLATE drafted 2026-04-26 with `[…]` placeholders. Needs counsel review before public launch.
- [`docs/legal/terms-of-service.md`](legal/terms-of-service.md) — also a template.
- These cover the privacy/T&C drafting work in items #5 and #6 below; the remaining work is filling placeholders + counsel review, not writing from scratch.

---

## Decision-tree (resolve before checklist)

| # | Decision | Current state | Recommended action | Status |
|---|---|---|---|---|
| D1 | **Firestore region** | `asia-northeast2` (Osaka, JP) — verified live 2026-05-03 via Firebase CLI | Migrate to `asia-southeast1` (Singapore). Use multi-database approach (cheapest, ~1 day) — create new `(asia-southeast1)` DB in same project, migrate, switch app | ☐ Open |
| D2 | **EU launch** | Undecided | Ship globally + engage £399/yr EU rep. Reversible cost; geo-restrict-then-open is harder | ☐ Open |
| D3 | **Counsel engagement** | None | Budget RM 1.5–3k for one-pass MY privacy-lawyer review of the existing template | ☐ Open |
| D4 | **DPO mailbox + SSM Enterprise legal name** | Undecided | Reserve `dpo@<domain>` + confirm Enterprise registration name from SSM cert | ☐ Open |

---

## Pre-launch checklist

| # | Item | What's required | Cost (RM) | Regulator / Authority | Source / Document | Status |
|---|------|------------------|-----------|------------------------|---------------------|---------|
| 1 | Firestore region migration | Migrate `(default)` Osaka DB → new `(asia-southeast1)` Singapore DB. Update Firebase Admin SDK init in `backend/main.py` to point at new DB | 0 + ~1 day dev | N/A — architectural | [legal_launch_research.md § Decision #1](../.claude/docs/legal_launch_research.md) | ☐ |
| 2 | DPO appointment + mailbox | Self-appoint founder as DPO. Set up `dpo@<domain>` email forwarding to founder. Publish DPO contact on marketing site, in-app, and privacy policy | 0–200 (mailbox if separate) | JPDP MY (PDPA), PDPC SG, Komdigi ID, OPDC TH | [PDPA Section 17 + 2024 Amendment](https://www.jpdp.gov.my/), [SG PDPA Section 11](https://www.pdpc.gov.sg/) | ☐ |
| 3 | EU Article 27 representative | Engage representative-as-a-service vendor (cheapest defensible: EUverify Startup). Add their name + EU address to privacy policy | ~2,200/yr (£399) | European Commission + EU national DPAs | [GDPR Article 27](https://gdpr.eu/article-27/) | ☐ |
| 4 | Google Cloud / Firebase DPA | Sign click-through Data Processing Addendum in Firebase Console → Project Settings → Privacy & Security | 0 | N/A — vendor contract | [Firebase DPA](https://firebase.google.com/terms/data-processing-terms) | ☐ |
| 5 | Privacy policy (bilingual EN+BM) | Fill placeholders in existing [`docs/legal/privacy-policy.md`](legal/privacy-policy.md) template. Add: PDPA 2024 Amendment compliance ("Data Controller", biometric clause, breach clock), CBPDT Guidelines cross-border notice, GDPR + ASEAN PDPA equivalents, CCPA notice, EU rep contact, DPO contact. Counsel review pass | 1,500–3,000 (counsel) | JPDP MY (PDPA Notice/Choice Principle) — primary | [PDPA 2024 Amendment](https://www.jpdp.gov.my/), [GDPR](https://gdpr.eu/), [SG PDPA](https://www.pdpc.gov.sg/), [TH PDPA](https://thaipdpa.com/), [ID UU PDP](https://komdigi.go.id/) | ☐ |
| 6 | Terms of Service (bilingual EN+BM) | Fill placeholders in existing [`docs/legal/terms-of-service.md`](legal/terms-of-service.md). Add: subscription auto-renewal disclosure, EU 14-day withdrawal + waiver, Germany cancel-button reference, MY Consumer Protection Act 1999 compliance | (covered in #5) | KPDN MY (Consumer Protection Act 1999) | [Consumer Protection Act 1999](https://www.kpdn.gov.my/), [EU Omnibus Directive 2019/2161](https://eur-lex.europa.eu/eli/dir/2019/2161/oj) | ☐ |
| 7 | Account deletion (in-app + public URL) | Build in-app delete flow (Settings → Account → Delete). Build public `/account/delete` web page (HTTP-accessible without auth). Both must complete deletion within 30 days | 0 — dev only | Apple, Google | [Apple Guidelines § 5.1.1(v)](https://developer.apple.com/app-store/review/guidelines/#5.1.1), [Google Data Deletion](https://support.google.com/googleplay/android-developer/answer/13327826) | ☐ |
| 8 | Granular consent capture | Signup screen with separate toggles for: data processing (mandatory), marketing (default off), analytics (default off). First-use camera/location prompts must be granular and withdrawable | 0 — dev only | All PDPA + GDPR + Apple/Google | [GDPR Article 7](https://gdpr.eu/article-7/), [TH PDPA Section 19](https://thaipdpa.com/) | ☐ |
| 9 | 72-hour breach response runbook | Bilingual (EN+BM) notification templates. Two clocks: **awareness clock** (MY/ID/TH/EU) and **post-determination clock** (SG only). Document escalation path | 0 — process | All PDPA + GDPR | [legal_launch_research.md § breach matrix](../.claude/docs/legal_launch_research.md), [PDPA 2024 Amendment](https://www.jpdp.gov.my/) | ☐ |
| 10 | DSAR (data subject rights) endpoint | Email intake at `dsar@<domain>` (or DPO mailbox). 30-day response SLA. Capabilities: access, portability (JSON export), erasure, rectification | 0 — process + scripts already exist (`backend/scripts/export_user_data.py`, `delete_user_data.py`) | All PDPA + GDPR | [GDPR Articles 15-22](https://gdpr.eu/), [PDPA Sections 30-37](https://www.jpdp.gov.my/) | ☐ |
| 11 | Records of Processing Activities (RoPA) + DPIA | One-page spreadsheet listing every personal data flow (purpose, lawful basis, recipients, retention). Short-form DPIA for camera + location processing | 0 — template | EU national DPAs (Article 30 + 35) | [GDPR Article 30](https://gdpr.eu/article-30/), [Article 35](https://gdpr.eu/article-35/), [ICO RoPA template](https://ico.org.uk/for-organisations/documentation/) | ☐ |
| 12 | Apple Privacy Nutrition Labels | Complete in App Store Connect → My Apps → App Privacy. Declare every data category collected: contact info, identifiers, usage data, etc. Must match actual data flows in code | 0 | Apple | [Apple Privacy Details](https://developer.apple.com/app-store/app-privacy-details/) | ☐ |
| 13 | Google Data Safety form | Complete in Play Console → Policy → App content → Data safety. Declare data collection, sharing, encryption, deletion. Provide Data Deletion URL | 0 | Google | [Play Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469) | ☐ |
| 14 | German-locale subscription cancel button | Add in-app two-click cancel UI for `de_DE` locale. Cannot rely on deep-link to Apple/Google subscription manager (BGH ruling 2025 extended § 312k BGB to apps) | 0 — dev only | German civil law (§ 312k BGB), enforced by German consumer associations | [§ 312k BGB](https://www.gesetze-im-internet.de/bgb/__312k.html), [BGH ruling 2025](https://www.bundesgerichtshof.de/) | ☐ |
| 15 | W-8BEN tax form (Apple + Google) | Submit during developer registration. Leave Part II (treaty claims) blank — no MY-US tax treaty exists. Accept 30% US withholding on US-storefront royalties | 0 — filing | US IRS (via Apple/Google) | [W-8BEN Form](https://www.irs.gov/forms-pubs/about-form-w-8-ben), [IRS Publication 901](https://www.irs.gov/forms-pubs/about-publication-901) | ☐ |
| 16 | Apple Developer Program enrollment | Create Apple Developer account. Submit Enterprise registration (SSM business cert) for Organization enrollment OR Individual for sole-prop trading name | ~440/yr ($99 USD) | Apple | [Apple Developer Program](https://developer.apple.com/programs/) | ☐ |
| 17 | Google Play Console registration | One-time fee. As of Sept 2026, Indonesia/Singapore/Thailand storefronts require developer-identity verification | ~110 one-time ($25 USD) | Google | [Google Play Console](https://play.google.com/console/about/), [Developer identity verification](https://support.google.com/googleplay/android-developer/answer/14171095) | ☐ |
| 18 | Indonesia PSE registration (CONDITIONAL) | File only if reaching 1,000 transacted ID users OR 1% ID traffic share. Without registration, Komdigi can block app at carrier/DNS level | 0 (filing) — but business-impact if missed | Komdigi (Direktorat Jenderal Aplikasi Informatika) | [Permendag 31/2023](https://peraturan.bpk.go.id/Details/254680/permendag-no-31-tahun-2023), [PSE Registration Portal](https://pse.komdigi.go.id/) | ☐ Conditional |

---

## Additional concerns from deep-dive research (added 2026-05-03)

Three more deep dives surfaced 17 additional concerns. See [`.claude/docs/legal_research/ip.md`](../.claude/docs/legal_research/ip.md), [`app_store_deep_compliance.md`](../.claude/docs/legal_research/app_store_deep_compliance.md), and [`operational_risk.md`](../.claude/docs/legal_research/operational_risk.md) for full detail with citations.

### Intellectual Property (IP)

| # | Item | What's required | Cost (RM) | Regulator / Authority | Source / Document | Status |
|---|------|------------------|-----------|------------------------|---------------------|---------|
| 30 | Pre-clearance trademark search | Free search via TMview (EU+international), USPTO `tmsearch.uspto.gov` (replaced TESS in 2026), MyIPO online search, WIPO Global Brand Database. Do BEFORE settling on brand. | 0 | Self-service (no authority filing) | [TMview](https://www.tmdn.org/tmview/), [USPTO Trademark Search](https://tmsearch.uspto.gov/), [MyIPO](https://www.myipo.gov.my/), [WIPO Global Brand DB](https://branddb.wipo.int/) | ☐ |
| 31 | Brand decision (confirm or rebrand) | "GroceryApp" is descriptive → likely refused at MyIPO §14(1)(b), EUIPO Art. 7(1)(c), USPTO §2(e)(1). Either confirm or rebrand to a coined/arbitrary mark BEFORE filing. | 0 | Self-decision | [ip.md §9](../.claude/docs/legal_research/ip.md) | ☐ |
| 32 | MY trademark — Class 9 + 42 at MyIPO | File trademark application; covers downloadable software (Class 9) + SaaS (Class 42). 10-year term. Madrid Protocol routing reaches all in-scope jurisdictions (Indonesia IS a Madrid member since 2018). | 1,900 | MyIPO (Intellectual Property Corporation of Malaysia) | [MyIPO Trademarks](https://www.myipo.gov.my/en/trademarks/) | ☐ |
| 33 | Domain defensive registration | Register `<brand>.com` + `<brand>.com.my` + `<brand>.my` + `<brand>.app`. Annual renewals. .com.my requires SSM registration (you have this). | 200/yr | MYNIC (.my) + ICANN registrars | [MYNIC](https://mynic.my/), [ICANN](https://www.icann.org/) | ☐ |
| 34 | Open-source license audit + Acknowledgements | Run `license-checker` (npm) + `pip-licenses` (Python). Ship `LICENSES.md` + an in-app Acknowledgements page. Apple/Google submission may flag missing OSS attribution. | 0 (DIY) | N/A — license-holder requirements | [SPDX licenses](https://spdx.org/licenses/), [license-checker](https://github.com/davglass/license-checker) | ☐ |
| 35 | Vendor IP-assignment clauses | Default in MY: contractor/designer owns copyright. Add explicit written assignment clause to every freelancer / designer contract; get logo + brand assets assigned in writing BEFORE payment. | 0 (template) | Common law (MY contract law) | [ip.md §7](../.claude/docs/legal_research/ip.md) | ☐ |
| 36 | EU Cyber Resilience Act preparation (CONDITIONAL on EU launch) | Vulnerability/incident reporting from **11 Sep 2026**; SBOM + secure-by-design from **11 Dec 2027**. Commercial app does NOT get OSS carve-out. Set up vulnerability disclosure process + incident reporting pipeline. | 0–2,000 (depending on tooling) | EU Commission (ENISA-coordinated) | [EU Cyber Resilience Act](https://eur-lex.europa.eu/eli/reg/2024/2847/oj) | ☐ Conditional |

### App Store Deep Compliance

| # | Item | What's required | Cost (RM) | Regulator / Authority | Source / Document | Status |
|---|------|------------------|-----------|------------------------|---------------------|---------|
| 40 | Apple Small Business Program enrollment | 15% commission instead of 30% for devs <$1M USD/yr. Enroll Day 1; effective 15-day-after-fiscal-month. ~RM 36K/yr saved at modest scale. | 0 (filing) | Apple | [Small Business Program](https://developer.apple.com/app-store/small-business-program/) | ☐ |
| 41 | Server-side IAP validation | StoreKit 2 + App Store Server Notifications V2 webhook (Apple); Play Developer API + Real-time Developer Notifications via Pub/Sub (Google). Or use RevenueCat (free <$10k MTR). Without this, refunded users keep premium features. | 0 (DIY) – ~$80/mo (RevenueCat at scale) | Apple + Google | [StoreKit 2](https://developer.apple.com/storekit/), [Play Billing](https://developer.android.com/google/play/billing) | ☐ |
| 42 | Android `acknowledgePurchase` within 3 days | `BillingClient.acknowledgePurchase` is a footgun — missed acknowledgments trigger Google **auto-refund**. Wire client + server paths from day 1. | 0 (dev only) | Google | [Play Billing — Process purchases](https://developer.android.com/google/play/billing/integrate#process) | ☐ |
| 43 | Play Billing Library v8 upgrade | v6 deprecated, v7 deprecating **31 Aug 2026** (same date as Android target API 36). Plan RN client upgrade alongside the API 36 work. | 0 (dev only) | Google | [Play Billing Library Releases](https://developer.android.com/google/play/billing/release-notes) | ☐ |
| 44 | Apple Sign-In (CONDITIONAL on social login) | Guideline 4.8: any third-party social login (Google/Facebook/etc.) requires also offering Sign in with Apple. Email-only login skips this. | 0 (dev only) | Apple | [Apple Guidelines §4.8](https://developer.apple.com/app-store/review/guidelines/#sign-in-with-apple) | ☐ Conditional |

### Operational Risk

| # | Item | What's required | Cost (RM) | Regulator / Authority | Source / Document | Status |
|---|------|------------------|-----------|------------------------|---------------------|---------|
| 50 | Cyber liability + PI insurance | Get quotes from 2 MY brokers (Howden Malaysia + Sime Darby Lockton or Contingent). Cyber liability RM 1M + Professional indemnity RM 1M. Bind BEFORE first paid customer. | 5,000/yr | Bank Negara Malaysia (insurers regulated) | [BNM Insurer Directory](https://www.bnm.gov.my/), [Howden MY](https://www.howdengroup.com/asia/malaysia) | ☐ |
| 51 | Firebase consent-mode for EU users | Analytics + Crashlytics must NOT initialize until explicit opt-in. Regulators verify via network monitoring + SDK decompilation, NOT UI inspection. | 0 (dev only) | EU national DPAs (ePrivacy enforcement) | [Firebase Consent Mode](https://firebase.google.com/docs/analytics/configure-data-collection) | ☐ |
| 52 | Transfer Impact Assessment (TIA) | Free CNIL template; 1-2 days self-service. Required post-Schrems II since SG (Firestore region) is not on EU adequacy list. | 0 (DIY) | EU national DPAs | [EDPB TIA Recommendation](https://edpb.europa.eu/our-work-tools/our-documents/recommendations/recommendations-012020-measures-supplement-transfer_en), [CNIL Templates](https://www.cnil.fr/) | ☐ |
| 53 | WCAG 2.1 AA accessibility audit | EAA effective **28 June 2025** — already in force for EU consumer digital services. Free axe DevTools + Lighthouse for first pass; ~RM 5k for one-time external audit. | 0–5,000 | EU national accessibility bodies + ADA Title III (US) | [W3C WAI](https://www.w3.org/WAI/), [European Accessibility Act](https://commission.europa.eu/european-accessibility-act_en) | ☐ |
| 54 | EU cookie consent banner (web admin) | ePrivacy-compliant banner with reject-all default as easy as accept-all. DIY home-grown is fine for indie scale. | 0 (DIY) | EU national DPAs (ePrivacy) | [ePrivacy Directive 2002/58/EC](https://eur-lex.europa.eu/eli/dir/2002/58/oj), [ICO Cookie Guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/) | ☐ |
| 55 | Subprocessor list page | Public list of all third parties handling user data + breach SLAs. Linked from privacy policy. Notify users of material changes. | 0 (DIY) | All PDPA + GDPR | [GDPR Art. 28](https://gdpr.eu/article-28/) | ☐ |

---

## Watch list (post-launch growth triggers)

| Trigger | Action | Regulator | Source |
|---|---|---|---|
| Annual revenue approaching RM 500,000 | Register for SST (8% digital service tax) | Royal Malaysian Customs (Kastam) | [SST Portal](https://mysst.customs.gov.my/) |
| Approaching RM 100k+/month revenue, foreign-investor pitch, or liability-shielding need | Convert sole prop → Sdn Bhd. Cost: ~RM 1,500 incorporation + ~RM 1,000/yr compliance | SSM | [SSM Sdn Bhd guide](https://www.ssm.com.my/Pages/Services/Other-Services/Conversion-of-business-name.aspx) |
| US-storefront sales reach ~USD 5–10k/month | Consider Singapore Pte Ltd subsidiary (0% US-SG treaty rate) to reclaim 30% US withholding via Apple/Google annual W-8 refresh. ~SGD 3k/yr maintenance pays back at this revenue | IRAS Singapore + IRS US | [SG-US Tax Treaty (none for indie devs — SG levies under separate model)](https://www.iras.gov.sg/) |
| App reaching 1,000 ID users / 1% ID traffic | File Indonesia PSE registration (item #18 above) | Komdigi | [Permendag 31/2023](https://peraturan.bpk.go.id/Details/254680/permendag-no-31-tahun-2023) |
| Adding ads or analytics SDKs | Re-do Apple Privacy Nutrition Labels + Google Data Safety. Add ATT prompt analysis. Revise GDPR lawful-basis framing | Apple, Google, EU DPAs | [Apple ATT](https://developer.apple.com/documentation/apptrackingtransparency) |
| Adding camera flow that extracts biometrics (face/fingerprint features) | **Triggers PDPA "sensitive personal data" rules** (added 2024 amendment). Explicit consent + DPIA mandatory | JPDP MY | [PDPA 2024 Amendment](https://www.jpdp.gov.my/) |
| Adding marketing email/SMS to MY users | DNC compliance under Communications and Multimedia Act 1998 + Section 233 spam rules | MCMC | [CMA 1998](https://www.mcmc.gov.my/) |
| App approaching 8M+ MY users | MCMC ASP(C) class licence assessment (only at this scale, per 2025 changes) | MCMC | [MCMC Licensing](https://www.mcmc.gov.my/) |
| **By 31 August 2026** | Google Play target API 36 (Android 16) deadline for new apps and all updates. Need RN 0.78+ or Expo SDK 54+ | Google | [Target API requirement](https://developer.android.com/google/play/requirements/target-sdk) |
| **By September 2026** | Google Play developer-identity verification cutover for ID/SG/TH/Brazil storefronts | Google | [Developer identity verification](https://support.google.com/googleplay/android-developer/answer/14171095) |

---

## Always-stale items (re-verify even before 90-day cadence)

These change frequently enough that the 90-day refresh isn't tight enough. Re-check live sources before relying on them in any artifact:

- **Apple App Store Review Guidelines** — quarterly revisions
- **Google Play Policy** — quarterly revisions
- **Indonesia PDP Authority (Lembaga PDP) establishment status** — pending presidential signature on implementing Government Regulation as of May 2026
- **EU subscription rules per-country** — Germany BGH cancel-button rulings keep extending; Italy/France similar
- **US-MY tax treaty status** — any treaty negotiation news materially changes the 30% withholding picture; a treaty would be the single largest cost reduction available

---

## Key regulator contacts

| Authority | Jurisdiction | Website | Topic |
|---|---|---|---|
| Personal Data Protection Department (JPDP) | Malaysia | https://www.jpdp.gov.my/ | PDPA registration, breach notification |
| Suruhanjaya Syarikat Malaysia (SSM) | Malaysia | https://www.ssm.com.my/ | Business registration, Sdn Bhd conversion |
| Royal Malaysian Customs Department (Kastam) | Malaysia | https://mysst.customs.gov.my/ | SST registration |
| Ministry of Domestic Trade and Cost of Living (KPDN) | Malaysia | https://www.kpdn.gov.my/ | Consumer Protection Act enforcement |
| Malaysian Communications and Multimedia Commission (MCMC) | Malaysia | https://www.mcmc.gov.my/ | CMA 1998, ASP class licensing |
| Personal Data Protection Commission (PDPC) | Singapore | https://www.pdpc.gov.sg/ | SG PDPA, DPO listing |
| Komdigi (Kementerian Komunikasi dan Digital) | Indonesia | https://komdigi.go.id/ | UU PDP enforcement (interim until Lembaga PDP), PSE registration |
| Office of the Personal Data Protection Committee (OPDC) | Thailand | https://pdpc.or.th/ | TH PDPA, breach notification |
| European Data Protection Board (EDPB) | EU | https://edpb.europa.eu/ | GDPR coordination |
| California Attorney General | US (California) | https://oag.ca.gov/privacy/ccpa | CCPA/CPRA |
| Apple Developer | Worldwide | https://developer.apple.com/ | App Store Review Guidelines |
| Google Play | Worldwide | https://support.google.com/googleplay/android-developer | Play Policy, Data Safety |

---

## Provenance

This checklist is derived from a 3-agent live-web research pass on 2026-05-03 covering Malaysia primary law, global app stores + EU/US, and ASEAN PDPA equivalents. See [`.claude/docs/legal_launch_research.md`](../.claude/docs/legal_launch_research.md) for the full critical path and decision matrices, with three deep-dive files for citations.

When an item changes (new amendment, new regulator guidance, vendor cost change), update this file's row inline AND increment `next_review_due` in the frontmatter.
