"""Notification service — one-way push channels for admin alerting.

Captured 2026-05-04 from the customer-feedback-process design pass:
the meta-metric for closed-beta retention is "% of submissions that
received an admin response within 72h." That metric depends on the
admin (Shahir) seeing new feedback fast — not on him remembering to
check the admin UI.

This module provides the *push* side: when feedback lands, send a
Telegram message to the admin's chat with deep-links back to the
admin UI for triage. Admin reads on phone, clicks link, replies via
the web admin UI (NOT via Telegram — that's the full-bot-bidirectional
work tracked as D1 in docs/FUTURE_TELEGRAM_BOT.md, deferred).

Design principles:
  - **Fire-and-forget.** Feedback creation MUST NEVER block on this.
    All errors are caught + logged at warning level. A Telegram
    outage is a degraded notification channel, not a feedback outage.
  - **Configurable on/off via env vars.** Empty TELEGRAM_BOT_TOKEN or
    TELEGRAM_ADMIN_CHAT_ID = silently no-op. Local dev defaults to
    no-notifications (no token in .env).
  - **No PII rules logic here.** What goes in the message is the
    caller's choice. This module just sends. Composition lives in
    the caller (e.g. feedback_service).

Setup (one-time, from `docs/TELEGRAM_ADMIN_SETUP.md`):
  1. @BotFather → /newbot → save token
  2. Open chat with your new bot, send any message
  3. Visit https://api.telegram.org/bot<TOKEN>/getUpdates → copy chat_id
  4. Set Render env vars: TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID
  5. Redeploy. Next feedback fires a notification.
"""

from __future__ import annotations

import logging
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_TELEGRAM_API_BASE = "https://api.telegram.org"
_TIMEOUT_SECONDS = 5.0  # short — we never want to slow the user-facing path


def is_telegram_configured() -> bool:
    """True when both bot token and chat id are set. Cheap predicate
    for callers that want to skip composing a message they can't send."""
    return bool(settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_ADMIN_CHAT_ID)


