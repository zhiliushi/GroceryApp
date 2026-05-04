import { useState } from 'react';
import { useAddShoppingListPrice } from '@/api/mutations/useShoppingListMutations';
import { useAuthStore } from '@/stores/authStore';

interface Props {
  listId: string;
  itemId: string;
  onScanForBarcode?: () => void;  // optional — opens scanner to set barcode
  onClose: () => void;
  defaultBarcode?: string;
}

/**
 * v3: AddAlternative form (kept file name `AddPriceInlineForm` for diff-stability).
 * An alternative is a candidate purchase under a primary. v3 adds:
 *  - candidate_name (override the primary's name when this alt is a different SKU)
 *  - pack_count + pack_size (multi-pack semantics; total qty = product)
 *  - weight/volume pair
 *  - price is now OPTIONAL — alt can be sketched first, priced later.
 * Cap: 3 alternatives per primary (beta).
 */
export default function AddPriceInlineForm({
  listId,
  itemId,
  onScanForBarcode,
  onClose,
  defaultBarcode,
}: Props) {
  const userCurrency = useAuthStore((s) => s.user?.currency_preference) || 'SGD';
  const [showMore, setShowMore] = useState(false);
  // Core
  const [candidateName, setCandidateName] = useState('');
  const [price, setPrice] = useState('');
  const [brand, setBrand] = useState('');
  const [store, setStore] = useState('');
  const [currency, setCurrency] = useState(userCurrency);
  const [barcode, setBarcode] = useState(defaultBarcode || '');
  // Pack qty
  const [packCount, setPackCount] = useState('1');
  const [packSize, setPackSize] = useState('');
  // Weight/Volume
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<'g' | 'kg' | 'oz' | 'lb'>('g');
  const [volume, setVolume] = useState('');
  const [volumeUnit, setVolumeUnit] = useState<'ml' | 'l' | 'fl_oz' | 'cup'>('ml');

  const addMutation = useAddShoppingListPrice();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = { currency };
    const p = parseFloat(price);
    if (price.trim() && (!p || p <= 0)) return;  // bad price input
    if (price.trim()) payload.price = p;
    if (brand.trim()) payload.brand = brand.trim();
    if (store.trim()) payload.store_name = store.trim();
    if (barcode.trim()) payload.barcode = barcode.trim();
    if (candidateName.trim()) payload.candidate_name = candidateName.trim();
    const pc = parseFloat(packCount);
    if (pc > 0) payload.pack_count = pc;
    const ps = parseFloat(packSize);
    if (ps > 0) payload.pack_size = ps;
    const w = parseFloat(weight);
    if (w > 0) {
      payload.weight_value = w;
      payload.weight_unit = weightUnit;
    }
    const v = parseFloat(volume);
    if (v > 0) {
      payload.volume_value = v;
      payload.volume_unit = volumeUnit;
    }
    addMutation.mutate(
      { listId, itemId, payload: payload as Parameters<typeof addMutation.mutate>[0]['payload'] },
      { onSuccess: onClose },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-ga-bg-primary border border-ga-border rounded-md p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          autoFocus
          type="text"
          value={candidateName}
          onChange={(e) => setCandidateName(e.target.value)}
          placeholder="Brand / variant (optional override)"
          className="px-2 py-1.5 bg-ga-bg-card border border-ga-border rounded text-sm text-ga-text-primary placeholder:text-ga-text-secondary focus:outline-none focus:border-ga-accent"
        />
        <div className="flex">
          <input
            type="number"
            step="any"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price (optional)"
            className="flex-1 min-w-0 px-2 py-1.5 bg-ga-bg-card border border-ga-border rounded-l text-sm text-ga-text-primary placeholder:text-ga-text-secondary focus:outline-none focus:border-ga-accent"
          />
          <input
            type="text"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
            className="w-14 px-2 py-1.5 bg-ga-bg-card border border-l-0 border-ga-border rounded-r text-xs text-ga-text-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <input
          type="number"
          step="any"
          min="0"
          value={packCount}
          onChange={(e) => setPackCount(e.target.value)}
          placeholder="# packs"
          className="px-2 py-1.5 bg-ga-bg-card border border-ga-border rounded text-sm text-ga-text-primary placeholder:text-ga-text-secondary focus:outline-none focus:border-ga-accent"
        />
        <input
          type="number"
          step="any"
          min="0"
          value={packSize}
          onChange={(e) => setPackSize(e.target.value)}
          placeholder="Per pack"
          className="px-2 py-1.5 bg-ga-bg-card border border-ga-border rounded text-sm text-ga-text-primary placeholder:text-ga-text-secondary focus:outline-none focus:border-ga-accent"
        />
        <input
          type="text"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="Brand"
          className="px-2 py-1.5 bg-ga-bg-card border border-ga-border rounded text-sm text-ga-text-primary placeholder:text-ga-text-secondary focus:outline-none focus:border-ga-accent"
        />
      </div>

      {showMore && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex">
              <input
                type="number"
                step="any"
                min="0"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="Weight"
                className="flex-1 min-w-0 px-2 py-1.5 bg-ga-bg-card border border-ga-border rounded-l text-sm text-ga-text-primary placeholder:text-ga-text-secondary focus:outline-none focus:border-ga-accent"
              />
              <select
                value={weightUnit}
                onChange={(e) => setWeightUnit(e.target.value as typeof weightUnit)}
                className="px-2 py-1.5 bg-ga-bg-card border border-l-0 border-ga-border rounded-r text-xs text-ga-text-primary focus:outline-none"
              >
                <option value="g">g</option>
                <option value="kg">kg</option>
                <option value="oz">oz</option>
                <option value="lb">lb</option>
              </select>
            </div>
            <div className="flex">
              <input
                type="number"
                step="any"
                min="0"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                placeholder="Volume"
                className="flex-1 min-w-0 px-2 py-1.5 bg-ga-bg-card border border-ga-border rounded-l text-sm text-ga-text-primary placeholder:text-ga-text-secondary focus:outline-none focus:border-ga-accent"
              />
              <select
                value={volumeUnit}
                onChange={(e) => setVolumeUnit(e.target.value as typeof volumeUnit)}
                className="px-2 py-1.5 bg-ga-bg-card border border-l-0 border-ga-border rounded-r text-xs text-ga-text-primary focus:outline-none"
              >
                <option value="ml">ml</option>
                <option value="l">L</option>
                <option value="fl_oz">fl oz</option>
                <option value="cup">cup</option>
              </select>
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={store}
          onChange={(e) => setStore(e.target.value)}
          placeholder="Store (optional)"
          className="px-2 py-1.5 bg-ga-bg-card border border-ga-border rounded text-sm text-ga-text-primary placeholder:text-ga-text-secondary focus:outline-none focus:border-ga-accent"
        />
        <div className="flex gap-1">
          <input
            type="text"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Barcode (optional)"
            className="flex-1 min-w-0 px-2 py-1.5 bg-ga-bg-card border border-ga-border rounded text-sm text-ga-text-primary placeholder:text-ga-text-secondary focus:outline-none focus:border-ga-accent"
          />
          {onScanForBarcode && (
            <button
              type="button"
              onClick={onScanForBarcode}
              title="Scan barcode"
              className="px-2 py-1.5 text-sm border border-ga-border rounded text-ga-text-primary hover:bg-ga-bg-hover"
            >
              📷
            </button>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center">
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="text-xs text-ga-text-secondary hover:text-ga-text-primary"
        >
          {showMore ? '▴ Less' : '▾ Weight / Volume'}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-xs border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={addMutation.isPending}
            className="px-3 py-1 text-xs font-medium rounded-md bg-ga-accent hover:bg-ga-accent-hover text-white disabled:opacity-50"
          >
            {addMutation.isPending ? 'Adding…' : 'Add alternative'}
          </button>
        </div>
      </div>
    </form>
  );
}
