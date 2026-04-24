# Nudge System

Progressive disclosure — prompts users to add optional details (expiry, price, volume) **after** they've experienced value, not upfront. The app starts dumb-simple and gets smarter as users engage.

## Philosophy

New users face minimum friction. Adding an item should take one input (name or scan). Only after users have added 5+ items (proving they'll stick with it) do we ask: "want to track expiry? it helps prevent waste."

**Nudges are:**
- Dismissible (remembered per-user)
- Non-blocking (never hide core functionality)
- Contextual (shown where they make sense)
- Actionable (tap → opens the relevant input/settings)

**Nudges are NOT:**
- Popups that interrupt flow
- Repeated after dismissal (respected)
- Shown on every page (choose one priority per user session)

## Nudge types

| Nudge ID | Trigger | Message | Action |
|----------|---------|---------|--------|
| `welcome` | 0 items | "Add your first grocery to get started" | Opens QuickAdd |
| `nudge_expiry` | 5+ items | "Track expiry dates to avoid food waste" | Opens QuickAdd with expiry field visible + toggles `preferences.track_expiry = true` |
| `nudge_price` | 10+ items | "Track prices to see your grocery spending" | Enables financial tracking in settings + opens QuickAdd |
| `nudge_volume` | 20+ items | "Add volume/unit for better tracking" | Toggles volume field in QuickAdd defaults |
| `insight_ready_50` | 50 purchases | "You've reached 50 purchases! See your patterns →" | Navigates to `/insights` |
| `insight_ready_100` | 100 purchases | "100 purchases! Your insights are ready" | Navigates to `/insights` |
| `insight_ready_500` | 500 purchases | "Milestone: 500 purchases. Advanced insights available." | Navigates to `/insights` |
| `insight_ready_1000` | 1000 purchases | "1000 purchases! Top tier insights unlocked." | Navigates to `/insights` |
| `reminder_stage_1` | Active purchase, no expiry, age ≥7d | "Still have 'X' from a week ago? Set expiry or mark used" (per-item, via reminders collection) | Opens Purchase Event detail |
| `reminder_stage_2` | Age ≥14d | Same, stronger wording | Same |
| `reminder_stage_3` | Age ≥21d | "Definitely check 'X' — bought 3 weeks ago" + admin flag `needs_review` | Same |

## Thresholds (configurable)

Stored in `app_config/features.nudge_thresholds`:

```yaml
nudge_thresholds:
  expiry: 5       # trigger nudge_expiry at N items
  price: 10       # trigger nudge_price
  volume: 20      # trigger nudge_volume
```

Admin can override via FeatureFlagsTab. Defaults optimised for ~2-week active usage.

## Storage

Dismissals tracked per user:

```
users/{uid}/ui_state/nudges:
  dismissed: str[]              # ["nudge_expiry", "welcome"]
  last_shown_at:
    nudge_expiry: timestamp
    nudge_price: timestamp
```

Written by frontend on dismiss/show. Read by `useNudges` hook.

## Determination logic

`useNudges.ts` React hook:

```typescript
function useNudges(): Nudge | null {
  const { data: purchases } = useActivePurchases();
  const { data: flags } = useFeatureFlags();
  const { data: dismissals } = useUiState();

  if (!flags?.progressive_nudges) return null;
  
  const itemCount = purchases?.length ?? 0;
  const dismissed = new Set(dismissals?.dismissed_nudges ?? []);
  
  // Priority order: highest unmet threshold → lowest
  const thresholds = flags.nudge_thresholds ?? { expiry: 5, price: 10, volume: 20 };
  
  if (itemCount === 0 && !dismissed.has("welcome")) {
    return { id: "welcome", ... };
  }
  
  // Insights nudges take priority over incremental ones
  if (itemCount >= 1000 && !dismissed.has("insight_ready_1000")) {
    return { id: "insight_ready_1000", ... };
  }
  if (itemCount >= 500 && !dismissed.has("insight_ready_500")) {
    return { id: "insight_ready_500", ... };
  }
  if (itemCount >= 100 && !dismissed.has("insight_ready_100")) {
    return { id: "insight_ready_100", ... };
  }
  if (itemCount >= 50 && !dismissed.has("insight_ready_50")) {
    return { id: "insight_ready_50", ... };
  }
  
  // Incremental feature nudges
  if (itemCount >= thresholds.volume && !dismissed.has("nudge_volume")) {
    return { id: "nudge_volume", ... };
  }
  if (itemCount >= thresholds.price && !dismissed.has("nudge_price")) {
    return { id: "nudge_price", ... };
  }
  if (itemCount >= thresholds.expiry && !dismissed.has("nudge_expiry")) {
    return { id: "nudge_expiry", ... };
  }
  
  return null;
}
```

**Priority ensures one nudge at a time.** Milestone nudges override incremental ones (insight_ready_50 dominates nudge_price once user hits 50 items).

## UI placement

- **Dashboard** — primary slot, below Waste card, above Frequently Bought
  - `NudgeBanner` component renders the active nudge (or nothing)
  - Dismiss button (X) top-right → writes to `dismissed_nudges` array
  - Action button → opens relevant modal/page
- **Inline in QuickAdd** — when user opens Add modal, if `nudge_expiry` is active (not dismissed), the expiry field auto-expands in the modal (rather than being hidden in `▼ More`)

Never two nudges on screen. Never a modal nudge (non-blocking).

## Dismissal behaviour

- Click X → added to `dismissed_nudges` array
- Never re-shown (even across sessions)
- Admin toggle `progressive_nudges = false` → hides all nudges immediately regardless of dismissals
- Re-enable: admin clears user's `dismissed_nudges` (future admin tool) — or user clears browser data (last resort)

## Reminder nudges (per-item, not global)

`users/{uid}/reminders/{reminder_id}` — written by scheduler `nudge_service.scan_reminders`:

```yaml
purchase_event_id: str           # which event this reminds about
catalog_name_norm: str
display_name: str
stage: int                       # 7 | 14 | 21
message: str                     # "Still have 'Milk' from a week ago?"
created_at: timestamp
dismissed_at: timestamp | null
acted_at: timestamp | null
action_taken: str | null         # "used" | "thrown" | "snooze" | "still_have"
```

UI: `ReminderBanner` component on Dashboard shows top 3 reminders. Each has action buttons:
- `[✓ Used]` → marks event used + dismisses reminder
- `[🗑 Thrown]` → opens ThrowAwayModal + dismisses reminder
- `[🤔 Still have]` → dismisses reminder; reminder stage stays, re-fires next cycle

## Admin controls

FeatureFlagsTab → "Progressive Nudges" section:
- Master toggle `progressive_nudges`
- Per-threshold inputs (expiry: 5, price: 10, volume: 20)
- Reset all users' dismissals button (future)

## Edge cases

- **User dismisses `nudge_expiry` but hasn't added expiry**: dismissal respected. Don't re-nudge. User can still add expiry manually via QuickAdd's `▼ More`.
- **User hits 50 items having dismissed all incremental nudges**: `insight_ready_50` still fires (milestones override dismissals).
- **User downgrades from paid tier that hid nudges → now free tier shows nudges**: dismissals persist, so only unseen nudges appear.
- **Admin sets `thresholds.expiry = 3` lower**: users who already dismissed at 5 won't see it again. Users at 4 will see it immediately.
- **Multiple devices for same user**: dismissals sync via Firestore, always in agreement.
