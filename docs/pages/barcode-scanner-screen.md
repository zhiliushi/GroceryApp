# BarcodeScannerScreen

**File:** `src/screens/scanner/BarcodeScannerScreen.tsx`
**Tab:** Scan Tab (entry point)
**Header:** Hidden (full-screen camera)

## Objective

Standalone barcode scanner on the Scan tab. Scans a product barcode, looks it up in multiple databases, and offers to add it to Inventory or a Shopping List.

## User View — States

### 1. Camera Active (scanning)

| Element | Data |
|---------|------|
| Camera feed | Full-screen live camera |
| Barcode overlay | Animated scan region indicator |
| Torch button | Toggle flashlight on/off |
| Footer hint | "Point camera at a barcode" |
| Manual entry link | "Enter Manually" |

### 2. Product Found

| Element | Data |
|---------|------|
| Product image | From barcode database |
| "Product Found" heading | — |
| Product name | Resolved name |
| Brand | Brand name |
| Categories | Category string |
| Barcode | Raw barcode number |
| Source tag | Where data came from (e.g. "open food facts") |

| Button | Action |
|--------|--------|
| Add to Inventory | Navigate to AddItem with prefill |
| Add to Shopping List | Navigate to ListPicker with prefill |
| Scan Another | Reset scanner |
| Enter Manually | Navigate to AddItem (empty) |

### 3. Product Not Found

| Element | Data |
|---------|------|
| "Product Not Found" heading | — |
| Barcode | Raw barcode number |
| Description | "This barcode isn't in our database yet" |

| Button | Action |
|--------|--------|
| Add to Inventory | Navigate to AddItem with barcode prefill |
| Add to Shopping List | Navigate to ListPicker with barcode prefill |
| Scan Another | Reset scanner |
| Enter Manually | Navigate to AddItem (empty) |

### 4. Permission States

| State | Display |
|-------|---------|
| Loading | Activity indicator |
| Not determined | Camera icon + "Grant Camera Access" button |
| Denied | Camera-off icon + "Open Settings" button |
| No camera | Camera-off icon + "Enter Manually" button |

### 5. Loading / Error

| State | Display |
|-------|---------|
| Loading | "Looking up product..." spinner |
| Error | Error message + "Try Again" button |

## Functions & Processes

| Function | Description |
|----------|-------------|
| `useBarcode()` hook | Manages scan state, product lookup, loading, error |
| `handleScan(codes)` | Called when camera detects barcode, triggers product lookup |
| `reset()` | Resets scanner to active scanning state |
| `requestPermission()` | Requests camera permission from OS |
| Barcode lookup chain | Local cache → Firebase → Open Food Facts API |

## Filters

None (scanner screen).
