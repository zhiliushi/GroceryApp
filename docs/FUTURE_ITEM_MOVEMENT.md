# FUTURE: Scan-to-Move Item Location

**Status:** Deferred. Basic location-change via inline edit on Purchase Event Detail page is sufficient for initial rollout.

## Problem

After buying groceries, user puts them in various storage locations (pantry, fridge, freezer). Later, items may move:
- Pantry → Fridge (after opening)
- Fridge → Freezer (if not using soon)
- Counter → Pantry (after putting away delayed items)

Current flow: tap item → edit location field → save. Works but has friction (navigation + typing/picking).

## Proposed UX

**Floating scan button → "Move Location" action.** Scan an item at its new location:
1. Scan barcode
2. Backend finds user's active purchase events for that barcode (could be multiple if stocked more than once)
3. Show mini-picker: "Which Milk are you moving?" (list shows current location + expiry date)
4. User taps the one being moved
5. Show location picker: "Where is it going now?" (shows all configured storage locations with icons)
6. User taps new location → purchase event's `location` field updated
7. Event also records `location_history: [{from, to, at}]` for analytics

Fast flow: scan → tap item → tap location → done (3 taps).

## API

`POST /api/purchases/{event_id}/move`
```json
{ "new_location": "fridge" }
```

Returns updated event. Appends to `location_history` array.

Or more flexibly, `PATCH /api/purchases/{event_id}` with `{ location: "fridge" }` — already supported.

## New field on purchase event

```yaml
location_history:
  - from: "pantry"
    to: "fridge"
    moved_at: timestamp
    moved_by: uid
```

Optional; empty array if item never moved.

## Frontend

- `ContextualScannerModal` adds "Move Location" as a possible action alongside "Add to Inventory", "Mark Used", etc.
- New component `MoveLocationPicker.tsx` — simple grid of location icons
- Also available from Purchase Event Detail page as existing inline edit

## Use cases

- Food prep workflow (buy frozen, defrost in fridge, then cook)
- Discovered behind the fridge — move to front / different location
- Household sharing: family member moves item, wants to track "who moved what when"

## Analytics

`location_history` enables future analytics:
- "Items you move most often" (often = freezer-to-fridge for meal prep)
- "Average days in each location before next move"
- "Waste correlation with location changes" (moved to freezer = saved from waste?)

## Feature flag

`app_config/features.scan_to_move` — off by default until rolled out.

## Estimated effort

- Backend: 1 day (endpoint + schema update)
- Frontend: 2-3 days (scanner action + picker UI)
- Total: ~1 week

## Prerequisites

- Feature flag system in place (Phase 1 done)
- Contextual scanner modal implemented (Phase 4d done)
