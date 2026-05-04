# FUTURE: Receipt-scan bulk import

**Status:** deferred. Captured 2026-05-04 from real-user walkthrough feedback —
"Saturday shop = a chore, 8-10 minutes to log 15 items in the SPA. Cap that
at 'log expensive perishables only' and skip the rest."

The single-item QuickAddModal is the tightest in-app capture path. It still
charges a per-item tax (name, qty, expiry, price, location, payment method)
that compounds across a full Saturday haul. Receipt OCR collapses that into
one photo + one review pass.

## Current state of OCR in the codebase

- `flags.recipe_ocr` — gates the photo-scan button on `RecipeFormPage`.
  Ships as a feature flag, default OFF.
- Mindee + Google Vision — wired as the upstream providers (per
  `docs/legal/privacy-policy.md` §4: "image bytes sent for OCR, never
  stored by us"). Used today only by recipe scans.
- `app/services/receipt_*` — partial scaffolding from the plan-era OCR
  work. Worth a grep before starting; some service surface may already
  exist.

## What "receipt scan" needs

### User flow

1. User taps **📷 Scan receipt** on QuickAddModal (or a new entry on
   MyItemsPage).
2. Camera capture or file upload (JPG / PNG / HEIC).
3. Backend OCR → returns `{ store, total, currency, lines: [{ name, qty,
   unit_price, line_total }] }`.
4. Confirmation page: each line is a draft purchase event with editable
   fields, pre-filled from OCR. User reviews, fixes wrong rows, taps
   **Save all**.
5. Bulk-create via existing `purchase_event_service.create_purchase`,
   one event per row. Optional: deduplicate against existing active
   inventory by name+barcode.

### Backend

- New endpoint `POST /api/receipts/scan` — accepts image, returns parsed
  rows (no DB writes). Same contract as the recipe scan endpoint.
- New endpoint `POST /api/receipts/commit` — accepts the user-confirmed
  row list, writes purchase events transactionally.
- Provider routing — Mindee receipt API is a known fit ($0.10/scan
  retail tier). Receipt OCR has provider-specific quirks; abstract
  behind a `receipt_ocr_provider` flag.
- New `flags.receipt_ocr` (off by default during beta).

### Frontend

- New component `<ReceiptScanModal />` in `components/scanner/`.
- Mounted from QuickAddModal as a sibling tab (alongside the existing
  manual entry and barcode scan).
- Confirmation page reuses the QuickAddModal field shape per row.
- Bulk-save uses a single mutation that fans out into N
  `useCreatePurchase` calls; show progress (3/15, 4/15, …).

### Edge cases worth pinning early

- **Store name** — OCR usually reads "Tesco Mutiara Damansara Receipt
  #12345". Auto-match against the user's `stores` collection or
  fuzzy-match on the canonical name; don't create a new store per
  scan.
- **Currency** — receipt may use `RM`, `MYR`, `$`, or no marker.
  Default to user's `currency_preference`; per-row override allowed.
- **Quantity vs pack size** — receipts often show "EGGS 12s × 1 unit"
  not "12 eggs". Heuristic: when OCR gives `unit_count × pack_size`,
  combine into `quantity = unit_count × pack_size` for the purchase
  event.
- **Non-grocery rows** — supermarket receipts include kitchenware,
  cleaning, etc. Don't try to gate; let the user delete unwanted
  rows in the confirmation page. (Same as scan + edit.)
- **Expiry date** — never on the receipt. Leave blank by default; the
  per-row review surface should suggest an expiry from the catalog
  entry's typical (`avg_days_to_expiry` per catalog entry, computed
  from history).

## Estimated effort

| Slice | Time |
|---|---|
| Backend `/api/receipts/scan` + provider plumbing | 1 day |
| Backend `/api/receipts/commit` + dedup logic | 0.5 day |
| Frontend ReceiptScanModal + bulk-save UX | 1.5 days |
| Confirmation page (edit-before-save row table) | 0.5 day |
| Tests + doc updates | 0.5 day |
| **Total** | **~4 days** |

## Trigger criteria

This is a quality-of-life upgrade, not a structural blocker. Build it
when:

- Phase A cutover ✓ done
- Mobile refactor (D2) underway or shipped — receipt scan is much more
  valuable on mobile than web (camera latency)
- Real user feedback (>3 reports) explicitly mentions Saturday
  logging fatigue — already caught in walkthrough 2026-05-04, but
  let it accumulate before scoping

## Cross-references

- Walkthrough notes (2026-05-04): Mira persona test surfaced this as
  the single highest-leverage UX investment.
- `RecipeFormPage` already implements a similar shape (photo-scan →
  parsed object → review). Reuse the pattern.
- `docs/PAID_ENHANCEMENTS.md` should gain a row for Mindee receipt
  scanning when this ships (per-scan cost vs free-tier).
- Future enhancement after this lands: **e-receipt PDF parser** for
  Lazada/Shopee/Tesco-Online — most online receipts already arrive
  structured; PDF text extract is cheaper than OCR.
