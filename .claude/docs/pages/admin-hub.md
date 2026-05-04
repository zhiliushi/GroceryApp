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

## Stats dashboard (Sprint 2)

Mounted at the top of the page, above the tabs. Reads the `stats`
blob already returned by GET /api/admin/feedback (no extra query).
Surfaces six headline counters:

- **Total** — corpus size.
- **Unresponded** — admin's queue: total minus threads with an
  `admin_response` set. Highlighted amber when >0.
- **Active** — visible to users (not auto-archived).
- **Archived** — auto-archived (resolved/wont_fix > 24h).
- **Pinned** — threads admin marked to bypass the 24h sweep.
  Highlighted purple when >0.
- **Median 1st reply** — median time from user submission to first
  admin reply, across replied threads. Reads from `responded_at`
  today; will switch to the FIRST message author=admin once the
  threading subcollection is the source of truth corpus-wide.

Plus two compact rows: **By kind** (bug / feature / cap_request /
general) and **By badge** (the same emoji set BadgeChip uses).

`feedback_service.stats()` walks the whole collection in one stream
— fine at closed-beta scale (≤ a few thousand docs over the lifetime
of the beta). If we cross ~10k feedback rows we'd swap to periodic
materialised counters; not worth the complexity yet.

## Summary card (Sprint 2)

Each FeedbackCard has a "Summary card" editor between the user
message and the BadgePicker. Admin types a one-line takeaway (≤280
chars). When set:

- Rendered prominently at the top of the user's MyFeedback row in a
  ga-accent-tinted band ("📌 <summary text>"), above the kind label
  and message preview.
- Admin sees the same text on the FeedbackCard with a "click to edit"
  affordance.

Distinct from `admin_response` (the reply body): the summary is the
TL;DR a casual reader should see at a glance. Examples: `"Shipped
in v0.7 — see What's new"`, `"Tracked — duplicate of #abc"`,
`"Working on it; ETA next sprint"`. Empty string clears.

Backend: new `summary: str | null` field on the feedback doc.
`update_feedback(summary=...)` accepts it; trims + caps at 280 chars;
`""` clears.

## Threading (Sprint 2)

Full multi-turn threading via a `messages/{id}` subcollection on
each feedback doc.

- **Storage**: `feedback/{feedback_id}/messages/{msg_id}` with
  `{author: 'user' | 'admin', text, created_at, author_email,
  materialized_from_legacy?}`.
- **Read-time fallback**: legacy v1/v2 docs without any messages but
  with an `admin_response` field set get a single virtual admin
  message synthesized at read time (`virtual: true`). The UI renders
  it with a "(legacy single reply)" hint. The synthesized message is
  NOT written back — it's purely a read-time projection.
- **First admin message in a legacy thread**: when admin posts a new
  message and the thread had a legacy `admin_response` but no real
  subcollection rows, the legacy reply is materialized as a real
  message row first (with `materialized_from_legacy: true`) so the
  chronological order stays correct.
- **admin_response mirror**: every admin message also writes the
  latest text into the parent's `admin_response` field. This keeps
  legacy single-reply UIs (the v1 FeedbackTab in Admin Settings,
  the my-feedback inline fallback) showing the most recent admin
  reply without needing to know about the messages subcollection.
- **`responded_at`**: stamped on every admin message. The 24h
  archive timer reads from this field.
- **User reply re-opens**: when a user posts a reply on a thread
  with `status ∈ {resolved, wont_fix}`, the parent's status bumps
  back to `triaged`. Pinned/badge/summary stay untouched. The
  thread re-appears on admin's Inbox tab.

### Endpoints

- User-side (ownership enforced server-side):
  - `GET /api/feedback/{id}/messages` — read own thread
  - `POST /api/feedback/{id}/messages` `{ text }` — reply on own thread
- Admin-side (admin gate):
  - `GET /api/admin/feedback/{id}/messages` — read any thread
  - `POST /api/admin/feedback/{id}/messages` `{ text }` — reply on any thread

### Frontend

- `<FeedbackThread feedbackId scope />` — shared component used by
  both the admin-side FeedbackCard and the user-side MyFeedback row.
  `scope='admin'` reads/writes through admin endpoints; `scope='mine'`
  through user endpoints.
- Cache key: `['feedback', 'thread', id, scope]`. Posting a message
  invalidates BOTH scopes for the thread plus the parent lists
  (`['admin', 'feedback']` and `['feedback', 'mine']`) so admin and
  user see each other's reply on next refetch.
- Render: chronological list with right-align for the viewer's own
  messages (admin sees their own replies right-aligned; user sees
  their own replies right-aligned). Admin messages are
  ga-accent-tinted; user messages are plain bg.

The single-reply textarea on the admin side has been replaced by the
threaded view; the admin notes (private) editor is preserved.

## Future work (not in this slice)

- **Telegram badge-change / reply notify** — currently we only
  notify on new submission, not on subsequent badge / reply changes
  or user replies. User replies in particular re-open closed threads
  and admin should know.
- **Thread-edit / delete** — today messages are append-only. Edit
  affordance for typo-fix is the obvious next ask.
- **AI-summarise** — populate the summary card from an LLM that
  reads the whole thread + the user's submission. Today admin types
  it manually.

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
