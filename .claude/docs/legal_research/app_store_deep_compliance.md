---
title: App Store Deep Compliance — Apple + Google Play (2026)
audience: Malaysia-based sole proprietor; freemium grocery/pantry tracker
stack: FastAPI + React Native + Firestore; Apple/Google IAP
compiled: 2026-05-03
companion: ./global_app_stores_eu_us.md (basics — Privacy Labels, Data Safety, account deletion, GDPR, CCPA)
scope: deeper / less-obvious / 2025-2026 changes only — does NOT duplicate companion
next_review_due: 2026-08-01
---

# App Store Deep Compliance — Beyond the Basics

> Companion file `global_app_stores_eu_us.md` covers the 101-level requirements (Privacy Nutrition Labels, Data Safety form, account-deletion, GDPR, CCPA). This file covers the 2025–2026 deltas, the financial mechanics, and the gotchas that bite indie devs after launch.

---

## 1. Apple In-App Purchase + Anti-Steering Rules (2025–2026 state)

### 1.1 The Epic v. Apple endgame — US storefront (current as of 2026-05)

The April 30, 2025 ruling (Judge Yvonne Gonzalez Rogers) found Apple in **wilful violation** of the original 2021 anti-steering injunction. Apple had been charging a 27% commission on external-link purchases plus restricting button placement; the court called this a "gross miscalculation" and barred ALL commission on external-link purchases in the US. Apple updated the App Review Guidelines on May 1, 2025 to permit unrestricted external links, buttons, and CTAs in the US storefront ([9to5Mac, 2025-05-01](https://9to5mac.com/2025/05/01/apple-app-store-guidelines-external-links/), [Michael Tsai blog](https://mjtsai.com/blog/2025/05/02/app-review-guidelines-updated-for-epic-anti-steering/)).

**December 2025 partial reversal:** US Court of Appeals modified the injunction to let Apple charge a "reasonable commission" on external-link purchases, but did NOT specify the rate ([MacRumors, 2025-12-11](https://www.macrumors.com/2025/12/11/apple-app-store-fees-external-payment-links/)). As of 2026-05, **Apple is still charging 0% commission on external US links** while Judge Gonzalez Rogers holds hearings on what fee is permissible ([AppleInsider, 2026-04-29](https://appleinsider.com/articles/26/04/29/app-store-policy-must-change-as-epic-convinces-us-circuit-court-to-reverse-stay)). The case is heading to the Supreme Court ([AppleInsider, 2026-04-06](https://appleinsider.com/articles/26/04/06/epic-vs-apple-lawsuit-over-app-store-fees-is-moving-to-the-supreme-court-again)).

**Practical posture for an indie grocery app launching in 2026:** Use Apple IAP for the US storefront. The external-link path is a moving target, requires StoreKit External Purchase entitlement paperwork, and the eventual commission rate is unknown. For a freemium app under the Small Business Program (15%), the external path is unlikely to net out cheaper after payment processor fees (~3%) and bank fees.

### 1.2 EU Digital Markets Act — Core Technology Fee → Core Technology Commission

Apple's EU DMA compliance changed materially in 2025–2026:

- **CTF base mechanic (still in effect through 2025):** €0.50 per first annual install per year over 1M, applied to apps using Alternative Terms / alternative app stores / web distribution ([Apple CTF page](https://developer.apple.com/support/core-technology-fee/)).
- **Indie exemption (3-year on-ramp):** Developers with global revenue under €10M pay €0 CTF for 3 years from signing the Alternative Terms Addendum. Between €10M–€50M during the on-ramp, CTF is capped at €1M/year.
- **2026-01-01 transition to Core Technology Commission (CTC):** Apple announced (June 2025) it is **sunsetting CTF** and moving the EU to a single business model: a CTC on digital goods/services across App Store, web distribution, and alternative marketplaces ([RevenueCat, 2025-06](https://www.revenuecat.com/blog/growth/apple-eu-dma-update-june-2025/), [DaringFireball, 2025-06](https://daringfireball.net/2025/06/apple_app_store_policy_updates_dma)).

**Practical posture for an indie:**
- Stay on Apple's standard EU IAP. The CTF/CTC complexity only matters if you (a) cross 1M EU first-annual-installs OR (b) want to ship to alternative app stores OR (c) sell via web distribution. None of these apply to a launching freemium grocery app.
- Apple estimates **<1% of developers** pay CTF. You are not in that 1%.

### 1.3 Reader app entitlement — does grocery qualify?

**No.** The reader entitlement requires the app to provide one of: magazines, newspapers, books, audio, music, or video as the *primary* functionality ([Apple Reader Apps page](https://developer.apple.com/support/reader-apps/)). A grocery/pantry tracker is a utility — neither qualifies for the reader entitlement nor needs it. Use standard IAP.

### 1.4 In-app pricing rules — auto-renewal disclosure

App Store Connect provides templated disclosure language. The required disclosures shown on the paywall before purchase:

- Subscription title and length of subscription period (must be ≥ 7 days per Guideline 3.1.2(a))
- Price of subscription, and price per unit if applicable
- Auto-renewal language ("Payment will be charged to Apple ID at confirmation of purchase")
- Cancellation language ("Subscription automatically renews unless auto-renew is turned off at least 24-hours before the end of the current period")
- Link to Terms of Use (EULA) and Privacy Policy

These are reviewed at submission. Missing language = rejection ([Apple Subscriptions page](https://developer.apple.com/app-store/subscriptions/)).

**Free trial conventions:** Auto-renewable subscriptions may include a free trial period configured in App Store Connect. Standard pattern: 7-day or 14-day free trial, then auto-renewing monthly/yearly. Trials are NOT considered "introductory offers" — those are a separate App Store Connect concept.

**Intro offer rules:** Introductory offers (pay-as-you-go, pay-up-front, or free trial) can only be offered to **new** subscribers, not lapsed/returning customers (separate "promotional offer" mechanism for those). Each subscription group can have one intro offer per locale.

### 1.5 Apple revenue share — Small Business Program

Standard: **30%** for first year, drops to 15% after 1 year of paid subscription per user.
Small Business Program: **15% across the board** ([Apple SBP page](https://developer.apple.com/app-store/small-business-program/)).

**Eligibility (current 2026):**
- Up to **$1M USD in proceeds** in the prior calendar year, OR new to App Store
- "Proceeds" = sales net of Apple's commission and certain taxes (i.e., what hits the bank, before the 15% reduction) ([RevenueCat SBP guide](https://www.revenuecat.com/blog/engineering/small-business-program/))
- All Associated Developer Accounts (>50% ownership / decision authority) count toward the $1M ceiling collectively

**Mid-year crossing:** If you cross $1M during the calendar year, you flip back to 30% for all future transactions immediately. Re-qualify the next year if proceeds drop back below.

**Enrollment timing:** Apple grants the 15% rate **15 days after the end of the fiscal month in which Apple approves enrollment**. For a 2026 launch, enrol on Day 1 — the few days of 30% commission while approval pends are negligible vs. forgetting and paying 30% for 6 months.

**ROI for an indie:** Massive. RM 19.99/mo × 1000 subs × 12 months = RM 240K/yr. SBP saves RM 36K/yr (15 percentage points) vs standard. Enrolment is 15 minutes of paperwork.

---

## 2. Google Play Billing + Alternative Billing (2025–2026 state)

### 2.1 Play Billing Library — required version for new submissions

**Currently required (2026-05): Play Billing Library v8 or higher** for new app submissions and updates ([Android Developers — deprecation FAQ](https://developer.android.com/google/play/billing/deprecation-faq)).

Google operates a **2-year deprecation cycle**:

| PBL Version | Last date for new releases/updates | Extension deadline |
|-------------|-----------------------------------|--------------------|
| v6          | 2025-08-31 (deprecated)           | 2025-11-01 |
| v7          | **2026-08-31** | 2026-11-01 |
| v8          | 2027-08-31 | 2027-11-01 |

For a 2026-Q3+ launch, **start on PBL v8** to avoid a forced migration in 12 months. React Native libraries to look at: `react-native-iap` (community, supports PBL 8) or RevenueCat (paid SDK, abstracts both stores; reasonable for indies given the maintenance avoidance).

Rejection triggers: deprecated PBL version, missing `com.google.android.play.billingclient.version` manifest entry, or unsupported dependency in `build.gradle`.

### 2.2 User Choice Billing (UCB) — eligible markets and commission

UCB lets users pick between Google Play Billing and an alternative (e.g., Stripe-driven web checkout). Eligible markets ([Play Console Help](https://support.google.com/googleplay/android-developer/answer/13821247?hl=en)):

- **Broad program:** Australia, Brazil, Indonesia, Japan, South Africa, UK, EEA — gaming everywhere; non-gaming except in EEA
- **Separate programs:** South Korea, India, US — both gaming and non-gaming

**Commission impact:** Standard Google Play commission **minus 4 percentage points** on UCB-routed transactions. So 30% → 26%, or 15% (small business / subscription year-2) → 11%. After payment processor fees (~3%) and your engineering cost, UCB rarely wins for an indie unless you already have a payments infra.

**Recommendation:** Skip UCB at launch. Use Google Play Billing only. Revisit at $50K+/mo MRR.

### 2.3 New Google Play fee structure (rolling out 2026–2027)

Google announced a major restructure on 2026-03-06 ([Android Developers Blog](https://android-developers.googleblog.com/2026/03/a-new-era-for-choice-and-openness.html)):

| Surface | Standard recurring (subs) | Standard non-recurring | Billing fee |
|---------|----------------|----------------|-------------|
| **New installs** (after rollout) | 10% + billing fee | 20% + billing fee | 5% (US/UK/EEA) |
| **Existing installs** | 10% + billing fee | 25% + billing fee | 5% (US/UK/EEA) |

Eligible developers (Apps Experience Program / Games Level Up Program) can drop new-install non-recurring to 15%. Devs <$1M/yr qualify for **10%** across most types.

**Rollout timeline:**
- **2026-06-30:** US, UK, EEA
- **2026-09-30:** Australia
- **2026-12-31:** Japan, South Korea
- **2027-09-30:** Rest of World (incl. Malaysia)

**Practical impact for a Malaysian-based grocery app:** For users in MY, the new structure does NOT apply until 2027-09-30. Continue planning around the existing 15% Play Console subscription rate (year 2) / 30% standard until then. For US/UK/EEA users post-2026-06-30, your effective recurring-subscription rate is **10% + 5% billing fee = 15% all-in** which essentially matches the existing year-2 rate immediately. Net win for a launching app: faster path to 15%.

### 2.4 Subscription policies — recent updates (2024–2025)

- **Easy cancellation:** Required globally; users must be able to cancel from the app in 2 taps OR via Play Store Subscriptions page (Play handles this). ([About subscriptions](https://developer.android.com/google/play/billing/subscriptions))
- **Restoration:** Must be available; calling `BillingClient.queryPurchasesAsync()` on app start is the canonical implementation.
- **Notification of price increases:** See §5 below.
- **Acknowledge requirement:** Subscriptions and non-consumables must be acknowledged within 3 days of purchase via `BillingClient.acknowledgePurchase()` (or server-side equivalent), or Google auto-refunds. This is a footgun — see §4.

### 2.5 Play Pass — N/A

Play Pass is Google's content-app subscription bundle (~$5/mo for users → access to a curated catalog of premium apps and games). Eligibility is editorial and skewed toward content/games. **A grocery/pantry tracker is unlikely to be invited.** Don't plan around it.

### 2.6 Family Library — covered in §7

---

## 3. Sign in with Apple — Guideline 4.8

### 3.1 Verbatim trigger (current 2026)

> "Apps that use a third-party or social login service (such as Facebook Login, Google Sign-In, Sign in with Twitter, Sign In with LinkedIn, Login with Amazon, or WeChat Login) to set up or authenticate the user's primary account with the app must also offer as an equivalent option another login service" with these properties: (a) limits collection to name + email, (b) lets users hide email, (c) does not collect interactions for ads without consent. ([Apple Review Guideline 4.8](https://developer.apple.com/app-store/review/guidelines/))

In practice, **Sign in with Apple** is the only login service that satisfies all three. There is no equivalent compliant option from any other vendor.

### 3.2 What triggers it

Adding **any** of: Sign in with Google, Sign in with Facebook, Sign in with Microsoft, Sign in with LinkedIn, etc. as a primary-account creation path triggers the 4.8 requirement.

### 3.3 What does NOT trigger it

- Email + password (proprietary auth, no third-party social) — exempt
- Phone OTP / passkey-only — exempt
- Magic-link email — exempt
- Anonymous-only mode (no account at all) — exempt
- Education/enterprise apps using existing edu/enterprise identity — exempt
- Government / industry electronic ID — exempt
- "Sign in with [specific service]" client apps (e.g., a Slack client uses Slack login) — exempt

### 3.4 Implementation cost — React Native

`@invertase/react-native-apple-authentication` is the standard library; install + Apple Developer Console Services ID setup + Xcode capability = ~half a day for someone who's done it before, full day fresh. Backend: validate the JWT identity token Apple returns (RS256, public keys at `https://appleid.apple.com/auth/keys`). FastAPI backend can use `python-jose` or `pyjwt` with JWKS.

**2026-01-01 South Korea-specific update:** Korean-based developers must provide a server-to-server notification endpoint when registering / updating a Services ID ([Apple Developer News](https://developer.apple.com/news/?id=j9zukcr6)). Doesn't apply to a Malaysian sole prop, but worth knowing if you ever incorporate in KR.

### 3.5 Recommended posture for the grocery app

**If shipping launch v1 with email + password only:** No 4.8 obligation. Skip Sign in with Apple to ship faster.

**If shipping with Google Sign-In (common for Firestore / Firebase Auth shortcut):** Sign in with Apple is mandatory. Add it. Failing to is a common 4.8 rejection.

The cheapest path: ship v1 with email + password + email-OTP only. Add social logins (and Sign in with Apple alongside) in a v1.1 once the auth surface is stable.

---

## 4. Server-Side Receipt Validation / StoreKit 2

### 4.1 Why server-side validation is non-negotiable

If your only entitlement check is the on-device receipt, an attacker can:

1. Buy a subscription, take a screenshot of the entitlement, refund (Apple/Google issue refunds with no developer veto)
2. Use a jailbroken/rooted device to forge a purchase response
3. Family-share with disabled accounts

The cost of skipping server-side: revenue leakage from refunded but still-entitled accounts, plus zero observability into churn / fraud.

### 4.2 Apple — StoreKit 2 + App Store Server API

**The modern stack (iOS 16+, current 2026 default):**

- App emits StoreKit 2 `Transaction` objects which are **already JWS-signed** by Apple. Backend verifies the JWS using Apple's public keys (rotated periodically — fetch from `https://api.storekit.itunes.apple.com/inApps/v1/keys`).
- Backend calls the **App Store Server API** (`/inApps/v1/subscriptions/{originalTransactionId}` or `/inApps/v1/transactions/{transactionId}`) to fetch authoritative subscription state. Authentication via JWT signed with a key from App Store Connect ([Apple StoreKit validation](https://developer.apple.com/documentation/storekit/validating-receipts-with-the-app-store)).
- Subscribe to **App Store Server Notifications V2** via a webhook URL configured in App Store Connect. V2 events include `DID_RENEW`, `DID_CHANGE_RENEWAL_STATUS`, `EXPIRED`, `REFUND`, `REVOKE` — these are how you keep entitlement in sync.

**Deprecated path (still works on iOS 15 and earlier but do not implement new):** `verifyReceipt` endpoint with base64 receipt-data parsing. Apple has guided away from this since 2022.

**FastAPI implementation cost:** ~1–2 days for an experienced backend. Components:
1. JWT generator for App Store Server API (pyjwt + ES256)
2. JWS verifier for inbound Transaction / Notification payloads (cryptography library + Apple's JWKS cache)
3. Webhook endpoint at e.g. `POST /webhooks/apple` accepting V2 notifications
4. Entitlements table keyed by `originalTransactionId`

### 4.3 Google — Play Billing v8 + Real-Time Developer Notifications (RTDN)

**Server stack:**

- Client receives `Purchase` from `BillingClient`. **Must call `acknowledgePurchase` within 3 days** or Google auto-refunds (this is a footgun — many devs miss it). Server-side equivalent is `purchases.subscriptions.acknowledge` via Google Play Developer API.
- Backend validates the purchase server-side via **Google Play Developer API** (`purchases.subscriptionsv2.get` for v2 endpoint, since 2023). Auth is OAuth 2.0 via a service account ([Android Developers — RTDN reference](https://developer.android.com/google/play/billing/rtdn-reference)).
- Subscribe to **Real-Time Developer Notifications (RTDN)** via a Google Cloud Pub/Sub topic. Events: `SUBSCRIPTION_PURCHASED`, `SUBSCRIPTION_RENEWED`, `SUBSCRIPTION_CANCELED`, `SUBSCRIPTION_EXPIRED`, `SUBSCRIPTION_RECOVERED`, etc. Pub/Sub push subscription delivers to your FastAPI webhook ([Android Developers — Purchase lifecycle](https://developer.android.com/google/play/billing/lifecycle)).

**FastAPI implementation cost:** ~1–2 days. Components:
1. Service account JSON + OAuth 2.0 token cache
2. Pub/Sub push subscription with auth header verification (Google signs the JWT in the `Authorization` header)
3. Webhook endpoint at e.g. `POST /webhooks/google` decoding the base64 RTDN payload
4. Same entitlements table keyed by `purchaseToken` / `originalPurchaseToken`

### 4.4 What happens if you skip server validation

- Apple/Google still process the payment fine — you still get paid
- BUT: refunds, cancellations, family-sharing-revocations, and grace-period entitlements are invisible to your backend → **users keep premium features after refunding**
- Plus: chargeback reporting and revenue analytics are unreliable
- Apple's 5.1.1(v) account-deletion review can fail if your server entitlement state contradicts Apple's

### 4.5 Recommended for grocery app launch

Build server-side validation in v1. Don't ship v1 without it. Use RevenueCat if backend bandwidth is the constraint — it abstracts both stores' webhook + validation logic at $0/mo for the first $10K MTR (monthly tracked revenue). Self-host once you cross that, OR keep paying RevenueCat (1% past the threshold) — typically cheaper than maintaining the integration internally for an indie.

---

## 5. Subscription Price Increase Rules

### 5.1 Apple — the 50% / $5 rule (introduced 2022, still current 2026)

A price increase **does not require user opt-in** if ALL of the following hold ([Apple Developer News, 2022-05](https://developer.apple.com/news/?id=tpgp89cl), [App Store Connect — price thresholds](https://developer.apple.com/help/app-store-connect/reference/auto-renewable-subscription-price-increase-thresholds/)):

- Increase ≤ $5 USD AND ≤ 50% of current price (monthly subs), OR
- Increase ≤ $50 USD AND ≤ 50% of current price (annual subs)
- Happens at most once per 365 days
- Permitted by local law

If the increase exceeds either threshold, **users must actively consent** before next renewal — failing to consent stops the renewal entirely (the subscription expires).

**Country-specific thresholds in MY context:** Apple uses local-currency thresholds. For Malaysia, treat the USD/RM mapping per the App Store Connect threshold table at the time of the change. Some EU countries (Germany, Austria, Poland) require consent for ANY increase regardless of size — DACH-region launches need extra care.

**Notification timing:** Apple notifies users 30 days before a yearly renewal at the new price, 7 days before a monthly. Channels: email, push, in-app App Store badge.

**Practical for grocery app:** For a launch price of RM 9.99/mo, a +50% raise = RM 14.99/mo. Below the $5/50% absolute and percentage limits → no opt-in needed. A jump to RM 19.99/mo (+100%) WOULD require opt-in. Plan price tiers accordingly.

### 5.2 Google Play — material price increase rules

Google's policy ([Play Console help](https://support.google.com/googleplay/android-developer/answer/140504)):

- Material price increase: > 0% — Google gives users 30 days notice via in-app messaging + email
- Opt-in required for "non-trivial" increases — Google determines threshold per market (less explicit than Apple's)
- Cancellation must remain easy throughout

Practical: Google's approach is more lenient than Apple's on opt-in but the user-notification SLA is similar. Engineer your backend to receive the `SUBSCRIPTION_PRICE_CHANGE_CONFIRMED` RTDN event.

### 5.3 Best practice for both stores

Before raising prices:
1. Communicate via in-app banner 45+ days ahead (more than Apple/Google's minimum)
2. Offer existing subscribers a 1-year price-lock at old rate as a goodwill gesture (reduces churn ~30%)
3. Watch your 30-day churn for 90 days post-change; if it spikes >2x baseline, the increase was too aggressive

---

## 6. App Tracking Transparency (ATT) — when does it apply?

### 6.1 Trigger conditions (current 2026)

ATT prompt is required when your app:
- Accesses IDFA (`AdSupport.framework` → `ASIdentifierManager.advertisingIdentifier`)
- Shares user data with third parties for cross-app or cross-website **tracking** (Apple's specific definition: linking user/device data collected from your app with user/device data from other companies' apps/sites for targeted ads OR sharing with data brokers) ([Apple — User Privacy and Data Use](https://developer.apple.com/app-store/user-privacy-and-data-use/))

### 6.2 What does NOT trigger ATT

- First-party analytics that doesn't involve IDFA (Firebase Analytics with default settings, when you don't link AdSupport.framework)
- Crash reporting (Sentry, Firebase Crashlytics)
- Server-side analytics (your own backend logging)
- Aggregated/anonymized analytics that aren't linked to a user identifier

**Firebase Analytics nuance:** Firebase Analytics by default does NOT access IDFA. It DOES integrate with Google Ads / Google Marketing Platform — if you enable that integration, IDFA access lights up and ATT is required. For a launching freemium grocery app with no advertising:

- Use Firebase Analytics (or skip analytics entirely)
- Do NOT link `AdSupport.framework`
- In `Info.plist`, do NOT add `NSUserTrackingUsageDescription`
- ATT prompt: not needed; users see no IDFA dialog

### 6.3 If you add ads or tracking later

Then you must:
1. Add `NSUserTrackingUsageDescription` to `Info.plist`
2. Call `ATTrackingManager.requestTrackingAuthorization` BEFORE using any tracking SDK
3. Update Privacy Nutrition Labels in App Store Connect to declare tracking
4. If sharing with data brokers, label "Data Used to Track You"

### 6.4 iOS 17 / iOS 18 changes

No major ATT framework changes in iOS 17 or 18. The 2025 evolution: Apple started emphasizing **specific** disclosure ("Share with Meta for advertising" rather than "tracking for ads") in App Privacy reports. Generic tracking copy is increasingly flagged in review.

### 6.5 Recommended for the grocery app

**Launch with no tracking SDKs. No ATT prompt. No IDFA access.** This is the cleanest privacy posture and the fastest review. Add Firebase Analytics (no IDFA) for product analytics; add tracking only when you have a concrete advertising spend.

---

## 7. Family Sharing for Subscriptions

### 7.1 Apple Family Sharing

- Configured per-product in App Store Connect → enabled section appears for each auto-renewable subscription and non-consumable IAP ([Apple — Turn on Family Sharing](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/turn-on-family-sharing-for-in-app-purchases/))
- Once enabled, NEW subscribers default to share with up to 5 family members. Existing subscribers must opt in via Manage Subscriptions
- **Once enabled, cannot be disabled** — one-way switch
- 2026 update: iOS 26.4 removed the requirement for family members to share a payment method ([MacRumors, 2026-03-18](https://www.macrumors.com/2026/03/18/ios-26-4-purchase-sharing-change/)). This expands the practical user base.

### 7.2 Google Family Library

- Configured per-product in Play Console
- Up to 5 family members + organizer (6 total) can share entitlements
- Same one-way principle as Apple in spirit, but Google's "shared subscription" mechanic is a Play Console setting

### 7.3 Trade-off for an indie

Naive math: 6× sharing = 1/6 the revenue. **Reality is far more nuanced:**

- The 5 secondary members typically would NOT have purchased independently. They convert because the primary did. So you're not losing 5 sales — you're gaining family-fit perceived value.
- Family Sharing **lifts conversion rate** of the primary subscriber (~10–25% higher trial-to-paid conversion in observed data, anecdotal)
- Pantry / grocery is highly family-shareable: the household pantry is a household concern. This is one of the highest-value categories for Family Sharing.

**Recommended:** Enable Family Sharing on Apple and Google from launch. The conversion lift is worth more than the theoretical share dilution for a household-pantry use case.

---

## 8. App Rating / Review Prompts

### 8.1 Apple — `SKStoreReviewController.requestReview()`

- Hard cap: 3 prompts per user per 365 days
- Apple decides whether to actually show the prompt (rate-limited, can be suppressed)
- You CANNOT detect if it was shown
- TestFlight builds: prompt never appears
- Dev/sim builds: always appears
- App Store builds: rate-limited

**Rule:** You CANNOT use a custom UI that links out to the App Store rating page if the user opts in. Apple Guideline 1.1.7 + 5.6.1 prohibit gating reviews behind custom interstitials.

### 8.2 Google — `ReviewManager` In-App Review API

- Similar opacity: Google decides display frequency; quota not publicly stated but in practice ~1–3/year
- Same prohibition on FakeRating policy violations (any UI suggesting "rate 5 stars" before showing the prompt = takedown-worthy)

### 8.3 Best-practice trigger timing for a grocery app

- **DON'T trigger:** on first launch, after errors, mid-task, on app resume from background
- **DO trigger:** after a clearly positive interaction:
  - User completes their first 25 pantry items added
  - User completes their first shopping trip checklist with all items
  - User has used the app on 5+ distinct days AND has 50+ tracked items
  - After they've successfully redeemed a feature gated by premium (the "value reveal" moment)
- Wait at least 14 days after install before any prompt
- Do not prompt within 30 days of a previous attempt

### 8.4 Library

`react-native-rate` is a standard wrapper. iOS calls `SKStoreReviewController`, Android calls `ReviewManager`. Single API → both stores.

---

## 9. Geographic Availability Matrix

### 9.1 Strategic question

App Store Connect availability = 175 countries; Play Console = 150+ countries. You toggle a checkbox per country.

### 9.2 Day-1 global vs. phased

**Day-1 global pros:**
- App Store SEO benefits from global availability (some search rankings consider availability breadth)
- Easier to get featured in non-tier-1 markets where competition is thinner
- Future expansion is friction-free

**Day-1 global cons:**
- Customer support burden (queries from any timezone, any language)
- Privacy-policy must cover all jurisdictions you ship to (GDPR, CCPA, LGPD, India DPDP, Korea PIPA, Singapore PDPA, etc.)
- Currency / locale mismatch — your subscription pricing tiers may not be optimal in all markets
- Indonesia: requires PSE registration if you have "significant" Indonesian users — see legal_launch_research.md

### 9.3 Recommended for MY-based grocery app

**Posture:** Ship to the 11 ASEAN+ANZ countries on day 1, plus EN-speaking Tier 1 (US, UK, CA, AU, NZ, IE). Hold EU back until you've finalized GDPR Art. 27 representative + KR/JP back until you've localized.

Specifically:
- ASEAN: MY, SG, ID, TH, PH, VN
- ANZ: AU, NZ
- Tier 1 EN: US, UK, CA, IE
- Hold: full EU (until Art. 27), KR, JP, CN

The toggle is reversible cheaply.

---

## 10. Vendor Contracts — Key Clauses

### 10.1 Apple Developer Program License Agreement (PLA)

Top 5 clauses an indie should read ([Apple PLA](https://developer.apple.com/support/terms/apple-developer-program-license-agreement/)):

1. **§3.2 — License grant scope:** Apple licenses you to develop on Apple platforms; you do NOT license Apple's IP. If you submit feedback, Apple owns it.
2. **§7.x — Termination:** Apple can terminate the agreement and revoke your distribution certificate "at any time, with or without cause." Your apps disappear from the store immediately. There is no cure period.
3. **§10.x — Indemnification:** You indemnify Apple for IP infringement, regulatory issues, and user data claims arising from your app.
4. **§3.3.x — App restrictions:** Many specific technical / behavioral restrictions; the most-violated ones for indies are private API usage and undisclosed background activity.
5. **Schedule 1 (Free Apps) and Schedule 2 (Paid Apps):** Two separate addenda you accept in App Store Connect. Schedule 2 contains the commission terms.

**2026 updates (March 30, 2026):** PLA revised for new framework specifications and data privacy requirements ([Apple Developer News](https://developer.apple.com/news/?id=fwswmjcn)).

### 10.2 Apple Paid Apps Schedule 2

Top 5 clauses:

1. **Commission rate:** 30% standard / 15% under SBP / 15% on subs after year 1 / 0% on free apps
2. **Payout currency / region:** Apple defaults to your bank's local currency for direct deposit
3. **Minimum payout threshold:** **USD 40** for most countries/currencies (contrary to legacy "$150" rumor — this changed years ago) ([App Store Connect — minimum payment threshold](https://developer.apple.com/help/app-store-connect/reference/reporting/minimum-payment-threshold/))
4. **Payment cadence:** ~33 days after fiscal-month close
5. **Tax forms:** W-8BEN (individual) / W-8BEN-E (entity) for non-US developers. **Apple does not withhold US tax on App Store sales by non-US developers** under the current model; for MY-based sole prop the form is filed once and re-affirmed every 3 years. **Note: 2026-04 update — Apple Distribution International Limited's exporter status was discontinued; sales from EU-Ireland are now subject to Irish VAT** ([Apple App Store Connect tax info](https://developer.apple.com/help/app-store-connect/manage-tax-information/provide-tax-information/))

### 10.3 Google Play Developer Distribution Agreement (DDA)

Top 5 clauses ([Google Play DDA](https://play.google/developer-distribution-agreement.html)):

1. **§4 — Pricing & payments:** Google's standard 15%/30% breakdown, with the new 2026-2027 structure phasing in (see §2.3)
2. **§7 — Prohibited activities:** Sets the floor for app behavior; the most-violated for indies is user data without proper privacy policy
3. **§9 — Indemnification:** You indemnify Google for IP claims, tax claims, data privacy claims arising from your app
4. **§10 — Termination:** Google can terminate "for any breach by you" with notice. Less aggressive than Apple's "with or without cause" but still pretty broad
5. **§14 — Governing law:** California law / Santa Clara County jurisdiction unless you're an EEA developer (then local)

**AI training note:** As of 2026-05, Google's DDA does NOT contain explicit AI-training-data clauses. Some independent commentary references AI-training restrictions — these have not landed in the DDA itself yet but may by year-end. Search for "AI", "training", "machine learning" terms when re-reviewing in Q4 2026.

### 10.4 Firebase / Google Cloud DPA

Top 5 clauses ([Firebase Terms](https://firebase.google.com/terms)):

1. **Subprocessor list:** Available at `https://firebase.google.com/terms/subprocessors`. Includes Google LLC entities globally + several regional entities. **Subscribe to update notifications** — new subprocessors require 30 days notice
2. **Data residency:** Firestore allows region selection at project creation (cannot be changed after). For an MY-based app servicing ASEAN: pick `asia-southeast1` (Singapore) or `asia-southeast2` (Jakarta — closer for Indonesian users but newer/less-mature). Cloud Functions and other services have separate region selectors.
3. **EU SCCs:** Firebase incorporates the 2021 EU SCCs (Module 2 Controller-to-Processor and Module 3 Processor-to-Processor) ([Firebase SCC C2P](https://firebase.google.com/terms/firebase-sccs-eu-c2p))
4. **Breach notification SLA:** Google notifies "without undue delay" — typically <72 hours, aligning with GDPR Art. 33
5. **Termination assistance:** 30-day post-termination data retrieval window before deletion

---

## 11. Notarization / Signing

### 11.1 iOS

- Apps signed with Apple Distribution certificate via App Store Connect upload (Xcode handles this)
- **No notarization for App Store distribution.** Notarization is for Mac apps distributed outside the Mac App Store (N/A here)
- Provisioning profile (created in Apple Developer Console) ties bundle ID + cert + capabilities. Renew yearly
- Lost cert: revoke + re-issue from App Store Connect. Existing builds in distribution unaffected (Apple re-signs at distribution)

### 11.2 Android

Two-key model under **Google Play App Signing** (mandatory for new apps since 2021):

- **Upload key:** YOU hold this. Used to sign the AAB you upload to Play Console
- **App signing key:** GOOGLE holds this. Google signs the final APK delivered to user devices. Critically, this is what end-user devices verify; you cannot lose this

**If you lose the upload key:**
- Generate new keystore
- Generate `upload_certificate.pem`
- Play Console → Setup → App integrity → Request upload key reset
- Upload the new cert; Google approves within ~48 hours
- Future uploads use the new key; the master signing key (held by Google) is unchanged so user devices accept updates seamlessly ([Use Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756?hl=en))

**Best practice:**
- Store upload keystore + password in two places (1Password / Bitwarden + offline encrypted backup)
- Document the alias and password somewhere recoverable
- Print a hard-copy keystore backup, keep it in a safe (yes, paper)

---

## 12. Editorial / Featuring Eligibility

### 12.1 Apple Today tab + Editorial Picks

**How to pitch:** Apple's Featuring Nominations form in App Store Connect → Marketing → Featuring Nominations ([Apple — Getting Featured](https://developer.apple.com/app-store/getting-featured/)).

**Lead time:** 2 weeks minimum, 3 months recommended.

**Criteria:**
- User experience — cohesive, valuable, helpful
- UI design — polished, intuitive, beautiful
- Innovation — solving a real problem in a fresh way
- Localization — multi-language support is a plus
- Accessibility — VoiceOver, Dynamic Type
- Compelling App Store product page — screenshots, previews, copy

**For a grocery/pantry app:**
- Strong angle: "smart pantry tracker that learns family routines" — innovation + everyday utility
- Pitch tied to launch: ramadan / chinese new year / christmas holiday food planning
- ASEAN-region pitch tied to local angle (halal pantry, traditional ingredients)
- Highlight the household-collaboration mechanic

### 12.2 Google Play Editor's Choice

**How to pitch:** No formal submission. Google's editorial team scouts apps from Play Console signals — high quality scores, high ratings, low crash rates, polished store listing.

**Criteria** ([Google Play blog](https://blog.google/products-and-platforms/platforms/google-play/find-great-apps-and-games-google-play-editors-choice-update/)):
- Design quality
- Functionality
- Overall UX
- Appeal to broad user base
- Long-term popularity (means you can't pitch on day-1; need traction first)
- Innovative use of Android features (widgets, complications, background sync APIs)

**Practical:** Google Play Editor's Choice is a 6-12 month outcome, not a launch outcome. Focus on quality metrics (Play Console "App Quality" page) and let it accrue.

### 12.3 Indie value of featuring

For an indie sole prop, featuring is the cheapest UA (user acquisition) channel by 1-2 orders of magnitude:

- Apple "App of the Day" → 100K-500K downloads in 24h for a niche utility
- Google Editor's Choice badge → ~30% lift in organic search ranking persistently
- App Store stories on Today tab → 50K-200K downloads in the story-display window

For comparison, paid UA on Meta/TikTok runs $2-8 CPI for utility apps in MY — featuring is effectively free.

**Maximize the chance:**
- Polish the App Store / Play Store listing (best 30 minutes of time you can spend — see App Store Optimization)
- Submit Featuring Nominations every meaningful launch / update
- Localize listing assets to top 5 markets
- Respond to every review (esp. critical ones) — Apple/Google editorial teams check this

---

## Critical-Path Actions Before Launch

Ordered by deadline pressure / cost-of-delay:

1. **Register Apple Developer Program ($99/yr)** and Google Play Console ($25 one-time) under your sole-prop name. Allow 24-48h for Apple identity verification.
2. **File W-8BEN with Apple** (you, as an individual MY tax resident; not a Sdn Bhd) in App Store Connect. Without it, Apple withholds 30% on US sales of paid apps.
3. **Enroll in Apple Small Business Program** Day 1. Files take 5-10 business days to approve. The 15-day-after-fiscal-month effective date math means register ASAP to capture the 15% rate from your first transactions.
4. **Configure server-side IAP validation** before submitting v1 to either store. StoreKit 2 + App Store Server Notifications V2 webhook for Apple; Google Play Developer API + RTDN Pub/Sub subscription for Google. ~1-2 days backend; or use RevenueCat as shortcut.
5. **Acknowledge purchases within 3 days.** Wire the `acknowledgePurchase` call in your Android client OR server-side via `purchases.subscriptions.acknowledge`. Same applies to Apple's `Transaction.finish()`. Skipping = auto-refund.
6. **Generate Android upload keystore + back it up in 2 places.** Lost upload keys are recoverable via Play App Signing reset, but the recovery is 48-hour blocked critical-path during which you can't ship.
7. **Privacy Policy + Terms of Service published at stable URLs** before either store submission. App Store Connect and Play Console require URLs. Use `https://yourdomain.com/privacy` and `https://yourdomain.com/terms` — not Notion / Google Docs links (often get review-flagged for instability).
8. **Implement account deletion in-app** (Apple Guideline 5.1.1(v) — covered in companion file but worth re-emphasizing as a P0 launch gate).
9. **Decide on Sign in with Apple posture.** If launching with email + password only, skip. If launching with Google Sign-In, MUST add Sign in with Apple alongside.
10. **Submit Featuring Nominations** in App Store Connect 2-3 weeks before launch with a clear narrative.

---

## Watch List — Items That Change with Growth

Track these and revisit when triggered:

- **Apple Small Business Program $1M proceeds threshold** — you exit to 30% the moment you cross $1M proceeds in a calendar year (across all Associated Developer Accounts). Add a metric to your revenue dashboard at $750K YTD.
- **Apple EU CTC threshold (€10M revenue)** — switches from free CTF to capped €1M/yr CTC if you cross €10M. Distant for an indie launch but matters at scale.
- **Apple EU first-annual-installs (1M)** — only relevant if you opt into Alternative Terms Addendum or web distribution. If you stay on standard EU IAP, no CTF/CTC ever.
- **Google Play 2026-2027 fee restructure rollout to Malaysia (2027-09-30)** — when MY users move to the new structure, your subscription rate may improve to 10% + 5% billing fee = 15% instead of waiting for year-2 anniversary on each subscription.
- **PBL v8 deprecation (2027-08-31)** — start migrating to PBL v9 around 2027-Q1.
- **ATT trigger** — re-audit if you ever add: (a) Firebase Ads / AdMob, (b) any third-party tracking SDK (Branch, AppsFlyer, Adjust, Mixpanel with cross-app tracking enabled), (c) data-broker integration. Each of these flips ATT from "not required" to "required" and triggers Privacy Nutrition Label updates.
- **Sign in with Apple trigger** — re-audit when adding any third-party social login.
- **Family Sharing** — if you decide post-launch to disable, you cannot. Decide once, deliberately, before turning on.
- **Google Play Developer DDA** — re-read each Q4 for AI-training and indemnification updates. Google has telegraphed AI-training-data changes coming.
- **EU-Ireland VAT update (2026-04)** — if you sell in the EU, your tax statements changed in April 2026. Re-verify with your accountant after the first EU payout cycle.

---

## 2026-Specific Surprises (Material Divergences from Pre-2025 Knowledge)

These are the rule changes that materially differ from training-data-cutoff knowledge:

### Surprise 1: US external-link commission is currently 0%, not 27%

The April 2025 ruling barred Apple's 27% external-link "workaround" commission. As of 2026-05, **0% commission applies on US external purchases** while Judge Gonzalez Rogers determines what's "reasonable." The December 2025 partial reversal restored Apple's right to charge SOMETHING on external links but did not specify a number — this is in active appellate litigation, heading to the US Supreme Court ([AppleInsider, 2026-04-06](https://appleinsider.com/articles/26/04/06/epic-vs-apple-lawsuit-over-app-store-fees-is-moving-to-the-supreme-court-again)). Plan for IAP-only at launch; the external-link option will solidify later.

### Surprise 2: Apple's EU CTF is being sunset (replaced by CTC) on 2026-01-01

Apple announced (June 2025) the unification of EU business models. CTF (per-install fee) is transitioning to CTC (commission on digital goods). For an indie not opting into Alternative Terms, neither matters. But the policy landscape is still settling — review Apple's EU page in Q3 2026 ([RevenueCat, 2025-06](https://www.revenuecat.com/blog/growth/apple-eu-dma-update-june-2025/)).

### Surprise 3: Google Play's fee structure is changing materially in 2026–2027

The 2026-03-06 announcement restructures the Play commission ([Android Developers Blog, 2026-03](https://android-developers.googleblog.com/2026/03/a-new-era-for-choice-and-openness.html)):
- New installs: 20% + 5% billing fee (non-recurring) / 10% + 5% billing fee (recurring)
- Devs <$1M/yr: 10% across most types
- Phased rollout: US/UK/EEA 2026-06-30 → AU 2026-09-30 → JP/KR 2026-12-31 → ROW (incl. MY) **2027-09-30**

For an MY-launch this means: existing 15% subscription rate (post year-1) holds in MY through 2027-09-30, then becomes ~15% all-in (10% commission + 5% billing fee). For US/UK/EEA users, the new lower rate kicks in on 2026-06-30.

### Surprise 4: PBL v8 is the current required version; v6 is deprecated

If you generate React Native / Flutter scaffolding from older templates, you may end up on PBL v6 or v7. v6 is hard-deprecated (rejected at submission since 2025-11-01); v7 is being deprecated 2026-08-31. Start on **v8** for any 2026-Q3+ launch.

### Surprise 5: Apple Family Sharing no longer requires shared payment method (iOS 26.4)

Released 2026-03 ([MacRumors, 2026-03-18](https://www.macrumors.com/2026/03/18/ios-26-4-purchase-sharing-change/)), this is a significant UX improvement that grows the practical population of users who can use Family Sharing for your subscriptions. It strengthens the case for enabling Family Sharing on day 1 for a household-pantry use case.

### Surprise 6: Apple Sign in with Apple now has KR-specific server-to-server requirement

From 2026-01-01, KR-based developers must register a server-to-server notification endpoint when registering/updating Services IDs ([Apple Developer News](https://developer.apple.com/news/?id=j9zukcr6)). Doesn't apply to a Malaysian sole prop, but if you incorporate in KR later, this is a new requirement.

### Surprise 7: Apple PLA was revised 2026-03-30

The Developer Program License Agreement was updated for new framework specifications and data privacy requirements ([Apple Developer News](https://developer.apple.com/news/?id=fwswmjcn)). You must re-accept in App Store Connect at next login for new builds to ship. Allocate 30 minutes to read the diff vs. the prior version (or use a third-party diff service).

### Surprise 8: Apple Distribution International Limited's Irish exporter status ended (2026-04)

EU-Ireland VAT now applies on EU sales; Apple's pass-through tax model changed. If you have EU users this affects your monthly statements. Verify with your accountant after the first post-April 2026 payout cycle ([Apple App Store Connect tax info](https://developer.apple.com/help/app-store-connect/manage-tax-information/provide-tax-information/)).

### Surprise 9: Apple's minimum payout threshold dropped (or was already much lower than commonly cited)

The widely-cited "$150 USD minimum payout" is outdated. Current default is **$40 USD** for most countries/currencies ([App Store Connect — minimum payout threshold](https://developer.apple.com/help/app-store-connect/reference/reporting/minimum-payment-threshold/)). For an indie in early launch, this matters: you'll receive your first Apple payout much earlier than legacy guidance suggests.

---

## Sources

Primary citations referenced inline. Core URLs:

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple Core Technology Fee](https://developer.apple.com/support/core-technology-fee/)
- [Apple Small Business Program](https://developer.apple.com/app-store/small-business-program/)
- [Apple Reader Apps](https://developer.apple.com/support/reader-apps/)
- [Apple Subscription Price Increase Thresholds](https://developer.apple.com/help/app-store-connect/reference/auto-renewable-subscription-price-increase-thresholds/)
- [Apple Developer Program License Agreement](https://developer.apple.com/support/terms/apple-developer-program-license-agreement/)
- [Apple App Store Server API / StoreKit 2](https://developer.apple.com/documentation/storekit/validating-receipts-with-the-app-store)
- [Apple Family Sharing for IAP](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/turn-on-family-sharing-for-in-app-purchases/)
- [Apple Featuring Nominations](https://developer.apple.com/app-store/getting-featured/)
- [Apple Minimum Payment Threshold](https://developer.apple.com/help/app-store-connect/reference/reporting/minimum-payment-threshold/)
- [Apple Sign in with Apple Korea update](https://developer.apple.com/news/?id=j9zukcr6)
- [Google Play Billing Library deprecation](https://developer.android.com/google/play/billing/deprecation-faq)
- [Google Play Real-Time Developer Notifications](https://developer.android.com/google/play/billing/rtdn-reference)
- [Google Play User Choice Billing](https://support.google.com/googleplay/android-developer/answer/13821247?hl=en)
- [Google Play 2026-2027 Lower Service Fees](https://support.google.com/googleplay/android-developer/answer/16954621?hl=en)
- [Google Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756?hl=en)
- [Google Play Developer Distribution Agreement](https://play.google/developer-distribution-agreement.html)
- [Firebase EU SCC Module 2](https://firebase.google.com/terms/firebase-sccs-eu-c2p)
- [Firebase EU SCC Module 3](https://firebase.google.com/terms/firebase-sccs-eu-p2p)
- Epic v Apple coverage: [9to5Mac 2025-05-01](https://9to5mac.com/2025/05/01/apple-app-store-guidelines-external-links/), [MacRumors 2025-12-11](https://www.macrumors.com/2025/12/11/apple-app-store-fees-external-payment-links/), [AppleInsider 2026-04-06](https://appleinsider.com/articles/26/04/06/epic-vs-apple-lawsuit-over-app-store-fees-is-moving-to-the-supreme-court-again)
- [DaringFireball — DMA June 2025](https://daringfireball.net/2025/06/apple_app_store_policy_updates_dma)
- [RevenueCat — Apple SBP guide](https://www.revenuecat.com/blog/engineering/small-business-program/)
- [Android Developers Blog 2026-03 — A new era for choice and openness](https://android-developers.googleblog.com/2026/03/a-new-era-for-choice-and-openness.html)
- [MacRumors 2026-03-18 — iOS 26.4 Family Sharing payment change](https://www.macrumors.com/2026/03/18/ios-26-4-purchase-sharing-change/)
