# Admin Hub page

Route: `/admin-hub` (admin-only — wrapped in `AdminRoute` like every other
admin path)
File: `backend/web-admin/src/pages/admin-hub/AdminHubPage.tsx`
Sidebar: admin section, `🛡️ Admin Hub` (between `Experimental` and
`Admin Settings`)

Shipped 2026-05-04 from the customer-feedback v2 design pass. Up to this
point admin triage was one tab inside Admin Settings (`<FeedbackTab />`).
The tab grew enough new responsibilities (cute badges, replies, pin,
archive sweep) to deserve its own page — and to mirror the user-side
User Hub structurally so admin always knows which surface the user is
reading.

## Purpose

The destination admin opens to read what users sent in, attach a
friendly badge, reply, and decide whether the thread is worth keeping
on the wall (pin) or letting it auto-archive after 24h. Closes the
loop that the floating 💬 feedback button opened on the user side.

## Composition — three tabs

```
[📨 Inbox]  [📌 Pinned]  [📂 Archived]                    Kind: [all ▾]
```

### 1. Inbox (default)

Active threads. Calls `useAdminFeedback({ archive_view: 'active' })`.
Backend filter excludes any thread where `status ∈ {resolved, wont_fix}`
AND `responded_at` (or fallback timestamp) is older than 24h, unless
`pinned`. Pinned threads here are still actionable; the Pinned tab
just gives a focused view.

### 2. Pinned

Threads admin tagged "keep visible". Calls
`useAdminFeedback({ archive_view: 'all', pinned_only: true })` so this
tab returns pinned rows regardless of archival eligibility. The "wall
of valuable feedback" — recurring concerns, ideas that shipped, etc.

### 3. Archived

Auto-archived (resolved/wont_fix > 24h). Calls
`useAdminFeedback({ archive_view: 'archived' })`. Read-mostly. Admin
can un-archive by either toggling the status back to `triaged` (or
back to `new`) OR by pinning, which immediately moves the row out of
the archived bucket.

### Kind filter

Single dropdown (`bug` / `feature` / `cap_request` / `general`) applied
on top of the active tab. Threaded through the existing
`list_feedback(kind=...)` filter on the backend.

## Per-row UI (`FeedbackCard`)

Top: kind label · source · user email; right side has the current
`<BadgeChip />` (when set), the internal `status` pill, and a `📌 pinned`
chip if pinned.

Body:
1. **User message** (read-only, whitespace-pre-wrap).
2. **Context blob** (`<details>`-collapsed) when the submission carried
   one — page_path, user_agent, app_version, breadcrumb_routes from
   the floating button + cap_request context blobs.
3. **`<BadgePicker />`** — clickable grid of all six cute badges. One
   click sets; clicking the active badge clears it (toggle). Plus a
   `clear` link when any badge is set. Pulls from the same
   `BADGE_CONFIG` + `BADGE_KEYS` exports used by `<BadgeChip />` so the
   picker and the user-facing chip stay in sync.
4. **Reply textarea** (max 2000 chars) + Send / Update / Clear buttons.
   Setting `admin_response` on the backend stamps `responded_at`,
   which is what the 24h archive timer reads from. Empty-string clear
   keeps `responded_at` so the timer doesn't reset on a misclick.
5. **Action row**:
   - 📌 Pin / Unpin toggle (sets `pinned` boolean).
   - Status select (`new` / `triaged` / `resolved` / `wont_fix`).
6. **Admin notes** (private) — separate from `admin_response`. Not
   shown to the user. Used by admin for triage memory ("waiting on
   data team", "duplicate of #abc", etc.).

## Cache invalidation

`useUpdateFeedback` invalidates both `['admin', 'feedback']` (so other
admin tabs / Sidebar badge counts refresh) AND `['feedback', 'mine']`
(so the user's My feedback list picks up the new badge / reply / pin
on next refetch). One mutation, both surfaces consistent.

## Deep-link support

`/admin-hub?id=<feedback_id>` scrolls the matching row into view +
highlights it with a 2-ring accent for 3 seconds. The Telegram
notification (`notification_service.notify_admin_feedback`) constructs
this URL so admin can tap-through from chat directly to the row.

If the feedback id isn't in the current tab's bucket, the page
auto-switches to the Inbox first, then re-runs the scroll-on-mount
logic. URL param is consumed once (replaceState) so a refresh doesn't
re-trigger.

## Why a separate page (vs. extending FeedbackTab)

- **Mirrors User Hub structurally** — admin reads exactly what the
  user reads, plus action affordances. Easier to keep the closed-loop
  mental model.
- **Per-tab queries are cheap** — three small `useQuery` results vs.
  one fat tab with client-side bucket filtering.
- **Admin Settings stays a settings page** — sliding new triage
  features into it kept inflating the tab list.

The legacy `<FeedbackTab />` in Admin Settings is left in place for
backward compat with existing Telegram links that target that tab.
It now reads the same backend data but carries the lightweight,
read-mostly v1 UI. Once we're sure no external link (Telegram
notifications, internal docs) references it, retire it.

## Future work (not in this slice)

- **User-reply threading** — full multi-turn threading with a
  `messages` subcollection. Today's design = "latest admin reply
  wins". Sprint 2.
- **Save / summarise into a card** — admin extracts a one-liner
  summary from a thread for the public-facing What's new feed. Today
  the badge `🚀 Shipped` is the only signal that bridges feedback →
  release notes.
- **Stats dashboard** — by-status / by-kind / median time-to-first-
  reply. Backend `feedback_service.stats()` already returns the
  aggregates; just needs a card.
- **Telegram badge-change notify** — currently we only notify on new
  submission, not on subsequent badge / reply changes.

## Backend touchpoints

- `app/services/feedback_service.py` — `_VALID_BADGES`, `is_archived`
  helper, `update_feedback(admin_response, admin_badge, pinned)`,
  `list_feedback(archive_view=...)`.
- `app/api/routes/admin.py` — GET `/api/admin/feedback` accepts
  `archive_view` + `pinned_only`; PATCH `/api/admin/feedback/{id}`
  accepts `admin_response`, `admin_badge`, `pinned` in body.
- Schema version bumped to `2` for new docs; old `schema_version=1`
  rows render fine because the new fields are optional with explicit
  null-tolerant defaults.
