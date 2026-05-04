# Malaysia Legal Research — Freemium Grocery/Pantry Tracker App

**Date compiled:** 2026-05-03
**Owner profile:** Malaysian individual, registered as Sole Proprietor / Enterprise with SSM (NOT yet Sdn Bhd)
**Stack:** FastAPI backend + React Native client + Firestore (Google Cloud, default US region)
**Business model:** Freemium with paid subscription tier via Apple/Google in-app purchases (IAP)
**Sensitive data:** Account email + password, camera (barcode), location
**Distribution:** Apple App Store + Google Play, global storefronts

> Scope and tone: This is research for engineering/product planning. It is not legal advice. Engage Malaysian counsel before launch for any item flagged "ambiguous" or "high-impact." All factual claims are inline-cited. Where a primary source (jpdp.gov.my, mcmc.gov.my, kpdn.gov.my, mysst.customs.gov.my, ssm.com.my, hasil.gov.my) was reachable, it is preferred. Where primary pages were behind 403s or PDF-only, secondary professional sources (Mayer Brown, DLA Piper, Sidley, EY, ITIF, etc.) are used as the citation.

---

## 1. PDPA 2010 + Amendment Act 2024

The Personal Data Protection Act 2010 (Act 709) was substantially amended by the **Personal Data Protection (Amendment) Act 2024 (Act A1727)**, which the Department of Personal Data Protection (JPDP) confirms and links to from its Acts page ([pdp.gov.my](https://www.pdp.gov.my/ppdpv1/en/akta/personal-data-protection-amendment-act-2024/)). The amendment was rolled out in three phases between January and June 2025 ([Mayer Brown briefing, July 2025](https://www.mayerbrown.com/en/insights/publications/2025/07/from-legislative-reform-to-practical-guidance-key-amendments-to-malaysias-pdpa-and-the-launch-of-cross-border-transfer-guidelines)).

### 1.1 Does this app need Data User (now "Data Controller") registration?

Registration applies only to **Data Users specified in the Personal Data Protection (Class of Data Users) Order 2013**, as amended in 2016. The Order enumerates fixed industry classes; processing personal data outside those classes does **not** trigger registration ([JPDP Class Order page](https://www.pdp.gov.my/ppdpv1/en/akta/personal-data-protection-order-class-of-data-users/); [Lexology overview](https://www.lexology.com/library/detail.aspx?g=2c923985-e0d2-4bd5-8e06-ea11bd23a4c1)).

The classes specified are: **communications (licensed telcos and couriers); banking and financial institutions; insurance; health (private hospitals, pharmacies, medical and dental clinics); tourism and hospitality (hotels and travel agencies); transportation (airlines); education (private schools and higher education institutions); direct sales of services (retail and wholesale, employment agencies, legal/audit/accounting/engineering/architects); real estate; utilities (electricity and water); pawnbrokers and moneylenders** ([Lexology — Registration of Data Users](https://www.lexology.com/library/detail.aspx?g=2c923985-e0d2-4bd5-8e06-ea11bd23a4c1)).

**Conclusion for this app:** A grocery/pantry tracker mobile app does **not** fall within any specified class. "Communications" in the Order means licensed CMA-1998 network/service providers (telcos, couriers), not OTT consumer apps. "Direct sales of services" was clarified in the 2016 amendment to target retail/wholesale and licensed professional services — not a consumer SaaS. **No registration is required at launch.**

If the product later adds e-commerce checkout that places it in retail/wholesale, or onboards healthcare/insurance partners, registration may be triggered. Fees per the official JPDP fee schedule are: **Sole Proprietorship RM100/yr, Partnership RM200/yr, Private Company RM300/yr, Public Company RM400/yr** ([JPDP Fees](https://www.pdp.gov.my/jpdpv2/registration/fees-registration/?lang=en)).

> Watch list item: any pivot toward in-app commerce, healthcare integration, or telco partnership re-opens this question.

### 1.2 Notice and consent for the three sensitive flows

The PDPA has 7 principles. **Notice & Choice (s.7)** requires a written notice in English and Bahasa Malaysia describing purpose, classes of third parties, choices available, source of the data, and rights of access/correction. **General Principle (s.6)** requires consent before processing ([Multilaw Malaysia DP Guide](https://multilaw.com/Multilaw/Multilaw/Data_Protection_Laws_Guide/DataProtection_Guide_Malaysia.aspx); [SPW retention article](https://spwcircular.com/blog/what-you-need-to-know-about-personal-data-retention-in-malaysia/)). The 2024 amendment (Phase 2, in force 1 April 2025) expanded the definition of **sensitive personal data to include biometric data**, which now requires **explicit** consent ([Sidley](https://www.sidley.com/en/insights/newsupdates/2024/08/important-changes-to-malaysias-data-protection-laws); [Hall Booth Smith summary](https://hallboothsmith.com/malaysia-2024-data-privacy-reform/)).

| Data flow | PDPA classification | Notice content required | Consent type |
|---|---|---|---|
| **Account email + password** | Personal data (regular) | Purpose: authentication. Third parties: Firebase Auth (Google US), email provider. Retention: until account deletion + 30d grace. Rights: access/correction/withdraw | **Standard consent** (signup checkbox or click-through, opt-in not pre-ticked) |
| **Camera (barcode scanning)** | Personal data only if image/video stored or face/biometric extracted. Live-only barcode decoding to a string is generally not "personal data" | If images are uploaded: same notice as above; if extracting biometric (e.g. ID-card OCR), **explicit consent** | OS-level just-in-time prompt (iOS `NSCameraUsageDescription`, Android runtime permission) plus in-app explanation |
| **Location** | Personal data; precise location is treated as sensitive in practice (not statutorily "sensitive" under s.4 unless tied to identity inference) | Notice must explain: why location, what precision (coarse vs precise), retention period, third parties (e.g. Firestore US region), opt-out mechanism | **Standard consent** + OS-level just-in-time prompt; recommend "while using the app" granularity over "always" |

Bilingual notice (English + Bahasa Malaysia) is mandatory under s.7(3) ([Multilaw](https://multilaw.com/Multilaw/Multilaw/Data_Protection_Laws_Guide/DataProtection_Guide_Malaysia.aspx)).

### 1.3 Retention (Principle 5)

The PDPA requires that personal data not be kept longer than necessary for the purpose. After purpose fulfilment, the controller must take "all reasonable steps to destroy or permanently delete" the data ([SPW retention guide](https://spwcircular.com/blog/what-you-need-to-know-about-personal-data-retention-in-malaysia/)). The 2024 amendment expanded the retention obligation to include documenting the retention period, methods of destruction, and any third-party retention ([Hall Booth Smith](https://hallboothsmith.com/malaysia-2024-data-privacy-reform/)). Statutory overrides exist for tax/payroll (7 years under Income Tax Act 1967 s.82); for app data unrelated to those statutes, define a retention schedule per data class and document it.

### 1.4 Data subject rights

Access, correction, withdrawal of consent, right to prevent processing for direct marketing, and — added by the 2024 amendment, in force from 1 June 2025 — **data portability** subject to technical feasibility ([Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2025/07/from-legislative-reform-to-practical-guidance-key-amendments-to-malaysias-pdpa-and-the-launch-of-cross-border-transfer-guidelines)). The app must offer in-product flows for access and deletion (this also satisfies Apple's privacy-policy expectations).

### 1.5 Mandatory breach notification (Phase 3, in force 1 June 2025)

The Personal Data Protection Guideline on Data Breach Notification (issued 25 February 2025) sets the operative rules ([Lexology — HHQ summary](https://hhq.com.my/posts/personal-data-breach-notification-in-malaysia-a-legal-guide-for-compliance/); [DLA Piper Privacy Matters](https://privacymatters.dlapiper.com/2025/03/malaysia-guidelines-issued-on-data-breach-notification-and-data-protection-officer-appointment/)):

- **To the Commissioner:** within **72 hours** of becoming aware of the breach. The 72-hour clock starts when the controller is informed of, or detects, the security incident — preliminary investigation is allowed but does not stop the clock. If the 72-hour deadline cannot be met, a written explanation with supporting evidence must be submitted ([Lexology guideline summary](https://www.lexology.com/library/detail.aspx?g=d72dec59-374a-4a94-aa94-03f8b5a0d3be)).
- **Phased reporting:** if full information is not available at first notice, additional details may be submitted as soon as practicable, **no later than 30 days** from the initial notification.
- **To affected data subjects:** without undue delay and **no later than 7 days after** the initial Commissioner notification, **if** the breach causes or is likely to cause significant harm.

**"Significant harm"** triggers individual notification and includes: physical harm, financial loss, negative credit effects, property damage, misuse for illegal purposes, sensitive-data compromise, identity-fraud-enabling combinations, and breaches affecting **1,000 or more data subjects** (the 1,000+ trigger is for Commissioner notification specifically) ([DLA Piper Privacy Matters](https://privacymatters.dlapiper.com/2025/03/malaysia-guidelines-issued-on-data-breach-notification-and-data-protection-officer-appointment/)).

Failure to notify: fine up to RM250,000 and/or up to 2 years' imprisonment ([DLA Piper](https://privacymatters.dlapiper.com/2025/03/malaysia-guidelines-issued-on-data-breach-notification-and-data-protection-officer-appointment/)).

### 1.6 DPO appointment (Phase 3, in force 1 June 2025)

A DPO must be appointed where the controller or processor:

1. Processes personal data of **more than 20,000 data subjects**, OR
2. Processes **sensitive personal data (including financial information) of more than 10,000 data subjects**, OR
3. Conducts processing that requires **regular and systematic monitoring** of personal data ([DLA Piper](https://privacymatters.dlapiper.com/2025/03/malaysia-guidelines-issued-on-data-breach-notification-and-data-protection-officer-appointment/)).

A pantry tracker app at launch — small user base, no financial data, no continuous monitoring — does **not** require a DPO. Once the user base crosses **20,000 active users**, the obligation triggers. The DPO can be an employee or external service provider but must be a Malaysian resident or have a local representative; their contact must be registered with JPDP and disclosed in the privacy notice ([Securiti](https://securiti.ai/malaysia-data-protection-guidelines-dpo-appointment-and-breach-notification/)).

### 1.7 Other 2024 amendment changes worth flagging

- Direct obligations on **data processors** (previously only data controllers). Firebase/Firestore as your processor doesn't change your liability, but your Data Processing Agreement (Google Cloud DPA) must reflect this. ([Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2025/07/from-legislative-reform-to-practical-guidance-key-amendments-to-malaysias-pdpa-and-the-launch-of-cross-border-transfer-guidelines))
- Maximum penalty raised to **RM1,000,000** and 3 years' imprisonment ([Sidley](https://www.sidley.com/en/insights/newsupdates/2024/08/important-changes-to-malaysias-data-protection-laws)).
- Terminology: "data user" → "data controller" (Phase 1, 1 April 2025) ([Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2025/07/from-legislative-reform-to-practical-guidance-key-amendments-to-malaysias-pdpa-and-the-launch-of-cross-border-transfer-guidelines)).

---

## 2. Communications and Multimedia Act 1998 + MCMC content code

The CMA 1998 ([MCMC Acts page](https://www.mcmc.gov.my/en/legal/acts); [full text PDF](https://contentforum.my/wp-content/uploads/2022/11/CMA-1998.pdf)) is industry-licensing legislation rather than a consumer app statute.

### 2.1 Application Service Provider (Class) — ASP(C) licence

The 2025 mandatory ASP(C) licensing was specifically tied to **internet messaging and social media services with 8 million or more users in Malaysia**, in force from 1 January 2025 ([CMS Law-Now](https://cms-lawnow.com/en/ealerts/2025/01/new-mandatory-licensing-requirements-for-application-service-providers-in-malaysia); [WJNT](http://www.wjnt-law.com/overview-of-the-mcmc-licensing-requirements-for-internet-messaging-and-social-media-service-providers/); [The Vibes / MCMC announcement](https://www.thevibes.com/articles/business/116967/mcmc-deems-major-internet-messaging-and-social-media-providers-as-licensed-from-jan-1-2026)). A grocery tracker app is neither messaging nor social media, and is far below the 8 million-user threshold. **ASP(C) does not apply at launch.**

If a chat/social/community feed is added later AND the app exceeds 8 million MY users, ASP(C) is triggered (annual renewal, fines up to RM500,000 and/or 5 years' imprisonment for non-compliance — [WJNT](http://www.wjnt-law.com/overview-of-the-mcmc-licensing-requirements-for-internet-messaging-and-social-media-service-providers/)).

Web hosting and client-server services are exempt from class licensing under the Communications and Multimedia (Licensing) (Exemption) Order 2000 ([MCMC Class Licence page](https://www.mcmc.gov.my/en/licence-under-akm-98/licence-for-broadcasting-mobile-services-fixed-s/class-licence-nfp-nsp-asp-casp)).

### 2.2 Content Code (s.213 CMA 1998)

The Content Code is a self-regulatory instrument prepared by the Communications and Multimedia Content Forum, registered with MCMC. It restricts unsuitable content, requires classification methods, complaints handling, and end-user content-control technologies ([MCMC overview page](https://www.mcmc.gov.my/en/legal/acts); CMA s.213 — see [PDF](https://contentforum.my/wp-content/uploads/2022/11/CMA-1998.pdf)). For a grocery tracker without UGC, the Content Code is largely a non-event. **If user-generated content (recipe sharing, reviews, comments) is added later**, the app should align with the Content Code on offensive-content takedowns and complaints workflow.

### 2.3 In-app advertising disclosures

CMA 1998 itself doesn't impose ad-disclosure rules; consumer-protection rules (Section 3) and the ASA-style Malaysian Code of Advertising Practice cover this. For freemium apps, the practical concerns are: (1) clear distinction between paid placements and editorial recommendations, (2) "subscribe" CTAs not styled as system dialogs, (3) sponsored content marked as such. These are best-practice rather than CMA-statutory.

### 2.4 Location-based services

There is no location-specific licensing under CMA 1998 for a non-telco app. Location data is regulated through PDPA (notice + consent) — see Section 1.2 above. The MCMC's interest is in licensed mobile network operators sharing location with third parties, not in an app's use of OS-provided location.

---

## 3. Consumer Protection Act 1999 (CPA) + e-commerce regulations

The CPA 1999 (Act 599) is the main consumer-protection statute, administered by the Ministry of Domestic Trade and Cost of Living (KPDN) ([CPA full text PDF](https://www.kpdn.gov.my/images/2024/awam/akta/ttpm/Act%20599.pdf); [KPDN site](https://www.kpdn.gov.my/en/faq/faq-enforcement)).

### 3.1 Cooling-off period

There is **no statutory cooling-off period for digital subscriptions** under the CPA. The 10-working-day cooling-off period in the CPA applies to **direct selling contracts** under the Direct Sales and Anti-Pyramid Scheme Act 1993 — door-to-door, mail-order, telemarketing — and not to in-app subscriptions purchased through Apple/Google IAP ([Anrok consumer-rights summary](https://stripe.com/resources/more/malaysia-sst-rate); [NSWLam article on no-refund clauses](https://www.nswlam.com/blog/no-refund-no-cancellation-policy-is-it-valid)).

In practice, **Apple and Google's own refund policies** govern IAP subscriptions and are stricter than CPA — Apple offers ad-hoc refund requests via Report a Problem; Google Play allows 48-hour auto-refunds for new purchases. A "no refunds" clause is unenforceable to the extent it conflicts with Part IIIA of the CPA on unfair contract terms ([NSWLam](https://www.nswlam.com/blog/no-refund-no-cancellation-policy-is-it-valid)).

### 3.2 Auto-renewal disclosure

The CPA does not have a dedicated auto-renewal section, but Part IIIA (Unfair Contract Terms) and ss.9-10 (false or misleading conduct) apply. The **Consumer Protection (Electronic Trade Transactions) Regulations 2012** (and the 2024 update) require online suppliers to disclose, on their website/app:

1. Name of the operator or company
2. Email address and telephone number, or address
3. Description of main characteristics of goods/services
4. Full price, including transport, taxes, other costs
5. Business registration number ([Lexology — Updated Regulations](https://www.lexology.com/library/detail.aspx?g=e9766f41-4f8a-4ce0-a523-501b29c25a3b); [Donovan & Ho](https://dnh.com.my/legal-updates-on-e-commerce-in-malaysia/); [Kiizen 2024 Regulations summary](https://www.kiizen.com.my/consumer-protection-electronic-trade-transaction-regulations-2024/))

Best practice for the freemium tier: pre-purchase screen lists exact subscription term, billing date, auto-renew, cancellation path. Apple/Google App Review Guidelines also require this; non-compliance is a binding-contract risk under the CPA.

### 3.3 Refunds

The CPA implies a guarantee that services will be rendered with reasonable care and skill (s.53). For digital subscriptions, this anchors a refund obligation when service fails (e.g., backend down for extended periods). Document a refund policy in the app's Terms covering both Apple/Google channel rules and the CPA s.53 backstop.

### 3.4 Misleading advertising

CPA ss.9-10 prohibit false or misleading representations as to standard, quality, value, price, or characteristics. App Store metadata, screenshots, and "premium" feature claims must be accurate. KPDN enforcement is real: see [KPDN enforcement FAQ](https://www.kpdn.gov.my/en/faq/faq-enforcement).

### 3.5 Bahasa Melayu listing requirement

Note: a 2024 mandate to require Bahasa Melayu on e-commerce listings was **postponed indefinitely** ([bebit-tech writeup](https://www.bebit-tech.com/en/blog/new-mandate-bahasa-melayu-requirement-for-malaysian-e-commerce-listings-postponed-until-further-notice)). For now, English-only listings are acceptable; bilingual privacy notice (s.7(3) PDPA) is still required.

---

## 4. SSM registration and entity choice

SSM (Companies Commission of Malaysia, [ssm.com.my](https://www.ssm.com.my)) registers Sole Proprietorships under the Registration of Businesses Act 1956 and Sdn Bhds under the Companies Act 2016.

### 4.1 When MUST a sole prop incorporate to Sdn Bhd?

**There is no statutory turnover threshold that compels incorporation.** A sole prop can in principle continue indefinitely. But these business events make Sdn Bhd practically unavoidable:

- **Liability events.** A sole prop has unlimited personal liability; an app handling user accounts, payments, and personal data is exposed to PDPA fines (up to RM1m per breach), CPA claims, and IP-infringement suits — all of which would attach to personal assets including primary residence. Most advisors recommend incorporating before the app reaches paid-user scale ([Centry comparison](https://www.centry.digital/blog/sdn-bhd-vs-sole-proprietorship-business-entities-in-malaysia); [Foundingbird](https://foundingbird.com/my/blog/differences-between-enterprise-and-sdn-bhd/)).
- **Foreign investor / co-founder.** Sole props are restricted to Malaysian citizens/PRs; bringing in a foreign investor or business partner forces conversion ([Foundingbird](https://foundingbird.com/my/blog/differences-between-enterprise-and-sdn-bhd/)).
- **Bank-grade contracts.** Many enterprise customers, ad networks, and even Stripe-equivalent processors will only contract with Sdn Bhds.
- **Annual revenue benchmark.** Industry guidance suggests converting once annual revenue is consistently above **RM300,000–500,000**, both for tax efficiency (Sdn Bhd 17% on first RM600k vs sole-prop personal rates up to 30%) and for credibility ([Stateless guide](https://learn.stateless.to/en/sole-proprietorship-in-malaysia-2025s-expert-tax-strategy/); [Centry](https://www.centry.digital/blog/sdn-bhd-vs-sole-proprietorship-business-entities-in-malaysia)).

### 4.2 App-store payouts: do Apple/Google force Sdn Bhd?

No — both Apple and Google permit individual / sole-proprietor payouts in Malaysia.

- **Apple Developer Program** explicitly supports individuals/sole-props without a DUNS number; legal first/last name must match Apple ID ([Apple enrollment help](https://developer.apple.com/support/enrollment/); [Apple D-U-N-S help](https://developer.apple.com/support/D-U-N-S/)). Bank account in the developer's legal name ([Apple banking info help](https://developer.apple.com/help/app-store-connect/manage-banking-information/enter-banking-information/)).
- **Google Play** supports individual/sole-prop payments profiles; Malaysian merchants receive USD wire transfers from the US ([Google payments wire transfer help](https://support.google.com/googleplay/android-developer/answer/2700656); [Google merchant tax info help](https://support.google.com/googleplay/android-developer/answer/7163598)).

So Sdn Bhd is **not strictly required** for app-store payouts. **But:** if the app ever uses non-IAP payment flows (Stripe Malaysia, iPay88, etc.), most processors require Sdn Bhd registration.

### 4.3 Conversion timeline + cost

Conversion is technically a fresh **incorporation of a new Sdn Bhd** plus an asset/liability transfer; SSM has no mechanism to "upgrade" an enterprise registration ([Corpso writeup](https://www.corpso.com/how-to-convert-enterprise-to-sdn-bhd-in-malaysia/); [Quadrant](https://quadrantbiz.co/blog/how-to-change-from-enterprise-to-sdn-bhd/); [Malaysiaco](https://www.malaysiaco.com.my/upgrade-from-sole-proprietor-partnership-to-sdn-bhd-company-2/)).

| Step | Timeline | Cost |
|---|---|---|
| Name search + reservation (MyCoID) | 1 day | RM50/name |
| Incorporation Section 14 + Section 17 docs filed | 1-3 working days SSM review | RM1,000 base SSM fee |
| Company secretary appointment (within 30 days post-incorp) | within 30 days | RM800-2,000/yr typical |
| Bank account opening (Maybank, CIMB, Public Bank) | 2-4 weeks | nil to RM500 |
| Asset/contract novation from sole prop | rolling | varies |
| Closure of sole prop (notify SSM, LHDN, EPF if applicable) | 1-2 weeks | RM30 SSM termination fee |

**End-to-end realistic timeline: 4-6 weeks.** Total cost using a service provider package: **RM1,460-3,000** ([Corpso](https://www.corpso.com/how-to-convert-enterprise-to-sdn-bhd-in-malaysia/)). Doing it manually via SSM's MyCoID portal: ~RM1,050.

### 4.4 Practical recommendation

Launch as sole prop is acceptable for v1. Plan the conversion when **any one** of these triggers fires:
- Active paying users >2,000 OR annual subscription revenue >RM200,000
- First non-IAP payment integration
- First foreign co-founder/investor offer
- First non-trivial PDPA, IP, or contract dispute

---

## 5. SST registration thresholds (2026)

Sales and Service Tax is administered by Royal Malaysian Customs at [mysst.customs.gov.my](https://mysst.customs.gov.my).

### 5.1 Current rate and threshold (2026)

- **Service tax rate on digital services: 8%** (raised from 6% effective 1 March 2024) ([ASEAN Briefing](https://www.aseanbriefing.com/doing-business-guide/malaysia/taxation-and-accounting/digital-service-tax-malaysia); [Bestar](https://www.bestar-asia.com/post/the-essentials-of-malaysia-digital-services-tax-dst-2025-compliance-for-foreign-businesses)).
- **Threshold for service-tax registration: RM500,000** in taxable services revenue over a rolling 12-month period ([EY SST expansion 2025](https://www.ey.com/en_my/insights/tax/malaysia-budget/sst-expansion-from-1-july-2025-what-has-changed-and-what-to-expect-in-budget-2026); [PwC service tax brief](https://www.pwc.com/my/en/publications/mtb/service-tax.html); [Cleartax 2026 SST guide](https://www.cleartax.com/my/en/sst-in-malaysia)).
- **Threshold for foreign digital service providers (FRP) selling into Malaysia: RM500,000** in 12 months ([ASEAN Briefing](https://www.aseanbriefing.com/doing-business-guide/malaysia/taxation-and-accounting/digital-service-tax-malaysia); [Anrok](https://www.anrok.com/vat-software-digital-services/malaysia)).
- **Registration deadline:** within 30 days of crossing or expecting to cross the threshold ([Cleartax](https://www.cleartax.com/my/en/sst-in-malaysia)).

### 5.2 How this applies to a Malaysian-domiciled freemium app

As a **Malaysian** service provider (sole prop or Sdn Bhd) selling subscriptions to Malaysian and foreign users:

- **Domestic SST applies** to revenue from Malaysian consumers once the rolling-12-month total crosses **RM500,000**.
- Revenue from foreign users (non-Malaysian residents) is generally **outside scope** of Malaysian service tax.
- The 8% rate applies on the consumer-facing price for Malaysian users; the developer collects, files **Form SST-02 quarterly** through the MySST portal, and remits.

For a freemium app, RM500,000 in MY-only subscription revenue is a meaningful milestone — it is a **growth-driven trigger, not a launch-day concern**.

### 5.3 Apple/Google IAP and SST

There is an interpretive nuance: Apple/Google act as **commissionaire** under their EU/UK/AU rules and increasingly elsewhere. For Malaysia, Apple has historically registered as a **Foreign Registered Person** for DST and collects SST on Malaysian transactions, remitting to Customs ([ITIF Malaysia digital tax policy](https://itif.org/publications/2025/06/09/malaysia-digital-tax-policy/); [Anrok Malaysia VAT index](https://www.anrok.com/vat-software-digital-services/malaysia)). The developer's payout from Apple is then net of SST. **Confirm with App Store Connect tax info** at launch — see Section 6.4.

### 5.4 LHDN income tax (separate from SST)

A sole-prop's app income is declared on **Form B** via the MyTax portal. Year of Assessment 2025 (i.e. 2025 income) deadline: **30 June 2026** for paper, **15 July 2026** for e-Filing ([LHDN forms](https://www.hasil.gov.my/en/forms/download-forms/); [Cleartax Form B 2026 guide](https://www.cleartax.com/my/en/form-b-malaysia)). Sole prop is taxed at personal scaled rates (0-30%); a Sdn Bhd would be taxed at 17% on first RM600k chargeable income.

---

## 6. Apple / Google submission requirements (Malaysia-specific)

### 6.1 MCMC class licensing requirement for app submission

**No.** There is no MCMC class licence required to submit an app to Apple App Store or Google Play from Malaysia. The ASP(C) licence (Section 2.1) targets messaging/social-media services with 8m+ users, not consumer app developers ([CMS Law-Now](https://cms-lawnow.com/en/ealerts/2025/01/new-mandatory-licensing-requirements-for-application-service-providers-in-malaysia)). MyCERT/NACSA notification is **not** a precondition for app submission; NACSA's notification regime applies to designated Critical National Information Infrastructure (CNII) entities — banks, telcos, utilities — under the Cyber Security Act 2024, not to a grocery tracker.

### 6.2 Content rating

- **Apple App Store:** uses Apple's own age-rating questionnaire in App Store Connect; ratings 4+, 9+, 13+, 16+, 18+ ([Apple age-ratings reference](https://developer.apple.com/help/app-store-connect/reference/age-ratings-values-and-definitions/); [Apple set-age-rating help](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/); [Apple news on updated ratings](https://developer.apple.com/news/?id=ks775ehf)). Malaysia has no separate Apple-side rating board.
- **Google Play:** uses **IARC** (International Age Rating Coalition) questionnaire which produces ratings for multiple territories including Malaysia (LPF — Lembaga Penapisan Filem covers traditional film/TV but Google Play maps to IARC) ([Capgo guide](https://capgo.app/blog/app-store-age-ratings-guide/); [Google IARC ratings via Play Console](https://support.google.com/googleplay/android-developer/answer/188189)). For a grocery tracker, expect 4+ / Everyone.

### 6.3 Apple W-8BEN (or W-8BEN-E)

Non-US developers receiving Apple payouts must submit a US tax form to claim treaty benefits and avoid 30% withholding:

- **W-8BEN** for individuals / sole proprietors ([Apple tax info help](https://developer.apple.com/help/app-store-connect/manage-tax-information/provide-tax-information/); [Kerem Erkan instructions](https://keremerkan.dev/posts/w-8ben-e-instructions-apple-google/)).
- **W-8BEN-E** for entities (Sdn Bhd) ([same](https://keremerkan.dev/posts/w-8ben-e-instructions-apple-google/)).

Malaysia has a US tax treaty with limited royalty-withholding provisions; check the current treaty article when filing. Apple also requires:
- US Tax Form (W-8BEN) for paid app/IAP earnings
- Local Malaysia Tax Form (Apple's MY tax form within App Store Connect — captures Malaysian tax-resident status and SST/GST registration if any) — appears in App Store Connect → Agreements, Tax, and Banking ([Apple AT&B agreements page](https://appstoreconnect.apple.com/agreements/)).

### 6.4 Google Play tax + payout setup

Google Play merchant payments profile requires:
- W-8BEN (individual) for US tax classification ([Google tax info](https://support.google.com/googleplay/android-developer/answer/7163598))
- Bank account in the merchant's legal name; Malaysian merchants paid in **USD wire transfer** from the US ([Google wire-transfer help](https://support.google.com/googleplay/android-developer/answer/2700656))
- Identity verification (passport or MyKad) for sole proprietors ([Google merchant verification thread](https://support.google.com/googleplay/android-developer/thread/298369407/stuck-with-verification-as-sole-proprietor-how-to-proceed?hl=en))

### 6.5 Storefront-specific compliance flags

- **Privacy Policy URL** is mandatory at submission — both stores reject apps without one. Must address each PDPA notice element (Section 1.2) and include DPO/DPC contact even if non-mandatory pre-20k users.
- **App Privacy Nutrition Labels (Apple) / Data Safety Form (Google)** — declare email, location, camera, financial info accurately. Misdeclaration is a removal trigger and a CPA s.10 misleading-conduct issue.
- **Subscription disclosures** — Apple App Review §3.1.2 and Google Play Subscriptions Policy require: clear price, billing frequency, free-trial length, auto-renew, cancellation path. These align with CPA-ETT Regulations 2012/2024 (Section 3.2).

### 6.6 NACSA and Cyber Security Act 2024

The Cyber Security Act 2024 imposes incident-reporting obligations on **designated CNII entities** (sectors: government, banking & finance, transportation, defence & security, info & comms, energy, water, healthcare, emergency services, agriculture & food). A consumer pantry app is **not** in scope. PDPA breach notification (Section 1.5) is the operative regime.

---

## 7. Cross-border data flow under PDPA section 129 (Firestore default-US)

This is the most material item for this stack — Firestore in default region (`nam5` — multi-region US) means all Malaysian user data is stored on US servers, which is a cross-border transfer under PDPA s.129.

### 7.1 What changed in 2024-2025

The Phase 2 amendment (1 April 2025) **removed the previous "whitelist" regime** under s.129. Previously, the Minister could gazette adequate jurisdictions and transfers to those were unrestricted. Under the amended s.129, **there is no whitelist**; instead, any cross-border transfer must satisfy at least one of several prescribed legal bases ([Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2025/07/from-legislative-reform-to-practical-guidance-key-amendments-to-malaysias-pdpa-and-the-launch-of-cross-border-transfer-guidelines); [Digital Policy Alert](https://digitalpolicyalert.org/change/10476-cross-border-data-transfer-regulation-in-personal-data-protection-amendment-act-2024); [HHQ — Exceptions to CBPDT](https://hhq.com.my/posts/exceptions-to-conduct-cross-border-personal-data-transfer/)).

### 7.2 The Cross-Border Personal Data Transfer Guidelines (29 April 2025)

JPDP issued the Guidelines for Cross Border Personal Data Transfer ("CBPDT Guidelines"), Circular 3/2025, on 29 April 2025 ([JPDP Guideline PDF](https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2025/08/GP_CBPDT_EN-1.pdf); [CMS Law-Now writeup](https://cms-lawnow.com/en/ealerts/2025/06/malaysian-guidelines-on-cross-border-data-transfers); [Lexology — Nazmi Zaini](https://www.lexology.com/library/detail.aspx?g=558c1e87-1a6b-412f-86ab-af3af540b146)). The legal bases for transfer:

1. **Substantially similar law / adequate level of protection** in destination jurisdiction (verified through a Transfer Impact Assessment, valid 3 years) ([Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2025/07/from-legislative-reform-to-practical-guidance-key-amendments-to-malaysias-pdpa-and-the-launch-of-cross-border-transfer-guidelines))
2. **Explicit consent of data subject** with written notice describing the destination, recipient class, and risks
3. **Necessary for performance of a contract** with the data subject
4. **Necessary for vital interests** of the data subject
5. **Legal proceedings or rights defence**
6. **Reasonable precautions and due diligence** through Standard Contractual Clauses, Binding Corporate Rules, or recognised certification schemes, ensuring no contravention of PDPA

### 7.3 Is the United States adequate?

The CBPDT Guidelines do **not** publish a list of adequate jurisdictions. The "substantially similar / adequate level of protection" determination is done by the data controller via a Transfer Impact Assessment (TIA) ([CMS Law-Now](https://cms-lawnow.com/en/ealerts/2025/06/malaysian-guidelines-on-cross-border-data-transfers)). Most Malaysian-side commentary takes the view that the United States as a whole does not currently meet "substantially similar," because the US has no single comprehensive federal data-protection law — making the consent + reasonable-precautions route the practical path for Firestore-US transfers ([Nazmi Zaini Chambers](https://nzchambers.com/cross-border-personal-data-transfer-guidelines-everything-you-need-to-know-2/)).

### 7.4 Practical compliance for Firestore-US

Three-prong approach:

**(a) Explicit consent in privacy notice + signup flow.** Required notice content:
- Identity of the recipient(s): "Google LLC, USA, as our data processor (Firestore / Firebase Authentication / Cloud Storage)."
- Country of destination: United States.
- Purpose: hosting and processing of grocery list, account, and (optionally) location data.
- Risks: US data-protection law differs from PDPA; FISA s.702 surveillance powers may permit US government access in defined cases.
- Withdrawal: consent can be withdrawn; account deletion path provided.

**(b) Reasonable precautions / due diligence.** Sign and retain:
- Google Cloud **Data Processing Addendum** (DPA), which incorporates Standard Contractual Clauses ([cloud.google.com/terms/data-processing-addendum](https://cloud.google.com/terms/data-processing-addendum)).
- Document Firebase/Firestore security configuration: encryption at rest, IAM, audit logging.
- Maintain a **Record of Cross-Border Transfers** with: recipient, country, data category, purpose, evidence (TIA, DPA, consent log) — required by CBPDT Guidelines ([Lexology — CBPDT](https://www.lexology.com/library/detail.aspx?g=558c1e87-1a6b-412f-86ab-af3af540b146)).

**(c) Optional: move Firestore to a closer region.** Firestore supports **`asia-southeast1` (Singapore)** and **`asia-southeast2` (Jakarta)** locations ([Firestore locations doc](https://firebase.google.com/docs/projects/locations)). Singapore has a PDPA broadly considered "substantially similar" by Malaysian commentators; using `asia-southeast1` simplifies the s.129 analysis significantly. **Strong recommendation: pick `asia-southeast1` at project creation.** Region cannot be changed after creation without data migration.

### 7.5 Penalties

Section 129 contraventions: up to **RM200,000 fine and/or 2 years' imprisonment** ([HHQ — Exceptions](https://hhq.com.my/posts/exceptions-to-conduct-cross-border-personal-data-transfer/)). The 2024 amendment did not specifically raise s.129 penalties (the RM1m headline penalty applies to the seven personal-data principles).

---

## Critical-path actions before launch

Ordered by dependency (do them in roughly this order). Each item has the relevant cite.

1. **Pick Firestore region `asia-southeast1` (Singapore) at project creation.** Eliminates the hardest s.129 question. Cost: nil (latency is also lower). Reference: [Firebase locations](https://firebase.google.com/docs/projects/locations); rationale: [Section 7.4](#74-practical-compliance-for-firestore-us).
2. **Sign Google Cloud Data Processing Addendum** in the Firebase console. This is the core "reasonable precautions" evidence under PDPA s.129. Reference: [cloud.google.com DPA](https://cloud.google.com/terms/data-processing-addendum).
3. **Draft and publish a bilingual (English + Bahasa Malaysia) Privacy Notice** that satisfies PDPA s.7 (purpose, third parties, retention, rights, withdrawal) and the CBPDT consent requirements (recipient, country, risks). Host the URL before submitting to either app store. Reference: [JPDP CBPDT PDF](https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2025/08/GP_CBPDT_EN-1.pdf).
4. **Implement explicit-consent UX:** signup checkbox (not pre-ticked) for the privacy notice + cross-border transfer; OS-level just-in-time prompts for camera and location. Persist consent records with timestamp and version. Reference: [Section 1.2](#12-notice-and-consent-for-the-three-sensitive-flows).
5. **Set up a breach-response runbook** with 72-hour Commissioner notification template and 7-day data-subject template, both drafted bilingually. Reference: [JPDP DBN guideline summary — DLA Piper](https://privacymatters.dlapiper.com/2025/03/malaysia-guidelines-issued-on-data-breach-notification-and-data-protection-officer-appointment/).
6. **Complete Apple App Store Connect Agreements, Tax, Banking** — submit W-8BEN as individual sole proprietor, enter MY bank details in legal name, complete the Apple Malaysia tax form. Reference: [Apple AT&B](https://appstoreconnect.apple.com/agreements/), [Apple tax info help](https://developer.apple.com/help/app-store-connect/manage-tax-information/provide-tax-information/).
7. **Complete Google Play Console payments profile** — W-8BEN, MY bank account in legal name, USD wire-transfer setup, identity verification with MyKad. Reference: [Google merchant tax info](https://support.google.com/googleplay/android-developer/answer/7163598), [Google wire transfer](https://support.google.com/googleplay/android-developer/answer/2700656).
8. **Write subscription disclosure screen** that lists exact term, billing frequency, auto-renew, free-trial details, cancellation path — satisfies CPA-ETT Regulations 2012, Apple §3.1.2, Google Play Subscriptions Policy. Reference: [Lexology — Updated Regulations](https://www.lexology.com/library/detail.aspx?g=e9766f41-4f8a-4ce0-a523-501b29c25a3b).
9. **Display SSM business registration number** on the in-app About / Contact screen (CPA-ETT Reg 3 disclosure) and in the App Store metadata seller field. Reference: [Kiizen 2024 Regulations](https://www.kiizen.com.my/consumer-protection-electronic-trade-transaction-regulations-2024/).
10. **Document a retention schedule per data class** (account email, location, camera images if any, support tickets) and a deletion endpoint; Apple now requires an in-app account-deletion mechanism. Reference: [SPW retention guide](https://spwcircular.com/blog/what-you-need-to-know-about-personal-data-retention-in-malaysia/); Apple App Store Review Guideline §5.1.1(v).

---

## Watch list (growth-driven triggers — recheck quarterly)

| Trigger | Threshold | Source citation | Action when triggered |
|---|---|---|---|
| **DPO mandatory** | >20,000 data subjects, OR >10,000 with sensitive/financial data, OR regular and systematic monitoring | [DLA Piper](https://privacymatters.dlapiper.com/2025/03/malaysia-guidelines-issued-on-data-breach-notification-and-data-protection-officer-appointment/) | Appoint internal/external DPO; register with JPDP; update privacy notice |
| **PDPA Data Controller registration** | If app pivots into a specified class (retail e-commerce, healthcare integration, communications) | [Lexology](https://www.lexology.com/library/detail.aspx?g=2c923985-e0d2-4bd5-8e06-ea11bd23a4c1); [JPDP fees](https://www.pdp.gov.my/jpdpv2/registration/fees-registration/?lang=en) | File Data Controller registration; pay annual fee (RM100 sole prop / RM300 Sdn Bhd) |
| **SST / DST registration** | RM500,000 in 12-month rolling MY-consumer revenue | [PwC](https://www.pwc.com/my/en/publications/mtb/service-tax.html); [EY](https://www.ey.com/en_my/insights/tax/malaysia-budget/sst-expansion-from-1-july-2025-what-has-changed-and-what-to-expect-in-budget-2026) | Register on MySST within 30 days; charge 8% on MY consumers; quarterly SST-02 filings |
| **Sdn Bhd conversion (financial)** | Annual revenue consistently > RM200,000-300,000 OR active paying users >2,000 | [Centry](https://www.centry.digital/blog/sdn-bhd-vs-sole-proprietorship-business-entities-in-malaysia); [Foundingbird](https://foundingbird.com/my/blog/differences-between-enterprise-and-sdn-bhd/) | Incorporate Sdn Bhd; novate Apple/Google contracts; transfer assets |
| **Sdn Bhd conversion (forced)** | Foreign co-founder or investor; or non-IAP payment processor onboarding | [Foundingbird](https://foundingbird.com/my/blog/differences-between-enterprise-and-sdn-bhd/) | Same as above |
| **MCMC ASP(C) licence** | App becomes messaging/social media AND >8 million MY users | [CMS Law-Now](https://cms-lawnow.com/en/ealerts/2025/01/new-mandatory-licensing-requirements-for-application-service-providers-in-malaysia) | Apply for ASP(C) licence; annual renewal |
| **Content Code alignment** | UGC features (recipe sharing, reviews, comments) added | [MCMC Acts](https://www.mcmc.gov.my/en/legal/acts) | Adopt Content Code-aligned moderation policy and complaints workflow |
| **CNII designation** | App becomes critical infrastructure (very unlikely for grocery tracker) | Cyber Security Act 2024 | NACSA registration; incident reporting |
| **Cross-border transfer record refresh** | Annually; or when adding a new processor/sub-processor | [JPDP CBPDT](https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2025/08/GP_CBPDT_EN-1.pdf) | Update TIA; update Record of Cross-Border Transfers |
| **PDPA penalties review** | Annual | [Sidley](https://www.sidley.com/en/insights/newsupdates/2024/08/important-changes-to-malaysias-data-protection-laws) | Reassess insurance coverage (cyber + PDPA) |

---

## Source map (quick reference)

**Primary (.gov.my and JPDP-published):**
- JPDP main: https://www.pdp.gov.my
- PDPA Amendment Act 2024 (Act A1727): https://www.pdp.gov.my/ppdpv1/en/akta/personal-data-protection-amendment-act-2024/
- JPDP Class of Data Users Order: https://www.pdp.gov.my/ppdpv1/en/akta/personal-data-protection-order-class-of-data-users/
- JPDP fee schedule: https://www.pdp.gov.my/jpdpv2/registration/fees-registration/?lang=en
- JPDP CBPDT Guideline 3/2025 PDF: https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2025/08/GP_CBPDT_EN-1.pdf
- KPDN CPA Act 599 PDF: https://www.kpdn.gov.my/images/2024/awam/akta/ttpm/Act%20599.pdf
- KPDN enforcement FAQ: https://www.kpdn.gov.my/en/faq/faq-enforcement
- MCMC main: https://www.mcmc.gov.my
- MCMC Acts: https://www.mcmc.gov.my/en/legal/acts
- MCMC Class Licence ASP/CASP page: https://www.mcmc.gov.my/en/licence-under-akm-98/licence-for-broadcasting-mobile-services-fixed-s/class-licence-nfp-nsp-asp-casp
- MCMC ASP register: https://www.mcmc.gov.my/en/legal/registers/cma-registers/register-of-class-licences-section-49-a/list-of-applications-service-providers
- LHDN: https://www.hasil.gov.my/en/
- Companies Commission of Malaysia (SSM): https://www.ssm.com.my
- Royal Malaysian Customs MySST: https://mysst.customs.gov.my

**App stores (primary developer documentation):**
- Apple Developer enrollment: https://developer.apple.com/programs/enroll/
- Apple D-U-N-S help: https://developer.apple.com/support/D-U-N-S/
- Apple banking info: https://developer.apple.com/help/app-store-connect/manage-banking-information/enter-banking-information/
- Apple tax info: https://developer.apple.com/help/app-store-connect/manage-tax-information/provide-tax-information/
- Apple age ratings: https://developer.apple.com/help/app-store-connect/reference/age-ratings-values-and-definitions/
- Google Play merchant tax: https://support.google.com/googleplay/android-developer/answer/7163598
- Google Play wire transfer: https://support.google.com/googleplay/android-developer/answer/2700656
- Google Play payments profile: https://support.google.com/googleplay/android-developer/answer/7161426

**Secondary (professional commentary, used where primary was 403 / PDF-only):**
- Mayer Brown — Key Amendments: https://www.mayerbrown.com/en/insights/publications/2025/07/from-legislative-reform-to-practical-guidance-key-amendments-to-malaysias-pdpa-and-the-launch-of-cross-border-transfer-guidelines
- DLA Piper Privacy Matters — Guidelines on DBN/DPO: https://privacymatters.dlapiper.com/2025/03/malaysia-guidelines-issued-on-data-breach-notification-and-data-protection-officer-appointment/
- Sidley — 2024 PDPA Amendments: https://www.sidley.com/en/insights/newsupdates/2024/08/important-changes-to-malaysias-data-protection-laws
- HHQ — CBPDT exceptions: https://hhq.com.my/posts/exceptions-to-conduct-cross-border-personal-data-transfer/
- HHQ — DBN compliance: https://hhq.com.my/posts/personal-data-breach-notification-in-malaysia-a-legal-guide-for-compliance/
- CMS Law-Now — Cross-Border Guidelines 2025: https://cms-lawnow.com/en/ealerts/2025/06/malaysian-guidelines-on-cross-border-data-transfers
- CMS Law-Now — ASP(C) licensing: https://cms-lawnow.com/en/ealerts/2025/01/new-mandatory-licensing-requirements-for-application-service-providers-in-malaysia
- Lexology — Registration of Data Users: https://www.lexology.com/library/detail.aspx?g=2c923985-e0d2-4bd5-8e06-ea11bd23a4c1
- Lexology — DBN Obligations: https://www.lexology.com/library/detail.aspx?g=d72dec59-374a-4a94-aa94-03f8b5a0d3be
- Lexology — Updated E-Commerce Regulations: https://www.lexology.com/library/detail.aspx?g=e9766f41-4f8a-4ce0-a523-501b29c25a3b
- Nazmi Zaini Chambers — CBPDT Guidelines explainer: https://nzchambers.com/cross-border-personal-data-transfer-guidelines-everything-you-need-to-know-2/
- ASEAN Briefing — Digital Service Tax Malaysia: https://www.aseanbriefing.com/doing-business-guide/malaysia/taxation-and-accounting/digital-service-tax-malaysia
- EY — SST expansion July 2025 / Budget 2026: https://www.ey.com/en_my/insights/tax/malaysia-budget/sst-expansion-from-1-july-2025-what-has-changed-and-what-to-expect-in-budget-2026
- PwC Malaysia — Service Tax: https://www.pwc.com/my/en/publications/mtb/service-tax.html
- ITIF — Malaysia digital tax policy: https://itif.org/publications/2025/06/09/malaysia-digital-tax-policy/
- Cleartax — Sole Proprietorship Malaysia 2026: https://www.cleartax.com/my/en/sole-proprietorship-malaysia
- Cleartax — Form B Malaysia 2026: https://www.cleartax.com/my/en/form-b-malaysia
- Cleartax — SST 2026: https://www.cleartax.com/my/en/sst-in-malaysia
- Foundingbird — Enterprise vs Sdn Bhd 2026: https://foundingbird.com/my/blog/differences-between-enterprise-and-sdn-bhd/
- Centry — Sdn Bhd vs Sole Prop: https://www.centry.digital/blog/sdn-bhd-vs-sole-proprietorship-business-entities-in-malaysia
- Corpso — Convert Enterprise to Sdn Bhd: https://www.corpso.com/how-to-convert-enterprise-to-sdn-bhd-in-malaysia/
- Multilaw Malaysia DP guide: https://multilaw.com/Multilaw/Multilaw/Data_Protection_Laws_Guide/DataProtection_Guide_Malaysia.aspx
- Securiti — Malaysia 2025 Data Protection Guidelines: https://securiti.ai/malaysia-data-protection-guidelines-dpo-appointment-and-breach-notification/
