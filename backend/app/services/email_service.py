"""
Cascading email service — tries providers in priority order.

Provider cascade: Resend → SendGrid → SMTP
If all fail, raises EmailDeliveryFailed (caller should fall back to showing code/link).

Each provider is self-contained with its own API call.
"""

from __future__ import annotations

import logging
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailDeliveryFailed(Exception):
    """All email providers failed."""
    pass


# ---------------------------------------------------------------------------
# Send (cascading)
# ---------------------------------------------------------------------------


async def send_email(to: str, subject: str, html_body: str) -> str:
    """Send an email using the first available provider.

    Returns the provider key that succeeded.
    Raises EmailDeliveryFailed if all fail.
    """
    from app.services import email_config_service

    config = email_config_service.get_email_config()
    if not config.get("enabled", True):
        raise EmailDeliveryFailed("Email sending is disabled by admin")

    providers = sorted(config.get("providers", []), key=lambda p: p.get("priority", 99))
    errors = []

    for provider in providers:
        if not provider.get("enabled"):
            continue

        key = provider["key"]
        try:
            if key == "resend" and settings.RESEND_API_KEY:
                await _send_resend(to, subject, html_body)
                email_config_service.increment_usage("resend", success=True)
                return "resend"
            elif key == "sendgrid" and settings.SENDGRID_API_KEY:
                await _send_sendgrid(to, subject, html_body)
                email_config_service.increment_usage("sendgrid", success=True)
                return "sendgrid"
            elif key == "smtp" and settings.SMTP_HOST:
                await _send_smtp(to, subject, html_body)
                email_config_service.increment_usage("smtp", success=True)
                return "smtp"
            else:
                errors.append(f"{key}: not configured")
                continue
        except Exception as e:
            logger.warning("Email provider %s failed: %s", key, e)
            email_config_service.increment_usage(key, success=False)
            errors.append(f"{key}: {e}")
            continue

    raise EmailDeliveryFailed(f"All providers failed: {'; '.join(errors)}")


# ---------------------------------------------------------------------------
# Provider implementations
# ---------------------------------------------------------------------------


async def _send_resend(to: str, subject: str, html_body: str) -> None:
    """Send via Resend.com API."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": settings.EMAIL_FROM,
                "to": [to],
                "subject": subject,
                "html": html_body,
            },
        )
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"Resend API {resp.status_code}: {resp.text[:200]}")
    logger.info("Email sent via Resend to %s", to)


async def _send_sendgrid(to: str, subject: str, html_body: str) -> None:
    """Send via SendGrid API."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={
                "Authorization": f"Bearer {settings.SENDGRID_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "personalizations": [{"to": [{"email": to}]}],
                "from": {"email": settings.EMAIL_FROM.split("<")[-1].rstrip(">").strip() or "noreply@groceryapp.com"},
                "subject": subject,
                "content": [{"type": "text/html", "value": html_body}],
            },
        )
        if resp.status_code not in (200, 201, 202):
            raise RuntimeError(f"SendGrid API {resp.status_code}: {resp.text[:200]}")
    logger.info("Email sent via SendGrid to %s", to)


async def _send_smtp(to: str, subject: str, html_body: str) -> None:
    """Send via SMTP (runs in thread to avoid blocking)."""
    import asyncio
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    def _send():
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.EMAIL_FROM
        msg["To"] = to
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            if settings.SMTP_USERNAME:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.sendmail(settings.EMAIL_FROM, [to], msg.as_string())

    await asyncio.get_event_loop().run_in_executor(None, _send)
    logger.info("Email sent via SMTP to %s", to)


# ---------------------------------------------------------------------------
# Invitation email template
# ---------------------------------------------------------------------------


