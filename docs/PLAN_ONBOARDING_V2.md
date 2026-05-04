---
title: Onboarding & Auth Plan v2 — closing the registration gaps
compiled: 2026-05-03
purpose: Close the first-login profile gap, enforce email verification, gate self-signup behind admin approval, bind invitations to emails, add operator-controlled web URL.
audience: Shahir
operating_constraints:
  - access_model: hybrid (invited auto-approve, self-signups need admin)
  - registration_form: standard (name + country + currency)
  - web_url_config: single canonical URL + maintenance banner toggle
  - email_verification: hard-block until verified
linked_from: legal_launch_research.md
---

# Plan — Onboarding & Auth v2

## Status (2026-05-04) — ✅ ALL PHASES COMPLETE

| Phase | Scope | Status |
|---|---|---|
| 0 | Backend foundation (schema fields, helpers, backfill script) | ✅ Shipped + backfill executed (1 user created — wife's profile) |
| 1 | Auth gate (email_verified enforcement + role-cache) | ✅ Shipped, mocked tests 8/8 pass |
| 2 | `/api/me` state-machine rewrite + complete-registration endpoint | ✅ Shipped, state-machine tests 10/10 pass |
| 3 | Invitation Firestore transaction + email-bound enforcement + email URL gate | ✅ Shipped, AST clean |
| 4 | Frontend AuthGate + 5 auth pages + maintenance banner + JoinPage update | ✅ Shipped, tsc + vite clean |
| 5 | Maintenance middleware + admin reject endpoint + token revocation + UI extensions + forgot password | ✅ Shipped, AST + tsc + vite clean. Bug found+fixed during validation: maintenance middleware now bypasses OPTIONS preflight |
| 6 | Backfill verify + plan doc closeout | ✅ **2026-05-04**: backfill `--dry-run` returns `Scanned: 2, Missing: 0, Skipped: 2`. All Firebase Auth users have Firestore profiles. No drift |

**Final live-state snapshot (2026-05-04):**
- `app_config/system`: all v2 fields populated (`web_public_url=https://groceryapp-backend-7af2.onrender.com`, `maintenance_mode=false`, `registration_open=true`, `max_active_users=50`)
- `users/`: 2 profiles, 0 missing
- `invitations/`: 0 in flight (clean slate)
- Backend: Phases 0-5 code shipped (after `git push origin main && git push render main:master`)
- Frontend: Phase 4 SPA shipped (post-deploy build picks it up automatically via Render's Docker build)

**5 audit gaps closed:**
1. ✅ First-login profile creation gap (Phase 0 + Phase 2)
2. ✅ Email verification not enforced for password-provider (Phase 1)
3. ✅ Invitation accept race condition (Phase 3 — Firestore transaction)
4. ✅ Email-bound invitation enforcement (Phase 3 — `invited_email` match required at accept)
5. ✅ Token revocation on disable/demote (Phase 5 — `revoke_refresh_tokens` + `_evict_role_cache`)

**Plus 5 Decision-driven hardenings:**
1. ✅ Hybrid access (invited auto-approve, self-signup pending)
2. ✅ Standard registration form (name + country + currency)
3. ✅ Single web URL + maintenance toggle
4. ✅ Hard-block email verification
5. ✅ Per-pending-signup admin notification (best-effort, requires web URL set)

**Future (deferred — see Phase 3+ work below):**
- MH-1 to MH-4: multi-household support (data model refactor, ~3–5 days, gated on Phase 2 retention signal)
- MFA for admin tier (Phase 3 launch — UK + AU)
- Auto-rejection of pending users after 30 days (if queue gets long)
- Account-method linking (Firebase Console toggle, 1 click)
- Phone-based auth (Phase 4 UAE/KSA)
- `/api/household/join/<code>` GET requires auth (small enumeration-surface tightening)

## Confirmed operational decisions (2026-05-03)

| # | Decision | Effect |
|---|---|---|
| 1 | Backfill creates `status="active", registration_complete=false` profile (force through form) | Existing dev/test users hit registration form on next login. Cleaner data over UX bump trade-off accepted. NOT routed to admin pending queue — existing users are already trusted |
| 2 | Email Shahir per pending signup | New helper `email_service.send_admin_pending_signup_notification()` fires on `/api/me` self-signup path. Best-effort, never blocks the user response. Recipient = email of first `ADMIN_UIDS` entry's Firestore profile (extend to all admins if multiple) |
| 3 | Maintenance mode: write-only block, admin bypass | All non-GET endpoints return 503 when `maintenance_mode=true` AND user is non-admin. Reads still work. Admin role check bypasses |
| 4 | Country list = full ISO 3166 (~250) | No Phase-2 UX bump. Default selection from `Intl.DateTimeFormat().resolvedOptions().locale` |
| 5 | Web URL block applies to **ALL** outbound emails containing links | Centralized wrapper `email_service.send_with_url()` calls `get_web_url_or_raise()` first. Affected emails: invitation, password reset, email verification resend, admin pending-signup notification, account-disabled notification, future link-bearing emails |

## TL;DR

Close 5 gaps from the audit by:

1. **Auto-create `users/{uid}` on first `/api/me` call** (was: silently absent → household + admin ops fail)
2. **Hybrid access model**: invitation-link users auto-approve; self-signups go to admin queue with status=pending
3. **Hard-block email verification**: password-provider users can't pass `/api/me` until `email_verified=true`. Google auto-verifies (Google guarantees the email)
4. **Email-bound invitation acceptance** + Firestore transaction protection (race-safe, code-can't-be-shared)
5. **Admin-configurable web URL** + maintenance-mode banner; flows that rely on URL block if unset

## State machine (the hot path)

`/api/me` returns one of these states based on the user's data + system config:

| State | Trigger | Frontend renders |
|---|---|---|
| `unauthenticated` | No token / token invalid | `/login` |
| `verify_email_required` | Token valid, `sign_in_provider=password`, `email_verified=false` | "Check your inbox" page with resend button |
| `pending_approval` | `users/{uid}.status="pending"` | "Waiting for admin approval" page |
| `registration_required` | `users/{uid}.status="active"`, `registration_complete=false` | Registration form (name + country + currency) |
| `disabled` | `users/{uid}.status="disabled"` | "Your account has been disabled" page (read-only or signed out) |
| `active` | `users/{uid}.status="active"`, `registration_complete=true` | Dashboard |

## Data model additions

### `users/{uid}` — new fields

| Field | Type | Default | Source of write |
|---|---|---|---|
| `status` | string | `"pending"` (self-signup) or `"active"` (invited) | `/api/me` first-call OR `approve_user` |
| `registration_complete` | bool | `false` | `/api/me/complete-registration` |
| `country` | string (ISO alpha-2) | `null` | Registration form |
| `currency_preference` | string (ISO 4217) | `null` (existing field) | Registration form |
| `invitation_code_used` | string \| null | `null` | `/api/me` if `?invitation_code=` present |
| `pending_approval_at` | int (ms) | now() if pending | `/api/me` first-call |
| `approved_at`, `approved_by` | int, string | (existing) | `approve_user` |
| `email`, `display_name` | string | from token | `/api/me` first-call |

### `app_config/system` — new fields

| Field | Type | Default | Notes |
|---|---|---|---|
| `web_public_url` | string | `""` | e.g. `https://app.brand.com`. Validated `https://` + non-empty when used |
| `maintenance_mode` | bool | `false` | Flips on during Tier-3 Firestore migration; admin still has full access |
| `maintenance_message` | string | `""` | Shown in site-wide banner when `maintenance_mode=true` |
| `registration_open` | bool | `true` (existing) | Master kill-switch for all new accounts |
| `max_active_users` | int | `50` (existing) | Closed-beta cap |

### `invitations/{code}` — uses existing fields, semantics tightened

- `invited_email` is now ENFORCED at acceptance (case-insensitive match required if set)
- `status` transitions wrapped in Firestore transaction

## New endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/me?invitation_code=CODE` | Token required | Refactored. Auto-creates profile on first call. State machine above |
| POST | `/api/me/complete-registration` | Token + `registration_required` state | Sets name + country + currency; flips `registration_complete=true`; auto-accepts pending invitation if `invitation_code_used` set |
| POST | `/api/me/resend-verification` | Token + `verify_email_required` | Triggers Firebase to resend the verification email (rate-limited 1/min/uid) |
| GET | `/api/admin/users/pending` | Admin | List users with `status="pending"` |
| POST | `/api/admin/users/{uid}/approve` | Admin | Flips status `pending → active`. Already exists in `user_service.approve_user`; needs route exposure |
| POST | `/api/admin/users/{uid}/reject` | Admin | Sets status `disabled` with `reason="rejected"` + revokes refresh tokens |
| GET | `/api/config/public` | Optional | Returns `web_public_url`, `maintenance_mode`, `maintenance_message`. Public so the maintenance banner shows even on the login page |
| PUT | `/api/admin/system-config` | Admin | Update `web_public_url`, `maintenance_mode`, `maintenance_message`. Validates URL format |

## Backend changes — file-by-file diff plan

### [`backend/app/core/auth.py`](../backend/app/core/auth.py)

- Extend `_verify_token` to reject password-provider users with `email_verified=false`:
  ```python
  decoded = firebase_auth.verify_id_token(token)
  provider = decoded.get("firebase", {}).get("sign_in_provider")
  if provider == "password" and not decoded.get("email_verified"):
      logger.info("Token rejected: email not verified for uid=%s", decoded.get("uid"))
      return None
  return decoded
  ```
- Add 5-min in-memory LRU cache keyed by uid for `_get_user_role` (stops the per-request Firestore read)
- Add helper `_get_user_with_state(uid)` returning `(profile_dict, state_str)` for use by `/api/me`

### [`backend/main.py`](../backend/main.py) — `/api/me` rewrite

Replace the current 36-line `/api/me` handler with the state-machine version (see Appendix A below for full code). Key behaviour:

1. If no token → return `{authenticated: false}`
2. If token valid but `email_verified=false` (password provider) → return `{authenticated: true, state: "verify_email_required"}`
3. Look up `users/{uid}`:
   - **If profile exists**: return state based on `status` + `registration_complete`
   - **If profile missing**:
     - Validate `?invitation_code=CODE` if present → if valid AND email matches → create with `status="active"`, `invitation_code_used=CODE`, `registration_complete=false` → return `state: "registration_required"`
     - Else: check `registration_open` + user-cap → if blocked, return `state: "registration_closed"` with reason → else create with `status="pending"`, `pending_approval_at=now`, `registration_complete=false` → return `state: "pending_approval"`
4. Always include in response: `web_public_url`, `maintenance_mode`, `maintenance_message` (so frontend can render banner without separate call)

### [`backend/app/services/user_service.py`](../backend/app/services/user_service.py)

Add:
- `create_user_profile(uid, email, display_name, status, invitation_code=None) -> dict` — single source-of-truth profile creator. Sets all required fields with `set()` (not `update()`). Replaces the implicit creation via currency-preference endpoint.
- `complete_registration(uid, name, country, currency) -> dict` — validates fields, sets `registration_complete=true`, returns updated profile. Auto-accepts pending invitation if `invitation_code_used` is set on the user doc.
- `reject_user(uid, admin_uid, reason) -> bool` — sets status=disabled with reason="rejected"; calls `firebase_auth.revoke_refresh_tokens(uid)`.

Modify:
- `update_user_status` → on transition to `disabled`, call `firebase_auth.revoke_refresh_tokens(uid)` to force immediate logout
- `update_user_role` → same revoke (admin demote)

### [`backend/app/services/invitation_service.py`](../backend/app/services/invitation_service.py)

Wrap `accept_invite` in a Firestore transaction:

```python
@firestore.transactional
def _accept_in_txn(txn, code, uid, user_email, display_name):
    inv_ref = _invitations().document(code)
    inv = inv_ref.get(transaction=txn).to_dict()
    if inv is None or inv["status"] != "pending":
        raise ValueError("Invalid or already-used code")
    expires_at = datetime.fromisoformat(inv["expires_at"])
    if expires_at < datetime.utcnow():
        raise ValueError("Code expired")
    # NEW: email-bound enforcement
    invited_email = (inv.get("invited_email") or "").strip().lower()
    if invited_email and invited_email != user_email.strip().lower():
        raise ValueError("This invitation is for a different email address")
    # ... add member to household within the same txn ...
    txn.update(inv_ref, {"status": "accepted", "accepted_by": uid, "accepted_at": ...})
```

### [`backend/app/services/config_service.py`](../backend/app/services/config_service.py)

Extend `_DEFAULT_SYSTEM` and add helpers:

```python
_DEFAULT_SYSTEM = {
    "max_active_users": 50,
    "registration_open": True,
    "web_public_url": "",
    "maintenance_mode": False,
    "maintenance_message": "",
    "updated_at": None,
    "updated_by": None,
}

def get_web_url_or_raise() -> str:
    """Returns the configured public URL. Raises WebUrlNotConfiguredError if unset.
    Called by email service before sending invitation/reset/notification emails."""
    config = get_system_config()
    url = (config.get("web_public_url") or "").strip()
    if not url:
        raise WebUrlNotConfiguredError(
            "Public web URL not configured. Admin: set this in Settings → System."
        )
    if not url.startswith("https://"):
        raise WebUrlNotConfiguredError(
            "Public web URL must start with https://"
        )
    return url
```

### [`backend/app/services/email_service.py`](../backend/app/services/email_service.py) (NEW or extend existing)

**Central wrapper for all link-bearing emails** (per Decision #5):

```python
def send_with_url(template_name: str, to_email: str, context: dict) -> bool:
    """Send any email that includes a link. Blocks if web URL unset.

    Raises WebUrlNotConfiguredError if web_public_url not set in admin settings.
    Returns True on send success, False on best-effort send failure.
    """
    web_url = config_service.get_web_url_or_raise()  # may raise
    context["web_url"] = web_url
    # ... render template + send via cascading providers (Resend → SendGrid → SMTP) ...
```

**All link-bearing email paths route through this wrapper:**
- `send_invitation_email` (existing) — refactor to use `send_with_url("invitation", ...)`
- `send_password_reset_email` — Phase 5 addition; routes through wrapper
- `send_email_verification_resend` — Phase 5 addition; routes through wrapper
- `send_admin_pending_signup_notification(pending_uid, pending_email)` — NEW per Decision #2:
  - Looks up admin email(s): for each `uid` in `settings.ADMIN_UIDS`, read `users/{uid}.email` from Firestore
  - Sends `template_name="admin_pending_signup"` with context `{pending_uid, pending_email, dashboard_url}` (where `dashboard_url = web_url + "/admin/users/pending"`)
  - Best-effort: logs failure, never blocks the user-facing `/api/me` response
- `send_account_disabled_email` — future addition; routes through wrapper

**Calling-side error handling:** endpoints that trigger emails wrap calls and surface 503:
```python
try:
    email_service.send_invitation_email(...)
except WebUrlNotConfiguredError as e:
    raise HTTPException(503, str(e))
```

### New route file: `backend/app/api/routes/admin_users.py`

Expose `pending`, `approve`, `reject` endpoints. Mount under `/api/admin/users`. Existing `admin.py` is for system-config admin actions; user-level admin gets its own route file for clarity.

### Modify [`backend/app/api/routes/admin.py`](../backend/app/api/routes/admin.py)

Add `PUT /api/admin/system-config` endpoint that validates `web_public_url` (must start with `https://` if non-empty), validates `maintenance_message` length (≤500 chars), persists to `app_config/system`.

### Modify [`backend/app/api/routes/household.py`](../backend/app/api/routes/household.py)

In `generate_invite` (line 177–213): before sending invitation email, call `get_web_url_or_raise()`. If it raises, return 503 with `{"detail": "Public web URL not configured. Admin must set this in Settings before invitations can be sent."}`.

## Firestore rules updates

Belt-and-suspenders since backend Admin SDK bypasses rules. Update [firestore.rules](../firestore.rules):

```
match /users/{userId} {
  // Allow read of own profile in any state (so frontend can render pending/registration screens)
  allow read: if isOwner(userId) || (isAuthenticated() && isHouseholdMember(userId));
  // First-time create: must include uid + email; status auto-set by backend, not client
  allow create: if isOwner(userId)
                && hasString('email')
                && request.resource.data.uid == userId;
  // Update: only owner, and cannot self-promote to admin or self-approve
  allow update: if isOwner(userId)
                && (!('role' in request.resource.data) || request.resource.data.role == resource.data.role)
                && (!('status' in request.resource.data) || request.resource.data.status == resource.data.status)
                && (!('approved_at' in request.resource.data) || request.resource.data.approved_at == resource.data.approved_at);
  allow delete: if false;  // backend-only
}
```

## Frontend changes — file-by-file diff plan

### Routing gate ([`backend/web-admin/src/App.tsx`](../backend/web-admin/src/App.tsx))

Wrap the routes in an `<AuthGate>` component that reads `useAuthStore().user.state` and redirects accordingly:

| state | Redirect to |
|---|---|
| `unauthenticated` | `/login` |
| `verify_email_required` | `/auth/verify-email` |
| `pending_approval` | `/auth/pending` |
| `registration_required` | `/register` |
| `disabled` | `/auth/disabled` |
| `active` | (continue to requested route) |

Login page is always reachable (so signed-out users can sign in). Other auth pages are reachable only by users in the matching state.

### New pages

- `pages/auth/VerifyEmailPage.tsx` — shows the user's email + "Resend verification email" button (calls `/api/me/resend-verification`) + "I've verified, refresh" button
- `pages/auth/PendingApprovalPage.tsx` — "Your request is queued. Admin will approve you within 24 hours. We'll email you." + sign-out button
- `pages/auth/DisabledPage.tsx` — "Your account is disabled. Contact admin." + sign-out button
- `pages/register/RegistrationFormPage.tsx` — name (text), country (autocomplete from ISO list), currency (autocomplete from ISO 4217). Defaults from device locale via `Intl.DateTimeFormat().resolvedOptions().locale`

### Updates

- [`stores/authStore.ts`](../backend/web-admin/src/stores/authStore.ts) — extend `AuthUser` type with `state`, `country`, `registration_complete`, `web_public_url`, `maintenance_mode`, `maintenance_message`
- [`pages/login/LoginPage.tsx`](../backend/web-admin/src/pages/login/LoginPage.tsx) — add "Forgot password?" link calling Firebase's `sendPasswordResetEmail`. Read invitation code from URL hash if present (`/login#invite=CODE`) → pass to /api/me as query param after sign-in
- New: `pages/join/JoinPage.tsx` — at `/join/:code`. Anonymous: shows invitation details. Routes signed-out users to `/login#invite=CODE`. After auth, calls /api/me with the code, lands on `/register` then auto-joins household on submit
- New: `components/MaintenanceBanner.tsx` — site-wide banner reading `maintenance_mode` from auth store
- New: admin pages
  - `pages/admin/SystemConfigPage.tsx` — form for web URL + maintenance toggle + message
  - `pages/admin/PendingApprovalsPage.tsx` — table of pending users with Approve/Reject buttons

## Phased rollout

Each phase is a separate PR/commit with its own verification. No phase ships until the previous one passes its tests.

### Phase 0 — backend foundation (1 day)

- Extend `users/{uid}` schema (no migration needed; new fields default-handled in code)
- Extend `app_config/system` schema (add 3 fields with safe defaults)
- Add `get_web_url_or_raise()` helper
- Add `create_user_profile()` + `complete_registration()` + `reject_user()`
- Backfill script: for each Firebase Auth user without a Firestore doc, create with `status="active"`, `registration_complete=false` (forces existing dev users through the form on next login — fine for closed beta)

**Verify:** `pytest backend/tests/integration/`, ast.parse clean, smoke against staging Firebase project.

### Phase 1 — auth gate (0.5 day)

- Modify `_verify_token` to enforce `email_verified` for password provider
- Add LRU cache to `_get_user_role`

**Verify:** sign in with unverified email → 401; sign in with verified email → 200. Existing tests still pass.

### Phase 2 — `/api/me` rewrite (0.5 day)

- Replace handler with state-machine version (Appendix A)
- Add `?invitation_code=` query param handling
- Always include `web_public_url`, `maintenance_mode`, `maintenance_message` in response

**Verify:** integration test that walks: no profile → pending → admin approve → registration_required → complete → active.

### Phase 3 — invitation flow hardening (0.5 day)

- Wrap `accept_invite` in Firestore transaction
- Enforce email-bound match
- Block `generate_invite` if web URL not configured

**Verify:** unit test for race (two concurrent accepts of same code → exactly one succeeds). Email-mismatch returns clear error.

### Phase 4 — frontend auth gates (1 day)

- New pages: VerifyEmail, PendingApproval, Disabled, Registration, Join
- AuthGate routing logic in App.tsx
- Maintenance banner component

**Verify:** manual end-to-end walkthrough of all 6 states. Vite build clean (catches missing lucide-react exports per CLAUDE.md). tsc --noEmit clean.

### Phase 5 — admin UI (0.5 day)

- SystemConfig page (web URL + maintenance toggle)
- PendingApprovals queue
- Forgot-password flow on LoginPage
- Token revocation on disable + demote (1-line server-side change)

**Verify:** admin can set URL → invitation sends successfully. Admin can approve/reject from queue.

### Phase 6 — backfill + flip (0.5 day)

- Run backfill script in staging → verify all existing users have profiles
- Run in production
- Flip `registration_open=true` (already default) and `web_public_url` set

**Verify:** existing users' next sign-in lands on registration form (one-time UX bump). New self-signups land on pending. New invited users skip pending.

**Total estimate: ~4–5 days of focused work** (the +half-day vs. earlier estimate is the central email wrapper + admin pending-signup notification path).

### Maintenance-mode middleware (per Decision #3)

Add to [`backend/main.py`](../backend/main.py) alongside the rate-limit middleware:

```python
class MaintenanceModeMiddleware(BaseHTTPMiddleware):
    """When app_config/system.maintenance_mode is true, return 503 for all
    non-GET requests from non-admin users. Admin role bypasses. Reads always
    work so users can see status. Cached config read per-request to avoid
    Firestore-quota burn (5s in-process TTL)."""

    async def dispatch(self, request, call_next):
        if request.method == "GET":
            return await call_next(request)
        from app.services import config_service
        if not config_service.is_maintenance_mode_cached():  # 5s TTL
            return await call_next(request)
        from app.core.auth import get_optional_user
        user = await get_optional_user(request)
        if user and user.is_admin:
            return await call_next(request)
        return JSONResponse(status_code=503, content={
            "detail": config_service.get_system_config().get("maintenance_message", "Service temporarily in maintenance mode."),
            "maintenance_mode": True,
        })
```

## Testing approach

### Unit (per service file)

- `user_service.create_user_profile`: emits required fields, sets defaults
- `user_service.complete_registration`: rejects bad ISO codes, succeeds happy path
- `invitation_service.accept_invite`: race-safe (transaction), email-bound enforcement
- `config_service.get_web_url_or_raise`: raises clear error when unset

### Integration (against test Firebase project)

End-to-end walks:
1. **Self-signup happy path**: Google sign-in → pending → admin approve → registration → active
2. **Invitation happy path**: invite generated → email sent → user signs in via /join/CODE → auto-active → registration → in household
3. **Email mismatch**: invite for alice@x → bob@x signs up via code → 400 error
4. **Verification block**: email/password signup → before verify → 401 on /api/me; after verify → 200
5. **Maintenance mode**: admin flips maintenance → banner shows, write endpoints return 503, admin still has full access
6. **Web URL block**: admin clears web URL → generate_invite returns 503 with admin-facing error

### Manual

- All 6 frontend states render correctly
- Forgot-password flow works
- Admin pending queue updates in real-time

## Rollback plan

All changes ship behind a single feature flag: `onboarding_v2_enabled` in `app_config/features` (existing flag pattern).

- **If anything breaks post-deploy**: flip `onboarding_v2_enabled=false` → backend reverts to current `/api/me` behaviour (silent profile-missing state) and skips email-verification check. Existing v1 frontend pages still work as fallback.
- **Cookie / token changes**: none — same Firebase Auth, same cookie format. Rollback doesn't invalidate sessions.
- **Schema changes**: additive only (new fields). Old code ignoring new fields is safe.

If a serious bug requires schema rollback, the backfill script is reversible: a "purge v2 fields" script removes `registration_complete`, `country`, `pending_approval_at`, `invitation_code_used` from all user docs.

## Open items / Phase 3+ work

| Item | When |
|---|---|
| Multi-environment URL config | If/when staging-vs-prod split happens (Phase 2+) |
| MFA for admin tier | Phase 3 (UK + AU launch — when admin compromise blast radius grows) |
| Auto-rejection of pending users after 30 days | Phase 2 if approval queue gets long |
| Account-method linking (email+password ↔ Google for same email) | Phase 2 — Firebase Console toggle "one account per email" |
| Phone-based auth | Phase 4 (UAE/KSA — phone auth is dominant pattern there) |
| `/api/household/join/<code>` GET requires auth | Phase 2 — small addition; reduces enumeration surface |

### Multi-household support (deferred — captured 2026-05-03)

User-flagged scenarios that the current 1:1 user-to-household model cannot represent. Schema changes are non-trivial; defer until current Onboarding v2 is fully shipped and validated against real users.

| # | Scenario | Current behaviour | Desired behaviour | Dependencies |
|---|---|---|---|---|
| MH-1 | Solo user invited to another household | `accept_invite` blocks: "Already in a household" — but a user with NO household membership today shows `household_id=null` and can join freely. The block fires when they're already a member somewhere. **Edge** to clarify: when they HAVE a household + receive a new invite, UX should offer a choice (stay / leave-then-join) rather than a hard error | UX flow at `/join/<code>` shows: "You're currently in `<HouseholdA>`. Joining `<HouseholdB>` will [a] leave A or [b] keep both as a member of multiple households." Choice pre-resolved by the user before any state mutation | None for the `leave-then-join` path. The `keep both` path needs MH-3 |
| MH-2 | Net-new user lands on a `/join/<code>` link without an existing account | After Phase 2: `/api/me` with `?invitation_code=` auto-creates profile with status=active. Their email need only match `invited_email` if it was set | Already covered — the "wait for invitation" framing is exactly what hybrid mode enables for invited users. Self-signups STILL go to admin pending. Optional future tightening: flip `registration_open=false` system-wide so the only entry path is via invitation | Phase 2 ships; then optional config toggle |
| MH-3 | One user in N households (1 owned + N joined) | `users/{uid}.household_id: string` is single-valued. Cannot represent multi-membership | Replace `household_id` with `users/{uid}/memberships/{household_id}` subcollection (or `households: [{...}]` array on user doc). Each membership counts against the **OWNER's** tier quota, not the member's own. The current `TIER_MAX_MEMBERS` matrix already keys off owner tier, so the quota math is unchanged — only the membership lookup changes | Major refactor: every `get_user_household(uid)` call site (40+ places) becomes `get_active_membership(uid)` with an "active household" concept. SPA needs an active-household switcher in the header. Firestore rules need `householdId` parameter where they currently infer from user doc |
| MH-4 | Member of household A wants to create their own household B | `create_household` blocks: "Already in a household. Leave first." | After MH-3 lands: drop the block; create_household just creates a new household where this user is owner. UX entry: a "Create your own household" button hidden in Settings → Advanced (searchable but not on main household page) so existing members don't accidentally fragment shared inventories | Depends on MH-3. UX-only: hide the entry behind Settings → Advanced + searchable. Add a confirmation modal explaining "you'll still be a member of `<HouseholdA>`" |

**Sequence when ready to build:** MH-3 (data model) → MH-1 (join UX) + MH-4 (create UX, both unlocked by MH-3 in parallel) → MH-2 optional toggle. Estimate: ~3–5 days of focused work, gated on Phase 2+ being live with retention signal so the multi-household demand is real.

## Cross-references

- Auth audit findings: this conversation's transcript (verification mode, 2026-05-03)
- Cash-tier alignment: this lands as part of Tier 0 free actions (no cost beyond engineering time)
- Bootstrap roadmap: [BOOTSTRAP_ROADMAP.md](BOOTSTRAP_ROADMAP.md)
- Legal-launch critical path: [legal_launch_research.md](../.claude/docs/legal_launch_research.md) — onboarding hardening reduces "shipping closed beta with broken admin gates" risk

---

## Appendix A — `/api/me` state-machine handler (full code)

```python
@app.get("/api/me")
async def get_current_user_info(request: Request, invitation_code: Optional[str] = None):
    """State-machine /api/me — returns current user state for routing.

    Possible states:
      unauthenticated, verify_email_required, pending_approval,
      registration_required, disabled, registration_closed, active
    """
    from app.core.auth import get_optional_user
    from app.services import user_service, config_service, invitation_service

    user = await get_optional_user(request)
    if not user:
        # /api/me also returns public config for the maintenance banner
        sysconfig = config_service.get_system_config()
        return {
            "authenticated": False,
            "state": "unauthenticated",
            "web_public_url": sysconfig.get("web_public_url", ""),
            "maintenance_mode": sysconfig.get("maintenance_mode", False),
            "maintenance_message": sysconfig.get("maintenance_message", ""),
        }

    sysconfig = config_service.get_system_config()
    base = {
        "authenticated": True,
        "uid": user.uid,
        "email": user.email,
        "display_name": user.display_name,
        "role": user.role,
        "web_public_url": sysconfig.get("web_public_url", ""),
        "maintenance_mode": sysconfig.get("maintenance_mode", False),
        "maintenance_message": sysconfig.get("maintenance_message", ""),
    }

    # Email-verification gate is enforced in _verify_token; if we got here,
    # token is valid AND (provider != password OR email_verified).
    # Note: _verify_token returns None for password-unverified, which means
    # get_optional_user returns None, which means we're in the unauthenticated
    # branch above. So no explicit check needed here.

    profile = user_service.get_user(user.uid)

    if profile is None:
        # First-time hit. Decide between invitation-auto-approve and self-signup-pending.
        invitation = None
        if invitation_code:
            try:
                invitation = invitation_service.validate_code(invitation_code)
                # Email match required if invitation specifies one
                invited_email = (invitation.get("invited_email") or "").strip().lower()
                if invited_email and invited_email != (user.email or "").strip().lower():
                    invitation = None  # treat as if not invited
            except ValueError:
                invitation = None

        if invitation:
            # Invited path — auto-approve
            user_service.create_user_profile(
                uid=user.uid,
                email=user.email,
                display_name=user.display_name,
                status="active",
                invitation_code=invitation_code.upper(),
            )
            return {**base, "state": "registration_required",
                    "invitation_household_name": invitation.get("household_name")}

        # Self-signup path — check caps, create as pending
        allowed, reason = config_service.check_registration_allowed()
        if not allowed:
            return {**base, "state": "registration_closed", "reason": reason}

        user_service.create_user_profile(
            uid=user.uid,
            email=user.email,
            display_name=user.display_name,
            status="pending",
        )
        # Decision #2: notify admin per pending signup. Best-effort, never block.
        try:
            from app.services import email_service
            email_service.send_admin_pending_signup_notification(
                pending_uid=user.uid, pending_email=user.email,
            )
        except Exception:
            logger.exception("admin pending-signup notification failed (non-fatal)")
        return {**base, "state": "pending_approval"}

    # Existing profile — branch on status + completion
    status = profile.get("status", "active")
    if status == "disabled":
        return {**base, "state": "disabled",
                "disabled_reason": profile.get("disabled_reason", "")}
    if status == "pending":
        return {**base, "state": "pending_approval",
                "pending_since": profile.get("pending_approval_at")}
    if not profile.get("registration_complete", False):
        return {**base, "state": "registration_required"}

    # Active + complete
    return {
        **base,
        "state": "active",
        "tier": profile.get("tier", "free"),
        "country": profile.get("country"),
        "currency": profile.get("currency"),
        "currency_preference": profile.get("currency_preference"),
        "selected_tools": profile.get("selected_tools", []),
        "homemaker_enabled": profile.get("homemaker_enabled", False),
        "schema_version": profile.get("schema_version", 1),
    }
```

## Appendix B — `complete_registration` endpoint

```python
@app.post("/api/me/complete-registration")
async def complete_registration(request: Request):
    from app.core.auth import get_current_user
    from app.services import user_service, invitation_service
    user = await get_current_user(request)
    body = await request.json()

    name = (body.get("display_name") or "").strip()
    country = (body.get("country") or "").strip().upper()
    currency = (body.get("currency") or "").strip().upper()

    if not name or len(name) < 2 or len(name) > 50:
        raise HTTPException(400, "Display name must be 2–50 characters")
    if not country or len(country) != 2 or not country.isalpha():
        raise HTTPException(400, "Country must be a 2-letter ISO code")
    if not currency or len(currency) != 3 or not currency.isalpha():
        raise HTTPException(400, "Currency must be a 3-letter ISO code")

    profile = user_service.complete_registration(
        uid=user.uid, name=name, country=country, currency=currency
    )

    # If the user came in via invitation, auto-accept now
    code = profile.get("invitation_code_used")
    if code:
        try:
            invitation_service.accept_invite(code, user.uid, name)
        except ValueError as e:
            # Invitation expired between sign-in and registration — surface but don't fail registration
            logger.warning("Auto-accept failed for uid=%s code=%s: %s", user.uid, code, e)

    return {"success": True, "profile": profile}
```
