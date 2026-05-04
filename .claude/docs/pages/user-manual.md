# User Manual page

Route: `/help`
File: `backend/web-admin/src/pages/help/UserManualPage.tsx`
Sidebar: secondary nav (under "▼ More" → "User Manual" 📘)

## Purpose

Single source of truth for user-facing help. Mirrors the actual feature
surface — when a feature lands or changes, this page MUST be updated in
the same PR.

The manual is organised by user task (getting started → adding →
tracking → spending/waste → maintenance → tier → FAQ), NOT by codebase
module. The reader is a layperson, often a Malaysian housewife managing
a family pantry; copy is plain-language, no engineering jargon.

## Composition

- **Sticky TOC** on desktop (left column, 200px). Scrolls in step with
  the article via `IntersectionObserver` substitute (raf-throttled
  scroll listener picking the topmost heading within 120px of viewport
  top).
- **Article body** (right column) — 11 numbered sections rendered as
  separate React subcomponents in the same file. Co-locating keeps the
  manual diff visible to anyone editing a feature.

  Section 1 (`GettingStarted`) carries an H3 subsection
  **"Signing in for the first time"** that documents the five auth-state
  screens (verify-email / pending-approval / registration-form /
  registration-closed / disabled). Per update discipline, the four small
  auth-state pages
  (`backend/web-admin/src/pages/auth/{VerifyEmail,PendingApproval,Disabled,RegistrationClosed}Page.tsx`
  + `backend/web-admin/src/pages/register/RegistrationFormPage.tsx`) do
  NOT get separate `.claude/docs/pages/*.md` files — they're documented
  here in the user manual instead, since each page is a one-decision
  full-screen flow with little surface area.
- **Tier badges** (`<Tier level="free|plus|pro|always-free|admin" />`)
  inline-tag features that aren't universal. Source of truth for tier
  copy is `backend/app/services/config_service.py` `_DEFAULT_TIERS` —
  if pricing or limits change there, update the table in section 9
  (`Tiers`).
- **FAQ** at the bottom uses click-to-expand `<Question>` rows.

## Update discipline

When you add/remove/change a user-visible feature:

1. Find the relevant section component (`GettingStarted`, `AddingItems`,
   `TrackingItems`, `UsingItems`, `Spending`, `Waste`,
   `RemindersInsights`, `Catalog`, `Tiers`, `Faq`) in
   `UserManualPage.tsx`.
2. Update copy + tier badge if the feature is gated.
3. If the feature is genuinely new (own page or major surface), add
   either a new section or a new bullet under the closest existing one
   — keep the 10-section count stable; add subsections, not new top
   sections.
4. If it's a tier-limit change, update section 9's table AND the
   `_DEFAULT_TIERS` config in lockstep.
5. Update `feature-inventory.md` (the canonical feature → page → tier
   map) so future contributors know where features live.

## Why a single-file page

Initial design was multi-file (`sections/GettingStarted.tsx` etc).
Rejected because the manual changes rarely and is read top-to-bottom
— scattering it across files makes the discipline rule ("update the
manual when you ship a feature") harder to enforce: a contributor
might edit a feature without realising the manual exists. One file
keeps it visible in PR diffs and grep results.

## Not included (by design)

- Admin docs — separate audience, lives in `docs/` markdown files.
- Onboarding tutorial — handled by `<ProgressiveNudge />` and
  `NudgeBanner`, which surface guidance contextually.
- API documentation — backend concern, lives in `docs/API.md`.
- Build/deploy steps — engineer concern, lives in `CLAUDE.md`.
