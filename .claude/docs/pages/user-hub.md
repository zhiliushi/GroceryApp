# User Hub page

Route: `/help`
File: `backend/web-admin/src/pages/help/UserManualPage.tsx`
Sidebar: secondary nav (under "▼ More" → "User Hub" 📘)

Renamed from "User Manual" on 2026-05-04. Filename + route stay
unchanged (`UserManualPage.tsx`, `/help`) for backward compat with
existing in-app links and bookmarks; only the visible label changes.
The displayed page title is "User Hub". The default export is still
`UserManualPage` to avoid touching `router.tsx`.

## Purpose

The destination users come back to for help, what's new, their
feedback, and catalog cleanup. Up to 2026-05-04 it was a static help
page only ("User Manual"); the rename + tabs reflect the expanded
role.

The page has a single goal: be the place a user opens to *learn what
the app does* and *see what it's done for them.*

## Composition — four tabs

```
[📘 Manual]  [✨ What's new]  [💬 My feedback]  [🧹 Catalog cleanup]
```

### 1. Manual (default tab)

The original help content. Sticky TOC on desktop (left column,
200px); article body (right column) of 12 numbered sections rendered
as separate React subcomponents in the same file. Scroll-spy via
raf-throttled scroll listener picking the topmost heading within
120px of viewport top.

Section 1 (`GettingStarted`) carries the H3 sub-section
**"Signing in for the first time"** documenting the five auth-state
screens (verify-email / pending-approval / registration-form /
registration-closed / disabled). The four auth-state pages
(`pages/auth/*`) + `RegistrationFormPage` do NOT get separate
`.claude/docs/pages/*.md` files — documented here instead since each
is a one-decision full-screen flow with little surface area.

Hash anchors (`/help#getting-started` etc.) auto-activate the Manual
tab via a `useLocation().hash` effect, so existing in-app deep-links
keep working.

Tier badges (`<Tier level="free|plus|pro|always-free|admin" />`)
inline-tag features that aren't universal. Source of truth for tier
copy is `backend/app/services/config_service.py` `_DEFAULT_TIERS` —
if pricing or limits change there, update the table in section 9
(`Tiers`).

### 2. What's new

Static array of changelog entries in
`backend/web-admin/src/components/help/WhatsNewTab.tsx`. Newest
first, grouped by date. Four kinds — `feature` ✨ / `improvement` 🔧
/ `fix` 🐛 / `notice` 📢 — each with a coloured chip and an optional
in-app link.

Why static (not a Firestore-backed admin-curated feed): for closed
beta with N=2-50 users, code-shipped entries are simpler, version-
controlled, and tied to actual releases. Switch to Firestore later
if admin needs to post non-code announcements (maintenance windows,
etc.) without a deploy.

### 3. My feedback

Wraps `<MyFeedbackSection emptyVariant="inline" />` (the same
component formerly mounted on Settings). Lists the user's
submissions newest-first; when admin has replied, the response
renders inline. Empty state explains the floating 💬 button.

Each row shows (top-right priority, in order):
1. **Cute badge** when admin set one (`👀 Noted` / `🔧 We're on it`
   / `💬 Need more info` / `✅ Resolved` / `🚀 Shipped` /
   `🌱 Parked`). Badges live in `<BadgeChip />` and are admin's
   user-friendly take on where the thread stands.
2. **Status pill** as fallback (`new` / `triaged` / `resolved` /
   `wont_fix`) when no badge is set yet.

Pinned threads (admin marked "keep visible") get a purple ring +
`📌 pinned` indicator and survive the auto-archive sweep.

**24h archive sweep:** threads that admin marked `resolved` or
`wont_fix` auto-hide from the main view 24 hours after the last
admin reply (`responded_at`, falling back to `updated_at`). When
the user has any archived rows, a "Show archived (N)" toggle
appears in the section header so they can re-open the past
threads. Pinned threads bypass archival entirely. Archive logic
lives in `feedback_service.is_archived` server-side; the SPA
calls `useMyFeedback('active' | 'archived')` per the toggle.

**Summary card (Sprint 2):** when admin sets a one-line takeaway
(`summary` field), it renders as a prominent ga-accent-tinted band
at the top of the row above the kind label
(`📌 <summary text>`). Distinct from the admin's reply body —
it's the TL;DR. Empty cases stay hidden.

**Threaded conversation (Sprint 2):** the row body now hosts a
`<FeedbackThread scope="mine" />` chronological message list +
reply textarea, replacing the single admin-response block. Behaviour:

- Loads automatically when the row is expanded OR has an admin
  reply (legacy single reply OR any messages on the subcollection).
- The user can reply directly in the thread. A user reply re-opens
  a closed thread (`status ∈ {resolved, wont_fix}` bumps back to
  `triaged`) so admin sees it again on their Inbox.
- Right-aligned bubbles for the user's own messages; admin replies
  show ga-accent-tinted on the left.
- Legacy single-reply rows (v1/v2 admin_response field) render the
  prior reply as a "(legacy single reply)" message; the next admin
  message materializes it as a real message row.

### 4. Catalog cleanup

Wraps `<MergeNudgeWidget emptyVariant="inline" />`. Likely-duplicate
items the catalog scanner spotted (shared barcode or near-identical
name) plus a 7-day Undo log for any merges run. Reviewing here is
non-destructive — the actual merge happens on each item's catalog
page via the deep-link in the row.

Both #3 and #4 used to live on Settings. Settings now carries a
note pointing here.

## Update discipline

When you add/remove/change a user-visible feature, update **two**
places in the same PR:

1. **Manual tab** — find the relevant section component (`GettingStarted`,
   `AddingItems`, `TrackingItems`, `UsingItems`, `Spending`, `Waste`,
   `RemindersInsights`, `Catalog`, `Tiers`, `MealsHomemaker`,
   `Preppers`, `Faq`) in `UserManualPage.tsx`. Update copy + tier
   badge if the feature is gated.

2. **What's new tab** — append an entry to `ENTRIES` in
   `components/help/WhatsNewTab.tsx`. Keep the title under ~60 chars,
   the description to ~2 sentences, and add an in-app `link` if the
   change is on a specific page. Tag with the right `kind`
   (feature/improvement/fix/notice).

If the feature is genuinely new (own page or major surface), add
either a new section or a new bullet under the closest existing
Manual section — keep the 12-section count stable; add subsections,
not new top sections.

If it's a tier-limit change, update section 9's table AND the
`_DEFAULT_TIERS` config in lockstep.

Update `feature-inventory.md` (the canonical feature → page → tier
map) so future contributors know where features live.

## Why one file for the Manual sections

Initial design was multi-file (`sections/GettingStarted.tsx` etc).
Rejected because the manual changes rarely and is read top-to-bottom
— scattering it across files makes the discipline rule harder to
enforce: a contributor might edit a feature without realising the
manual exists. One file keeps it visible in PR diffs and grep
results.

The four-tab refactor preserves this: `WhatsNewTab` lives in its
own file (it has its own discipline), and the moved widgets stay
where they were imported from. Only the page-level wrapper gained
tab navigation.

## Not included (by design)

- Admin docs — separate audience, lives in `docs/` markdown files.
- Onboarding tutorial — handled by `<ProgressiveNudge />` and
  `<NudgeBanner />`, which surface guidance contextually.
- API documentation — backend concern, lives in `docs/API.md`.
- Build/deploy steps — engineer concern, lives in `CLAUDE.md`.
- Public roadmap — deliberately not surfaced; users can submit
  feature requests via the 💬 feedback button instead.
