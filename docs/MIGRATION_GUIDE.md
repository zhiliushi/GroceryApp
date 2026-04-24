# Migration Guide — grocery_items → catalog + purchases

During the 2026-04 refactor, existing `users/{uid}/grocery_items` documents migrate to the new `catalog_entries` + `users/{uid}/purchases` model.

## Overview

- **Source**: `users/{uid}/grocery_items/{id}` (one doc per purchase, flat shape)
- **Destination**:
  - `catalog_entries/{uid}__{name_norm}` — aggregated catalog entry per unique name
  - `users/{uid}/purchases/{new_uuid}` — one purchase event per source item

**Source is NOT deleted.** Each source doc is marked `_migrated: true, _migrated_purchase_id: <new_id>, _migrated_at: <ts>` so re-runs skip it.

## When to run

After Phase 1 (foundation code deployed) is stable in production:
1. Run **dry-run** to verify output counts
2. Run on **admin user first** (test account) — verify catalog + events look correct
3. Run on **staging/test users** (<10 accounts) — smoke test web admin uses migrated data
4. Run on **full production** — batch by user group, off-hours

## Script location

`backend/scripts/migrate_grocery_items_to_purchases.py`

## Usage

```bash
# Dry-run (default — no writes)
python scripts/migrate_grocery_items_to_purchases.py

# Dry-run single user
python scripts/migrate_grocery_items_to_purchases.py --user <uid>

# Dry-run limit to first N users
python scripts/migrate_grocery_items_to_purchases.py --limit 10

# Execute (requires explicit flag)
python scripts/migrate_grocery_items_to_purchases.py --execute

# Execute single user
python scripts/migrate_grocery_items_to_purchases.py --execute --user <uid>

# Execute first N users (staged rollout)
python scripts/migrate_grocery_items_to_purchases.py --execute --limit 50
```

## Algorithm

Per user:

