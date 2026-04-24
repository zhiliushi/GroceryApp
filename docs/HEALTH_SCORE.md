# Health Score

The **Health Score** is a single number (0-100) representing the overall health of the user's inventory. Shown as a prominent bar at the top of the Dashboard. Green/yellow/red drives page state (healthy/warning/critical).

## Purpose

Give users an **at-a-glance signal** of how well they're managing food waste:
- Green (80-100): healthy — few items expiring, low waste rate
- Yellow (50-79): warning — some items at risk, moderate waste
- Red (<50): critical — many expired/expiring, high waste rate

Clickable → drills into contributing factors (which items pull the score down).

## Formula

```python
def compute_health_score(user_data: dict) -> int:
    active = user_data["active_count"]
    expiring_3d = user_data["expiring_3d_count"]     # active, expiry in next 3 days
    expiring_7d = user_data["expiring_7d_count"]     # active, expiry in 4-7 days
    expired = user_data["expired_count"]             # active but past expiry date
    untracked = user_data["untracked_count"]         # active, no expiry, age > 7d
    thrown_this_month = user_data["thrown_month"]
    used_this_month = user_data["used_month"]
    total_this_month = thrown_this_month + used_this_month

    if active == 0 and total_this_month == 0:
        return 100                                   # brand new user, no data to score

    # Component 1: active items weighted by urgency
    active_component = (
        (active - expiring_3d - expiring_7d - expired - untracked) * 1.0   # healthy
        + expiring_7d * 0.8                                                 # mildly risky
        + expiring_3d * 0.5                                                 # risky
        + expired * 0                                                        # bad
        + untracked * 0.6                                                    # unknown risk
    ) / max(active, 1)  # range 0..1

    # Component 2: this-month waste rate (inverted — lower is better)
    waste_rate = thrown_this_month / max(total_this_month, 1)
    waste_component = 1.0 - waste_rate  # range 0..1

    # Combined: 70% current inventory health + 30% historical waste performance
    score = 0.7 * active_component + 0.3 * waste_component

    return round(score * 100)
```

### Reasoning

- **Expired items** score 0 — they are the worst signal (already wasted if no action).
- **Expiring in 3 days** scores 0.5 — urgent but salvageable.
- **Expiring in 7 days** scores 0.8 — at risk but manageable.
- **Untracked age >7d** scores 0.6 — unknown risk; might be bad, might not.
- **Healthy active** scores 1.0 — full credit.
- **Monthly waste rate** adds historical context — user who threw 50% last month gets lower score even if current inventory looks OK.

## Example

User Alice:
- 18 active items (10 healthy, 2 expiring in 3d, 2 expiring in 7d, 1 expired, 3 untracked >7d)
- This month: 5 used, 2 thrown

```python
active_component = (10 * 1.0 + 2 * 0.8 + 2 * 0.5 + 1 * 0 + 3 * 0.6) / 18
                 = (10 + 1.6 + 1.0 + 0 + 1.8) / 18
                 = 14.4 / 18
                 = 0.80

waste_rate = 2 / (5 + 2) = 0.286
waste_component = 1 - 0.286 = 0.714

score = 0.7 * 0.80 + 0.3 * 0.714 = 0.560 + 0.214 = 0.774

→ 77 (yellow, borderline healthy)
```

## Dashboard display

```
┌──────────────────────────────────────────────────────────┐
│  HEALTH SCORE                                            │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░  77/100                          │
│                                                          │
│  "10 healthy · 4 at risk · 1 expired · 3 untracked"    │
│  "Waste this month: 29%"                                 │
│                                                          │
│  [tap to see breakdown →]                                │
└──────────────────────────────────────────────────────────┘
```

Bar colour gradient:
- 0-49: red (`#ef4444`)
- 50-79: yellow (`#f59e0b`)
- 80-100: green (`#22c55e`)

## Drill-down (Health Score Detail page)

Route: `/health-score`

Breakdown view:

```
┌──────────────────────────────────────────────────────────┐
│  ← Dashboard                                             │
│  Health Score: 77/100 (Yellow — Warning)                 │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░                                  │
├──────────────────────────────────────────────────────────┤
│  WHAT'S PULLING YOUR SCORE DOWN                          │
│                                                          │
│  🔴 1 expired item (-5.6 pts)                            │
│      • Milk (expired yesterday)     [Throw][Used]       │
│                                                          │
│  🟠 2 expiring in 3 days (-5.0 pts)                      │
│      • Bread (Apr 26)               [Use][Give]         │
│      • Yogurt (Apr 27)              [Use][Give]         │
│                                                          │
│  🟡 3 untracked items >7 days old (-5.3 pts)             │
│      • Sugar (bought 12 days ago)   [Set expiry]        │
│      • Salt (bought 22 days ago)    [Set expiry]        │
│      • Rice (bought 15 days ago)    [Set expiry]        │
│                                                          │
│  📉 29% waste rate this month (-8.6 pts)                 │
│      You threw 2 of 7 items this month.                  │
│      Top wasted: Bread (2 this month)                    │
│      [See waste details →]                               │
├──────────────────────────────────────────────────────────┤
│  30-DAY TREND                                            │
│  [line chart of daily scores]                            │
└──────────────────────────────────────────────────────────┘
```

Each contributing factor:
- Shows the points deducted
- Lists specific items
- Gives inline actions to fix them
- Clicking an item drills to Purchase Event Detail

## Update cadence

- **On write**: score recomputed when user creates/updates a purchase event (fire-and-forget background job, writes to `users/{uid}/cache/health`)
- **On read**: if cache >5min old, recompute and store
- **Daily scheduler**: after `purchase_expiry_check` at 09:15 UTC, recompute all users' scores (so expired items reflect overnight)

## API endpoint

`GET /api/waste/health-score`

Response:
```json
{
  "score": 77,
  "grade": "yellow",
  "components": {
    "active": { "healthy": 10, "expiring_7d": 2, "expiring_3d": 2, "expired": 1, "untracked": 3 },
    "monthly_waste": { "used": 5, "thrown": 2, "rate": 0.286 }
  },
  "breakdown": [
    { "factor": "expired", "impact": -5.6, "items": [...] },
    { "factor": "expiring_3d", "impact": -5.0, "items": [...] },
    ...
  ],
  "computed_at": "2026-04-23T10:00:00Z"
}
```

## Future: per-category health

Later enhancement: break score down by category (dairy, bread, produce) to help users identify which areas need attention. Requires catalog entries to have categories (currently optional).
