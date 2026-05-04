# About page

Route: `/about` (public — no auth required, mirrors `/privacy` and `/terms`)
File: `backend/web-admin/src/pages/about/AboutPage.tsx`

## Purpose

A publicly reachable surface that lists external links the operator wants to
share: donation channels (Ko-fi etc.), reference reads, social handles. Logged-out
visitors can reach it via `/about`. Logged-in users can reach it from the
sidebar's secondary nav (▼ More → About) or via cross-links in the legal pages.

The link list is **operator-managed at runtime** — there's no hardcoded array of
URLs in source. Admins add/edit/remove links from
`/admin-settings → External Links`. Edits are live.

## Data model

Top-level Firestore collection `external_links/{auto_id}`:

```
{
  id: uuid,
  label: string (≤80 chars),
  url: string (≤500 chars, must start http:// or https://),
  category: "donation" | "reference" | "social" | "other",
  description: string | null (≤200 chars, optional one-liner),
  icon: string | null (≤8 chars, emoji or short symbol),
  sort_order: int (lower = first within a category),
  enabled: bool (false = hidden on /about but visible to admin),
  created_by: uid | "seed",
  created_at, updated_at, schema_version: 1
}
```

## API endpoints

| Method | Path | Auth | Used by |
|--------|------|------|---------|
| `GET`  | `/api/external-links` | none (public) | AboutPage |
| `GET`  | `/api/admin/external-links` | admin | ExternalLinksTab |
| `POST` | `/api/admin/external-links` | admin | add link |
| `PATCH`| `/api/admin/external-links/{id}` | admin | edit / toggle |
| `DELETE`| `/api/admin/external-links/{id}` | admin | delete |
| `POST` | `/api/admin/external-links/seed-defaults` | admin | seeds Ko-fi default if collection empty (idempotent) |

The public `GET` always filters to `enabled=true` server-side. Admin `GET`
returns all by default (`enabled_only=false`); pass `?enabled_only=true` to
restrict.

The public response includes a pre-grouped `by_category` dict so the page
can render sections without reshuffling client-side.

## Categories

Fixed enum at `app/services/external_link_service.py::_VALID_CATEGORIES` and
mirrored in the admin tab. Adding a new category requires:

1. Add it to `_VALID_CATEGORIES` in the service.
2. Add a row to `CATEGORY_TITLES` and `CATEGORY_ORDER` in `AboutPage.tsx`.
3. Add it to `CATEGORY_OPTIONS` in `ExternalLinksTab.tsx`.

Intentionally a code change — keeps the page predictable and prevents typos
turning into orphan categories.

## Seed behaviour

`external_link_service.seed_defaults_if_empty()` inserts a single Ko-fi
donation link (`https://ko-fi.com/shahfurqan`) if and only if the collection
is empty. Triggered manually by `POST /api/admin/external-links/seed-defaults`
or by clicking **Seed defaults** in the admin tab. Safe to call multiple
times — second call returns `{inserted: 0}`.

## Why public

Donation links and "more reads" entries should reach unauthenticated visitors
too — that's the main value of having an About page. The page uses raw `fetch`
(not `apiClient`) so the 401 redirect interceptor doesn't kick in for users
without a session.