```python
def migrate_user(uid: str, dry_run: bool = True) -> dict:
    """Migrate one user's grocery_items to catalog + purchases."""
    
    # 1. Lock — prevent concurrent runs on same user
    lock_ref = db.collection("app_config").document("migrations").collection("grocery_items_v1").document(f"lock_{uid}")
    if lock_ref.get().exists:
        return {"status": "skipped_locked", "uid": uid}
    if not dry_run:
        lock_ref.set({"started_at": now, "pid": os.getpid()})
    
    # 2. Stream source items
    items = db.collection("users").document(uid).collection("grocery_items").stream()
    
    # 3. Group by normalized name
    by_name = defaultdict(list)
    for item in items:
        if item.to_dict().get("_migrated"):
            continue  # already migrated
        name_norm = _normalize(item.to_dict().get("name", ""))
        if not name_norm:
            continue  # skip items with empty/invalid names
        by_name[name_norm].append(item)
    
    # 4. For each normalized name → create/merge catalog entry + purchase events
    stats = {"catalog_created": 0, "catalog_merged": 0, "events_created": 0, "errors": []}
    
    for name_norm, source_items in by_name.items():
        # 4a. Upsert catalog
        catalog_doc_id = f"{uid}__{name_norm}"
        catalog_ref = db.collection("catalog_entries").document(catalog_doc_id)
        
        display_name = source_items[0].to_dict().get("name", name_norm)
        aliases = list({item.to_dict().get("name", "") for item in source_items if item.to_dict().get("name") != display_name})
        barcodes = list({item.to_dict().get("barcode") for item in source_items if item.to_dict().get("barcode")})
        barcode = barcodes[0] if barcodes else None
        
        default_location = _mode([item.to_dict().get("location") for item in source_items if item.to_dict().get("location")])
        default_category = _mode([item.to_dict().get("category") for item in source_items if item.to_dict().get("category")])
        
        active_count = sum(1 for item in source_items if item.to_dict().get("status") == "active")
        total_count = len(source_items)
        last_purchased_at = max(
            (item.to_dict().get("purchaseDate") or item.to_dict().get("addedDate") or 0 for item in source_items),
            default=0,
        )
        
        if not dry_run:
            catalog_ref.set({
                "user_id": uid,
                "name_norm": name_norm,
                "display_name": display_name,
                "aliases": aliases,
                "barcode": barcode,
                "default_location": default_location,
                "default_category": default_category,
                "active_purchases": active_count,
                "total_purchases": total_count,
                "last_purchased_at": last_purchased_at,
                "needs_review": any(item.to_dict().get("needsReview") for item in source_items),
                "source": "migration",
                "created_at": SERVER_TIMESTAMP,
                "updated_at": SERVER_TIMESTAMP,
                "schema_version": 1,
                "created_by": "migration",
            }, merge=True)
        
        stats["catalog_created"] += 1
        
        # 4b. Create purchase events
        batch = db.batch()
        batch_count = 0
        
        for item in source_items:
            src_data = item.to_dict()
            
            # Map status: active→active, consumed→used, expired→thrown+reason=expired, discarded→thrown+reason=bad
            src_status = src_data.get("status", "active")
            if src_status == "consumed":
                status = "used"; reason = "used_up"
            elif src_status == "expired":
                status = "thrown"; reason = "expired"
            elif src_status == "discarded":
                status = "thrown"; reason = "bad"
            else:
                status = "active"; reason = None
            
            expiry_ms = src_data.get("expiryDate") or src_data.get("expiry_date")
            expiry_date = _ms_to_timestamp(expiry_ms) if expiry_ms else None
            
            date_bought_ms = src_data.get("purchaseDate") or src_data.get("addedDate")
            date_bought = _ms_to_timestamp(date_bought_ms) if date_bought_ms else SERVER_TIMESTAMP
            
            consumed_date_ms = src_data.get("consumed_date") or src_data.get("consumedDate")
            consumed_date = _ms_to_timestamp(consumed_date_ms) if consumed_date_ms else None
            
            event_ref = db.collection("users").document(uid).collection("purchases").document()
            event_data = {
                "catalog_name_norm": name_norm,
                "catalog_display": display_name,
                "barcode": src_data.get("barcode"),
                "quantity": src_data.get("quantity", 1),
                "expiry_date": expiry_date,
                "expiry_source": "user" if expiry_ms else None,
                "price": src_data.get("price"),
                "date_bought": date_bought,
                "location": src_data.get("location"),
                "status": status,
                "consumed_date": consumed_date,
                "consumed_reason": reason,
                "reminder_stage": 0,
                "source": "migration",
                "source_ref": item.id,                        # track old ID
                "created_at": SERVER_TIMESTAMP,
                "updated_at": SERVER_TIMESTAMP,
                "schema_version": 1,
                "created_by": "migration",
            }
            
            if not dry_run:
                batch.set(event_ref, event_data)
                batch.update(item.reference, {
                    "_migrated": True,
                    "_migrated_purchase_id": event_ref.id,
                    "_migrated_at": SERVER_TIMESTAMP,
                })
                batch_count += 2  # 2 writes per item (create + update)
                
                # Commit every 400 writes (under 500 batch limit)
                if batch_count >= 400:
                    batch.commit()
                    batch = db.batch()
                    batch_count = 0
            
            stats["events_created"] += 1
        
        if not dry_run and batch_count > 0:
            batch.commit()
    
    # 5. Release lock, record metrics
    if not dry_run:
        lock_ref.delete()
        metrics_ref = db.collection("app_config").document("migrations").collection("grocery_items_v1").document(uid)
        metrics_ref.set({
            "uid": uid,
            "finished_at": SERVER_TIMESTAMP,
            **stats,
        })
    
    return {"uid": uid, "status": "success", **stats}
```

## Status mapping

| Source `grocery_items.status` | Destination `purchases.status` | `consumed_reason` |
|------------------------------|-------------------------------|-------------------|
| `active` | `active` | `null` |
| `consumed` | `used` | `"used_up"` |
| `expired` | `thrown` | `"expired"` |
| `discarded` | `thrown` | `"bad"` |

## Field mapping (all source → destination)

