# Global App-Store, EU, and US Compliance Reference — GroceryApp

**Compiled:** 2026-05-03
**Subject:** Malaysia-based sole proprietor launching a freemium grocery / pantry tracker on Apple App Store + Google Play, global storefronts.
**Stack:** FastAPI backend + React Native client + Firestore (Google Cloud, default region US unless reconfigured).
**Sensitive surfaces:** email/password accounts, camera (barcode), location, paid IAP subscriptions.

> All citations are **inline as URLs** because Apple/Google quietly republish the same canonical pages. If a URL stops resolving, search the page title — Apple in particular keeps the URL stable but rewrites content quarterly.
> Nothing here is legal advice; for a launching sole prop, the cheap-but-defensible posture is: pick reasonable defaults from this doc, then have a Malaysian lawyer who knows tech contracts spend ~2 hours sanity-checking the privacy policy and ToS before launch.

> **See also (added 2026-05-03):** [`app_store_deep_compliance.md`](app_store_deep_compliance.md) covers gaps not in this file — Apple Small Business Program (15% commission Day-1 enrollment), server-side IAP validation (StoreKit 2 + Play Developer API + RTDN), Android `BillingClient.acknowledgePurchase` 3-day footgun, Play Billing Library v8 deprecation timeline (v7 retires 31 Aug 2026 alongside target API 36), Apple Sign-In Guideline 4.8 trigger conditions, iOS 26.4 Family Sharing changes (March 2026 removed shared-payment-method requirement), Apple's reduced minimum payout ($40 USD, was $150), Apple Distribution International Ireland exporter status ending 2026-04 (EU VAT now applies), Epic v Apple US ruling April 2025 (external-link commission currently 0%, case heading to Supreme Court). Apple/Google policies drift quarterly — re-verify both files before launch.

---

## 1. Apple App Store Review Guidelines (current April 2026 wording)

Canonical source: <https://developer.apple.com/app-store/review/guidelines/>. The guidelines are versioned only by date stamp on that page; Apple notifies via <https://developer.apple.com/news/> whenever a section changes.

### 1.1 § 3.1.1 — In-App Purchase

Direct quote (verbatim from the live guidelines page, fetched 2026-05-03):

> "If you want to unlock features or functionality within your app, (by way of example: subscriptions, in-game currencies, game levels, access to premium content, or unlocking a full version), you must use in-app purchase. Apps may not use their own mechanisms to unlock content or functionality, such as license keys, augmented reality markers, QR codes, cryptocurrencies and cryptocurrency wallets, etc."
> — <https://developer.apple.com/app-store/review/guidelines/#in-app-purchase>

Implications for a freemium grocery tracker:

- Subscription unlock of premium features (unlimited household members, OCR receipts, multi-store price tracking, etc.) **must** route through StoreKit IAP. Stripe / direct credit cards inside the iOS app = automatic rejection.
- **Restoration is mandatory.** "you should make sure you have a restore mechanism for any restorable in-app purchases" — the React Native client must expose a "Restore Purchases" button, typically wired through `react-native-iap`'s `getAvailablePurchases()` / `finishTransactionIOS()`.
- A Price-Tier-0 "XX-day Trial" Non-Consumable IAP is permitted, but Apple explicitly says "Prior to the start of the trial, your app must clearly identify its duration, the content or services that will no longer be accessible when the trial ends, and any downstream charges the user would need to pay for full functionality." For a SaaS-style auto-renewable trial, prefer Apple's built-in introductory-offer mechanism (set in App Store Connect → Subscriptions) over a Price-Tier-0 Non-Consumable.
- The May 2025 Epic-related update affects the **US storefront only**: external links to web checkout are now permitted there, with anti-steering language relaxed. For Malaysia/global storefronts the rule is unchanged — **IAP is mandatory**. Source: <https://developer.apple.com/news/?id=dovxb62h>, summarised at <https://appleinsider.com/articles/25/05/02/apples-app-store-guidelines-updated-to-reflect-court-order-over-external-purchases>.

### 1.2 § 3.1.2 — Subscriptions

Verbatim from the live page:

> "If you offer an auto-renewable subscription, you must provide ongoing value to the customer, and the subscription period must last at least seven days and be available across all of the user's devices."
> — <https://developer.apple.com/app-store/review/guidelines/#subscriptions>

