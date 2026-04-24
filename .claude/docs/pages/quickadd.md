# QuickAdd Modal

File: `backend/web-admin/src/components/quickadd/QuickAddModal.tsx`
Companion: `CatalogAutocomplete.tsx` · `ExpiryInput.tsx`

## Purpose

Primary write-path for the refactored app. Replaces the legacy inventory add-form. Single-modal flow: name → optional expiry → optional More → save.

## Open sites

- `DashboardPage` — "+ Add item" button
- `MyItemsPage` — "+ Add item" button + empty-state hero CTA
- `CatalogListPage` — row-level "+ Add" button (uses `defaults.catalogEntry` to prefill)
- `CatalogEntryPage` — primary "New purchase" action
- `FrequentlyBoughtCard` — per-row "+ Add" button
- `ContextualScannerModal` — after scan, for `add_purchase` action (prefills `{name, barcode}`)
- `NameUnknownItemModal` — after naming an unknown barcode, opens this modal prefilled

## Defaults (`defaults` prop)

```ts
interface Defaults {
  name?: string;
  barcode?: string;
  catalogEntry?: CatalogEntry;  // full entry; prefills name + barcode + default_location
  location?: string;
}
```

## State-driven disclosure

- `name.trim().length > 0` → Save button enabled
- Typing triggers `useCatalog({ q: name, limit: 10 })` → autocomplete suggestions
- Selecting a suggestion → `matchedEntry` set → "matches existing catalog entry (N× bought)" hint
- `▼ More` reveals:
  - Barcode input
  - Price (gated by `financial_tracking` flag)
  - Payment toggle (Cash / Card) (gated by `financial_tracking` flag)

## Save flow

```
Save → useCreatePurchase.mutate({
  name: name.trim(),
  barcode: barcode.trim() || null,
  quantity,
  expiry_raw: expiryRaw.trim() || undefined,
  location,
  price: price ? parseFloat(price) : undefined,
  payment_method: paymentMethod || undefined,
})
  → POST /api/purchases
    → transactional catalog upsert + event create + counter increment
    → BackgroundTasks: check_user_milestones
  → onSuccess → toast 'Added' → close modal
  → React Query invalidates: purchases, catalog, waste, reminders
```

## NL expiry preview (`ExpiryInput`)

Client-side mirror of `backend/app/services/nl_expiry.py:parse_expiry`:
- "tomorrow" | "tmrw" | "tmr" → tomorrow's date
- "in N days" / "N days" / "next week" → computed
- ISO `YYYY-MM-DD` / DD/MM/YYYY → parsed
- "no expiry" / "n/a" / "" → badges as `tone: none`
- Otherwise → `tone: unknown`, "Will try to parse on save" (authoritative parse on server)

The server-side parser is authoritative — frontend preview is only for user confidence.

## Keyboard

- ESC closes (top-level effect)
- Enter in the name field triggers nothing (autocomplete dropdown present)
- Enter in Expiry or Price fields submits the form (not explicitly prevented; rely on Tab flow)

## Tests (manual, pre-rollout)

1. Open from Dashboard with no defaults → Name empty, Save disabled
2. Type "mil" → catalog autocomplete shows "Milk" if exists
3. Select "Milk" → name fills, barcode auto-populates, default_location pulls from catalog
4. "tomorrow" in expiry → green preview with tomorrow's date
5. Save → toast, dashboard HealthBar updates within 5s (query invalidation)