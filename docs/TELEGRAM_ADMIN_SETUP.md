# Telegram admin notifications — setup runbook

One-time setup for the P1.5 admin push channel. After this, every new
user feedback fires a Markdown message to your Telegram chat with deep
links back to the admin UI for triage.

**Time required**: ~5 minutes.

## What this does (and doesn't)

✅ Sends a Telegram message to your personal chat when a user submits feedback.
✅ Includes the feedback kind, user email, page, message text, last-5 routes.
✅ Links to: triage UI, user profile, the page they were on.

❌ Does NOT let you reply via Telegram — replies happen in the admin UI
and surface to the user as in-app notifications. This is by design;
bidirectional bot is the deferred D1 work in `FUTURE_TELEGRAM_BOT.md`.

❌ Does NOT block feedback writes if Telegram is down. Notifications
are fire-and-forget; a Telegram outage just means you won't get the
phone alert until you check the admin UI manually.

## Setup steps

### 1. Create the bot

1. Open Telegram, search for `@BotFather`, start the chat.
2. Send `/newbot`.
3. Pick a display name (e.g. `GroceryApp Admin Alerts`) — shown to you only.
4. Pick a username ending in `bot` (e.g. `groceryapp_admin_alerts_bot`).
5. BotFather replies with a token: `1234567890:AAabc...` — **save this**.

### 2. Discover your chat ID

1. In Telegram, search for the bot username from step 1.
2. Open the chat, send any message (e.g. "hi").
3. In a browser, visit:
   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```
   (replace `<TOKEN>` with the token from step 1).
4. Look for `"chat":{"id":NNNNNNNNN, ...}` in the JSON. That number is
   your **chat ID**. Save it.

### 3. Set Render env vars

In the Render dashboard for the `groceryapp-api` service:

| Key | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | the token from step 1 |
| `TELEGRAM_ADMIN_CHAT_ID` | the numeric chat ID from step 2 |

Save. Render will redeploy automatically.

### 4. Verify

1. Open https://groceryapp-backend-7af2.onrender.com (or wherever the SPA
   lives), sign in with any test account.
2. Use the floating 💬 button (bottom-right on desktop, FAB on mobile)
   to submit a test feedback. Pick `general`, type "telegram setup test",
   hit Send.
3. Within ~3 seconds your Telegram chat with the bot should show:
   ```
   💬 General feedback
   From: shahir91mss@gmail.com
   Page: /dashboard
   > telegram setup test
   🔗 Triage in admin · 👤 User profile · 📍 Open page in app
   ```
4. Click the **Triage in admin** link. It should open the admin
   FeedbackTab with the test row scrolled-into-view + highlighted.

### 5. Optional — multi-admin or backup recipient

Today the implementation sends to a single chat. To fan out to a
co-admin or a personal channel:

- **Easiest**: create a Telegram *group*, add the bot, change
  `TELEGRAM_ADMIN_CHAT_ID` to the group's ID (negative number).
  Everyone in the group sees alerts.
- **Per-admin** (future): would need a backend change to support
  multiple chat IDs. Not worth it until there's a co-admin.

## Disabling

Clear either env var (set to empty string) and redeploy. The backend
silently no-ops the call and the rest of the feedback flow keeps
working unchanged. Feedback writes are unaffected.

## Privacy notes

Telegram becomes a data processor when configured — message text,
user email, and page path travel through their infrastructure. This
is documented in `docs/legal/privacy-policy.md` §4 (Data storage and
processors). If you operate in a region with stricter rules
(EU/UK), confirm Telegram's processing terms cover your basis.

The bot token is the entire trust boundary. If it leaks (e.g. into a
public repo), regenerate via BotFather (`/token` command). The old
token dies the moment the new one is generated.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| No message arrives, but feedback row exists | Token or chat-id wrong | Re-run /getUpdates; check spelling |
| Telegram returns 401 | Token invalid or revoked | Generate new via BotFather |
| Telegram returns 400 with "chat not found" | You haven't started the chat with the bot | Send any message to the bot first |
| Messages arrive but links 404 | `web_public_url` not set in admin settings | Admin Settings → System → Web URL |
| Messages cut off mid-text | Long feedback hit 1500-char body cap (intentional) | Read the full text in the triage view via the link |

See `app/services/notification_service.py` for the implementation; the
`is_telegram_configured()` predicate is the single check that gates
sending.
