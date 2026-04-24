import { useEffect, useState } from 'react';
import { useCreatePurchase } from '@/api/mutations/usePurchaseMutations';
import { useFeatureFlags } from '@/api/queries/useFeatureFlags';
import CatalogAutocomplete from './CatalogAutocomplete';
import ExpiryInput from './ExpiryInput';
import { cn } from '@/utils/cn';
import type { CatalogEntry, PaymentMethod } from '@/types/api';

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

  const { data: flags } = useFeatureFlags();
  const financialTracking = flags?.financial_tracking !== false;

  const createMutation = useCreatePurchase();

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
