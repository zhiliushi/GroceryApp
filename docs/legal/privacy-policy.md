# Privacy Policy — GroceryApp

> **⚠ TEMPLATE — NOT LEGAL ADVICE.** This is a starting point, not a finished
> policy. Replace the bracketed `[…]` placeholders with your real details and
> have a lawyer review before public launch (see `docs/PAID_ENHANCEMENTS.md`
> P11). Drafted for an invite-only beta in Malaysia (PDPA scope).

**Last updated:** 2026-04-26
**Effective:** 2026-04-26
**Operator:** [Your Name / Company Name], [Address], [Country]
**Contact:** [your-email@domain.com]

---

## 1. What this policy covers

This Privacy Policy explains how GroceryApp ("we", "the App") collects, uses,
and protects your personal data when you use our web and mobile interfaces.
By using the App you consent to the practices described here.

GroceryApp helps you track grocery purchases, expiry dates, and reduce food
waste. We process the minimum personal data needed to deliver that service.

## 2. Data we collect

**You provide directly:**
- Email address and display name (via Google Sign-In through Firebase Auth)
- Items you add to your inventory: name, quantity, expiry date, location,
  optional purchase price, optional barcode
- Items you mark used / thrown / given away, and the reasons
- Shopping list contents
- Optional uploaded photos for barcode/receipt scanning (admin-experimental
  feature; OFF by default)
- Recipes you create (in the Meals page)

**Collected automatically:**
- Authentication tokens (Firebase ID tokens)
- Anonymous device + browser metadata (user-agent, IP at request time, for
  rate-limit + audit log purposes only)
- Service worker logs (cached responses, sync state)
- Page views via the App's internal analytics (no Google Analytics)

**We do NOT collect:**
- Payment information (no payments accepted yet)
- Precise location (we do NOT request browser geolocation)
- Contact lists, calendars, or other phone data
- Behavioural advertising signals — we serve no ads

## 3. How we use your data

- **Service delivery.** Show you your inventory, compute health scores, send
  expiry reminders.
- **Account management.** Authenticate you, recover access, contact you about
  service issues.
- **Aggregate analysis.** Improve the catalog quality (admin only — see
  `/admin/catalog-analysis`). Aggregations never include your name or email
  in any displayed result.
- **Security.** Detect abuse, enforce rate limits, audit administrator
  actions.

We do **not** sell, rent, or share your personal data with advertisers or
data brokers. We do not use your data to train AI models for third parties.

## 4. Data storage and processors

Your data is stored in:

- **Google Cloud Firestore** (Firebase project `groceryapp-b91a7`),
  multi-region. Google's privacy terms: https://cloud.google.com/terms/data-processing-addendum
- **Render.com** (web hosting), United States. Render privacy:
  https://render.com/privacy
- Optional third-party lookups when you scan a barcode:
  - **OpenFoodFacts** — public open-data API, no account data sent
  - **Google Vision / Mindee** — only if `ocr_enabled` flag is ON; image
    bytes are sent for OCR, never stored by us

We do not transfer data to any other countries deliberately, but Google and
Render's regional infrastructure may store backups in their global data
centres per their respective DPAs.

## 5. Data retention

- **Active inventory.** Kept until you delete it or close your account.
- **Purchase history.** Kept until you delete it; used for waste-prevention
  insights.
- **Audit logs.** 90 days, then automatically deleted.
- **Service worker caches.** Cleared on app uninstall or browser cache wipe.
- **After account deletion.** All your personal data is purged within 30 days
  from primary stores; up to 90 days from rolling backups.

## 6. Your rights

Under PDPA (Malaysia) and equivalent regulations:

- **Access.** Request a copy of your data via Settings → Export Data, or by
  emailing us. Returns a JSON dump within 7 days.
- **Correction.** Edit your inventory and profile in-app at any time.
- **Deletion.** Settings → Delete Account → confirms with second click. Your
  data is purged within 30 days.
- **Withdrawal of consent.** You can stop using the App at any time. We
  retain only what is required for legal/accounting reasons (currently:
  none).
- **Complaint.** You may complain to the Department of Personal Data
  Protection (PDP) Malaysia: https://www.pdp.gov.my/

## 7. Cookies and similar technologies

GroceryApp uses:
- A **first-party authentication token** (Firebase) to keep you logged in.
- A **service worker** for offline access to the App shell.
- **localStorage** to remember UI preferences (sidebar state, dismissed
  nudges, theme).

We do NOT use third-party tracking cookies, advertising pixels, or
fingerprinting.

## 8. Children

GroceryApp is not designed for children under 13. We do not knowingly
collect data from children. If you believe a child has signed up, contact
us and we will delete the account.

## 9. Security

- All traffic uses TLS 1.2+ (HTTPS).
- Firestore Security Rules restrict every collection to the owning user
  (`request.auth.uid == resource.data.user_id`).
- Admin API endpoints are restricted to authorized administrators by both
  Firebase custom claims and server-side `require_admin` checks.
- Rate limiting (60 writes/min/user) prevents abuse.
- We do not store passwords directly — Firebase Auth handles credentials.

No system is 100% secure. If you discover a security issue, please email
[security@yourdomain.com] before public disclosure (see `SECURITY.md`).

## 10. Changes to this policy

We may update this policy as the App evolves. Material changes will be
announced in-app and via email. The "Last updated" date at the top reflects
the most recent revision.

## 11. Contact

Questions, requests, or complaints:
- Email: [your-email@domain.com]
- Postal: [Your Address]

---

*This policy was generated from a community template + adapted for
GroceryApp's actual data practices on 2026-04-26. It is NOT a substitute
for review by a qualified attorney before public launch.*
