# Catalog System

The **catalog** is the user's personal name-keyed list of items they've ever added. It is the source of truth for *what an item IS*, while **purchase events** record *when an item was bought*.

## Core concept

```
User types/scans "Milk" → Catalog entry `uid__milk` created/matched
                       → Purchase event created referencing it

User types/scans "Milk" again
                       → Catalog entry `uid__milk` already exists → reuse
                       → New purchase event created, catalog counters incremented
```

One catalog entry can have many purchase events (one per shopping trip). The catalog holds identity + defaults (display name, default location, linked barcode). Events hold individual transaction data (expiry, price, date, status).

---

## Uniqueness rules

1. **Per-user name uniqueness** — A single user cannot have two catalog entries with the same normalised name. `"Milk"`, `"milk"`, `" MILK "` all collapse to `name_norm = "milk"` and point to the same catalog doc.

2. **Cross-user independence** — Alice's `"milk"` and Bob's `"milk"` are two separate catalog docs, keyed by `{user_id}__{name_norm}`. They coexist; changes to one don't affect the other.

3. **One barcode per catalog entry** — A catalog entry has a single nullable `barcode` field (NOT an array). Different package sizes (e.g. "Milk 1L" vs "Milk 2L") require separately named entries. If user scans barcode X and another of their catalog entries already has X linked → 409 Conflict.

4. **Entry without barcode is first-class** — users can add items purely by name (e.g. "Grandma's jam") — those entries have `barcode: null` and work identically.

---

## Name normalization

```python
def _normalize(name: str) -> str:
    """Lowercase, strip whitespace, collapse internal whitespace to single underscore,
    remove punctuation except word chars and whitespace.
    
    Examples:
        "Milk"       → "milk"
        "MILK"       → "milk"
        " milk "     → "milk"
        "Milk 1L"    → "milk_1l"
        "MiLk 1 L"   → "milk_1_l"
        "Dr. Pepper" → "dr_pepper"
        "100% Juice" → "100_juice"
        "!!!"        → ""  (rejected)
    """
    stripped = name.strip().lower()
    cleaned = re.sub(r"[^\w\s]", "", stripped)
    return re.sub(r"\s+", "_", cleaned).strip("_")
```

**Rejected inputs** (API returns 400):
- Empty string after normalization (all punctuation/whitespace)
- Length > 300 characters after normalization (Firestore doc ID limit = 1500 bytes)

---

## Data flow

### Scenario 1: User types new name "Milk"

```
POST /api/purchases { name: "Milk" }
    ↓
purchase_event_service.create_purchase():
    name_norm = "milk"
    doc_id = f"{uid}__milk"
    
    Firestore transaction:
        catalog_ref = catalog_entries/{doc_id}
        if not catalog_ref.exists:
            catalog_ref.set({
                user_id: uid,
                name_norm: "milk",
                display_name: "Milk",
                active_purchases: 1,
                total_purchases: 1,
                last_purchased_at: SERVER_TIMESTAMP,
                created_at: SERVER_TIMESTAMP,
                source: "api",
            })
        else:
            catalog_ref.update({
                active_purchases: Increment(1),
                total_purchases: Increment(1),
                last_purchased_at: SERVER_TIMESTAMP,
                updated_at: SERVER_TIMESTAMP,
            })
        
        event_ref = users/{uid}/purchases/{auto_id}
        event_ref.set({
            catalog_name_norm: "milk",
            catalog_display: "Milk",
            date_bought: SERVER_TIMESTAMP,
            status: "active",
            reminder_stage: 0,
            ...
        })
    
    return event_id
```

### Scenario 2: User types "MILK" (same as above, different case)

```
name_norm("MILK") = "milk"  → same doc_id → same catalog entry reused
aliases[] gets ["Milk"] appended if not present (tracks casings seen)
```

### Scenario 3: User scans barcode X (first time)

```
1. Client: POST /api/barcode/{X}/scan-info
2. Backend barcode_service.lookup:
   a. Check global products/{X}
   b. If found, return product + user_catalog_match (null for first scan)
3. Client: POST /api/purchases { name: "Milk", barcode: X }
4. Backend purchase_event_service.create_purchase:
   - Check user's catalog for entry with barcode=X → no match
   - Check catalog_entries/{uid}__milk → no match either
   - Create catalog entry with barcode=X
   - Detect country_code from X's prefix via country_service
   - Create purchase event
```

