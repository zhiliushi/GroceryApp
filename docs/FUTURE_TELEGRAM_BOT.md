# FUTURE: Telegram Bot Integration

**Status:** Deferred. Not built in current refactor. Full design captured here for future implementation.

## Motivation

Users want to interact with GroceryApp via Telegram — faster entry from a chat app they already use, push notifications for expiring items, hands-free add while shopping.

## Library + Architecture

- **Library:** `python-telegram-bot[webhooks]==20.8` (async handlers)
- **Deployment:** Webhook (not polling). Render free tier hosts the webhook endpoint.
- **Endpoint:** `POST /api/telegram/webhook` in new `app/api/routes/telegram.py`
- **Package:** `app/telegram/` — handlers, middleware, nl_parser, notifications

## User linking (pairing code flow)

1. User clicks `Connect Telegram` in web admin `SettingsPage` → `TelegramLinkCard`
2. Backend generates 6-char alphanumeric code, stores:
   ```
   users/{uid}/telegram_pair: {code: "ABCDEF", expires_at: now+15min}
   ```
3. UI shows: `"Send /link ABCDEF to @GroceryAppBot"`
4. User sends `/link ABCDEF` to bot
5. Bot handler validates code (not expired, single-use), writes:
   ```
   users/{uid}: {
     telegram_chat_id: str,
     telegram_username: str,
     telegram_linked_at: timestamp,
     telegram_notifications: { expiry: true, weekly_summary: true }
   }
   ```
6. Bot replies `✅ Linked to shahir@...`
7. Web UI polls `/api/me` every 5s while card open → flips to "Connected [Unlink]"

## Commands (Phase 1)

| Command | Handler | Behavior |
|---------|---------|----------|
| `/start` | `cmd_start` | Welcome + "send /link CODE to connect" |
| `/link <code>` | `cmd_link` | Validate code, pair chat_id |
| `/unlink` | `cmd_unlink` | Remove telegram_chat_id |
| `/add <name> [qty] [expiry]` | `cmd_add` | Create purchase event. `/add milk 2 tomorrow` → qty=2, expiry=tomorrow |
| `/list` | `cmd_list` | 10 most recent active items, paged with inline buttons |
| `/expiring` | `cmd_expiring` | Items expiring in next 7 days, grouped by urgency |
| `/used <name>` | `cmd_used` | Mark used via FIFO (oldest-expiry first). Ambiguity → inline keyboard of matches. |
| `/thrown <name>` | `cmd_thrown` | Mark thrown, prompt reason via inline buttons |
| `/help` | `cmd_help` | Command list |
| `/notify` | `cmd_notify` | Toggle expiry + weekly_summary notifications |

## Natural Language Chat (Phase 2 — behind flag `telegram_nl_enabled`)

Non-command text routes to `nl_handler`:
1. Uses existing Mistral API key (`MISTRAL_API_KEY` in env)
2. Prompt template extracts intent: `{intent: add|throw|use|query, name, qty?, expiry?}`
3. Returns confirmation before execution: `"I heard: add milk, 2 units, expires tomorrow. Confirm?"` with Yes/No buttons
4. On confirm → execute via same services as `/add`

## Notifications (outbound push)

Scheduler jobs in `scheduler.py`:

- **Daily 08:00 user-local-time**: for each user with `telegram_notifications.expiry=true`, query items expiring today/tomorrow → batch-send per chat
- **Weekly Sunday 18:00**: summary ("This week: used X, threw Y worth $Z, Y expiring next week")
- **Rate limit**: max 1 notification per user per 6h (in-memory set with cleanup)

## Security

- **Webhook secret**: `setWebhook(secret_token=...)` on bot init; verify `X-Telegram-Bot-Api-Secret-Token` header on every POST; reject non-matching with 403
- **Rate limit**: per chat_id, 20 cmds/min, sliding window in-memory
- **Auth gate**: middleware decorator rejects all commands except `/start`, `/link`, `/help` if user not linked
- **Pairing codes**: 15min TTL, `secrets.token_urlsafe(4)`, single-use (deleted on successful link)
- **Token storage**: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_WEBHOOK_SECRET` in `.env` + Render env; never commit
- **Replay protection**: ring buffer of last 500 `update_id`; duplicate → 200 no-op
- **PII in logs**: strip message text from error logs

## File structure (backend)

```
app/telegram/
  __init__.py
  bot.py                       # Application builder, handler registration
  middleware.py                # auth, rate limit, logging
  nl_parser.py                 # Mistral intent extraction (phase 2)
  notifications.py             # outbound push logic
  handlers/
    __init__.py
    system.py                  # /start /help /link /unlink /notify
    items.py                   # /add /list /used /thrown /expiring
  services/
    pairing_service.py         # code gen + link
    telegram_user_service.py   # chat_id → uid resolver (5min cache)

app/api/routes/telegram.py     # FastAPI webhook endpoint
```

## Config additions

```python
# app/core/config.py
TELEGRAM_BOT_TOKEN: str = ""
TELEGRAM_WEBHOOK_SECRET: str = ""
TELEGRAM_WEBHOOK_URL: str = ""  # e.g. https://groceryapp-backend-xxx.onrender.com/api/telegram/webhook
```

## Requirements additions

```
python-telegram-bot[webhooks]==20.8
```

## User fields added

```yaml
users/{uid}:
  telegram_chat_id: str | null
  telegram_username: str | null
  telegram_linked_at: timestamp
  telegram_notifications:
    expiry: bool
    weekly_summary: bool
```

## Frontend additions

- `components/telegram/TelegramLinkCard.tsx` in `SettingsPage`:
  - Shows pairing code when user clicks Connect
  - Polls `/api/me` for `telegram_chat_id` presence
  - Shows "Connected as @username [Unlink]" when linked
  - Unlink button POSTs to `/api/users/me/telegram/unlink`
- Notification prefs toggles (Expiry / Weekly summary) in same card

## Feature flag

`app_config/features.telegram_bot` — master toggle. When off:
- Webhook returns 503 "service paused"
- `TelegramLinkCard` hidden
- Notifications not sent

## Edge cases

- **Pairing code expires mid-flow** → bot replies "code expired, regenerate from web"
- **User deletes Firebase account while linked** → orphan `telegram_chat_id`; next bot message → "account not found, send /start"
- **Concurrent /add from bot + web** → idempotency key `(uid, name_norm, ts bucket 60s)`; dedup on bot side
- **Admin disables `telegram_bot` flag while users linked** → stop notifications, reject webhook with 503, keep chat_ids stored so re-enable is seamless

## Implementation cost estimate

- Backend: ~15 files, ~1000 LOC
- Frontend: 1 new component (~200 LOC)
- Testing: webhook security, command handlers, pairing flow, notification rate limiting
- Total: ~2-3 days focused work

## When to build

After Phase 4 (frontend refactor) is stable. Users with linked Telegram can replace web usage for many flows. Prioritise if user feedback requests it; otherwise low priority.
