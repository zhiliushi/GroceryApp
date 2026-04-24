# FUTURE: AI-Powered Catalog Deduplication

**Status:** Deferred. Manual admin tools in `ADMIN_CATALOG_ANALYSIS.md` are sufficient for now.

## Problem

User catalogs accumulate near-duplicate entries over time:
- Typos: "Mlik" vs "Milk"
- Abbreviations: "DL Milk" vs "Dutch Lady Milk"
- Translations: "Milk" vs "Susu"
- Variations: "Milk 1L" vs "Milk One Liter"

Manual merging is tedious. AI can suggest or auto-merge high-confidence duplicates.

## Approach

Scheduler runs weekly: `ai_catalog_dedup_service.scan_duplicates`.

### Candidates

For each user's catalog entries:
1. Filter to entries with `catalog.needs_review=true` (set by stage-3 reminders) OR low purchase counts
2. Compute pairwise similarity:
   - Levenshtein distance on name (handles typos)
   - Jaccard token similarity (handles abbreviations)
   - Same-barcode match (high signal)
3. Score each pair; above threshold (~0.85) → merge candidate

### Dedup decision

For each candidate pair `(A, B)` per user:
- Auto-merge if:
  - Same barcode OR similarity > 0.95 AND both have recent active purchases
- Suggest merge (don't auto) if:
  - 0.85 < similarity < 0.95 OR different barcodes but similar names
- Ignore if similarity < 0.85

### LLM enhancement (optional)

For ambiguous pairs, call Mistral API:
```
"Are these two grocery items likely the same? Answer with {same: true/false, confidence: 0-1, reason: string}.
  Item A: 'Mlik 1L' (bought 5 times)
  Item B: 'Milk 1L' (bought 22 times)"
```

## User UX

New notification type `dedup_suggestion`:
- In-app banner: "You may have duplicate catalog entries: 'Milk' and 'MILK (with typo)'. Merge?"
- Action buttons: `[Merge]` `[Keep separate]` `[Later]`
- Dismissal remembered per pair

Auto-merges:
- Happen silently overnight
- Log to `users/{uid}/ai_dedup_log` so user can see/undo
- Settings toggle: "Auto-merge high-confidence duplicates" (default on)

## Admin oversight

Admin page extends CatalogAnalysisPage with "AI Dedup Log":
- All auto-merges across users
- Revert button for mistakes
- Adjust similarity threshold globally

## File structure

```
backend/app/services/
  ai_dedup_service.py          # NEW: pairwise similarity, LLM call, merge logic
```

## Feature flag

`app_config/features.ai_catalog_dedup` — off by default until validated.

## Estimated effort

- Algorithm tuning: 2-3 days
- Frontend UX: 1-2 days
- Total: ~1 week

## Prerequisites

- Sufficient data volume (>1000 active catalog entries across users) to validate similarity thresholds
- Mistral API key configured
- User trust built on manual admin dedup first