Concrete rules (paraphrased from § 3.1.2(a)–(c) <https://developer.apple.com/app-store/review/guidelines/#subscriptions>):

| Rule | What this means for GroceryApp |
|---|---|
| Min period **7 days** | Don't ship a "3-day premium" SKU. Smallest sane SKU is weekly. |
| **Cross-device** | The same purchase must unlock on iPad, on the user's other iPhones (same Apple ID). Use `Transaction.currentEntitlements` (StoreKit 2) or server-side receipt validation. |
| **No "post on social to unlock"** | Free-to-paid conversion can't depend on the user doing extra friction tasks. |
| **Must not strip prior paid features** | If you ever convert a one-time-paid feature to subscription-gated, grandfather existing buyers. Not relevant pre-launch but worth pinning. |
| **Free trial allowed** via App Store Connect | Use Apple's introductory-offer flow rather than rolling your own. |
| **"Subscription Information" disclosure (3.1.2(c))** | Before the purchase sheet appears, you must clearly tell the user what they get (number of features, storage, content, etc.) AND meet the disclosure language in [Schedule 2 of the Developer Program License Agreement](https://developer.apple.com/support/terms/apple-developer-program-license-agreement/). |

#### Required pre-purchase disclosure language (Schedule 2 boilerplate)

For each auto-renewable subscription, the paywall screen MUST display, in plain text the user can read before tapping "Subscribe":

1. Title of the subscription (e.g. "GroceryApp Premium").
2. Length of subscription (e.g. "1 month" / "1 year").
3. Price per period.
4. **"Payment will be charged to your Apple ID account at confirmation of purchase."**
5. **"Subscription automatically renews unless it is canceled at least 24 hours before the end of the current period."**
6. **"Your account will be charged for renewal within 24 hours prior to the end of the current period."**
7. **"You can manage and cancel your subscriptions by going to your account settings on the App Store after purchase."**
8. Functional links to your **Terms of Use** and **Privacy Policy** on the same screen.

Apple rejects roughly 1 in 4 first submissions for missing #4–#8 verbatim — see common rejection lists at <https://nextnative.dev/blog/app-store-review-guidelines>.

### 1.3 § 3.2.2 — Unacceptable Business Models

Source: <https://developer.apple.com/app-store/review/guidelines/#unacceptable>. None of (i)–(x) are practical risks for a grocery tracker. The only one to keep in mind:

- **3.2.2(x)** — "Apps must not force users to rate the app, review the app, download other apps, or other store-related actions in order to access functionality, content, or use of the app." → If you add a "rate us" prompt, it must be skippable and must not gate any feature. Use `SKStoreReviewController` (max 3 prompts/year, system-throttled) — not a custom modal.

### 1.4 § 5.1 / 5.1.1 — Privacy

Source: <https://developer.apple.com/app-store/review/guidelines/#privacy>.

Verbatim (5.1.1(i)):

> "All apps must include a link to their privacy policy in the App Store Connect metadata field and within the app in an easily accessible manner. The privacy policy must clearly and explicitly: Identify what data, if any, the app/service collects, how it collects that data, and all uses of that data. Confirm that any third party with whom an app shares user data ... will provide the same or equal protection ... Explain its data retention/deletion policies and describe how a user can revoke consent and/or request deletion of the user's data."

#### 1.4.1 Privacy Nutrition Labels — what to declare for GroceryApp

Source: <https://developer.apple.com/app-store/app-privacy-details/>. Determined per data type, with three statuses: "Used to Track You," "Linked to You," "Not Linked to You."

For this app the disclosed categories are:

| Apple data category | Why declared | Linked? | Tracking? |
|---|---|---|---|
| **Contact Info → Email Address** | Account auth | Linked to You | No |
| **User Content → Other User Content** | Pantry items, shopping lists, photos of receipts if uploaded | Linked to You | No |
| **Identifiers → User ID** | Firebase / FastAPI internal user UUID | Linked to You | No |
| **Usage Data → Product Interaction** | App analytics (only if you wire Firebase Analytics or similar) | Linked to You | No |
| **Diagnostics → Crash Data, Performance Data** | Sentry / Firebase Crashlytics | Linked to You | No |
| **Location → Coarse Location** | Find nearby stores feature (only if you actually use it server-side or analytics-side) | Linked to You | No |
| **Purchases → Purchase History** | StoreKit IAP receipts | Linked to You | No |

If you do **not** wire third-party advertising/tracking SDKs (no AppLovin, no Meta Audience Network, no AdMob), you can answer "No" to "Used to Track You" across all categories. Camera-captured barcode images that never leave the device do **not** trigger a Photos/Camera category — disclose camera only if you upload images to your backend.

#### 1.4.2 App Tracking Transparency (ATT)

Source: <https://developer.apple.com/documentation/apptrackingtransparency> and policy explainer at <https://developer.apple.com/app-store/user-privacy-and-data-use/>.

**Threshold:** ATT prompt is required only when you "track" the user — Apple defines tracking as linking user/device data from your app **with data from other companies' apps, websites, or offline properties** for advertising or sharing with data brokers, OR sharing device location / email lists with a data broker.

**For a freemium grocery app with no ad SDKs and no third-party analytics that aggregate cross-app:**

- **No ATT prompt required.** Confirmed: a self-contained app that only uses Firebase Analytics for first-party telemetry, Crashlytics for crash logs, and StoreKit for IAP does not "track" by Apple's definition.
- The moment you add Meta SDK, AppsFlyer, Branch, AppLovin, etc. — ATT prompt is mandatory.
- Even without ATT prompt, you still **must** declare the answers in App Store Connect → App Privacy.

2026 caveat: search results referenced 2025 transparency-update language requiring third-party recipient names in ATT prompts ("Share with Meta for advertising" rather than generic "tracking for ads"). Source: <https://developer.apple.com/forums/tags/app-tracking-transparency>. Not relevant unless you add third-party trackers, but lock this in your watch list.

#### 1.4.3 Camera and Location purpose strings

Required Info.plist keys for the React Native build. Use the exact end-user-facing wording, not engineering-speak:

```xml
<key>NSCameraUsageDescription</key>
<string>GroceryApp uses the camera to scan product barcodes so you can add items to your pantry without typing.</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>GroceryApp uses your location to suggest nearby stores and check store-specific prices. We never share your location with third parties.</string>
```

Apple's purpose-string review (5.1.1(ii)) asks one question: does the string clearly describe the use? Vague strings ("for app features") are a top rejection cause. Source: <https://developer.apple.com/documentation/uikit/protecting_the_user_s_privacy>.

#### 1.4.4 § 5.1.1(v) — In-app account deletion

Source: <https://developer.apple.com/support/offering-account-deletion-in-your-app/>. In force since June 30 2022.

Requirements:

- The deletion must be **initiable from inside the app** (not via a "contact support" email).
- Account + associated personal data must be deleted (deactivation only is **not enough**).
- Must not require a phone call, support ticket, or out-of-app support flow — those are reserved for "highly regulated industries" under § 5.1.1(ix), which a grocery tracker does **not** qualify for.
- Reasonable confirmation flow (e.g. typed-confirmation modal) is fine.

Implementation in this stack:

```
Settings → Account → Delete Account
  → typed confirmation ("type DELETE")
  → POST /api/v1/account/delete on FastAPI
    → Firestore: delete /users/{uid} doc + subcollections
    → Firebase Auth: admin.auth().deleteUser(uid)
    → invalidate IAP receipts (StoreKit handles refunds separately)
  → sign-out + redirect to onboarding
```

#### 1.4.5 Privacy Manifest (PrivacyInfo.xcprivacy)

Source: <https://developer.apple.com/news/?id=3d8a9yyh> (announcement) and <https://developer.apple.com/documentation/bundleresources/privacy-manifest-files>. Enforced for new/updated apps with newly added third-party SDKs since **May 1, 2024**.

Required for this app:

- A `PrivacyInfo.xcprivacy` file in the iOS bundle declaring:
  - Data types collected (mirror of the Nutrition Label answers).
  - Required-Reason API usage. The most-likely hits in a React Native app: `UserDefaults` (RN core uses it), file timestamp APIs, system boot time. Each needs a reason code (e.g. `CA92.1` for UserDefaults "access info from same group of apps").
- React Native 0.74+ ships a baseline manifest; you'll likely need to merge with declarations from `react-native-firebase`, `react-native-iap`, etc. Verify each SDK ships its own manifest or the app submission fails.

---

## 2. Google Play Policy (current 2026 version)

Canonical hub: <https://support.google.com/googleplay/android-developer/topic/9858052>. Annual major-policy day was **April 15, 2026**: <https://support.google.com/googleplay/android-developer/answer/16926792?hl=en>.

### 2.1 Data Safety form

Source: <https://support.google.com/googleplay/android-developer/answer/10787469>. The form's 13 data categories the developer must answer for each:

1. Location (approximate / precise)
2. Personal info (name, email, user IDs, address, phone, sensitive identifiers)
3. Financial info (payment info, purchase history, credit score)
4. Health and fitness
5. Messages (email, SMS, in-app)
6. Photos and videos
7. Audio files (music, sound recordings)
8. Files and docs
9. Calendar events
10. Contacts
11. App activity (interactions, search history, installed apps, user-generated content)
12. Web browsing history
13. App info and performance (crash logs, diagnostics)
14. Device or other IDs (advertising ID, Firebase Installation IDs, Android ID)

For GroceryApp, the declarations are:

| Type | Collected? | Shared? | Required? | Purpose(s) |
|---|---|---|---|---|
| Email address | Yes | No | Yes (for account) | Account management |
| User IDs | Yes | No | Yes | Account management, App functionality |
| Approximate location | Yes (only if feature shipped) | No | No (optional) | App functionality |
| Purchase history | Yes (Play Billing) | No | Yes (auto by Billing Library) | App functionality |
| Photos | Conditional | No | No | App functionality (only if receipt OCR ships) |
| Crash logs | Yes (Crashlytics) | No | Yes | Analytics, Fraud prevention |
| Performance data | Yes | No | Yes | Analytics |
| Firebase Installation ID | Yes | No | Yes | App functionality, Analytics |

Two attestations Google requires regardless:

- **"Data is encrypted in transit"** — say **Yes**. Both Firestore SDK and FastAPI-over-HTTPS satisfy this. Don't tick this if any endpoint is plain HTTP.
- **"Users can request that their data is deleted"** — say **Yes**. Hooks to the same endpoint as Apple's account-deletion flow.

April 2025 update worth noting: `Settings.Secure.ANDROID_ID` is now explicitly under "Device or other IDs." If any analytics SDK reads it, declare it. Source: <https://support.google.com/googleplay/android-developer/answer/16926792>.

### 2.2 Subscriptions Policy

Source: <https://support.google.com/googleplay/android-developer/answer/9900533>.

Hard rules:

- **Pricing display:** Annual subscriptions cannot be displayed primarily in monthly equivalent ("$2.99/mo" with the actual annual figure tiny). Display the actual charge prominently.
- **Auto-renewal disclosure:** Must explicitly state that the subscription will "automatically be renewed and charged" before the user confirms purchase. For free trials, must state when the trial converts and what the post-trial charge will be.
- **Easy cancellation:** Either link to Google Play's Subscription Center (`https://play.google.com/store/account/subscriptions`) from your in-app account screen, or provide a direct in-app cancellation flow. Google Play's class-action settlement (preliminary approval Jan 22, 2026, see <https://www.cnbc.com/select/google-play-5-million-class-action-settlement/>) cited unclear cancellation disclosure as the precipitating issue.
- The **same Schedule-2-style 7-bullet disclosure** as Apple is the safe play — write it once, reuse for both stores.

### 2.3 Account Deletion

Source: <https://support.google.com/googleplay/android-developer/answer/13327111>. In effect since May 31, 2024.

Two parallel obligations:

1. **In-app deletion path** (same flow as the Apple requirement; can be the same backend endpoint).
2. **Web-based Data Deletion URL** — a public web page that lets users request deletion **without reinstalling the app**. Must:
   - Reference the app or developer name.
   - Be functional (Google's reviewers test the URL).
   - Lead to a form / link / contact path that can submit deletion.
   - Be entered into Play Console → Data Safety → "Account deletion."

Practical implementation: a single `/account/delete` page on the marketing site backed by the FastAPI endpoint, accepting either logged-in deletion or an email-confirmation flow for users who lost device access. Required even though you have in-app deletion.

What "deletion" must cover: **everything declared in the Data Safety section**. Allowed retention only "for legitimate reasons such as security, fraud prevention or regulatory compliance" — and you must disclose those carve-outs in the Privacy Policy.

### 2.4 Permissions Policy — camera & location

Source: <https://support.google.com/googleplay/android-developer/answer/9888170>. Practical requirements:

- **Runtime permission rationale:** Before the system permission dialog, show an in-app screen explaining *why* you need the permission and how the user benefits. For barcode scanning, a one-screen "Tap allow on the next prompt to scan barcodes — we don't store images" works.
- **Prominent disclosure for location:** If you collect location in the background or at all (foreground), Google Play wants a disclosure separate from the privacy policy, before the runtime permission, that says "GroceryApp collects location data to [reason]. The data [is/is not] used while the app is closed."
- **Background location:** Avoid it. A grocery app does not need `ACCESS_BACKGROUND_LOCATION`. Including it triggers an extra permissions review and almost always rejection unless justified.

### 2.5 Target API level — does it block React Native ship date?

Source: <https://support.google.com/googleplay/android-developer/answer/11926878> and <https://developer.android.com/google/play/requirements/target-sdk>.

Status as of May 2026:

- **Standard new apps & app updates: must target API 35 (Android 15) or higher.** This was the August 31, 2025 deadline.
- **Next deadline: August 31, 2026 — must target API 36 (Android 16) or higher.** Source: <https://support.google.com/googleplay/android-developer/answer/16561298>.
- **64-bit:** required since August 2019. React Native ships 64-bit by default; just verify the abiFilters in `android/app/build.gradle` includes `arm64-v8a` and not just `armeabi-v7a`.

React Native compatibility:

- React Native 0.75+ supports `targetSdkVersion = 35` cleanly.
- React Native 0.78+ recommended for `targetSdkVersion = 36` to handle Android 16's edge-to-edge default and tighter background restrictions.
- For Expo: SDK 52+ supports API 35 via `expo-build-properties`; SDK 54+ for API 36 (verify on the Expo SDK lifecycle page when relevant).
- **Edge-to-edge default in API 35+:** layouts will draw behind system bars unless you wrap with `react-native-safe-area-context`. Must-fix before ship.

Source: <https://sujeetkumargpt06.medium.com/adapting-to-google-plays-latest-policy-api-35-react-native-android-15-4530d1dd4fb7>.

---

## 3. GDPR (EU) applicability and minimum compliance for a Malaysian sole prop

### 3.1 Article 3 territorial scope — does GDPR even apply?

Source: <https://gdpr-info.eu/art-3-gdpr/> and EDPB Guidelines 3/2018 at <https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-32018-territorial-scope-gdpr-article-3-version_en>.

The two triggers for Article 3(2) (non-EU controller):

1. **Offering goods or services** to data subjects in the EU.
2. **Monitoring behaviour** of data subjects in the EU.

#### "Offering" threshold (EDPB Guidelines 3/2018 criteria)

Mere accessibility from the EU is **not enough**. The EDPB looks for evidence of "intent to target" the EU. Concrete factors that tip into "yes, this is offering":

- App is available on EU country App Store / Google Play storefronts (DE, FR, IT, ES, etc.).
- Marketing/web copy in any official EU language other than English (and even English carries weight when paired with other factors).
- Pricing in EUR or any EU member-state currency.
- TLD is `.eu` or an EU country TLD (`.de`, `.fr`).
- Specific mention of EU customers or EU shipping/delivery options.
- Paid advertising targeting EU geos.

For a global App Store + Play launch, the answer is **yes — GDPR applies**. The moment the app is downloadable from the German storefront, you've crossed the "offering" line.

EDPB also clarifies that "monitoring of behaviour" includes web/app analytics that profile individual users — which Firebase Analytics' default settings can be argued to do. Both triggers are likely live.

### 3.2 Lawful basis (Article 6) for the three data flows

| Data flow | Recommended basis | Notes |
|---|---|---|
| Email + password (account) | **Contract performance** (Art. 6(1)(b)) | The user has signed up to use the service; auth credentials are necessary to deliver it. Don't force "consent" UI for what's truly contract-necessary. |
| Camera (barcode scan) | **Consent** (Art. 6(1)(a)) — given through the OS permission prompt | The OS prompt is a freely-given, specific, informed, unambiguous indication. Document that you treat OS-permission grant as consent. |
| Coarse location | **Consent** (Art. 6(1)(a)) | Same. If you ever expand to background location, GDPR analysis gets more demanding. |
| Subscription billing data | **Contract performance** (Art. 6(1)(b)) | Necessary to charge for the service. |
| Crash analytics | **Legitimate interest** (Art. 6(1)(f)) | Document the LIA balancing test in your Privacy Policy or RoPA. |
| Marketing emails | **Consent** (Art. 6(1)(a)) — separate opt-in | Don't piggyback on registration. ePrivacy Directive (Cookie Law) layers on this. |

Source: <https://gdpr-info.eu/art-6-gdpr/>.

### 3.3 Required artifacts

#### 3.3.1 Privacy Policy

Mandatory under Articles 12–14. Must include: identity & contact of controller (you), purposes + legal basis, recipients (Firebase, Apple, Google), retention, data subject rights, complaint route to a supervisory authority. ICO (UK) keeps the most readable plain-English checklist: <https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/>.

#### 3.3.2 Records of Processing Activities (RoPA)

Article 30. The "<250 employees" exemption (Art. 30(5)) does **not** apply if processing is "not occasional" — running a SaaS that continuously processes user data is by definition not occasional. **You must keep a RoPA.** A simple spreadsheet with columns (purpose, categories of data subjects, categories of personal data, recipients, retention, security measures, transfer mechanisms) is adequate.

Source: <https://gdpr-info.eu/art-30-gdpr/>.

#### 3.3.3 Data Protection Impact Assessment (DPIA)

Article 35. Triggered when processing is "likely to result in a high risk." For a freemium grocery app collecting email + camera + coarse location, a DPIA is **not** strictly required (no special-category data, no large-scale systematic monitoring, no profiling for legal-effects decisions). Document the assessment-of-non-applicability — one paragraph in your privacy file is enough.

Source: <https://gdpr-info.eu/art-35-gdpr/>.

#### 3.3.4 Data Protection Officer (DPO)

Article 37. **Not required** for this app — DPO is mandatory only for public authorities, large-scale systematic monitoring, or large-scale special-category data. Don't appoint one.

Source: <https://gdpr-info.eu/art-37-gdpr/>.

#### 3.3.5 EU Representative under Article 27 — **mandatory for this setup**

Source: <https://gdpr-info.eu/art-27-gdpr/>.

The Article 27 exemption applies when processing is "occasional, does not include large-scale processing of special categories ... and is unlikely to result in a risk to the rights and freedoms of natural persons." A live SaaS continuously processing user data is **not occasional** — same logic as RoPA. So **you need an EU representative**.

The representative must be in an EU member state where some of your users are. They become your point of contact for supervisory authorities and data subjects.

**Vendors and 2026 pricing (verified live):**

| Vendor | Annual price (EU rep, base tier) | Coverage | Source |
|---|---|---|---|
| **EUverify Startup** | £399/year (~€465) | EU + UK identical price; ≤ 5 employees, < £500K rev | <https://euverify.com/gdpr/pricing/> |
| **GDPR Local** | £99/month → ~£1,188/year (~€1,400) | EU + UK | <https://gdprlocal.com/pricing/> |
| **EUverify Growth** | £599/year (~€700) | ≤ 20 employees, < £2M rev | <https://euverify.com/gdpr/pricing/> |
| **Prighter** | Custom — public quotes typically €500–1500/year for a sole-prop SaaS, with ~40% off when bundled with UK rep | EU; UK and Swiss available as add-ons | <https://prighter.com/pricing/> |
| **VeraSafe** | Custom quote (typical €1500–3000+ for SaaS-tier) | EU + UK + Swiss | <https://verasafe.com/representative-services/gdpr-article-27-representative-program/> |

For a launching MY sole prop, **EUverify Startup at £399/year or Prighter base** are the cheapest defensible options. Don't try to skip — supervisory authorities in DE/FR have started enforcement against US-based SaaS without an Art-27 rep.

#### 3.3.6 UK GDPR representative (separate)

Brexit produced UK GDPR (post-2020), which mirrors GDPR but requires a **separate UK representative** if you target UK users. Most vendors above bundle UK + EU rep for ~30% over the EU-only price.

### 3.4 Data subject rights (Articles 15–22)

Endpoints to expose, either in-app or via a privacy@yourdomain inbox:

| Right | Endpoint | SLA |
|---|---|---|
| Access (Art. 15) | Export-account-data button → returns JSON of user's data | 1 month, extendable to 3 |
| Rectification (Art. 16) | Edit profile in-app | Immediate |
| Erasure (Art. 17) | Delete-account flow | 1 month |
| Portability (Art. 20) | Same as Access, machine-readable JSON/CSV | 1 month |
| Object (Art. 21) | Email channel for marketing opt-out | 1 month |

Build the export-data feature alongside delete-account — same backend logic, different return value. In Firestore: a single Cloud Function that walks `/users/{uid}` and subcollections, dumps to JSON, signs the URL, emails it to the user.

### 3.5 Breach notification

Article 33: notify the lead supervisory authority within **72 hours** of becoming aware. Article 34: notify affected users "without undue delay" if high risk (likely if password hashes or precise location leaked). Have a one-page incident-response template ready before launch.

Source: <https://edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-92022-personal-data-breach-notification-under_en>.

---

## 4. CCPA / CPRA (California)

Canonical sources: <https://oag.ca.gov/privacy/ccpa> and <https://cppa.ca.gov/regulations/>.

### 4.1 Applicability thresholds (effective 2025+, CPI-adjusted)

A for-profit entity that does business in California **and** meets at least one of:

1. **Annual gross revenue > $26.625M** (CPI-adjusted from $25M, effective Jan 1, 2025; adjusted again at Jan 1, 2027; check <https://cppa.ca.gov/regulations/cpi_adjustment.html> for the current figure).
2. Buys, sells, or shares **personal info of ≥ 100,000** California consumers or households per year.
3. Derives **≥ 50% of annual revenue from selling/sharing** personal info.

For a launching grocery app: **you almost certainly do not meet any threshold** at launch. Confirmed — this aligns with iapp.org's threshold guidance: <https://iapp.org/news/a/does-the-ccpa-as-modified-by-the-cpra-apply-to-your-business>.

### 4.2 Recommended posture even when not strictly required

Compliance signal cost is low; downside risk if you cross the threshold mid-year is high. Do the following at launch:

1. **Privacy Policy with a "California Residents" section** that mirrors CCPA disclosure structure (categories collected, sources, purposes, recipients, retention, rights). Templates at <https://termly.io/resources/articles/do-not-sell-my-personal-information/>.
2. **"Do Not Sell or Share My Personal Information" link** in the website footer — only required if you sell/share, which a freemium grocery app probably doesn't. If you don't sell/share, your Privacy Policy still must explicitly state "we do not sell or share personal information as defined under CCPA." Source: <https://www.law.cornell.edu/regulations/california/11-CCR-7013>.
3. **Honor the Global Privacy Control (GPC)** browser signal on your marketing site — California's CPPA enforces this. One-line check in JS: `navigator.globalPrivacyControl === true`.
4. **Same access/deletion endpoints** built for GDPR will satisfy CCPA's "right to know" and "right to delete" — no extra engineering.

### 4.3 2026 CCPA regulations effective Jan 1, 2026

Source: <https://www.jacksonlewis.com/insights/navigating-california-consumer-privacy-act-30-essential-faqs-covered-businesses-including-clarifying-regulations-effective-1126>. New rules effective Jan 1, 2026 around automated decision-making technology (ADMT) disclosures, cybersecurity audit requirements (only kicks in for businesses meeting ADMT/large-data thresholds), and risk-assessment cadence. **None apply to a launching freemium grocery app at this scale.** Park on a watch-list item.

---

## 5. Firestore + cross-border data transfer

### 5.1 The legal question

If Firestore stores EU users' data in `us-central1`, you are exporting personal data from the EU to the US. Article 44 GDPR says you need a transfer mechanism: an adequacy decision, SCCs, or BCRs.

### 5.2 What Firebase's DPA covers by default

Source: <https://firebase.google.com/support/privacy>.

- Google Cloud-governed Firebase services (including Firestore) fall under the **Cloud Data Processing Addendum (CDPA)** — automatic when you accept the Firebase ToS.
- Firebase-specific services have their own **Data Processing and Security Terms** with processor obligations under GDPR + CCPA.
- Standard Contractual Clauses are auto-incorporated where applicable (separate document at <https://cloud.google.com/terms/data-processing-addendum>).

### 5.3 EU-US Data Privacy Framework (DPF)

Source: <https://www.dataprivacyframework.gov/Program-Overview>.

- **Google LLC is on the DPF active-participant list** with current certification (last verified update: 2026-02-18 per Firebase's own privacy page).
- The General Court of the EU **dismissed the legal challenge to the DPF on Sept 3, 2025**, confirming validity of the adequacy decision. Source: <https://www.heuking.de/en/news-events/newsletter-articles/detail/eug-confirms-effectiveness-of-eu-us-data-privacy-framework.html>.
- For a small developer using Firestore in `us-central1`: relying on **DPF + Google's DPA + SCCs (auto-incorporated)** is the standard, defensible posture in 2026. You do not need to negotiate anything separately.

### 5.4 Practical decision: `eur3` region or stay in `us-central1`?

Firestore's `eur3` multi-region (europe-west1 + europe-west4 + europe-central2) gives **physical EU data residency**. Source: <https://firebase.google.com/docs/firestore/regional-endpoints>.

| Posture | Pros | Cons |
|---|---|---|
| Stay in `us-central1`, rely on DPF + DPA + SCCs | Cheaper egress within US for FastAPI co-located in US; no migration if backend is US | DPF could be challenged again ("Schrems III"); some EU users prefer EU data residency on principle |
| Switch to `eur3` for Firestore | Eliminates the cross-border-transfer question for the database; better latency for EU users | Firebase Auth user records still live in US (no EU residency for Auth as of 2026); slightly higher cost; if FastAPI is in US, every read/write hops the Atlantic |

**Recommendation for launch:** stay in `us-central1` and document DPF reliance in the privacy policy. The mitigation cost of `eur3` is real (engineering complexity + Auth still cross-borders) and DPF is currently solid. If/when EU traffic exceeds say 30% of MAU, revisit and migrate Firestore (not Auth) to `eur3` and consider regional FastAPI deployment in europe-west1.

Auth limitation source: <https://firebase.uservoice.com/forums/948424-general/suggestions/46591651-firebase-authentication-for-eu>.

---

## 6. EU consumer law on subscription billing

### 6.1 EU Omnibus Directive (2019/2161) — right of withdrawal

Source: <https://eur-lex.europa.eu/EN/legal-content/summary/consumer-information-right-of-withdrawal-and-other-consumer-rights.html>. In force across the EU since May 28, 2022.

- Default: 14-day right of withdrawal from distance contracts, no reason needed, no cost.
- **Digital content waiver (Art. 16(m) of the Consumer Rights Directive):** the consumer **can** waive the withdrawal right, but only if all of the following are true at purchase time:
  1. The consumer **expressly consents** to immediate performance.
  2. The consumer **acknowledges loss** of the withdrawal right.
  3. The trader provides confirmation of the contract on a durable medium.
- **Digital service classification:** recent CJEU case law (AG Opinion in Sky Austria, see <https://www.lexology.com/library/detail.aspx?g=c0027993-de36-4b7e-aeb6-40650f63fb8e>) treats most subscription apps as "digital services" rather than "digital content." For digital services, the withdrawal right doesn't lapse on first use — it lapses only on full performance. For most SaaS this means you must honor a 14-day refund window.

**For GroceryApp:** safest posture is to honor a 14-day no-questions-asked refund for EU subscribers on the **first** subscription period. This conflicts with Apple/Google's "all sales final after first day of digital content delivery" defaults — meaning you need a refund-via-issuer flow (StoreKit refund request, Google Play subscription refund) **plus** your own logic to recognize EU consumers and process them quickly.

In practice: Apple and Google's storefront refund handling is what most small developers use. Apple handles EU refunds via App Store automatically — see <https://support.apple.com/en-us/118223>. Document in your ToS that EU consumers should request refund through Apple/Google in the first instance, and you'll process direct refunds within 14 days for cases the storefront declines. This is the de-facto standard.

### 6.2 Auto-renewal disclosure — store flow vs strict EU law

Apple's and Google's purchase sheets show duration + price + renewal language by default. EU consumer law also wants the **trader** (you) to make these disclosures, in the same language as the consumer's storefront. Gap: Apple/Google show this in English globally; EU consumer protection authorities have ruled that German consumers must see German disclosures.

Mitigation: your in-app paywall **before** the StoreKit/Play purchase sheet must show duration, price, renewal terms, and trial-conversion in the locale's language. Use App Store Connect's localized App Store review notes to confirm to the reviewer that the in-app paywall localizes.

### 6.3 Country-specific quirks

#### Germany — "Cancellation Button" (Kündigungsbutton)

Source: <https://www.mofo.com/resources/insights/211006-new-two-click-cancellation-button>. Effective July 1, 2022, codified in § 312k BGB.

- Applies to **online subscription contracts with consumers in Germany**.
- Must be a button (not buried in account settings text), labeled "Verträge hier kündigen" or equivalent.
- Two-click flow: button → confirmation page with "Jetzt kündigen" button.
- Failing this gives the user a **statutory right to terminate immediately**.

For an iOS/Android app where billing runs through Apple/Google: Bundesgerichtshof (BGH) rulings in 2025 have **extended this to apps**, not just web. See <https://www.technologyslegaledge.com/2025/04/online-contract-cancellations/>. The safe interpretation: provide an in-app "Cancel Subscription" button in German locales, in addition to the link to Google/Apple's subscription manager.

Practical implementation:

```
Settings → Subscriptions → "Verträge hier kündigen" (DE locale only)
  → confirmation screen: "Jetzt kündigen"
  → deep-link to platform subscription manager + server-side flag for grace period
```

#### France

- LCEN + DGCCRF require pre-tick boxes for auto-renewal — you can't have "auto-renew" pre-checked. Apple/Google's flow handles this for you because users actively confirm purchase.
- French consumer code Article L. 215-1 requires informing consumers 1–3 months before automatic renewal of contracts longer than 1 year. Annual subscriptions need a renewal-reminder email ~1 month before charge. Source: <https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032224094/>.

#### Italy

- Codice del Consumo aligns broadly with EU Omnibus.
- AGCM (competition/consumer authority) has been aggressive on dark-pattern subscription cancellations. Same posture as Germany: clear in-app cancel.

---

## 7. Apple's Malaysia-developer payout and tax — **important finding**

### 7.1 The headline

**There is no comprehensive US-Malaysia tax treaty.** The only US-Malaysia agreement covers air and sea transport income only. Sources:

- <https://taxsummaries.pwc.com/malaysia/individual/foreign-tax-relief-and-tax-treaties> (PwC: "Limited Agreement ... Restricted to taxation of air and sea transport operations")
- <https://www.expatriationattorneys.com/no-tax-treaty-with-malaysia-impacts-expat-tax-reporting/>
- IRS treaty list does not include Malaysia: <https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z>

**Consequence:** Apple's payouts on **US-storefront sales** are subject to the default **30% US federal withholding** for non-resident-alien royalty/services income. There is no treaty rate to claim.

### 7.2 W-8BEN form fill-out for a Malaysian sole proprietor

Source: Apple's process — <https://developer.apple.com/help/app-store-connect/manage-tax-information/provide-tax-information/>. IRS form instructions: <https://www.irs.gov/instructions/iw8ben>.

For a sole proprietor (an individual operating under a business name without forming a Sdn Bhd), the form is **W-8BEN** (the individual form), **not W-8BEN-E** (entity form). The IRS instructions are explicit: a sole proprietor with a DBA files as an individual.

| Form field | What to enter |
|---|---|
| Part I, Line 1 | Your **legal name as on Malaysian IC/passport**, not the DBA. |
| Line 2 | Country of citizenship: **Malaysia** |
| Line 3 | Permanent residence address: home address in MY (not a PO box) |
| Line 4 | Mailing address (if different) |
| Line 5 | US TIN: **leave blank** (you don't have one and don't need one for treaty-less withholding) |
| Line 6a | Foreign TIN: your **MyKad number** or **MyTax/Lembaga Hasil Dalam Negeri tax file number** if you have one |
| Line 8 | Date of birth |
| **Part II — Treaty benefits** | **Leave entirely blank.** No US-MY treaty exists, so claiming any reduced rate is invalid and will trigger Apple/IRS rejection. |
| Part III | Sign, date, capacity ("Individual" or your name) |

### 7.3 What 30% withholding actually means on Apple payouts

- Withholding applies to the **US-storefront portion** of revenue only. Sales on the MY/SG/EU/etc. storefronts are not US-source and have no withholding.
- Apple sends an annual 1042-S showing US-source income and withholding, around late February following the tax year.
- Malaysia's tax authority (LHDN) treats foreign-source income received in Malaysia as taxable from YA 2022 onwards (with some exemptions through YA 2026 — confirm via <https://www.hasil.gov.my>). You may be able to credit the 30% US withholding against MY tax under domestic relief rules, even without a treaty — consult a MY tax professional.

### 7.4 Google Play

Google requires the same W-8BEN. Same 30% applies on the US storefront for the same reason. Source: <https://support.google.com/payments/answer/7644013> (Play Console payments tax info).

### 7.5 Pragmatic recovery option

If the US withholding bites hard (likely in months where US-storefront contributes >40% of revenue), the cleanest path long-term is to:

- Form a Sdn Bhd in MY (not the same as a sole prop) — still no treaty, still 30%. Forming a Sdn Bhd does NOT solve the treaty issue.
- Form a Singapore Pte Ltd — **Singapore-US tax treaty** caps royalties at 0% in many cases. Source: <https://aspireapp.com/blog/singapore-us-tax-treaty>. Cost: ~SGD 1500–3000/year setup + ongoing accounting. Only worth it past ~USD 5–10K/month US-storefront revenue.

Park as a watch-list item. Day 1 launch as MY sole prop, eat the 30%, revisit at 12 months.

---

## Critical-path actions before launch

Ordered by sequence and dependency. Each item should be ticked before binary submission.

1. **Privacy Policy + Terms of Service** drafted and hosted at stable URLs on the marketing site (`/privacy`, `/terms`). Must include: identity, data categories, lawful basis (per § 3.2 above), third-party processors (Firebase, Apple, Google, Sentry/Crashlytics), retention, data subject rights, transfer mechanisms (DPF + SCCs), CCPA "California Residents" section even though under threshold, contact email `privacy@yourdomain`. Have a MY tech lawyer spend 2 hours reviewing.

2. **Engage an EU representative.** Sign with EUverify Startup tier (£399/year) or Prighter equivalent. Get the official Article 27 designation letter and put the rep's name + EU address into the Privacy Policy. Also into App Store Connect → App Privacy → "Privacy Choices" if there's a free-form field.

3. **Build the data subject rights endpoints.** One FastAPI endpoint each: `GET /api/v1/account/export` (returns user's data as JSON), `DELETE /api/v1/account` (cascades to Firestore + Firebase Auth). Hooks for both an in-app "Delete Account" button **and** a public web form at `/account/delete` (for the Google Play Data Deletion URL requirement).

4. **Implement subscription paywall with full Schedule-2 disclosure** in-app, before triggering StoreKit / Play purchase sheet. Localize disclosure text into at minimum English, German, French, Italian, Spanish (the highest-volume EU languages). Wire `react-native-iap` for Restore Purchases.

5. **Privacy manifest + purpose strings.** Add `PrivacyInfo.xcprivacy` to iOS bundle with required-reason API codes for UserDefaults, file timestamp, system boot. Set `NSCameraUsageDescription` and `NSLocationWhenInUseUsageDescription` Info.plist strings. Verify each third-party iOS pod ships its own manifest.

6. **Fill in App Store Connect → App Privacy** (Nutrition Labels) and **Play Console → Data Safety form** with the categories table from § 1.4.1 and § 2.1. Tick "encrypted in transit," "users can request deletion." Submit the public Data Deletion URL to Play Console.

7. **W-8BEN submitted to Apple App Store Connect and Google Play Console** with Part II left blank. Confirm 30% withholding will apply to US-storefront sales. Plan cash-flow accordingly.

8. **Account-deletion in-app flow + delete confirmation** on both iOS and Android. Apple's reviewer always tests this — broken or "contact us via email" flows are an automatic 5.1.1(v) rejection.

9. **German-locale "Verträge hier kündigen" button** in the Subscriptions screen (DE-only conditional render). Two-click confirmation. Deep-link or call platform cancellation API.

10. **Records of Processing Activities (RoPA) spreadsheet** kept alongside the Privacy Policy. One row per processing activity (auth, billing, analytics, crash reports, location, camera). Store in version control alongside the codebase.

---

## Watch list — items that change with growth

| Trigger | Action | Source |
|---|---|---|
| **CCPA threshold crossed** (>$26.625M revenue, or >100K CA consumers/year, or >50% revenue from data sales) | Add Do-Not-Sell link, GPC support hardening, formal notice-at-collection in app, vendor contracts upgraded to DPAs with SCCs. | <https://cppa.ca.gov/regulations/cpi_adjustment.html> |
| **DPF court challenge** ("Schrems III") | Migrate Firestore to `eur3`; review SCCs; consider EU-resident FastAPI deployment. | <https://www.didomi.io/blog/eu-us-data-privacy-framework-dpf-2025> |
| **EU revenue exceeds ~30% of MAU** | Migrate Firestore to `eur3` proactively before any DPF challenge bites; deploy EU-region FastAPI. | <https://firebase.google.com/docs/firestore/regional-endpoints> |
| **EU rep volume past startup tier** (>5 employees, >£500K revenue at EUverify; equivalent at Prighter) | Upgrade to Growth/Scale-Up tier. EU rep cost rises £200–500 per annum bracket. | <https://euverify.com/gdpr/pricing/> |
| **Aug 31, 2026 deadline for Play target API 36 (Android 16)** | Bump React Native and Expo SDK; test edge-to-edge layouts; submit update before deadline or new app updates blocked. | <https://support.google.com/googleplay/android-developer/answer/16561298> |
| **Apple Privacy Manifest scope expansion** (Apple has signaled broader Required-Reason API scope future-tense) | Re-audit `PrivacyInfo.xcprivacy` annually; subscribe to <https://developer.apple.com/news/> for the announcement. | <https://developer.apple.com/news/?id=3d8a9yyh> |
| **EU Digital Fairness Act** (in development 2025–2026, may layer extra subscription-cancellation rules) | Track Commission's progress; expect mandatory online-cancellation parity to reach all EU. | <https://www.insideprivacy.com/consumer-protection/digital-fairness-act-series-topic-4-digital-subscriptions/> |
| **Add a third-party SDK** (analytics, ads, attribution) | ATT prompt becomes mandatory; Privacy Manifest and Nutrition Label both need updates; SDK signature must be valid. | <https://developer.apple.com/news/?id=3d8a9yyh> |
| **Add background location** | Google Play prominent disclosure + extra permissions review; many rejections — avoid unless essential. | <https://support.google.com/googleplay/android-developer/answer/9888170> |
| **US-storefront revenue justifies SG entity** (~USD 5–10K/month) | Consider Singapore Pte Ltd to claim US-Singapore treaty 0% royalty rate — saves the 30% withholding. | <https://aspireapp.com/blog/singapore-us-tax-treaty> |
| **Children under 13 ever become a target** (e.g. "family sharing pantry" feature) | COPPA (US) + GDPR-K kicks in. Both Apple and Google require Families Policy compliance. Major scope expansion. | <https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa> |

---

## Appendix — rule changes since the early-2025 training cutoff worth noting

- **Apple ATT specificity (2025 update):** generic "tracking for ads" prompts are no longer accepted; you must name partners ("Share with Meta for advertising"). Source: indirect via <https://developer.apple.com/forums/tags/app-tracking-transparency> and adtech vendor write-ups.
- **DPF judicial validation (Sept 3, 2025):** General Court of EU dismissed legal challenge — DPF now on firmer legal footing than at any time since Schrems II. Source: <https://www.heuking.de/en/news-events/newsletter-articles/detail/eug-confirms-effectiveness-of-eu-us-data-privacy-framework.html>.
- **Google Play class-action settlement (preliminary approval Jan 22, 2026):** $5M settlement on subscription-disclosure clarity. Reinforces that Google will police subscription disclosure language tightly going forward. Source: <https://www.cnbc.com/select/google-play-5-million-class-action-settlement/>.
- **Google Play target SDK 36 (Android 16) deadline: Aug 31, 2026** for new apps and updates. Source: <https://support.google.com/googleplay/android-developer/answer/16561298>.
- **CCPA 2026 regulations effective Jan 1, 2026:** ADMT disclosures and cybersecurity audits — **out of scope for a launching freemium grocery app** but reshape the SaaS landscape. Source: <https://www.jacksonlewis.com/insights/navigating-california-consumer-privacy-act-30-essential-faqs-covered-businesses-including-clarifying-regulations-effective-1126>.
- **German cancellation-button extension to apps (BGH 2025 rulings):** previously interpreted as web-only, now applies to in-app subscriptions. Source: <https://www.technologyslegaledge.com/2025/04/online-contract-cancellations/>.
- **Apple US-storefront external-link allowance (May 2025, post-Epic ruling):** US storefront only. No effect on global-storefront launch posture. Source: <https://developer.apple.com/news/?id=dovxb62h>.

---

*End of report. Total ~520 lines. Citation count: ~50 distinct URLs across Apple, Google, EU institutions, IRS/PwC, and vendor pricing pages.*
