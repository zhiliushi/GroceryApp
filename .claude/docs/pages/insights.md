# Insights (Phase 5)

Routes:
- `/insights` → `pages/insights/InsightsPage.tsx`

Related components:
- `components/dashboard/InsightsCard.tsx` — top-insight banner on Dashboard
- Backend: `services/insights_service.py` + `api/routes/insights.py`

## Purpose

Milestone-driven narratives at 50 / 100 / 500 / 1000 purchases. Rich content beyond "you hit 50 items" — shows top purchased, waste breakdown, spending, shopping frequency, avoid list.

## Data shape

`users/{uid}/insights/milestone_{N}`:

```json
{
  "kind": "milestone",
  "milestone": 100,
  "total_purchases_at_trigger": 123,
  "status": "ready",
  "title": "You've bought 100 items!",
  "description": "You've crossed 100 purchases. Your most-bought item is Milk (12×). So far you've used 72 and thrown 20 (22% waste rate). You shop about every 6.3 days, most often on Saturday. Consider buying less Yogurt — you've thrown 40% of what you bought.",
  "top_purchased": [{ "name": "Milk", "name_norm": "milk", "count": 12 }, ...],
  "waste_breakdown": [{ "name": "Yogurt", "name_norm": "yogurt", "count": 4, "value": 18.0 }, ...],
  "spending": { "cash": 120, "card": 340, "total": 460 },
  "shopping_frequency": { "avg_days_between": 6.3, "peak_day": "Saturday" },
  "avoid_list": [{ "name": "Yogurt", "name_norm": "yogurt", "waste_rate": 0.4, "thrown": 4, "total": 10 }, ...]
}
```

## Generation

Two triggers — idempotent via doc ID `.get().exists` check:

1. **Inline (real-time, best-effort)** — `POST /api/purchases` adds `BackgroundTasks.add_task(insights_service.check_user_milestones, uid)`. Runs after HTTP response; worker crash loses only this one trigger — backstopped by scheduler.
2. **Scheduler (hourly backstop)** — `scheduler.milestone_check` → `insights_service.check_milestones()` iterates all users with catalog entries and calls `check_user_milestones(uid)`.

### Two-pass optimization

`check_user_milestones(uid)`:
- **Pass 1 (cheap)**: sum `catalog_entries.total_purchases` where `user_id == uid` — one query.
- **Pass 2 (heavy, only when needed)**: `_aggregate_user_stats(uid)` — one catalog query + one purchase events stream → builds full doc. Only runs when a milestone is actually crossed AND not already emitted.

See `docs/WORKFLOWS.md#milestone-insights-50--100--500--1000` for the full flow.

## Rendering

### InsightsCard (dashboard)

- Auto-hides when `data.count === 0`
- Renders top insight inline: title + description + dismiss
- "View all N insights →" linking to `/insights`

### InsightsPage

- List of all non-dismissed insights
- Each renders via `InsightCard` component
- `MilestoneDetails` grid: Top purchased · Thrown most · Spending · Shopping pattern · Avoid list (full-width)
- Each catalog reference cross-links to `/catalog/{name_norm}`
- Dismiss button per insight → `useDismissInsight` → `POST /api/insights/{id}/dismiss`

## Flag gating

- `insights` flag OFF → `GET /api/insights` returns `{count: 0, insights: []}` → card + page auto-hide / empty-state
- Also hidden in Sidebar (secondary nav entry has `requiresFlag: 'insights'`)

## Narrative (`_narrative`)

Rule-based template. Swappable to LLM by replacing the function body — input is the full stats dict, output is a string. Tested in `tests/services/test_milestone_insights.py`.