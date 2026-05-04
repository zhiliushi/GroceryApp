---
title: Operational Risk + EU + MY Sectoral Compliance Deep-Dive
project: GroceryApp
audience: Solo founder (sole proprietor, Malaysia) launching freemium grocery/pantry tracker
stack: FastAPI + React Native + Firestore (asia-southeast1)
companion_to: F:\ClaudeProjects\GroceryApp\.claude\docs\legal_launch_research.md
compiled: 2026-05-03
next_review_due: 2026-08-01
freshness_cadence: 90 days
always_stale_items:
  - Apple App Store Review Guidelines
  - Google Play policy
  - Indonesia PDP Authority establishment status
  - EU subscription rules per-country
  - US-MY tax treaty status
  - FTC Click-to-Cancel revival status (ANPRM submitted Jan 2026 — track Federal Register)
  - EU AI Act high-risk obligations (live 2 Aug 2026)
---

# Operational Risk + EU + MY Sectoral Compliance Deep-Dive

This document covers the operational, insurance, accessibility, sectoral-MY, and contract-drafting gaps NOT covered in `legal_launch_research.md` (which handles privacy/PDPA, app-store basics, payments, entity selection). Read both before launch.

Hard ground rules:
- All facts have an inline citation. Where a claim is judgement, it is labeled "(judgement)" or "(inferring)".
- "Indie" below = solo founder, sole proprietor, < RM 500k revenue, no employees, no office. Recommendations scale up if any of these change.
- 1 USD ≈ 4.7 MYR (May 2026 rough conversion for budget reasoning, not authoritative).

---

## 1. Insurance for indie tech businesses in Malaysia

### 1.1 Cyber liability insurance

**What it covers** (typical Malaysian SME policy):
- Data breach response: forensics, notification costs, credit monitoring for affected users
- Regulatory fines and defence costs (where insurable — note: not all jurisdictions allow fines to be insured)
- Ransomware: ransom payment (capped, often RM 1M–3M sublimit), recovery costs
- Business interruption from cyber event (partial — limited window)
- Third-party liability (lawsuits from affected users)
- Cyber extortion, social engineering fraud, network security liability

Source: <https://www.contingent.com.my/blog/cyber-security-insurance-business-malaysia>, <https://www.howdengroup.com/my-en/cover/cyber>

**Important exclusion**: incidents arising from "non-compliance or negligence" — i.e., if you ignored MFA, didn't patch, or skipped basic hygiene, you are NOT covered. (<https://www.contingent.com.my/blog/cyber-security-insurance-business-malaysia>) For an indie running Firestore on default-secure config with proper rules, this is generally fine, but document your security posture so an underwriter and a future claim assessor can verify.

