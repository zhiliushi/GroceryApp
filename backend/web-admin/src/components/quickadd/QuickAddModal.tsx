import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useCreatePurchase,
  useCreateMultiPack,
  isQuotaExceededError,
  type QuotaExceededDetails,
} from '@/api/mutations/usePurchaseMutations';
import { useFeatureFlags } from '@/api/queries/useFeatureFlags';
import { useLocations } from '@/api/queries/useLocations';
import {
  validBaseUnits,
  defaultBaseUnit,
  suggestedPackLabels,
  effectiveUnitType,
  type UnitType,
} from '@/utils/unitType';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { useAuthStore } from '@/stores/authStore';
import { useScannerEngine } from '@/components/barcode/useScannerEngine';
import CatalogAutocomplete from './CatalogAutocomplete';
import ExpiryInput from './ExpiryInput';
import DidYouMeanSuggestions from './DidYouMeanSuggestions';
import QuotaHitPicker from '@/components/quota/QuotaHitPicker';
import StoreSelect from '@/components/stores/StoreSelect';
import { cn } from '@/utils/cn';
import type { CatalogEntry, PaymentMethod, ScanInfo } from '@/types/api';

interface QuickAddModalProps {
  open: boolean;
  onClose: () => void;
  // Pre-fill from barcode scan, etc.
  defaults?: {
    name?: string;
    barcode?: string;
    catalogEntry?: CatalogEntry;
    location?: string;
  };
}

// Common currencies for the dropdown — user can also type a 3-letter code if missing.
const CURRENCIES = ['SGD', 'MYR', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'IDR', 'THB', 'PHP', 'VND', 'INR', 'AUD'];

// UNIT_TYPE_TOUCHPOINT — base_unit + pack_label come from the canonical
// helpers in `utils/unitType.ts` (which mirrors backend
// `unit_type_service`). Don't reintroduce a local `UNITS` array here —
// the unit dropdown is filtered by the matched catalog's unit_type.
// See `.claude/docs/unit-type-method.md` for the data model.

