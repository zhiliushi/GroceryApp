# Settings

Route: `/settings`
File: `backend/web-admin/src/pages/settings/SettingsPage.tsx`

## Purpose

The user-facing "knobs" page. Account info (read-only), household
sharing, display currency, shopping-list defaults, catalog cleanup,
and account security all live here. Each concern is a
self-contained section component under `components/settings/` so
adding a new knob is one card, one file.

## Composition (render order)

1. `<PageHeader title="Settings" icon="⚙️" />`.
2. **"ⓘ What can I change here?" expandable** — page-level overview.
   Lists every section with one-line descriptions so a new user can
   scan the page before diving in. Specifically calls out that
   **changing display currency does NOT re-aggregate past data**
   (the most common source of "wait, why didn't my old totals
   change?" support questions).
3. **Account card** (`SettingsPage.tsx` inline) — Email / UID / Role.
   Read-only. UID and Role labels carry `title=` tooltips:
   - UID — "Your unique account ID. Share this if support asks."
   - Role — "Your access level. Admins can manage products, users,
     and feature flags."
4. `<HouseholdSection />` — household creation / join / management.
5. `<DisplayCurrencySection />` — preferred currency for display.
6. `<GrocerySection />` — shopping-list checkout defaults +
   purchase-pattern analytics opt-in (v3 beta).
7. `<SecuritySection />` — change password, link Google, delete
   account.
8. **Application card** — version + platform. Currently hardcoded
   to `GroceryApp Web v3.0.0` / `React SPA`.

> **Moved 2026-05-04**: `<MergeNudgeWidget />` (catalog cleanup) and
> `<MyFeedbackSection />` (the user's feedback list) used to mount
> here; they now live as tabs on the User Hub at
> [`/help`](user-hub.md). The components themselves remain at
> `components/settings/*` and gained an `emptyVariant: 'hide' |
> 'inline'` prop so the User Hub tabs render an empty state instead
> of auto-hiding. The page-level helper expandable in `SettingsPage`
> now points users to User Hub for these.
10. **Legal** — links to `/privacy` and `/terms` with one-line
    summary text.
11. **FSM Engine card** — see "Misplaced section" below.

## Section components — what each one owns

### HouseholdSection (`components/settings/HouseholdSection.tsx`)

Two view states gated by `useHousehold().data?.household`:

- **No-household view** — Create form (name + role picker) and Join
  form (6-letter code). Includes a new "What is a household?"
  expandable explaining what a household *is* (shared inventory /
  shopping list / storage / waste totals), what roles mean (just
  labels, not permissions), and the difference between Create and
  Join. This expandable lives on the empty-state branch only — once
  the user is in a household, the section's behaviour is
  self-evident.
- **Household view** — owner sees member list with Remove buttons,
  invite generator with role + optional email, pending-invite list
  with Revoke. Members see member list (read-only) and a Leave
  button. Tooltips on destructive actions:
  - **Remove** — "Remove this member from the shared household.
    Their personal data stays with them."
  - **Dissolve** — "Disband the household for everyone. Each
    member keeps their own data; only the shared view goes away."
  - **Leave** — "Stop sharing with this household. Your own
    purchases, shopping list, and waste totals stay with you."

  The destructive copy mirrors the dialog text shown by
  `useConfirmDialog` so the tooltip and the dialog don't disagree.

  **MH-4 — Create your own household entry** (members only): when
  `data.household.owner_uid !== currentUid`, the household-view
  branch additionally renders a `<CreateOwnHouseholdInline />`
  collapsible at the bottom (after the Leave button). This surfaces
  the create-flow for members who don't yet own one but might want
  to manage their own inventory + invite others. Hidden for owners
  (they're already at the cap of 1 owned household per user).
  Backend `create_household` enforces the "owner=1" invariant; the
  UI hides the entry when it isn't actionable.

  Today's heuristic (`owner_uid !== currentUid` on the *active*
  household) is accurate as long as the legacy `household_id` field
  reflects whichever household the user owns. Edge case: a user
  with the active scope on a member-only household but who owns a
  different one (post multi-membership join) sees the Create entry
  even though they shouldn't — backend rejects with the right
  error. Full accuracy needs a future `/api/me/memberships`
  endpoint; tracked in `PLAN_ONBOARDING_V2.md` MH-3 follow-ups.

### Active-household switcher (`components/layout/HouseholdSwitcher.tsx`)

Not part of `<SettingsPage />` directly, but related to the
household-management surface. The switcher pill lives in
`<AppLayout />` (top-4 right-72, desktop only). MH-3a no-op shape
today: derives a single membership from `useHousehold()` and shows
a one-row dropdown. Multi-row dropdown surfaces once the deferred
`/api/me/memberships` endpoint ships and the SPA reads from it.
See `PLAN_ONBOARDING_V2.md` MH-3 for the data flow.

### DisplayCurrencySection (`components/settings/DisplayCurrencySection.tsx`)

Single dropdown of common currencies (`SGD, MYR, USD, EUR, GBP,
JPY, CNY, IDR, THB, PHP, VND, INR, AUD`). If the user's current
preference isn't in that list, it's prepended so it stays
selectable.

The component already carries good inline help text:

> Prices entered in any currency are converted to your display
> currency at save time using the day's FX rate. Past events are
> NOT re-aggregated when you change this — they remain in their
> original locked rate.

This is the canonical wording — the page-level helper points back
to it, both echo the same constraint.

Mutation flow: `PUT /api/me/currency-preference` →
`qc.invalidateQueries({ queryKey: qk.me })` →
`fetchUserInfo()` (auth-store snapshot refresh) so banners and
QuickAddModal pick up the change without a reload.

### GrocerySection (`components/settings/GrocerySection.tsx`)

Two knobs, both already with good inline copy:

- **Default storage on checkout** — dropdown of the user's
  registered storage locations + "🏠 Home / Unsorted (sort later)".
  Default is `_unsorted` so brand-new users don't have to set up
  storage before their first checkout.
- **Record purchase patterns** — checkbox; opt-in for substitution
  analytics. Defaults to off. Inline copy explains exactly what
  data is recorded ("which brand/store you actually picked").

Mutation: `useUpdateGroceryPreferences()` —
`PUT /api/me/grocery-preferences`. Fires on every change (no
explicit Save button) — fine for booleans / single dropdowns.

### MergeNudgeWidget (`components/settings/MergeNudgeWidget.tsx`)

Two stacked cards:

- **Likely duplicates** — fetched via `useCatalogDuplicates()`. Pairs
  scored by either `shared_barcode` or `name_similarity` with a
  numeric score. Each row links to one side via "Review →" — the
  user decides whether to merge from the catalog page itself.
- **Recent transfers** (collapsed by default) — `useTransferLog()`.
  Each row shows `from → to`, timestamp, event count. While
  `reversal_window_open && !reversed_at`, a Reverse button puts the
  events back. Window is **7 days from transfer**.

Newly added inline expandable: "ⓘ How does this work?" explains the
detection signals (shared barcode vs name similarity) and the
7-day reversal window in plain language. The whole widget
auto-hides when both lists are empty (`!hasPairs && !hasLog`) so it
doesn't take up real estate for new users.

### SecuritySection (`components/settings/SecuritySection.tsx`)

Three sub-flows:

1. **Sign-in methods** — pills showing `Email + Password` and/or
   `Google` based on `firebaseUser.providerData`.
2. **Change Password** (if email+password user) — current /
   new / confirm fields with a live validation checklist (≥ 8
   chars, contains digit, mixed case, match). Triggers Firebase
   reauth → `updatePassword` flow. Maps `auth/wrong-password` and
   `auth/requires-recent-login` to friendly messages. "Forgot
   your password?" link uses `sendPasswordResetEmail`.
3. **Set a Password** (if Google-only user) — same checklist; uses
   `reauthenticateWithPopup(GoogleAuthProvider)` before
   `updatePassword`. Adds email+password as an alternate sign-in.
4. **Link Google Account** (if not already linked) — single button
   running `linkWithPopup`. Maps `auth/credential-already-in-use`
   to "This Google account is already linked to another user."
5. **Delete Account** (Danger Zone) — two-step confirmation with
   "type DELETE" gate. Re-auths with whichever provider, calls
   `DELETE /api/admin/users/:uid` to delete the Firestore profile,
   then `deleteUser()` for Firebase Auth, then `signOut()`. The
   Firestore delete may 403 for non-admin users — the code swallows
   the error and notes that admin-side cleanup will run later.

Inline help is already good throughout; no extra helpers added in
this pass beyond the page-level overview.

## Misplaced section

**FSM Engine** card (rendered at the bottom of `SettingsPage.tsx`)
exposes internal state-machine names:

- Item Lifecycle (`scanned → active → consumed | expired | discarded`)
- Review Workflow (`pending_review → approved | rejected | needs_info`)
- Foodbank Pipeline (`healthy → cooldown → disabled`)

This is developer-oriented information, not user-facing. Two valid
moves:

1. **Move to Admin Settings → Diagnostics** — admin-only context,
   keeps the info available without confusing end users.
2. **Delete entirely** — the same data already lives in
   `docs/STATE_DRIVEN_UI.md` for engineers; users don't need it.

Either is preferable to the current placement. Out of scope for
this helper-pass; flagged for a future cleanup commit.

## Data sources

- `useMe()` — `/api/me`. Source for Account card + initial values
  for currency / shopping-list preferences.
- `useHousehold()` — `/api/household`. Drives `<HouseholdSection />`'s
  view branching.
- `useLocations()` — used by `<GrocerySection />`'s default-storage
  dropdown.
- `useCatalogDuplicates()`, `useTransferLog()` — drive
  `<MergeNudgeWidget />`. Both fetched lazily; widget hides when
  both return empty.
- `firebase/auth` SDK directly — `<SecuritySection />` does its own
  Firebase auth calls without going through the API client.

## Helper UX choices

- **Page-level "ⓘ What can I change here?" expandable** — single
  source of truth for what each section owns, so the user can
  decide where to go before scanning all eight cards. Lives at the
  top of the page so it's discoverable.
- **Per-section in-component helpers** rather than one giant
  page-level helper — each subcomponent already had partial inline
  copy; we strengthened the gaps (Household empty-state, Catalog
  cleanup explainer) so the helper sits next to the controls it
  describes, not eight cards away.
- **`title=` tooltips on destructive buttons + UID/Role labels** —
  hover-only reinforcement for the dialog copy, no extra layout
  weight.

## Update discipline

When adding a new section:

1. Add a new component under `components/settings/`.
2. Mount it in `SettingsPage.tsx` between two existing sections
   (decide ordering by frequency-of-use, not alphabetical).
3. Add a one-line entry to the page-level "ⓘ What can I change
   here?" helper.
4. Add a section paragraph under "Section components" here.

When adding a destructive action to an existing section:

1. Wrap the action in `useConfirmDialog`.
2. Add a `title=` tooltip on the trigger button stating what the
   action affects and what's preserved.
3. Mirror the tooltip wording to the dialog `message` to avoid
   user-facing inconsistency.

When changing currency-preference semantics (e.g. if past events
ever start re-aggregating on change):

1. Update the inline copy in `DisplayCurrencySection.tsx`.
2. Update the page-level helper bullet.
3. Mirror in `dashboard.md` and `spending.md` "Currency" sections.

When the FSM Engine card eventually moves or is deleted: remove the
**Misplaced section** notice here too.