**MY-licensed insurers offering cyber (confirmed active 2026)**:
- **AIG Malaysia — CyberEdge** — modular SME-to-multinational product. (<https://www.aig.my/home/solutions/business/financial-lines/cyber-insurance>)
- **Chubb Malaysia** — operates and licensed under Bank Negara Malaysia. (<https://www.chubb.com/my-en/business/professional-indemnity-insurance.html>)
- **Allianz, AXA, MSIG** — all licensed in MY but the search did not surface specific 2026 product pages. Confirm directly with broker. The BNM approved-insurer list is the authoritative source: <https://www.bnm.gov.my/-/approved-insurance-and-takaful-brokers>.
- **Howden Malaysia** — broker, places cyber across multiple carriers. (<https://www.howdengroup.com/my-en/cover/cyber>)
- **Sime Darby Lockton** — broker with risk-management practice. (<https://global.lockton.com/apac/en/malaysia>)

**Typical pricing (MY SME, 2026)**:
- "SME cyber policies start from just a few thousand RM/year" with customised plans available. (<https://www.contingent.com.my/blog/cyber-security-insurance-business-malaysia>)
- Realistic indie band: **RM 2,500 – RM 5,000/yr** for RM 500k–1M coverage limit (judgement, anchored to the "few thousand RM/year" line above and Malaysian SME cyber-insurance market summaries). For an indie pre-revenue with low user count and Firebase-only stack, the lower end of that band is realistic; insurers underwrite primarily on revenue and sensitive-data volume, not headcount.
- A common starting limit for Malaysian tech SMEs is RM 500,000 – RM 1,000,000; firms serving GLCs/banks start at RM 2M–5M. (<https://www.contingent.com.my/blog/cyber-security-insurance-business-malaysia>)

**Underwriter requirements (2026)** — be ready to attest:
- MFA on all admin accounts
- Regular VAPT (vulnerability assessment / penetration testing) — annual is the floor
- Documented incident response plan
- SOC monitoring or equivalent (for an indie, this can be a documented cloud-native alerting setup with Firebase + GCP audit logs)

Source: <https://www.contingent.com.my/blog/cyber-security-insurance-business-malaysia>

### 1.2 Professional indemnity (PI) — a.k.a. "tech E&O"

**What it covers**: errors / omissions / negligent acts in the provision of technology services, including software defects, system failures, data loss, and IP infringement claims. (<https://www.contingent.com.my/blog/technology-professional-indemnity-insurance-for-malaysia-and-singapore>)

**MY-licensed PI insurers (confirmed 2026)**:
- AIG Malaysia (<https://www.aig.my/home/solutions/business/financial-lines/professional-indemnity-insurance>)
- Chubb (<https://www.chubb.com/my-en/business/professional-indemnity-insurance.html>)
- Howden (broker) (<https://www.howdengroup.com/my-en/cover/professional-indemnity>)
- Kurnia (<https://www.kurnia.com/products-and-services/business-insurance/professional-indemnity-insurance>)
- QBE Malaysia (<https://www.qbe.com/my/business-insurance/professional-indemnity>)
- Liberty Specialty Markets MY (<https://www.libertyspecialtymarkets.com.my/product/professional-indemnity>)
- Zurich Malaysia (<https://www.zurich.com.my/insurance-products/business/for-my-profit/financial-lines/professional-indemnity-insurance>)
- Berjaya Sompo (<https://www.berjayasompo.com.my/product/professional-indemnity-insurance>)

**Typical pricing for MY sole prop, software**: published 2026 search did not return firm numbers. The estimate of **RM 1,500 – RM 3,500/yr** for a sole-prop software business with RM 1M coverage is in line with neighbouring-market (SG) tech-PI bands and reflects typical indie underwriting practice (judgement — MY market reference: <https://www.nvs.com.my/updated-insights-on-public-and-professional-indemnity-insurance-in-malaysia-2026/>). Get firm quotes from at least two brokers before committing.

### 1.3 General liability (CGL) — public liability + product liability

For a digital-only indie with no physical office or premises open to the public, CGL is **low priority**. Bundle it later if you ever:
- Open a co-working seat that takes client visits
- Ship physical merchandise or hardware
- Run in-person events

Often rolled into a packaged "office package" with PI; standalone is rare. (Inferring from market practice — no MY-specific source.)

### 1.4 Directors & Officers (D&O)

**Only relevant after Sdn Bhd conversion.** Sole prop has no separate "directors" to sue. Capture this as a watch-list item triggered by entity change.

### 1.5 What to ask a broker (checklist)

1. **Coverage limit** — RM 500k? 1M? 2M? Match to realistic worst-case (size of largest user-data lawsuit you can imagine).
2. **Per-claim deductible / excess** — RM 5k–25k typical. Lower deductible = higher premium.
3. **Aggregate annual limit** vs **per-claim limit** — are they the same?
4. **War / cyber-war exclusion** — post-2022 a common addition; ask exactly which nation-state attribution triggers exclusion.
5. **Retroactive date** — does the policy cover incidents that occurred before policy inception but were discovered after?
6. **Jurisdiction of cover** — MY? ASEAN? Worldwide? Specifically: **does it cover EU-resident user claims under GDPR?** This matters once you have any EU users.
7. **Defence costs inside or outside the limit** — "inside" means defence eats your coverage; "outside" is better but more expensive.
8. **Notification period** — 30 / 60 / 90 days to notify after discovering an incident.
9. **Breach response panel** — who do they assign for forensics / PR / legal? Pre-vetted panels are faster in incident.
10. **Premium-payment cadence** — annual lump vs monthly.

### 1.6 Recommended brokers (MY tech-focused)

- **Howden Malaysia** — explicit cyber and tech-PI practice; SME-friendly. (<https://www.howdengroup.com/my-en>) Howden has been actively expanding in MY with broker acquisitions. (<https://www.howdengroupholdings.com/howden-increases-its-investment-malaysia>)
- **Sime Darby Lockton Malaysia** — broker with risk-management depth. (<https://global.lockton.com/apac/en/malaysia>)
- **Contingent (MY)** — boutique with tech-PI and cyber content marketing; aimed at SMEs. (<https://www.contingent.com.my/>)

Use the BNM approved-broker list as the authoritative filter: <https://www.bnm.gov.my/-/approved-insurance-and-takaful-brokers>.

PIBM (Persatuan Insurans Brokers Malaysia / Insurance Brokers Association of Malaysia) — the search did not surface a tech-focused practice from PIBM directly; it is the industry association, not a broker. Reach out via member list if needed.

---

## 2. WCAG 2.1 AA accessibility compliance

### 2.1 Why it matters (legal exposure ranking)

1. **EU European Accessibility Act (EAA) — IN FORCE 28 June 2025.** Enforcement officially began 28 June 2025. (<https://www.adatitleiii.com/2025/08/european-accessibility-act-poses-new-challenges-for-us-companies-with-customers-in-the-eu/>) The EAA covers "websites, apps, and digital kiosks operating in the EU for travel, banking, and e-commerce" with a recommendation of WCAG 2.2 Level AA. (<https://www.deptagency.com/insight/2025-is-the-deadline-for-digital-accessibility/>) E-commerce is the relevant scope for a freemium grocery app sold to EU consumers. (<https://www.twobirds.com/en/insights/2025/a-guide-to-navigating-the-european-accessibility-act-for-online-retailers-service-providers-and-plat>)
   - **Scope question for a grocery tracker**: a pantry-tracker app is not "e-commerce" in the traditional sense (no in-app retail). However, a freemium subscription transaction concluded with EU consumers IS an e-commerce service. The conservative read is that **once paid plans are sold to any EU resident, EAA applies**. (Judgement; confirm with EU counsel before EU launch.) See companion `legal_launch_research.md` for EU launch sequencing.
2. **US ADA Title III** — US federal law; consumer apps have been sued for inaccessibility (Robles v Domino's, 2019, established that ADA applies to digital). WCAG 2.1 AA is the de-facto standard required to defend an ADA Title III lawsuit. (<https://accessible.org/wcag/>)
3. **MY Persons with Disabilities Act 2008** — encourages digital accessibility but **enforcement is weak**; "no strict regulation requiring digital accessibility compliance" for private-sector consumer apps as of 2026. (<https://www.skynettechnologies.com/blog/digital-accessibility-in-malaysia>) Treat as best-practice / future-risk, not gating.

### 2.2 WCAG 2.1 Level AA practical checklist

WCAG 2.1 has 50 success criteria at A + AA, organised by POUR (Perceivable, Operable, Understandable, Robust). (<https://web-accessibility-checker.com/en/blog/wcag-21-aa-checklist-developer-guide>) The high-impact ones for a grocery app:

**Perceivable**
- 1.1.1 Non-text content has text alternative (alt text on icons, product images)
- 1.3.1 Info and relationships are programmatically determinable (semantic structure)
- 1.4.3 Color contrast ≥ 4.5:1 for normal text, 3:1 for large text
- 1.4.4 Text can be resized to 200% without loss of content
- 1.4.10 Reflow — content reflows at 320 CSS px without horizontal scroll
- 1.4.11 Non-text contrast ≥ 3:1 for UI components and graphical objects

**Operable**
- 2.1.1 All functionality keyboard-accessible (web admin)
- 2.1.2 No keyboard traps
- 2.4.7 Focus indicator visible
- 2.5.5 Touch target size ≥ 44×44 CSS px (mobile) — WCAG 2.1 AAA but de-facto 2.2 AA minimum

**Understandable**
- 3.1.1 Page language declared
- 3.3.1 Errors identified in text (not just colour)
- 3.3.3 Error suggestions provided where possible

**Robust**
- 4.1.2 Name, role, value programmatically determinable
- 4.1.3 Status messages (via ARIA live regions on web)

Source: <https://accessible.org/wcag/>, <https://web-accessibility-checker.com/en/blog/wcag-21-aa-checklist-developer-guide>

WCAG 2.1 AA also added new criteria for mobile: orientation-flexible (no portrait-only unless essential), pointer cancellation (use up-event, not down-event, for completion), and motion-actuation alternatives. (<https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Mobile_accessibility_checklist>)

**Note**: EAA's recommendation is **WCAG 2.2 AA** (one notch above 2.1 AA). 2.2 adds 6 new criteria including 2.4.11 Focus Not Obscured, 2.5.7 Dragging Movements, 2.5.8 Target Size (Minimum) — important for mobile. (<https://www.levelaccess.com/blog/wcag-2-2-aa-summary-and-checklist-for-website-owners/>) Recommendation: target 2.2 AA from the start; the delta is small.

### 2.3 React Native accessibility specifics

- Use `accessible={true}` on tappable wrappers
- `accessibilityLabel` on every interactive element (button, image-as-button)
- `accessibilityRole` ("button", "header", "link", "image", "none") to give VoiceOver / TalkBack the right semantic
- `accessibilityHint` for non-obvious actions
- `accessibilityState` for toggles, checked states, disabled
- Test under VoiceOver (iOS) AND TalkBack (Android) — they behave differently
- Test with system Dynamic Type / large fonts (3× scaling) — your layout must reflow
- Test in dark mode + high-contrast mode

Reference: React/RN accessibility docs at <https://legacy.reactjs.org/docs/accessibility.html>.

### 2.4 Web admin accessibility (if you have one)

- Semantic HTML first (`<button>`, `<nav>`, `<main>`, `<h1>` hierarchy) — avoid `<div onClick>`
- ARIA only where semantic HTML insufficient
- Avoid keyboard traps in modals (cycle focus inside modal, ESC closes)
- Skip-link to main content
- Focus-visible styles (don't rely on `:hover`)

### 2.5 Audit tooling

| Tool | Type | Cost | Strength | Source |
|------|------|------|----------|--------|
| **axe DevTools (browser ext)** | Manual / dev | Free; Pro $40+/mo | Full axe-core ruleset (~96 rules), best signal-to-noise | <https://www.deque.com/axe/devtools/> |
| **Pa11y** | CLI / CI | Free | Open source; integrates into CI/CD | <https://www.ramotion.com/blog/practical-accessibility-testing-with-pa11y-and-axe-core/> |
| **Lighthouse** | Browser / CI | Free | 57 a11y audits + performance/SEO; broader but shallower | <https://inclly.com/resources/axe-vs-lighthouse> |
| **WAVE** | Browser ext | Free | Visual overlays, easy for non-devs | <https://inclly.com/resources/accessibility-testing-tools-comparison> |
| **Stark** (Figma plugin) | Design-time | Free + Pro | Catch contrast/colour issues in design before code | (general knowledge) |

**Recommended indie stack**: axe DevTools (browser, free) + Pa11y (CI, free) + manual VoiceOver/TalkBack testing on real devices. Total cost: **RM 0** for tooling. (<https://inclly.com/resources/accessibility-testing-tools-comparison>)

For a one-time pre-launch audit by a third party (recommended for EU users), expect **RM 5,000 – RM 15,000** for a small-scope app + admin (judgement; MY freelance accessibility consultant rates).

### 2.6 VPAT (Voluntary Product Accessibility Template)

Standard form documenting accessibility conformance. **Relevant for B2B / government procurement, not consumer-facing apps.** (Inferring from typical use case.) Skip for a freemium B2C grocery app unless you later sell to enterprises or governments.

### 2.7 MY accessibility law (verdict)

PWD Act 2008 covers ICT and digital but **enforcement is weak for private consumer apps** as of 2026. (<https://www.skynettechnologies.com/blog/digital-accessibility-in-malaysia>) The National Council for Persons with Disabilities (NCBM) is lobbying for mandatory rules; not yet law. Treat as best-practice and reputational risk; do not let MY law alone drive your accessibility budget — let EAA + ADA drive it.

---

## 3. ePrivacy Directive / cookie consent (EU)

### 3.1 Current state of law

- **ePrivacy Directive (2002/58/EC, amended 2009)** is still in force in 2026.
- The **ePrivacy Regulation** (intended successor) has been delayed for years and remains not adopted as of 2026. Plan against the Directive.
- **Article 5(3) of the ePrivacy Directive** requires prior consent for storage or access on terminal equipment. The EDPB confirmed in Guidelines 2/2023 (final October 2024) that Art. 5(3) applies beyond cookies — to pixels, URL tracking, IP-only tracking, and fingerprinting. (<https://www.hunton.com/privacy-and-information-security-law/edpb-publishes-guidelines-to-clarify-scope-of-eu-cookie-notice-and-consent-requirements>, <https://eutechreg.com/p/consent-for-everything-edpb-guidelines>)
- GDPR Article 6 legitimate interest **does not substitute** ePrivacy consent. (<https://www.consenteo.com/knowledge-hub/GDPR/gdpr_cookie_consent_2026>)

### 3.2 Practical cookie consent rules

- **Prior opt-in** for non-essential cookies / SDKs (analytics, marketing, A/B-testing)
- **Reject-all as easy as Accept-all** — symmetrical UX is now mandatory in most EU member states (per CNIL France, ICO UK)
- **Granular consent** by category (analytics vs marketing vs functional)
- **Pre-ticked boxes invalid**

Source: <https://www.cookieyes.com/blog/eu-cookie-compliance/>

### 3.3 Mobile app implications (CRITICAL for this stack)

EDPB guidance treats mobile-app SDKs the same as cookies. **Firebase Analytics + Crashlytics need user consent in the EU** before they can initialize.

The technical requirement: **asynchronous initialization** — your app code must wait for an explicit positive consent signal before allowing tracking SDKs to fire. Firebase has APIs for this (`setAnalyticsCollectionEnabled(false)` until consent given). (<https://secureprivacy.ai/blog/gdpr-compliance-mobile-apps>)

In 2026, regulators verify this with network monitoring, SDK decompilation, and controlled testing — not just UI inspection. (<https://secureprivacy.ai/blog/gdpr-compliance-mobile-apps>) "We have a banner" is not compliance; the SDK must actually NOT phone home before consent.

**Implementation pattern for Firebase**:
1. On first launch (EU IP detected OR always-show-for-safety), show a consent screen.
2. Default: analytics OFF, crashlytics OFF.
3. Only after explicit "Accept" do you call `setAnalyticsCollectionEnabled(true)` etc.
4. Provide an in-app settings screen to revoke consent. Revocation must be as easy as granting.
5. Persist the consent choice; do not re-prompt every launch.

(Inferring concrete implementation pattern from the EDPB / Firebase consent-mode documentation.)

### 3.4 Cookie banner vendors / DIY recommendation for indie

| Option | Cost (2026) | Verdict for indie |
|--------|-------------|-------------------|
| **OneTrust** | $10,000+/yr | Overkill; price floor raised early 2026 |
| **Cookiebot** | Free up to 50 subpages; $13–55+/mo for larger | Doubled prices Aug 2025; still viable for small web admin |
| **CookieYes** | Mid-market; flexible | Decent middle option |
| **Enzuzo** | Free for one domain, basic banner + privacy generator | Recommended free option |
| **DIY** | RM 0 | Best for indie if you have one web admin and one mobile app |

Source: <https://www.enzuzo.com/blog/onetrust-vs-cookiebot>, <https://www.cookieyes.com/blog/eu-cookie-compliance/>

**Recommended indie path**:
- **Web admin**: home-grown banner with deny-all default. ~50 LoC. Persists choice in localStorage. Or use Enzuzo free tier.
- **Mobile**: Firebase consent-mode toggle in onboarding + an in-app "Privacy" settings screen. No third-party CMP needed.

Total cost: **RM 0** if DIY; up to **RM 2,000/yr** if Cookiebot for a larger web property.

---

## 4. Malaysia Cybersecurity Act 2024

### 4.1 Effective date and status

- Royal assent + gazetted as **Act 854**.
- **Came into operation 26 August 2024**, together with four subsidiary regulations. (<https://www.globalcompliancenews.com/2024/09/03/malaysia-cyber-security-act-2024-and-subsidiary-regulations-in-force-on-26-august-2024/>, <https://www.nacsa.gov.my/act854.php>)
- Administered by **NACSA** (National Cyber Security Agency) under the Prime Minister's Department.

### 4.2 NCII (National Critical Information Infrastructure) sectors

The Act regulates NCII sectors only — not all businesses. NCII sectors per the Act / subsidiary regulations: government, banking & finance, transportation, defence & national security, information & communications, energy, water/sewerage/waste, healthcare, agriculture & plantation, trade/industry/economy, science/technology/innovation. (<https://www.mayerbrown.com/en/insights/publications/2024/12/malaysias-new-cyber-security-act-2024-a-summary-and-brief-comparative-analysis>)

**Does a grocery / pantry tracker trigger NCII?** **No, almost certainly not** — a freemium consumer app for personal pantry management does not fall in any NCII sector. It is not a payment-system processor, not healthcare, not energy. The Minister has the power to designate additional NCII entities by order, but a consumer app is not a candidate at indie scale. (Judgement based on the statutory list.)

### 4.3 NCII obligations (only if triggered later by scale or pivot)

If designated, an NCII entity must:
- Provide information when requested by the Chief Executive of NACSA
- Comply with relevant codes of practice
- Conduct cybersecurity risk assessments and audits
- **Notify sector lead and Chief Executive on awareness of a cybersecurity incident**

Source: <https://securiti.ai/overview-of-malaysia-cyber-securitiy-act-2024/>, <https://www.pwc.com/my/en/assets/publications/2024/pwc-my-cyber-security-act-2024-new-era-for-cybersecurity-in-malaysia.pdf>

### 4.4 Penalties (if and when in scope)

Failure to comply triggers fines up to **RM 500,000** and imprisonment up to **10 years** for certain offences (notification failures, false statements). (<https://www.simplydata.com.my/cyber-security-act-2024-malaysia/>) Criminal liability for NCII directors is on the table.

### 4.5 What changes if/when the threshold is hit

If the grocery app ever becomes large enough to be designated (extremely unlikely without sector change), a non-trivial compliance program is required. Re-evaluate at:
- 1M+ MAU
- Cross-platform pivot into health / finance / regulated data
- Acquisition by an NCII operator

**Watch-list item, not launch-blocking.**

---

## 5. Anti-spam laws (only if/when marketing email or SMS)

At launch, with no marketing email program, this section is informational. Defer the work but not the awareness.

### 5.1 Malaysia — Section 233A CMA + UCEM rules

- **Communications and Multimedia (Amendment) Act 2025** introduced new **Section 233A** prohibiting unsolicited commercial electronic messages (UCEM) without valid consent. (<https://conventuslaw.com/report/malaysia-overview-on-the-communications-and-multimedia-amendment-act-2025/>, <https://www.lowpartners.com/legal-update-proposed-regulation-of-unsolicited-commercial-electronic-messages-ucem/>)
- **Effective 11 February 2025.** (<https://conventuslaw.com/report/malaysia-overview-on-the-communications-and-multimedia-amendment-act-2025/>)
- Covers WhatsApp, Telegram, email, SMS, social media. (<https://insightplus.bakermckenzie.com/bm/data-technology/malaysia-proposed-new-regulatory-framework-against-unsolicited-commercial-electronic-messages>)
- Bans address-harvesting software and scraping tools.
- Consent-first approach — closer to GDPR / CASL than to CAN-SPAM.

**MCMC** is the regulator. Implementation framework still being consulted on as of 2025; expect tightening through 2026. (<https://www.rahmatlim.com/publication/articles/31104/mcmc-seeks-feedback-on-proposed-regulatory-framework-for-unsolicited-commercial-electronic-messages>)

**Practical takeaway for MY-resident sender**: get explicit opt-in before sending any commercial message. Track consent timestamp + source.

### 5.2 USA — CAN-SPAM (if any US recipients)

- Commercial-only law; transactional messages exempt. (<https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business>)
- "From" / "To" / Reply-To accurate; physical postal address mandatory in body.
- Subject line not deceptive.
- Clear opt-out; honour within **10 business days**.
- Opt-out mechanism functional for **at least 30 days** after send.
- Penalties up to ~$50k per email (current rules).
- **2026 enforcement reality**: brand is liable even if a partner sent the bad email — "plausible deniability" is not a defence. (<https://www.unsubcentral.com/can-spam-compliance/>)

### 5.3 Canada — CASL (if any Canadian recipients)

- **Express OR implied** consent required before commercial electronic message (CEM). (<https://crtc.gc.ca/eng/com500/guide.htm>)
- Express consent does not expire (until withdrawn).
- Implied consent timer: **2 years** from last business transaction; **6 months** from inquiry. (<https://smartsmssolutions.com/resources/blog/ca/canada-anti-spam-legislation-casl>)
- Penalties up to **CAD $10M** per violation (corporations), $1M (individuals); directors/officers personally liable. (<https://smartsmssolutions.com/resources/blog/ca/canada-anti-spam-legislation-casl>)
- Stricter than CAN-SPAM. If any Canadian users in your audience, default to CASL standards globally — they cover everyone.

### 5.4 EU — GDPR + ePrivacy for email

- Article 6 GDPR + ePrivacy Art. 13 require **explicit opt-in** for marketing email.
- Pre-checked boxes invalid (Planet49 ECJ ruling).
- "Soft opt-in" allowed for similar products to existing customers, with opt-out at every send.
- "Unsubscribe" link mandatory in every commercial message.

(Consolidated from <https://www.consenteo.com/knowledge-hub/GDPR/gdpr_cookie_consent_2026> and general GDPR knowledge — no single-link source.)

### 5.5 Recommended ESP for indie + MY context

| Provider | Free tier | Paid entry | Best for | Source |
|----------|-----------|-----------|----------|--------|
| **Resend** | 3,000/mo free | $20/mo for 50k | Indie default; modern API; React Email | <https://www.buildmvpfast.com/api-costs/email> |
| **Postmark** | 100/mo trial | $15/mo for 10k | When deliverability is mission-critical (transactional) | <https://postmarkapp.com/compare/resend-alternative> |
| **Amazon SES** | $0.10 per 1k | Cheapest at scale (>200k/mo) | Skip until you have ops headcount | <https://blog.vibecoder.me/email-service-pricing-resend-sendgrid-postmark> |
| **ConvertKit / Mailchimp** | Limited | $15+/mo | Audience newsletter (creator) | (general knowledge) |

**Recommendation for indie at launch**: **Resend** for transactional (signup, password reset, receipts). Defer marketing-email program until product-market fit. Resend at 3k/mo free covers a launch-stage user base with headroom.

### 5.6 Practical: defer, but record

At launch, no marketing emails → all of the above is documented for the future. Build the user-account schema now to track:
- `consent_email_marketing` boolean
- `consent_email_marketing_at` timestamp
- `consent_email_marketing_source` (signup form, in-app prompt, etc.)
- `consent_email_marketing_revoked_at` timestamp

You will not need the data on day one but you cannot retroactively prove consent if you don't capture it.

---

## 6. FTC Click-to-Cancel rule status (2026)

### 6.1 Current status — VACATED

- FTC's "Click-to-Cancel" rule (Negative Option Rule amendments) was finalized 14 October 2024.
- **Vacated 8 July 2025 by the US Court of Appeals for the Eighth Circuit** for procedural error: FTC failed to conduct a preliminary regulatory analysis of costs/benefits when the rule's economic impact exceeded the $100M threshold. (<https://www.sidley.com/en/insights/newsupdates/2025/07/us-ftc-click-to-cancel-rule-struck-down>, <https://www.beneschlaw.com/insight/eighth-circuit-cancels-ftcs-click-to-cancel-rule/>)
- **Not stayed — fully vacated**.

### 6.2 What's happening now (2026)

- **30 January 2026**: FTC submitted a draft Advanced Notice of Proposed Rulemaking (ANPRM) to OIRA / OMB for a renewed negative-option rule. Both Commissioners voted to advance. (<https://www.crowell.com/en/insights/client-alerts/clicking-all-the-right-boxes-ftc-moves-to-revive-click-to-cancel-rule-following-eighth-circuit-vacatur>)
- Petition from Consumer Federation of America + American Economic Liberties Project to reopen rulemaking — published in Federal Register. (<https://www.kelleydrye.com/viewpoints/blogs/ad-law-access/ftc-quietly-reopens-click-to-cancel-rulemaking-in-response-to-petition>)
- **Realistic 2026–2027 timeline**: ANPRM → public comment → notice of proposed rulemaking → final rule → effective date. **Earliest practical effective date: late 2027.**

### 6.3 What it would require (when revived)

Cancel as easy as sign-up. Specifically:
- One-click cancel where sign-up was one-click
- No "retention specialist" call required if sign-up was online
- Clear consent for auto-renewal
- Notice before renewal
- Annual reminder for long-running subscriptions

(Synthesised from prior rule text — re-verify when new version published.)

### 6.4 What this means for the grocery app

- **App Store / Play Store flows** are already one-click cancel — covered.
- **Web / Stripe direct subscription** flows need to match. If Stripe Checkout + Customer Portal is used, Stripe Customer Portal already provides one-click cancel — likely sufficient.
- **State laws are the live risk now**: California, New York, Vermont have negative-option laws on the books. Apply Click-to-Cancel logic by default to avoid having to retrofit. (<https://www.wilmerhale.com/en/insights/client-alerts/20250801-eighth-circuit-vacates-the-ftcs-click-to-cancel-rule-but-federal-and-state-regulators-likely-to-remain-active>)
- **Germany BGB §312k Cancel Button** (covered in companion `legal_launch_research.md`) still applies for German users.

**Verdict**: build cancel-as-easy-as-signup from day one. Cheap to do; expensive to retrofit.

---

## 7. Children's design code + COPPA detail

### 7.1 UK ICO Age-Appropriate Design Code (Children's Code)

- World's first statutory code for children's data, ICO 2021. (<https://www.lexology.com/library/detail.aspx?g=91a279ed-8082-4564-8309-cac2b151faaa>)
- 16 standards including data minimisation, default high-privacy settings, transparency, no nudge techniques to lower privacy.
- Applies to UK-based services AND any service "likely to be accessed by children" — even general-audience services may need to consider it.

### 7.2 Practical guidance for a "general audience, not for under-13" app

- Add explicit "**not for users under 13**" wording in:
  - Privacy policy
  - Terms of service
  - App store description
- Block under-13 in your sign-up flow (age gate or self-declared age field with rejection).
- If you do not market to or design features for children, and you have a published statement excluding under-13s, you significantly reduce your exposure under both COPPA and ICO Code.

### 7.3 California AADC (CAADCA)

- California Age-Appropriate Design Code Act passed Sept 2022.
- **Partially blocked by court 2023** (NetChoice v Bonta — preliminary injunction on First Amendment grounds).
- Status uncertain in 2026; treat as not-currently-enforceable but watch.

### 7.4 US COPPA (under-13)

- Federal law: **verifiable parental consent (VPC)** required before collecting personal info from under-13s.
- No behavioural advertising for under-13s.
- **2025 amendments** finalized; **compliance deadline 22 April 2026** for the updated rule. (<https://securiti.ai/ftc-coppa-final-rule-amendments/>, <https://www.coblentzlaw.com/news/updates-to-childrens-privacy-federal-and-state-laws/>)
- New VPC methods include knowledge-based authentication, face-verification vs gov-ID, SMS-to-parent + ID confirmation. (<https://terms.law/FAQ/privacy-data/children-privacy-coppa-faq.html>)
- **If you exclude under-13 explicitly + reasonably believe users are 13+, COPPA does NOT apply** — but you must have a reasonable basis for that belief (age gate at minimum). (<https://iapp.org/news/a/reconciling-the-age-appropriate-design-code-with-coppa>)

### 7.5 MY children's data

- **PDPA does not have separate child-specific rules.** General consent rules apply.
- **Parental consent for under-18 is GOOD PRACTICE, not a strict legal requirement** in MY today.
- Watch list: PDPA 2024 amendments may add child-specific provisions; check at next 90-day refresh.

(Source: companion `legal_launch_research.md` — PDPA detail lives there.)

### 7.6 Recommended language for privacy policy

> "This service is intended for users aged 13 and older. We do not knowingly collect personal information from children under 13. If we become aware that a child under 13 has registered, we will delete that account and any associated data within 30 days. Parents who believe their child has provided personal information may contact us at [email]."

Plus an age gate at sign-up that blocks under-13 (don't just collect age — actively reject).

---

## 8. Transfer Impact Assessment (TIA) — Schrems II / GDPR

### 8.1 What TIA is

A documented assessment, required under post-Schrems II EDPB Recommendations 01/2020, of whether a data transfer to a "third country" (outside EEA) provides "essentially equivalent" protection to GDPR. (<https://www.kiteworks.com/gdpr-compliance/transfer-impact-assessment-schrems-ii/>)

### 8.2 When required for this stack

If Firestore is in **`asia-southeast1` (Singapore)** — which is the recommended low-latency region for SE Asia — and **any EU-resident user data** is stored there, a TIA is required. (<https://dapripro.com/international-data-transfers-after-schrems-ii-compliance-strategies/>)

Singapore's **PDPA 2012** is generally considered a "modern" privacy regime and an adequate-equivalence evaluation for non-government access is favourable, but Singapore is **not** on the EU's adequacy list. So you cannot rely on adequacy — you need SCCs + a TIA.

### 8.3 The six-step TIA per EDPB Recommendations 01/2020

1. **Know your transfers** — map flows: which EU users' personal data, to which Firestore region, accessed by which Google Cloud entity.
2. **Identify transfer tool** — SCCs (in your Google Cloud DPA), BCRs, derogations.
3. **Assess third-country law and practice** — does Singapore law impair the SCC effectiveness? Look at PDPA, Internal Security Act, government access regimes.
4. **Identify and adopt supplementary measures** — encryption-at-rest with customer-managed keys, pseudonymisation, contractual restrictions on disclosure to authorities.
5. **Procedural steps** — adopt the supplementary measures.
6. **Re-evaluate at intervals** — annually or on material change.

Source: <https://www.kiteworks.com/gdpr-compliance/transfer-impact-assessment-schrems-ii/>, <https://www.cnil.fr/en/transfer-impact-assessment-tia-cnil-publishes-final-version-its-guide>

### 8.4 SCCs vs TIA — they are different layers

- **SCCs** = the contractual layer. Already covered by the Google Cloud DPA you accept when signing up.
- **TIA** = the due-diligence layer. Your responsibility as the data exporter / controller.

Both are required. Having SCCs alone is insufficient post-Schrems II.

### 8.5 Templates and resources

- **CNIL TIA Guide** (final version, French regulator's free template): <https://www.cnil.fr/en/transfer-impact-assessment-tia-cnil-publishes-final-version-its-guide>
- **IAPP TIA templates** (members + some free): <https://iapp.org/resources/article/transfer-impact-assessment-templates>
- **PrivacyChecker template** (free): <https://privachecker.pro/blog/transfer-impact-assessment-template>

### 8.6 Cost / time

- DIY using CNIL template: 1–2 days of focused work for an indie, mostly research on Singapore law sections you cite.
- Outside counsel: **RM 2,000–5,000** for a sole-prop scope (judgement; ASEAN privacy counsel rates).
- Refresh annually; major refresh on Firestore region change or EU regulator action.

---

## 9. Subprocessor management

### 9.1 What it is

Public list of all third parties that handle user personal data on your behalf, with role + location + breach-notification SLAs, linked from your privacy policy. GDPR Article 28(2) requires controller approval of subprocessors. (<https://gdpr-info.eu/art-28-gdpr/>)

### 9.2 Article 28 obligations summary

- Subprocessor engagement requires **prior specific or general written authorisation** from the controller.
- Under general authorisation: processor must inform controller of intended changes and give chance to object. (<https://watchdogsecurity.io/gdpr/processor-safeguards-and-management>)
- Subprocessor must accept the **same data-protection obligations** as the original processor, in writing. (<https://www.enzuzo.com/blog/article-28-gdpr>)
- You (the controller) must inform data subjects which subprocessors are used — typically via privacy policy. (<https://complydog.com/blog/subprocessors>)

### 9.3 Practical: maintain a subprocessor list page

A simple `/subprocessors` page on your marketing site, linked from privacy policy, listing for each entry:

| Subprocessor | Service | Personal Data Processed | Location | DPA / SCCs link |
|--------------|---------|-------------------------|----------|-----------------|
| Google LLC (Firebase / GCP) | Auth, Firestore, Cloud Functions, Hosting | Account info, all app content | Singapore (asia-southeast1) | <https://cloud.google.com/terms/data-processing-addendum> |
| Apple Inc. | App Store delivery, App Store Connect | App-store identifiers | US | Apple Developer DPA |
| Google LLC (Play Console) | Play delivery | Play identifiers | US | Play DPA |
| Stripe (if used) | Payment processing | Email, last-4, billing country | US/IE | Stripe DPA |
| Resend (if used) | Transactional email | Email address, message content | US | Resend DPA |
| Sentry (if used) | Error tracking | IP, device info, stack traces | US | Sentry DPA |
| Crashlytics (Google) | Mobile crash reporting | Device identifiers, crash logs | US | (within Firebase DPA) |

Update on every vendor change. Material changes — new vendor in a new jurisdiction handling new data — trigger user notification (email + in-app).

### 9.4 Notification of changes

- **Material change** = new subprocessor handling new data category, OR change in jurisdiction.
- Notification mechanism: email to active users + privacy-policy version bump + in-app notice.
- Standard window: **30 days advance notice**, allowing user to object (in practice, "object" = stop using service).

(Practice norm; not strictly required by Article 28 but consistent with "fair" change-management.)

---

## 10. AI Act 2024 (EU) — when adding ML features

### 10.1 Phased timeline

| Date | What kicks in | Source |
|------|---------------|--------|
| **2 Feb 2025** | Prohibitions (unacceptable-risk practices) + AI literacy obligations | <https://artificialintelligenceact.eu/implementation-timeline/> |
| **2 Aug 2025** | GPAI (general-purpose AI model) rules | <https://www.dataguard.com/eu-ai-act/timeline> |
| **2 Aug 2026** | Most remaining provisions including transparency (Art. 50) and high-risk obligations (except Art. 6(1)) | <https://artificialintelligenceact.eu/implementation-timeline/> |
| **2 Aug 2027** | High-risk AI systems embedded in regulated products (extended transition) | <https://artificialintelligenceact.eu/implementation-timeline/> |

### 10.2 Risk categories

- **Unacceptable** (banned): social scoring, manipulative subliminal techniques, untargeted facial recognition scraping, etc.
- **High** (heavy obligations): biometric ID, education/employment decisions, critical infrastructure, law enforcement uses.
- **Limited** (transparency only): chatbots ("you are interacting with AI"), AI-generated content labelling (Art. 50).
- **Minimal** (no obligations).

Source: <https://www.legalnodes.com/article/eu-ai-act-2026-updates-compliance-requirements-and-business-risks>

### 10.3 Where a grocery app would land

- **Pantry recommendation engine / "you might want to buy X"** = **minimal risk**.
- **Recipe generation from inventory** (LLM call) = **limited risk** — must disclose "AI-generated" and that user is interacting with AI.
- **Receipt OCR / barcode → product matching** = **minimal risk** (assuming no biometric / no automated decision affecting legal rights).
- **Photo of fridge → identify items** (computer vision) = **minimal risk** unless used for biometric ID (faces). Don't process faces in fridge photos.

(Risk-classification reasoning is judgement applied to AI Act categories; confirm with counsel before launch of any ML feature aimed at EU users.)

### 10.4 Disclosure obligations (Art. 50, live 2 Aug 2026)

When in EU scope:
- **AI-generated content** must be machine-readably marked as AI-generated.
- **Chatbots / conversational AI** must clearly disclose that the user is interacting with AI, unless obvious.
- **Deepfakes / synthetic media** must be labelled.
- **Emotion recognition / biometric categorization** requires informing affected persons.

If you add a "Recipe AI" feature post-launch, plan a one-time review against Art. 50 before EU launch of that feature.

### 10.5 Watch list

- Re-classify on every new ML feature.
- Monitor 2 August 2026 (high-risk + Art. 50 transparency live).
- Monitor enforcement guidance from EU AI Office (still being staffed in 2026).

---

## 11. Marketing claims substantiation

### 11.1 Malaysia — Trade Descriptions Act 2011 (Act 730)

- Prohibits **false trade descriptions** and **false or misleading statements** in supply of goods/services. (<https://www.wipo.int/wipolex/en/legislation/details/15309>)
- "False" includes descriptions that, while literally true, are misleading to a material degree. (<https://qingchambers.wordpress.com/2024/01/29/a-guide-to-malaysias-trade-descriptions-act-2011/>)
- **MCMC Content Code** (referenced by Trade Descriptions practice) requires advertisers to **hold documentary evidence** for all claims capable of objective substantiation. (<https://qingchambers.wordpress.com/2024/01/29/a-guide-to-malaysias-trade-descriptions-act-2011/>)
- **Penalties**: corporate fines RM 15,000 per offending good (1st offence), RM 30,000 (2nd+); individuals up to RM 10,000 + 3 years jail (1st), RM 20,000 + 5 years (2nd+). (<https://www.kpdn.gov.my/images/2024/awam/akta/kpdn/Act%20730.pdf>)
- Regulator: **KPDN** (Ministry of Domestic Trade and Cost of Living).

### 11.2 USA — FTC Endorsement Guides (2023 update)

- Material connection between endorser and brand must be **clearly and conspicuously disclosed**.
- Includes paid influencers, free product, employee endorsements.
- Hashtag-only disclosure (e.g., `#ad`) is acceptable IF clear and visible — but `#ad` buried at the end of a long tag list is not.
- Liability is on **both** the endorser and the brand.

(Source: <https://www.ftc.gov/business-guidance/endorsements-and-testimonials> — FTC publishes the guides; widely referenced.)

### 11.3 EU — Unfair Commercial Practices Directive (UCPD)

- Misleading statements AND **misleading omissions** prohibited.
- Stricter than US in tone — "average consumer" benchmark.
- 31 practices banned outright (the "blacklist", e.g., bait advertising).

### 11.4 Recommended practice for the grocery app

For any quantitative claim ("**save 30% on groceries**", "**reduce food waste by 40%**"), maintain a substantiation file including:
- Methodology — how was the figure measured?
- Sample size and demographics
- Date of measurement
- Caveats and assumptions
- Whether the claim represents typical or best-case results

For influencer marketing:
- Contract clause requiring `#ad` or `#sponsored` disclosure.
- Pre-publication review of influencer content.
- Track which influencers received product, payment, or both.

For app-store listings:
- Don't claim "reduces food waste" without data. Reframe as "designed to help you reduce food waste" — aspirational language is safer than empirical claim.
- Save screenshots and copy versions for each app-store update; you cannot recover historical claims.

Source for endorsement-guide background: <https://www.ftc.gov/business-guidance/endorsements-and-testimonials>; MY regulator: <https://www.kpdn.gov.my/>.

---

## 12. T&C clauses — standard / non-obvious

For each, recommended language summary + jurisdiction note. **None of this is legal advice — get counsel review before launch.**

### 12.1 Choice of law / forum

**Recommendation for MY-based indie**: choose **Malaysian law** with **Malaysian courts** OR **AIAC arbitration** (formerly KLRCA, in Kuala Lumpur). (<https://www.aiac.world/wp-content/arbitration/arbitration/rules_arb_en/PDF-Flip/PDF.pdf>)

> "These Terms shall be governed by and construed in accordance with the laws of Malaysia. Any dispute arising out of or in connection with these Terms shall be referred to and finally resolved by arbitration administered by the Asian International Arbitration Centre (AIAC) in accordance with the AIAC Arbitration Rules in force at the time, with seat in Kuala Lumpur, language English, and a sole arbitrator."

**Trade-off**: MY law / KL forum favours the indie (home-court advantage, low cost). EU consumers cannot be forced to arbitrate or to litigate outside their home country under EU consumer rules; consumer-protection mandatory law of the EU consumer's residence may override your choice. So your forum clause governs **B2B and non-EU consumers**; for EU consumers, accept that suits may proceed in their courts.

(Inferring; consistent with EU Brussels I bis Regulation Art. 17–19.)

### 12.2 Force majeure

Standard clause covering: acts of God, war, government action, pandemics, internet outages beyond reasonable control, third-party platform failures (e.g., Google Cloud regional outage).

Post-2020 case law tightened enforcement: **the event must be unforeseeable AND unavoidable AND it must actually have caused the failure**. Courts now scrutinise whether the obligor took reasonable mitigation steps. (Common-law trend; UK Supreme Court Gulia and German BGH lines through 2023.)

> "Neither party shall be liable for failure or delay in performance caused by events beyond its reasonable control, including… provided that the affected party (i) gives prompt written notice, (ii) takes reasonable steps to mitigate, and (iii) resumes performance promptly upon cessation of the event."

### 12.3 Limitation of liability

- **Excluded**: indirect, special, consequential, punitive damages; loss of profits, data, goodwill.
- **Capped**: direct damages capped at **fees paid in the 12 months preceding the claim**, OR a fixed amount (e.g., USD 100) if free user. (<https://www.hyperstart.com/blog/limitation-of-liability/>, <https://toslawyer.com/essential-terms-for-every-saas-contract-as-recommended-by-a-saas-contracts-lawyer/>)
- **Carve-outs that cannot be capped**: gross negligence, wilful misconduct, fraud, breach of confidentiality, IP indemnity (at counsel's discretion).

> "To the maximum extent permitted by law, [Company]'s aggregate liability arising out of or relating to these Terms or the Service shall not exceed the greater of (a) the fees paid by the user to the Company in the twelve (12) months preceding the event giving rise to the claim, or (b) USD 100. In no event shall the Company be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, goodwill, or business opportunity, regardless of the legal theory."

**Jurisdiction note**: in **EU consumer contracts**, certain liability limitations are unenforceable (death/personal injury, gross negligence). Under MY Contracts Act 1950 and Consumer Protection Act 1999, similar mandatory protections apply. Courts will enforce a reasonable limitation but not one deemed "unconscionable."

### 12.4 Indemnification

- **B2C app**: ToS rarely indemnifies the user; user often indemnifies the company against user's misuse / IP claims arising from user content.
- **One-way (user → company) is standard for B2C**. Bilateral indemnification belongs in B2B/enterprise contracts.

> "User shall indemnify, defend, and hold harmless [Company] from and against any third-party claims, damages, liabilities, costs, and expenses (including reasonable attorneys' fees) arising out of (a) user's misuse of the Service, (b) user's violation of these Terms, (c) user's User Content infringing any rights of a third party, or (d) user's violation of applicable law."

### 12.5 Termination

- **For cause** (breach by other party, with cure period typically 30 days): immediate effect.
- **For convenience** (either party, with notice): typically 30 days advance.
- **Effect of termination**: data export window (e.g., 30 days), then deletion within retention schedule (e.g., 90 days). Deferred deletion accommodates accidental termination + restore.
- **Surviving clauses**: confidentiality, IP ownership, limitation of liability, indemnity, governing law.

> "Either party may terminate these Terms at any time. Upon termination… User may export data within 30 days of termination… Company will delete User personal data within [90] days of termination, except where retention is required by law."

### 12.6 Severability

Standard:

> "If any provision of these Terms is held by a court of competent jurisdiction to be invalid or unenforceable, that provision shall be modified to the minimum extent necessary to make it valid and enforceable, and the remaining provisions shall remain in full force and effect."

### 12.7 Class action waiver

- **US**: common; generally enforceable post-AT&T v Concepcion (2011).
- **EU consumer contracts**: generally **NOT enforceable** under Directive 93/13 / national consumer law.
- **MY**: less tested; class actions are rare in MY but waivers are not bullet-proof against consumer claims.
- **Recommendation**: include for US scope; do not rely on it for EU/MY consumers.

### 12.8 Arbitration clause

**Pros**: cheaper than court, private, often faster, neutral forum.
**Cons**: limited discovery, arbitrators may be expensive, harder to challenge an award, EU consumers cannot be forced into arbitration outside their home country.

For an MY indie, recommended pattern:
- **B2B / enterprise users**: AIAC arbitration in KL, English language, sole arbitrator.
- **Consumers (general public)**: courts of consumer's residence prevail in EU; for non-EU consumers, you can include arbitration but expect courts to second-guess on consumer-protection grounds.

Reference template clauses available via Cooley GO and Fenwick (publicly accessible) — confirm at <https://www.cooley.com/> and <https://www.fenwick.com/>.

---

## 13. SLA commitments

### 13.1 Realistic indie commitments

| Tier | Annual downtime budget | When to commit | Source |
|------|-----------------------|----------------|--------|
| 99.0% | 87.6 hr/yr | Beta / free-tier only | (math) |
| 99.5% | 43.8 hr/yr | Most indie freemium | (math) |
| 99.9% | 8.76 hr/yr | Most paid SaaS; standard | (math) |
| 99.95% | 4.38 hr/yr | Firebase's own commitment | <https://firebase.google.com/terms/service-level-agreement> |
| 99.99% | 52.6 min/yr | Enterprise; very expensive to deliver | (math) |

### 13.2 Firestore / Firebase SLA reality (2026)

- **Firebase Hosting + Realtime Database**: Monthly Uptime Percentage **≥ 99.95%**. (<https://firebase.google.com/terms/service-level-agreement>)
- **Firestore**: Multi-region: **≥ 99.999%**, regional: **≥ 99.99%**. (<https://cloud.google.com/firestore/sla>)
- Service Credits are the sole remedy; you must claim within typically 30 days of incident.

### 13.3 What an indie can realistically commit to publicly

You are **at the mercy of Google's uptime** — you can never commit to higher than what Google commits to you. **Recommendation**:

- Commit publicly to **99.5%** for paid users.
- Document transparently: "Service availability depends on Google Cloud / Firebase availability. Our internal target is 99.9% but our public commitment is 99.5%."
- Show a **status page** (UptimeRobot free tier, or Atlassian Statuspage starter).
- Refunds / credits: **rarely triggered** for indie, but document the formula. Standard: pro-rata refund of subscription fee for the month if monthly uptime falls below committed threshold.

### 13.4 SLA section template

> "[Company] commits to a Service Availability of 99.5% measured monthly. 'Service Availability' means the percentage of time during a calendar month during which the Service is available for use by paying users, excluding scheduled maintenance announced at least 48 hours in advance, and excluding unavailability caused by factors outside [Company]'s reasonable control (including third-party platform outages, force majeure events, and user-side issues). If Service Availability falls below 99.5% in any calendar month, the affected paying user may request a Service Credit equal to a pro-rata portion of the monthly subscription fee for the period of unavailability. Service Credits are the sole and exclusive remedy."

---

## Critical-path actions before launch

Ordered by what blocks the next action.

1. **Privacy policy + ToS legal review** (ALL OF: this doc + companion `legal_launch_research.md` deep-dives). Engage a MY tech lawyer for a 2–3 hour review session. Budget RM 1,500–3,000.
2. **Get insurance quotes from at least two MY brokers** (Howden, Sime Darby Lockton, or Contingent). Quote both cyber liability (RM 1M limit) and professional indemnity (RM 1M limit). Bind before the first paid customer.
3. **Implement Firebase consent-mode for EU users** — analytics/crashlytics OFF until explicit opt-in. Build the in-app consent screen + revocation in settings. (Section 3.3.)
4. **Run a TIA (Transfer Impact Assessment) for Singapore-region Firestore data flows** using the CNIL template — 1–2 days self-service. Save in `.claude/docs/legal_research/` for refresh on schedule. (Section 8.)
5. **Add age-gate at sign-up + "not for under-13" wording in ToS / Privacy / app-store description**. Block under-13 sign-ups. (Section 7.2, 7.6.)
6. **Implement cancel-as-easy-as-signup in the web/Stripe flow** (App Store / Play already comply). Match Click-to-Cancel logic by default to avoid retrofit. (Section 6.4.)
7. **Run an axe DevTools + manual VoiceOver/TalkBack pass on the app and web admin**. Fix all WCAG 2.1 AA blockers. Aim for zero axe Critical / Serious before EU launch. (Section 2.)
8. **Build a `/subprocessors` page linked from privacy policy**, listing every third-party data handler. (Section 9.3.)
9. **Set up substantiation-file practice** for any quantitative marketing claim ("save 30%", etc.). One folder per claim; methodology + data + caveats. (Section 11.4.)
10. **Capture marketing-consent flags in the user schema NOW** even if you have no marketing program yet (Section 5.6) — you cannot retroactively prove consent.

---

## Watch list — growth- or feature-triggered triggers

| Trigger | Item | Section |
|---------|------|---------|
| 1M+ MAU OR pivot into health/finance | Re-evaluate NCII designation under MY Cybersecurity Act 2024 | §4 |
| Adding any ML / LLM feature | EU AI Act risk-classification; especially Art. 50 transparency live 2 Aug 2026 | §10 |
| Starting any marketing-email program | CASL (Canada) + GDPR (EU) + CMA s.233A (MY) consent capture; pick ESP (Resend default) | §5 |
| Sdn Bhd conversion | Add D&O insurance | §1.4 |
| Any influencer / paid partnership | FTC Endorsement Guides + MY KPDN | §11.2 |
| Any paid B2B or enterprise customer | VPAT + DPA template + bilateral indemnification | §2.6, §12.4 |
| Any change to subprocessors | 30-day user notification + privacy policy bump | §9.4 |
| FTC Click-to-Cancel ANPRM → final rule (track Federal Register) | Re-verify cancel flows comply with revived rule | §6.2 |
| Apple App Store / Google Play policy update | Always-stale items per CLAUDE.md; check at every release | (per global rules) |
| Indonesia PDP authority establishment | If launching in ID — DPO requirements may activate | (companion doc) |

---

## Total minimum-viable risk-mitigation budget

Annual recurring (year 1, indie sole-prop, low revenue, single founder):

| Item | Low | High | Notes |
|------|-----|------|-------|
| Cyber liability insurance (RM 1M limit) | RM 2,500 | RM 5,000 | Per §1.1; quote-driven |
| Professional indemnity insurance (RM 1M limit) | RM 1,500 | RM 3,500 | Per §1.2; quote-driven |
| Accessibility audit tooling (axe + Pa11y free) | RM 0 | RM 0 | Per §2.5; CI-integrated |
| One-time pre-launch a11y audit (third party) | RM 5,000 | RM 15,000 | Per §2.5; one-time, amortise over 2–3 yrs |
| Cookie banner / consent (DIY or Enzuzo free) | RM 0 | RM 2,000 | Per §3.4 |
| Email service (Resend free tier at launch) | RM 0 | RM 1,200 | Per §5.5; Resend free → $20/mo |
| Status page (UptimeRobot free) | RM 0 | RM 600 | Free tier sufficient for indie |
| Legal review (MY tech lawyer, 2–3 hr) | RM 1,500 | RM 3,000 | Per critical-path §1; one-time, refresh annually |
| TIA + DPA review by counsel (optional) | RM 0 | RM 5,000 | Per §8.6; DIY w/ CNIL template viable |
| **Annual recurring total (excl. one-time audit + legal)** | **RM 4,000** | **RM 12,300** | |
| **First-year total (including one-time items)** | **RM 10,500** | **RM 35,300** | |

**Realistic single-number for a frugal indie sole-prop in year 1**: **~RM 12,000–15,000** assuming:
- Lower-end cyber + PI quotes (~RM 5,000 combined)
- DIY cookie banner, free a11y tooling, Resend free tier
- One ~RM 2,500 legal review hour
- One ~RM 5,000 one-time accessibility audit (defer to month 6 if cash-tight; use free tooling for launch)

**Year 2+ steady state**: **~RM 6,000–8,000/yr** (insurance + one annual legal touch-base).

This budget intentionally excludes:
- Entity setup fees (Sdn Bhd vs sole prop — covered in `legal_launch_research.md`)
- App-store developer fees (Apple $99/yr, Google $25 one-time — covered in companion)
- Payment processor fees (Stripe / Apple IAP / Play — transactional, not risk-mitigation)
- Tax compliance (LHDN GST/SST — separate budget)

---

## Frontmatter / refresh discipline

Per CLAUDE.md global rules:
- Compiled **2026-05-03**.
- Refresh cadence **90 days** — next review due **2026-08-01**.
- **Always-stale items** to re-verify even before 90d:
  - Apple App Store + Google Play policy updates
  - FTC Click-to-Cancel ANPRM → NPRM → final rule trajectory
  - EU AI Act Art. 50 + high-risk obligations live (2 Aug 2026)
  - COPPA 2025 amendments compliance deadline (22 Apr 2026 — already past at next review)
  - MCMC Section 233A UCEM implementation framework (still being consulted at compile time)
  - MY PDPA 2024 amendments + child-data provisions
  - Insurance broker quotes (markets re-rate annually)

When refreshing, log the refresh in `legal_launch_research.md` frontmatter and note any material changes inline with the date stamp.