export default function QuickAddModal({ open, onClose, defaults }: QuickAddModalProps) {
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState<string>('');
  const [expiryRaw, setExpiryRaw] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState<string>('count');
  const [price, setPrice] = useState<string>('');
  const [currency, setCurrency] = useState<string>('SGD');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  // Default 'pantry' is intentional — useLocations() falls back to a
  // hardcoded list that includes 'pantry' until the API responds. The
  // open-reset effect below picks `fallbackLocation` (registered or
  // 'pantry') so user-renamed locations also work. LOCATION_TOUCHPOINT.
  const [location, setLocation] = useState('pantry');
  const [showMore, setShowMore] = useState(false);
  const [matchedEntry, setMatchedEntry] = useState<CatalogEntry | undefined>();
  // Multi-pack mode — when on, qty/price single-fields are replaced by
  // pack_count × units_per_pack × price_per_pack and we POST /purchases/multi-pack.
  const [multiPackOn, setMultiPackOn] = useState(false);
  const [packCount, setPackCount] = useState<number>(1);
  const [unitsPerPack, setUnitsPerPack] = useState<number>(1);
  const [pricePerPack, setPricePerPack] = useState<string>('');
  // UNIT_TYPE_TOUCHPOINT — descriptive container name (carton/box/bag/…).
  // Defaults from suggestedPackLabels(unit_type) when matched, else 'pack'.
  const [packLabel, setPackLabel] = useState<string>('pack');
  // Phase D — store_id of where this purchase came from
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeLabel, setStoreLabel] = useState<string>('');

  const [scanning, setScanning] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [lookupBarcode, setLookupBarcode] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const stoppingRef = useRef(false);

  const { data: flags } = useFeatureFlags();
  const financialTracking = flags?.financial_tracking !== false;
  const authUser = useAuthStore((s) => s.user);
  const uid = authUser?.uid;
  const userCurrency = authUser?.currency ?? 'SGD';
  // LOCATION_TOUCHPOINT — the registered list (with hardcoded fallback).
  // See `.claude/docs/feature-inventory.md` "location touchpoints" for
  // the canonical-method rule; never reintroduce a per-component
  // hardcoded LOCATIONS array.
  const { locations } = useLocations();
  const fallbackLocation =
    locations.find((l) => l.key === 'pantry')?.key ?? locations[0]?.key ?? 'pantry';

  const createMutation = useCreatePurchase();
  const multiPackMutation = useCreateMultiPack();
  const [quotaDetails, setQuotaDetails] = useState<QuotaExceededDetails | null>(null);
  const scanner = useScannerEngine();
  const scannerRef = useRef(scanner);
  scannerRef.current = scanner;

  // Reset on open with defaults
  useEffect(() => {
    if (open) {
      setName(defaults?.name ?? defaults?.catalogEntry?.display_name ?? '');
      setBarcode(defaults?.barcode ?? defaults?.catalogEntry?.barcode ?? '');
      setLocation(
        defaults?.location ??
          defaults?.catalogEntry?.default_location ??
          fallbackLocation,
      );
      setExpiryRaw('');
      setQuantity(1);
      // UNIT_TYPE_TOUCHPOINT — default base_unit follows the catalog
      // row's unit_type when available. Buying milk should default to
      // 'ml', not 'count'.
      setUnit(defaultBaseUnit(defaults?.catalogEntry?.unit_type));
      setPrice('');
      setCurrency(userCurrency);
      setPaymentMethod('');
      setShowMore(false);
      setMatchedEntry(defaults?.catalogEntry);
      setScanning(false);
      setManualBarcode('');
      setLookupBarcode(null);
      setLookupError(null);
      setMultiPackOn(false);
      setPackCount(1);
      setUnitsPerPack(1);
      setPackLabel(
        suggestedPackLabels(defaults?.catalogEntry?.unit_type)[0] ?? 'pack',
      );
      setPricePerPack('');
      setStoreId(null);
      setStoreLabel('');
    }
  }, [open, defaults, userCurrency]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  const handleDetected = useCallback((bc: string) => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    scannerRef.current.stopScanning();
    setLookupBarcode(bc);
  }, []);

  // Start camera when scanning is toggled on
  useEffect(() => {
    if (!open || !scanning) return;
    stoppingRef.current = false;
    if (scanner.engine !== 'manual') {
      scanner.startScanning(handleDetected);
    }
    return () => {
      scanner.stopScanning();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scanning]);

  // Look up the barcode → populate form
  useEffect(() => {
    if (!lookupBarcode) return;
    let cancelled = false;
    setLookupError(null);
    apiClient
      .get<ScanInfo>(API.BARCODE_SCAN_INFO(lookupBarcode), {
        params: { user_id: uid || '' },
      })
      .then((r) => {
        if (cancelled) return;
        const info = r.data;
        const entry = info.user_catalog_match;
        const product = info.global_product as
          | { product_name?: string; name?: string }
          | null;
        const resolvedName =
          entry?.display_name ?? product?.product_name ?? product?.name ?? '';

        setBarcode(info.barcode);
        if (resolvedName) setName(resolvedName);
        if (entry?.default_location) setLocation(entry.default_location);
        setMatchedEntry(entry ?? undefined);
        if (info.user_history.avg_price != null && !price) {
          setPrice(String(info.user_history.avg_price));
        }
        if (!entry && !product) {
          setShowMore(true);
        }
        setScanning(false);
        setLookupBarcode(null);
        setManualBarcode('');
      })
      .catch((err) => {
        if (cancelled) return;
        setLookupError(err instanceof Error ? err.message : 'Lookup failed');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookupBarcode, uid]);

  if (!open) return null;

  const isPending = createMutation.isPending || multiPackMutation.isPending;
  const canSaveSingle = name.trim().length > 0 && !isPending;
  const canSaveMulti =
    name.trim().length > 0 &&
    packCount >= 1 &&
    unitsPerPack >= 1 &&
    !isPending;
  const canSave = multiPackOn ? canSaveMulti : canSaveSingle;

  // Live total + per-unit auto-compute for multi-pack mode.
  const ppPackNum = parseFloat(pricePerPack);
  const multiPackTotal =
    !isNaN(ppPackNum) && packCount > 0 ? ppPackNum * packCount : null;
  const multiPackUnitPrice =
    !isNaN(ppPackNum) && unitsPerPack > 0 ? ppPackNum / unitsPerPack : null;

  function handleAutocomplete(newName: string, entry?: CatalogEntry) {
    setName(newName);
    setMatchedEntry(entry);
    if (entry) {
      if (entry.barcode && !barcode) setBarcode(entry.barcode);
      // Override the default location with the catalog row's default
      // when the user hasn't deliberately picked a different one. We
      // compare against the fallback rather than a literal string so
      // user-renamed locations still trigger the override.
      if (entry.default_location && location === fallbackLocation) {
        setLocation(entry.default_location);
      }
      // UNIT_TYPE_TOUCHPOINT — default base_unit follows the matched
      // row's unit_type (volume → ml, weight → g, count → count). Only
      // override when the user hasn't deliberately changed it from the
      // initial 'count'.
      if (entry.unit_type && unit === 'count') {
        setUnit(defaultBaseUnit(entry.unit_type));
      }
    }
  }

  // UNIT_TYPE_TOUCHPOINT — read the catalog row's effective unit_type
  // (count by default; legacy 'container' coerced via the canonical
  // helper). Drives base_unit dropdown filtering + pack_label suggestions.
  const matchedUnitType: UnitType = effectiveUnitType(matchedEntry);

  function handleSave() {
    if (!canSave) return;
    if (multiPackOn) {
      multiPackMutation.mutate(
        {
          name: name.trim(),
          barcode: barcode.trim() || null,
          pack_count: packCount,
          units_per_pack: unitsPerPack,
          price_per_pack: pricePerPack ? parseFloat(pricePerPack) : null,
          currency: currency || null,
          expiry_raw: expiryRaw.trim() || null,
          location,
          store_id: storeId || null,
          // UNIT_TYPE_TOUCHPOINT — pass canonical fields per
          // `.claude/docs/unit-type-method.md`.
          base_unit_label: unit,
          base_unit: unit,
          pack_label: packLabel,
        },
        {
          onSuccess: () => onClose(),
          onError: (err) => {
            const q = isQuotaExceededError(err);
            if (q) setQuotaDetails(q);
          },
        },
      );
      return;
    }
    createMutation.mutate(
      {
        name: name.trim(),
        barcode: barcode.trim() || null,
        quantity,
        // UNIT_TYPE_TOUCHPOINT — write canonical fields. Single-pack
        // mode means loose-by-default, pack_size=1.
        unit: unit || undefined,
        pack_label: 'loose',
        pack_size: 1,
        base_unit: unit as 'count' | 'ml' | 'L' | 'g' | 'kg' | undefined,
        expiry_raw: expiryRaw.trim() || undefined,
        location,
        price: price ? parseFloat(price) : undefined,
        currency: price && currency ? currency : undefined,
        payment_method: paymentMethod || undefined,
        store_id: storeId || undefined,
      },
      {
        onSuccess: () => onClose(),
        onError: (err) => {
          const q = isQuotaExceededError(err);
          if (q) setQuotaDetails(q);
        },
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]" onClick={onClose}>
      <QuotaHitPicker
        open={quotaDetails !== null}
        details={quotaDetails}
        onCancel={() => setQuotaDetails(null)}
        onResolved={() => {
          setQuotaDetails(null);
          // Retry the create that just failed.
          handleSave();
        }}
      />
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-ga-bg-card border border-ga-border rounded-xl shadow-2xl max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-ga-border flex items-center justify-between">
          <h3 className="text-base font-semibold text-ga-text-primary">Add item</h3>
          <button onClick={onClose} className="text-ga-text-secondary hover:text-ga-text-primary">
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {scanning ? (
            <ScannerView
              engine={scanner.engine}
              status={scanner.status}
              error={scanner.error}
              hasTorch={scanner.hasTorch}
              torchOn={scanner.torchOn}
              onToggleTorch={scanner.toggleTorch}
              framesScanned={scanner.framesScanned}
              autoFallback={scanner.autoFallback}
              html5NoDetectionHint={scanner.html5NoDetectionHint}
              manualBarcode={manualBarcode}
              setManualBarcode={setManualBarcode}
              onManualLookup={() => {
                const bc = manualBarcode.trim();
                if (bc.length < 4) return;
                handleDetected(bc);
              }}
              looking={!!lookupBarcode && !lookupError}
              lookupBarcode={lookupBarcode}
              lookupError={lookupError}
              onCancel={() => {
                scanner.stopScanning();
                setScanning(false);
                setManualBarcode('');
                setLookupBarcode(null);
                setLookupError(null);
                stoppingRef.current = false;
              }}
              onRetry={() => {
                setLookupError(null);
                setLookupBarcode(null);
                stoppingRef.current = false;
                if (scanner.engine !== 'manual') {
                  scanner.startScanning(handleDetected);
                }
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setScanning(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-ga-accent/50 text-ga-accent rounded-md hover:bg-ga-accent/10 text-sm"
            >
              📷 Scan barcode to autofill
            </button>
          )}

          <div>
            <label className="block text-xs text-ga-text-secondary mb-1">
              Name <span className="text-red-500">*</span>
              {matchedEntry && (
                <span className="ml-2 text-green-500">
                  · matches existing catalog entry ({matchedEntry.total_purchases}× bought)
                </span>
              )}
            </label>
            <CatalogAutocomplete value={name} onChange={handleAutocomplete} autoFocus />
            {!matchedEntry && (
              <DidYouMeanSuggestions
                query={name}
                onPick={(m) => {
                  setName(m.display_name);
                  setMatchedEntry({
                    id: m.name_norm,
                    name_norm: m.name_norm,
                    display_name: m.display_name,
                    barcode: m.barcode,
                    total_purchases: m.total_purchases,
                    active_purchases: m.active_purchases,
                    last_purchased_at: m.last_purchased_at,
                  } as unknown as CatalogEntry);
                  if (m.barcode && !barcode) setBarcode(m.barcode);
                }}
              />
            )}
          </div>

          <ExpiryInput value={expiryRaw} onChange={setExpiryRaw} />

          {/* Quantity row layout — UNIT_TYPE_TOUCHPOINT.
              Earlier iteration crammed [−, input, +, unit-select] into one
              tight row inside grid-cols-2; the input collapsed to ~46px and
              the number was barely readable. Now: number input is a fixed
              `w-16` so it's always legible, unit dropdown moves to its own
              field below the row on mobile (stacks naturally via wrap on
              cramped widths). The unit defaults track unit_type — see
              defaultUnitForType() at top of file. */}
          {!multiPackOn && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-ga-text-secondary mb-1">
                  Quantity
                  {matchedEntry?.unit_type && (
                    <span className="ml-1 text-[10px] text-ga-text-secondary font-normal">
                      ({matchedEntry.unit_type})
                    </span>
                  )}
                </label>
                <div className="flex gap-1 items-center">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(0.1, Math.ceil(quantity) - 1))}
                    disabled={quantity <= 0.1}
                    className="w-9 h-10 flex-shrink-0 rounded border border-ga-border text-ga-text-primary hover:bg-ga-bg-hover disabled:opacity-40 disabled:cursor-not-allowed text-base leading-none"
                    aria-label="Decrease quantity (snaps to whole number)"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
                    className="w-16 flex-shrink-0 px-2 py-2 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary focus:outline-none focus:border-ga-accent text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.floor(quantity) + 1)}
                    className="w-9 h-10 flex-shrink-0 rounded border border-ga-border text-ga-text-primary hover:bg-ga-bg-hover text-base leading-none"
                    aria-label="Increase quantity (snaps to whole number)"
                  >
                    +
                  </button>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="flex-1 min-w-0 px-2 py-2 pr-7 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary focus:outline-none focus:border-ga-accent"
                    aria-label="Unit"
                  >
                    {/* UNIT_TYPE_TOUCHPOINT — base_unit options filtered
                        by the matched catalog row's unit_type. Drop the
                        old "pack" option (pack is a buy-side label, not
                        a measurement unit; see unit-type-method.md). */}
                    {validBaseUnits(matchedUnitType).map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-ga-text-secondary mb-1">Location</label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary focus:outline-none focus:border-ga-accent"
                >
                  {locations.map((l) => (
                    <option key={l.key} value={l.key}>
                      {l.icon} {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Multi-pack toggle + inputs (catalog_evolution.md §2.2 #5).
              When on, single quantity is hidden — each event represents one pack
              with its own expiry, sharing a multi_pack_parent_id. */}
          <div className="border-t border-ga-border pt-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={multiPackOn}
                onChange={(e) => setMultiPackOn(e.target.checked)}
              />
              <span className="text-ga-text-primary">
                Multi-pack purchase (e.g. 6 packs of 6 eggs)
              </span>
            </label>
            {multiPackOn && (
              <div className="mt-3 space-y-3 bg-ga-bg-hover/30 rounded-md p-3">
                {/* UNIT_TYPE_TOUCHPOINT — pack_label + base_unit row.
                    pack_label is a free-text descriptive container name
                    (carton, box, bag, …); base_unit is the measurement
                    (filtered by the matched catalog row's unit_type). */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-ga-text-secondary mb-1 uppercase tracking-wide">
                      Pack label
                    </label>
                    <input
                      type="text"
                      list="pack-label-suggestions"
                      value={packLabel}
                      onChange={(e) =>
                        setPackLabel(e.target.value.trim().toLowerCase())
                      }
                      placeholder="carton / box / bag / …"
                      className="w-full px-2 py-2 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary focus:outline-none focus:border-ga-accent"
                    />
                    <datalist id="pack-label-suggestions">
                      {suggestedPackLabels(matchedUnitType).map((label) => (
                        <option key={label} value={label} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-[10px] text-ga-text-secondary mb-1 uppercase tracking-wide">
                      Base unit
                    </label>
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full px-2 py-2 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary focus:outline-none focus:border-ga-accent"
                    >
                      {validBaseUnits(matchedUnitType).map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-ga-text-secondary mb-1 uppercase tracking-wide">
                      # {packLabel}{packCount === 1 ? '' : 's'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={packCount}
                      onChange={(e) => setPackCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-2 py-2 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary text-center tabular-nums focus:outline-none focus:border-ga-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-ga-text-secondary mb-1 uppercase tracking-wide">
                      {unit}/{packLabel}
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={unitsPerPack}
                      onChange={(e) => setUnitsPerPack(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-2 py-2 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary text-center tabular-nums focus:outline-none focus:border-ga-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-ga-text-secondary mb-1 uppercase tracking-wide">
                      Price/{packLabel}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={pricePerPack}
                      onChange={(e) => setPricePerPack(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-2 py-2 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary text-center tabular-nums focus:outline-none focus:border-ga-accent"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-ga-bg-card border border-ga-border rounded p-2">
                    <div className="text-[10px] text-ga-text-secondary uppercase tracking-wide">Total</div>
                    <div className="text-ga-text-primary tabular-nums font-medium">
                      {multiPackTotal != null
                        ? `${currency} ${multiPackTotal.toFixed(2)}`
                        : '—'}
                    </div>
                  </div>
                  <div className="bg-ga-bg-card border border-ga-border rounded p-2">
                    <div className="text-[10px] text-ga-text-secondary uppercase tracking-wide">Per unit</div>
                    <div className="text-ga-text-primary tabular-nums font-medium">
                      {multiPackUnitPrice != null
                        ? `${currency} ${multiPackUnitPrice.toFixed(2)}`
                        : '—'}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-ga-text-secondary mb-1">Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-3 py-2 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary focus:outline-none focus:border-ga-accent"
                    >
                      {(CURRENCIES.includes(currency)
                        ? CURRENCIES
                        : [currency, ...CURRENCIES]
                      ).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-ga-text-secondary mb-1">Location</label>
                    <select
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full px-3 py-2 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary focus:outline-none focus:border-ga-accent"
                    >
                      {locations.map((l) => (
                        <option key={l.key} value={l.key}>
                          {l.icon} {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-[10px] text-ga-text-secondary">
                  Saving creates {packCount} separate event{packCount === 1 ? '' : 's'} sharing one
                  parent ID — each pack tracked with its own expiry.
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowMore(!showMore)}
            className="text-xs text-ga-accent hover:underline"
          >
            {showMore ? '▲ Less' : '▼ More details (barcode, price, payment)'}
          </button>

          {showMore && (
            <div className="space-y-3 pt-2 border-t border-ga-border">
              <div>
                <label className="block text-xs text-ga-text-secondary mb-1">Barcode</label>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3 py-2 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary focus:outline-none focus:border-ga-accent"
                />
              </div>
              {financialTracking && !multiPackOn && (
                <>
                  <div>
                    <label className="block text-xs text-ga-text-secondary mb-1">Price</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0.00"
                        className="flex-1 min-w-0 px-3 py-2 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary focus:outline-none focus:border-ga-accent tabular-nums"
                      />
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        aria-label="Currency"
                        className="flex-shrink-0 px-2 py-2 pr-7 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary focus:outline-none focus:border-ga-accent"
                      >
                        {(CURRENCIES.includes(currency)
                          ? CURRENCIES
                          : [currency, ...CURRENCIES]
                        ).map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    {currency !== userCurrency && (
                      <p className="mt-1 text-[10px] text-ga-text-secondary">
                        Will be converted to {userCurrency} (your display currency) at save time.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-ga-text-secondary mb-1">
                      Store (where bought)
                    </label>
                    <StoreSelect
                      value={storeId}
                      valueLabel={storeLabel}
                      onChange={(id, label) => {
                        setStoreId(id);
                        setStoreLabel(label);
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-ga-text-secondary mb-1">Payment</label>
                    <div className="flex gap-2">
                      {(['cash', 'card'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPaymentMethod(paymentMethod === m ? '' : m)}
                          className={cn(
                            'px-4 py-1.5 text-sm rounded border',
                            paymentMethod === m
                              ? 'bg-ga-accent text-white border-ga-accent'
                              : 'border-ga-border text-ga-text-secondary hover:bg-ga-bg-hover',
                          )}
                        >
                          {m === 'cash' ? '💵 Cash' : '💳 Card'}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-ga-border flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md',
              canSave ? 'bg-ga-accent text-white hover:opacity-90' : 'bg-ga-bg-hover text-ga-text-secondary cursor-not-allowed',
            )}
          >
            {isPending
              ? 'Saving…'
              : multiPackOn
                ? `Save ${packCount} pack${packCount === 1 ? '' : 's'}`
                : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ScannerViewProps {
  engine: 'native' | 'html5-qrcode' | 'manual';
  status: 'idle' | 'starting' | 'scanning' | 'paused' | 'error';
  error: string | null;
  hasTorch: boolean;
  torchOn: boolean;
  onToggleTorch: () => Promise<void>;
  framesScanned: number;
  autoFallback: boolean;
  html5NoDetectionHint: boolean;
  manualBarcode: string;
  setManualBarcode: (v: string) => void;
  onManualLookup: () => void;
  looking: boolean;
  lookupBarcode: string | null;
  lookupError: string | null;
  onCancel: () => void;
  onRetry: () => void;
}

function ScannerView({
  engine,
  status,
  error,
  hasTorch,
  torchOn,
  onToggleTorch,
  framesScanned,
  autoFallback,
  html5NoDetectionHint,
  manualBarcode,
  setManualBarcode,
  onManualLookup,
  looking,
  lookupBarcode,
  lookupError,
  onCancel,
  onRetry,
}: ScannerViewProps) {
  const debugEnabled =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).has('debug') ||
      window.localStorage.getItem('scannerDebug') === '1' ||
      html5NoDetectionHint);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-ga-text-primary">📷 Scan barcode</div>
        <button
          onClick={onCancel}
          className="text-xs text-ga-text-secondary hover:text-ga-text-primary"
        >
          Cancel
        </button>
      </div>

      {looking && lookupBarcode && (
        <div className="text-sm text-ga-text-secondary py-3 text-center animate-pulse">
          Looking up {lookupBarcode}…
        </div>
      )}

      {lookupError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded p-3 text-sm text-red-400">
          Lookup failed: {lookupError}
          <button onClick={onRetry} className="ml-2 underline">
            Retry
          </button>
        </div>
      )}

      {!looking && !lookupError && (
        <>
          {engine !== 'manual' ? (
            <div className="relative bg-black rounded-lg overflow-hidden aspect-[4/3]">
              <div id="barcode-viewfinder" className="absolute inset-0" />
              {/* Soft centering guide. The actual decode zone is the full
                  video frame (qrbox is unset to avoid html5-qrcode's
                  shaded-region overlay, which on iOS confused users about
                  what was actually being scanned). */}
              <div
                aria-hidden
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3/5 h-1/3 border-2 border-white/70 rounded pointer-events-none"
              />
              {status === 'error' && (
                <div className="absolute inset-0 flex items-center justify-center text-white text-sm p-4 text-center bg-black/80">
                  Camera unavailable: {error}
                </div>
              )}
              {hasTorch && (
                <button
                  onClick={() => onToggleTorch()}
                  className="absolute top-2 right-2 bg-black/50 text-white text-xs rounded px-2 py-1"
                >
                  {torchOn ? '🔦 Torch on' : '🔦 Torch off'}
                </button>
              )}
              {debugEnabled && (
                <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-mono rounded px-2 py-1 leading-tight">
                  {engine} · {status}
                  <br />
                  frames: {framesScanned}
                </div>
              )}
              {autoFallback && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs rounded px-3 py-1 whitespace-nowrap">
                  Trying alternate scanner…
                </div>
              )}
              {html5NoDetectionHint && !autoFallback && (
                <div className="absolute bottom-2 left-2 right-2 bg-black/75 text-white text-[11px] rounded px-3 py-2 leading-snug">
                  Still searching — try moving closer, holding steady, or
                  improving lighting. Or enter the barcode manually below.
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-ga-text-secondary italic">
              Camera unavailable on this device — enter the barcode manually below.
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs text-ga-text-secondary">
              Or type / paste barcode manually
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onManualLookup();
                }}
                placeholder="e.g. 9555012345678"
                className="flex-1 px-3 py-2 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary"
              />
              <button
                onClick={onManualLookup}
                disabled={manualBarcode.length < 4}
                className={cn(
                  'px-4 py-2 text-sm rounded',
                  manualBarcode.length >= 4
                    ? 'bg-ga-accent text-white'
                    : 'bg-ga-bg-hover text-ga-text-secondary cursor-not-allowed',
                )}
              >
                Look up
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