| Source field | Destination |
|--------------|-------------|
| `name` | `catalog.display_name`, `purchases.catalog_display` |
| `_normalize(name)` | catalog doc id suffix, `purchases.catalog_name_norm` |
| `barcode` | `purchases.barcode`, `catalog.barcode` (first non-null wins) |
| `quantity` | `purchases.quantity` |
| `location` | `purchases.location`; mode → `catalog.default_location` |
| `status` | mapped per table above |
| `expiryDate` or `expiry_date` (ms) | `purchases.expiry_date` (normalised) |
| `addedDate`, `added_date` | `purchases.date_bought` |
| `consumed_date`, `consumedDate` | `purchases.consumed_date` |
| `price` | `purchases.price` |
| `category` | mode → `catalog.default_category` |
| `source` | `purchases.source` (preserved from source) |
| `needsReview` | OR-aggregated → `catalog.needs_review` |
| `purchaseDate` | if present, overrides `addedDate` → `purchases.date_bought` |

## Progress tracking

`app_config/migrations/grocery_items_v1/{uid}` — per-user metrics doc:
```yaml
uid: str
finished_at: timestamp
catalog_created: int
catalog_merged: int
events_created: int
errors: str[]
```

Locks at `app_config/migrations/grocery_items_v1/lock_{uid}` — deleted on success.

Overall summary doc `app_config/migrations/grocery_items_v1/_summary`:
```yaml
started_at: timestamp
last_run_at: timestamp
users_processed: int
total_catalog_created: int
total_events_created: int
```

## Rollback

Script: `backend/scripts/rollback_purchases_migration.py`

Requires `--confirm-wipe` flag.

```python
def rollback_user(uid: str):
    # 1. Delete all catalog_entries where user_id == uid
    catalog_ref = db.collection("catalog_entries").where("user_id", "==", uid)
    for doc in catalog_ref.stream():
        doc.reference.delete()
    
    # 2. Delete all purchases for this user
    purchases_ref = db.collection("users").document(uid).collection("purchases")
    for doc in purchases_ref.stream():
        doc.reference.delete()
    
    # 3. Clear _migrated markers on source grocery_items
    items_ref = db.collection("users").document(uid).collection("grocery_items")
    for doc in items_ref.where("_migrated", "==", True).stream():
        doc.reference.update({
            "_migrated": firestore.DELETE_FIELD,
            "_migrated_purchase_id": firestore.DELETE_FIELD,
            "_migrated_at": firestore.DELETE_FIELD,
        })
    
    # 4. Clear migration metrics doc
    db.collection("app_config").document("migrations").collection("grocery_items_v1").document(uid).delete()
```

## Safety checklist

Before running `--execute`:

- [ ] Phase 1 foundation code deployed (feature_flags, services, schemas)
- [ ] Dry-run on production succeeded with expected counts
- [ ] Backup of Firestore is recent (<24h old)
- [ ] Ran on admin test account (yourself) — verified web admin shows correct data
- [ ] Ran on <10 staging users — no errors, correct counters
- [ ] Coordinated with team (no deploys during migration window)
- [ ] Monitoring active — watch error rates, Firestore write ops metric

## Verification (post-migration)

Run consistency checker: `backend/scripts/check_catalog_consistency.py`

Checks:
- Every `catalog.active_purchases` matches actual count of active events
- Every `catalog.total_purchases` matches actual count of events
- No orphan events (catalog_name_norm pointing to non-existent entry)
- No orphan catalog entries (entries with total=0 but created during migration suggest bug)

```bash
python scripts/check_catalog_consistency.py --user <uid>
python scripts/check_catalog_consistency.py  # all users
```

## Deprecation window

- Old `grocery_items` collection stays read-only for **90 days** after mobile app refactor ships
- Legacy endpoints (`/api/inventory/my`, etc.) return data from new model via backward-compat shim
- After 90 days: delete `users/*/grocery_items/*` collection entirely via sweep script

## Troubleshooting

**Migration stuck / lock doc present**: Check `app_config/migrations/grocery_items_v1/lock_{uid}`. If stale (>1 hour old), delete manually, re-run.

**Duplicate catalog entries**: Happens if re-run without idempotency check. Script checks `_migrated: true` on source — if bypassed, re-run may add events twice. Remedy: check `source: "migration"` on events, dedupe via `source_ref` (original grocery_items id).

**Missing expiry dates**: Some `grocery_items` have `expiryDate: 0` or invalid timestamps — script converts to `null` and flags reminder_stage=0 normally.

**Firestore quota exceeded during migration**: Free tier allows 20k writes/day. Large migrations may hit quota — split into multiple days using `--limit` flag.
