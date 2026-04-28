import { useCallback, useEffect, useRef, useState } from 'react';
import { useCreatePurchase } from '@/api/mutations/usePurchaseMutations';
import { useFeatureFlags } from '@/api/queries/useFeatureFlags';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { useAuthStore } from '@/stores/authStore';
import { useScannerEngine } from '@/components/barcode/useScannerEngine';
import CatalogAutocomplete from './CatalogAutocomplete';
import ExpiryInput from './ExpiryInput';
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

const LOCATIONS = ['fridge', 'freezer', 'pantry', 'counter', 'other'];

export default function QuickAddModal({ open, onClose, defaults }: QuickAddModalProps) {
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState<string>('');
  const [expiryRaw, setExpiryRaw] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [location, setLocation] = useState('pantry');
  const [showMore, setShowMore] = useState(false);
  const [matchedEntry, setMatchedEntry] = useState<CatalogEntry | undefined>();

  const [scanning, setScanning] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [lookupBarcode, setLookupBarcode] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const stoppingRef = useRef(false);

  const { data: flags } = useFeatureFlags();
  const financialTracking = flags?.financial_tracking !== false;
  const uid = useAuthStore((s) => s.user?.uid);

  const createMutation = useCreatePurchase();
  const scanner = useScannerEngine();
  const scannerRef = useRef(scanner);
  scannerRef.current = scanner;

  // Reset on open with defaults
  useEffect(() => {
    if (open) {
      setName(defaults?.name ?? defaults?.catalogEntry?.display_name ?? '');
      setBarcode(defaults?.barcode ?? defaults?.catalogEntry?.barcode ?? '');
      setLocation(defaults?.location ?? defaults?.catalogEntry?.default_location ?? 'pantry');
      setExpiryRaw('');
      setQuantity(1);
      setPrice('');
      setPaymentMethod('');
      setShowMore(false);
      setMatchedEntry(defaults?.catalogEntry);
      setScanning(false);
      setManualBarcode('');
      setLookupBarcode(null);
      setLookupError(null);
    }
  }, [open, defaults]);

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

  const canSave = name.trim().length > 0 && !createMutation.isPending;

  function handleAutocomplete(newName: string, entry?: CatalogEntry) {
    setName(newName);
    setMatchedEntry(entry);
    if (entry) {
      if (entry.barcode && !barcode) setBarcode(entry.barcode);
      if (entry.default_location && location === 'pantry') {
        setLocation(entry.default_location);
      }
    }
  }

  function handleSave() {
    if (!canSave) return;
    createMutation.mutate(
      {
        name: name.trim(),
        barcode: barcode.trim() || null,
        quantity,
        expiry_raw: expiryRaw.trim() || undefined,
        location,
        price: price ? parseFloat(price) : undefined,
        payment_method: paymentMethod || undefined,
      },
      {
        onSuccess: () => onClose(),
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]" onClick={onClose}>
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
          </div>

          <ExpiryInput value={expiryRaw} onChange={setExpiryRaw} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ga-text-secondary mb-1">Quantity</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary focus:outline-none focus:border-ga-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-ga-text-secondary mb-1">Location</label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary focus:outline-none focus:border-ga-accent"
              >
                {LOCATIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
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
              {financialTracking && (
                <>
                  <div>
                    <label className="block text-xs text-ga-text-secondary mb-1">Price</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary focus:outline-none focus:border-ga-accent"
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
            {createMutation.isPending ? 'Saving…' : 'Save'}
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
  manualBarcode,
  setManualBarcode,
  onManualLookup,
  looking,
  lookupBarcode,
  lookupError,
  onCancel,
  onRetry,
}: ScannerViewProps) {
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
              <div className="absolute inset-10 border-2 border-white/60 rounded pointer-events-none" />
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