def notify_admin_telegram(
    text: str,
    *,
    parse_mode: str = "Markdown",
    disable_web_page_preview: bool = True,
) -> None:
    """Send a Telegram message to the admin chat. Fire-and-forget.

    Returns None on success OR failure — caller cannot tell. By design;
    this lets feedback writes treat notifications as best-effort.

    Args:
        text: message body. For Markdown: backticks for code, *bold*,
              _italic_, [label](url) for links. Telegram strips MD
              that doesn't parse and shows the raw chars — keep it
              simple.
        parse_mode: "Markdown" | "MarkdownV2" | "HTML" | None.
                    "Markdown" (legacy) is forgiving; MarkdownV2 is
                    strict but supports more. Defaulting to Markdown
                    because the message templates don't need V2 power.
        disable_web_page_preview: True hides the link-preview cards
                    Telegram normally shows. Saves real-estate when the
                    message has 3+ links.
    """
    if not is_telegram_configured():
        return

    url = f"{_TELEGRAM_API_BASE}/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": settings.TELEGRAM_ADMIN_CHAT_ID,
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": disable_web_page_preview,
    }

    try:
        response = httpx.post(url, json=payload, timeout=_TIMEOUT_SECONDS)
        if response.status_code >= 400:
            # Log the body so the admin can debug bad tokens / wrong chat-ids,
            # but never raise — a bad config should not break feedback writes.
            logger.warning(
                "telegram.notify failed status=%s body=%s",
                response.status_code,
                response.text[:300],
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("telegram.notify error: %s", exc)


# ---------------------------------------------------------------------------
# Composers — domain-specific message templates. Keep here so the wire
# format stays consistent across callers and so test fixtures can stay
# small.
# ---------------------------------------------------------------------------


_KIND_PREFIX = {
    "bug": "🐛 *Bug report*",
    "feature": "💡 *Feature request*",
    "cap_request": "📈 *Cap revisit request*",
    "general": "💬 *General feedback*",
}


def notify_admin_feedback(
    feedback_doc: dict,
    *,
    web_public_url: Optional[str] = None,
    breadcrumb_routes: Optional[list[str]] = None,
) -> None:
    """Compose + send a Markdown notification for a new feedback doc.

    `web_public_url` should come from the system config (see
    config_service.get_system_config().web_public_url). When empty the
    deep-links degrade to relative paths — still readable but not
    clickable from outside the app.

    `breadcrumb_routes` is optional. When provided, the most-recent ~5
    routes get appended at the bottom so admin can recreate context.
    The frontend captures these via useRouteHistory + sends them in the
    `context` blob on submit. This composer accepts either a list arg
    or pulls them from feedback_doc['context']['breadcrumb_routes'].
    """
    kind = feedback_doc.get("kind", "general")
    prefix = _KIND_PREFIX.get(kind, _KIND_PREFIX["general"])

    user_email = feedback_doc.get("user_email") or "(unknown email)"
    user_id = feedback_doc.get("user_id", "")
    feedback_id = feedback_doc.get("id", "")
    msg_text = (feedback_doc.get("message") or "").strip()

    # Truncate aggressive — Telegram has a 4096-char hard cap; we want
    # to leave headroom for the prefix + footer + links. Aim for body
    # at ~1500 chars, footer at ~500, prefix at ~150.
    if len(msg_text) > 1500:
        msg_text = msg_text[:1497] + "..."

    # Strip leading/trailing whitespace per line; render as Markdown blockquote.
    quoted = "\n".join("> " + line for line in msg_text.split("\n") if line.strip())

    # Pull breadcrumbs from arg or context blob.
    context = feedback_doc.get("context") or {}
    if breadcrumb_routes is None:
        ctx_routes = context.get("breadcrumb_routes")
        if isinstance(ctx_routes, list):
            breadcrumb_routes = [str(r) for r in ctx_routes][:5]

    page_path = context.get("page_path") or "(unknown)"
    user_agent_short = (context.get("user_agent") or "")[:60]

    # Build deep-links. Use the admin tab + id query so FeedbackTab can
    # scroll-into-view + highlight the matching row.
    base = (web_public_url or "").rstrip("/")
    triage_url = f"{base}/admin-settings?tab=feedback&id={feedback_id}" if base else f"/admin-settings?tab=feedback&id={feedback_id}"
    profile_url = f"{base}/users/{user_id}" if (base and user_id) else f"/users/{user_id}" if user_id else None
    page_url = f"{base}{page_path}" if (base and page_path.startswith("/")) else None

    lines = [prefix, ""]
    lines.append(f"From: {user_email}")
    lines.append(f"Page: `{page_path}`")
    lines.append("")
    if quoted:
        lines.append(quoted)
        lines.append("")

    lines.append(f"🔗 [Triage in admin]({triage_url})")
    if profile_url:
        lines.append(f"👤 [User profile]({profile_url})")
    if page_url:
        lines.append(f"📍 [Open page in app]({page_url})")

    if breadcrumb_routes:
        crumbs = " → ".join(f"`{r}`" for r in breadcrumb_routes[-5:])
        lines.append("")
        lines.append(f"_Last routes:_ {crumbs}")

    if user_agent_short:
        lines.append(f"_Browser:_ `{user_agent_short}`")

    text = "\n".join(lines)
    notify_admin_telegram(text)


def notify_admin_user_reply(
    parent_doc: dict,
    *,
    reply_text: str,
    web_public_url: Optional[str] = None,
) -> None:
    """Compose + send a Markdown notification when a user replies on
    one of their own feedback threads.

    Closes the silence in the original notify path: the v1 channel only
    fired on the FIRST submission. With Sprint-2 threading, a user can
    follow up — and that follow-up may re-open a thread admin had
    marked resolved. Without this notify, those replies sit unseen
    until admin checks Admin Hub manually.

    Triggered from `feedback_service.post_message` when author='user'.
    Fire-and-forget — wrapped in the caller's try/except so a Telegram
    outage never blocks the user's reply write.

    Deep-link points to `/admin-hub?id=<feedback_id>` (the new triage
    surface, not the legacy /admin-settings?tab=feedback link).
    """
    kind = parent_doc.get("kind", "general")
    prefix = _KIND_PREFIX.get(kind, _KIND_PREFIX["general"])

    user_email = parent_doc.get("user_email") or "(unknown email)"
    feedback_id = parent_doc.get("id", "")
    parent_status = parent_doc.get("status", "new")
    reopened = parent_status in ("resolved", "wont_fix")

    body = (reply_text or "").strip()
    if len(body) > 1500:
        body = body[:1497] + "..."
    quoted = "\n".join("> " + line for line in body.split("\n") if line.strip())

    base = (web_public_url or "").rstrip("/")
    triage_url = (
        f"{base}/admin-hub?id={feedback_id}"
        if base
        else f"/admin-hub?id={feedback_id}"
    )

    lines = ["📨 *User reply* on " + prefix.replace("*", ""), ""]
    lines.append(f"From: {user_email}")
    if reopened:
        # The post_message handler bumps status back to triaged when a
        # user replies on a closed thread. Surface that explicitly so
        # admin knows a previously-archived item is now active again.
        lines.append("_Re-opens this thread (was marked resolved)._")
    lines.append("")
    if quoted:
        lines.append(quoted)
        lines.append("")
    lines.append(f"🔗 [Open thread in Admin Hub]({triage_url})")

    notify_admin_telegram("\n".join(lines))