### Scenario 4: User scans barcode X (already linked)

```
1. POST /api/barcode/{X}/scan-info
2. Returns user_catalog_match = {name: "Milk", barcode: X, ...}
3. Client offers one-tap confirm
4. POST /api/purchases { catalog_name_norm: "milk", barcode: X }
5. Backend skips catalog creation, just creates purchase event
```

### Scenario 5: User tries to link barcode X to a second entry "Lite Milk"

```
POST /api/catalog/{uid}__lite_milk with barcode=X
    ↓
catalog_service.update_catalog_entry:
    Query: where user_id == me && barcode == X
    → Found: {uid}__milk already has X
    → Raise ConflictError: "Barcode X is already linked to 'Milk'. Unlink it first or merge entries."
    ↓
API returns 409 with existing entry details
```

### Scenario 6: User marks purchase event as thrown (decrements counters)

```
POST /api/purchases/{event_id}/throw { reason: "expired" }
    ↓
purchase_event_service.update_status:
    Firestore transaction:
        event.update({status: "thrown", consumed_date: now, consumed_reason: "expired"})
        catalog.update({active_purchases: Increment(-1)})
```

---

## Catalog merge (user wants to combine two entries)

Scenario: User has both `"Milk"` and `"Fresh Milk"` and wants to merge them.

```
POST /api/catalog/{uid}__fresh_milk/merge { target: "milk" }
    ↓
catalog_service.merge_catalog(src="fresh_milk", dst="milk"):
    1. Read all purchase events where catalog_name_norm == "fresh_milk"
    2. Batch-update them: catalog_name_norm = "milk", catalog_display = "Milk"
       (chunked 400 per batch, respecting Firestore 500 write limit)
    3. Update catalog_entries/{uid}__milk:
       total_purchases += catalog_entries/{uid}__fresh_milk.total_purchases
       active_purchases += fresh_milk.active_purchases
       aliases += fresh_milk.display_name, fresh_milk.aliases
       If dst has no barcode but src does: inherit src's barcode
    4. Delete catalog_entries/{uid}__fresh_milk
```

---

## Cleanup (scheduler job)

Weekly Monday 03:00 UTC: `catalog_service.cleanup_unlinked_catalog()`

Deletes catalog entries where:
- `barcode == null` (user-created, not linked to a product)
- `active_purchases == 0`
- `last_purchased_at < now - 365 days` (inactive for a year)

This prevents unused personal names from accumulating forever. Entries with barcodes are preserved indefinitely (they represent real products scanned).

---

## Admin oversight

Admin view at `/admin/catalog-analysis` provides cross-user aggregations:

- **Barcode → names map** — for each barcode scanned across users, list all user-provided `display_name`s with counts. Helps admin:
  - Detect duplicate/inconsistent naming ("Milk" vs "Susu" vs "DL Milk" for same barcode)
  - Promote the most common user name to `products.product_name` for global consistency
  - Flag spam/junk entries

- **Unnamed barcodes** — barcodes users scanned but didn't associate with a catalog entry (abandoned scans). Admin can proactively create global product entries.

- **User-entered names without barcode** — unique names never linked to a barcode. Useful for:
  - Detecting common unbranded items ("Grandma's jam", "local bread")
  - Analytics: what categories have no barcode coverage

- **Catalog cleanup preview** — shows entries scheduled for deletion in next cleanup run (dry-run).

See `docs/ADMIN_CATALOG_ANALYSIS.md` for full admin UI spec.

---

## Catalog entry states (for UI)

| State | Conditions | UI actions |
|-------|-----------|-----------|
| **Empty** | No active purchases, no history | `[Delete]` |
| **Historical** | active=0, total>0 | `[Edit name]` `[Merge]` `[Delete (force)]` |
| **Active** | active>0 | `[Edit name]` `[Merge]` (Delete hidden) |
| **Linked** | barcode != null | + `[Unlink barcode]` |
| **Needs review** | needs_review=true (from stage-3 reminder or AI) | Banner "Review needed" + regular actions |

See `docs/STATE_DRIVEN_UI.md` for full state-to-action resolver patterns.