def send_invitation_email(
    to_email: str,
    household_name: str,
    inviter_name: str,
    code: str,
) -> None:
    """Send a household invitation email. Sync wrapper.

    Onboarding v2 — Decision #5: requires `web_public_url` to be configured.
    Raises `WebUrlNotConfiguredError` synchronously if unset; the calling
    endpoint surfaces this as a 503 with an admin-facing message. Once the
    URL passes the check, the actual send is async fire-and-forget — provider
    failures are logged but don't surface to the caller.
    """
    import asyncio
    from app.services import config_service

    web_url = config_service.get_web_url_or_raise()  # raises if unset / non-https
    join_url = f"{web_url}/join/{code}"

    subject = f"Join {inviter_name}'s household on GroceryApp"
    html = f"""
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a2e;">🏠 You're Invited!</h2>
        <p><strong>{inviter_name}</strong> has invited you to join their household
        "<strong>{household_name}</strong>" on GroceryApp.</p>
        <p>You'll share grocery inventory, shopping lists, and price tracking with the family.</p>
        <div style="text-align: center; margin: 24px 0;">
            <a href="{join_url}" style="background: #4f46e5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">Join household</a>
            <div style="margin-top: 16px; background: #f0f0f5; border-radius: 8px; padding: 16px; display: inline-block;">
                <span style="font-size: 12px; color: #666;">Or use code:</span><br>
                <span style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #4f46e5;">{code}</span>
            </div>
        </div>
        <p style="font-size: 13px; color: #666;">This invitation expires in 7 days. Use the same email address that received this message — invitations are email-bound.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 11px; color: #999;">GroceryApp — Smart grocery management for families.</p>
    </div>
    """

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(send_email(to_email, subject, html))
        else:
            loop.run_until_complete(send_email(to_email, subject, html))
    except Exception as e:
        logger.warning("Failed to send invitation email to %s: %s", to_email, e)


# ---------------------------------------------------------------------------
# Admin pending-signup notification (Onboarding v2 — Decision #2)
# ---------------------------------------------------------------------------


def send_admin_pending_signup_notification(pending_uid: str, pending_email: str) -> None:
    """Notify admin(s) when a self-signup user enters the pending-approval queue.

    Per Decision #2: best-effort, never blocks the user-facing /api/me response.
    Per Decision #5: requires `web_public_url` to be configured (the email
    contains a dashboard link). If URL unset, logs warning and skips silently.

    Recipient resolution: each UID in `settings.ADMIN_UIDS` → looked up in
    Firestore `users/{uid}.email`. Sends to all admins with resolvable emails.
    """
    import asyncio
    from app.core.exceptions import WebUrlNotConfiguredError
    from app.services import config_service, user_service

    if not settings.ADMIN_UIDS:
        logger.info(
            "admin pending-signup notification skipped: no ADMIN_UIDS configured "
            "(pending_uid=%s)", pending_uid,
        )
        return

    try:
        web_url = config_service.get_web_url_or_raise()
    except WebUrlNotConfiguredError as e:
        logger.warning(
            "admin pending-signup notification skipped: %s (pending_uid=%s)",
            e.message, pending_uid,
        )
        return

    admin_emails = []
    for admin_uid in settings.ADMIN_UIDS:
        admin_profile = user_service.get_user(admin_uid)
        if admin_profile and admin_profile.get("email"):
            admin_emails.append(admin_profile["email"])

    if not admin_emails:
        logger.warning(
            "admin pending-signup notification skipped: no admin emails resolvable "
            "from ADMIN_UIDS (configured=%d)", len(settings.ADMIN_UIDS),
        )
        return

    dashboard_url = f"{web_url}/admin/users/pending"
    subject = f"GroceryApp — Pending signup: {pending_email}"
    html = f"""
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a2e;">🆕 New signup pending approval</h2>
        <p>A new user has signed up and is awaiting your approval:</p>
        <div style="background: #f0f0f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <div><strong>Email:</strong> {pending_email}</div>
            <div style="font-size: 11px; color: #666; margin-top: 4px;">UID: {pending_uid}</div>
        </div>
        <div style="text-align: center; margin: 24px 0;">
            <a href="{dashboard_url}" style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Review Pending Approvals</a>
        </div>
        <p style="font-size: 13px; color: #666;">If you don't recognise this person, reject the signup from the admin queue.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 11px; color: #999;">Automated notification from GroceryApp.</p>
    </div>
    """

    for admin_email in admin_emails:
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.ensure_future(send_email(admin_email, subject, html))
            else:
                loop.run_until_complete(send_email(admin_email, subject, html))
        except Exception as e:
            logger.warning(
                "Failed to send admin pending-signup notification to %s: %s",
                admin_email, e,
            )


# ---------------------------------------------------------------------------
# Test email
# ---------------------------------------------------------------------------


async def send_test_email(to: str) -> dict:
    """Send a test email to verify provider configuration."""
    subject = "GroceryApp — Email Test"
    html = """
    <div style="font-family: -apple-system, sans-serif; padding: 20px;">
        <h2>✅ Email is working!</h2>
        <p>This test email confirms your email provider is configured correctly.</p>
        <p style="font-size: 12px; color: #666;">Sent from GroceryApp backend.</p>
    </div>
    """
    try:
        provider = await send_email(to, subject, html)
        return {"success": True, "provider": provider, "message": f"Test email sent via {provider}"}
    except EmailDeliveryFailed as e:
        return {"success": False, "message": str(e)}
