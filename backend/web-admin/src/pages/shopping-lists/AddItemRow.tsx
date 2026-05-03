import { useState } from 'react';
import CatalogAutocomplete from '@/components/quickadd/CatalogAutocomplete';
import { useAddShoppingListItem } from '@/api/mutations/useShoppingListMutations';
import type { CatalogEntry, AddShoppingListItemPayload } from '@/types/api';
import { cn } from '@/utils/cn';

type Mode = 'collapsed' | 'manual' | 'catalog';

interface Props {
  listId: string;
  atCap: boolean;
  onScanClick: () => void;
}

/** Three-entry-point add row for the shopping list detail page.
 *  - Manual: name (required) + optional qty + optional weight/volume
 *  - Catalog: CatalogAutocomplete picker → adds matched entry
 *  - Scan: delegates to parent (ContextualScannerModal)
 */
export default function AddItemRow({ listId, atCap, onScanClick }: Props) {
  const [mode, setMode] = useState<Mode>('collapsed');
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<'g' | 'kg' | 'oz' | 'lb'>('g');
  const [volume, setVolume] = useState('');
  const [volumeUnit, setVolumeUnit] = useState<'ml' | 'l' | 'fl_oz' | 'cup'>('ml');

  const addMutation = useAddShoppingListItem();

  function reset() {
    setName('');
    setQty('');
    setWeight('');
    setVolume('');
    setMode('collapsed');
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const payload: AddShoppingListItemPayload = {
      item_name: name.trim(),
      source: 'manual',
    };
    if (qty.trim()) {
      const q = parseFloat(qty);
      if (q > 0) payload.quantity = q;
    }
    if (weight.trim()) {
      const w = parseFloat(weight);
      if (w > 0) {
        payload.weight_value = w;
        payload.weight_unit = weightUnit;
      }
    }
    if (volume.trim()) {
      const v = parseFloat(volume);
      if (v > 0) {
        payload.volume_value = v;
        payload.volume_unit = volumeUnit;
      }
    }
    addMutation.mutate({ listId, payload }, { onSuccess: reset });
  }

  function handleCatalogPick(displayName: string, entry?: CatalogEntry) {
    setName(displayName);
    if (entry) {
      addMutation.mutate(
        {
          listId,
          payload: {
            item_name: entry.display_name,
            barcode: entry.barcode || undefined,
            source_catalog_name_norm: entry.name_norm || undefined,
            source: 'catalog',
          },
        },
        { onSuccess: reset },
      );
    }
  }

  if (atCap) {
    return (
      <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300">
        List is full (50 items). Buy or remove an item to add another.
      </div>
    );
  }

  if (mode === 'collapsed') {
    return (
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setMode('manual')}
          className="px-3 py-1.5 text-sm font-medium rounded-md bg-ga-accent hover:bg-ga-accent-hover text-white"
        >
          + Add manually
        </button>
        <button
          onClick={() => setMode('catalog')}
          className="px-3 py-1.5 text-sm font-medium rounded-md border border-ga-border text-ga-text-primary hover:bg-ga-bg-hover"
        >
          📚 Browse catalog
        </button>
        <button
          onClick={onScanClick}
          className="px-3 py-1.5 text-sm font-medium rounded-md border border-ga-border text-ga-text-primary hover:bg-ga-bg-hover"
        >
          📷 Scan
        </button>
      </div>
    );
  }

  if (mode === 'catalog') {
    return (
      <div className="mb-4 rounded-lg border border-ga-border bg-ga-bg-card p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-ga-text-secondary">
            Pick from your catalog (or type to search)
          </span>
          <button
            onClick={reset}
            className="text-xs text-ga-text-secondary hover:text-ga-text-primary"
          >
            ✕ Cancel
          </button>
        </div>
        <CatalogAutocomplete
          value={name}
          onChange={handleCatalogPick}
          placeholder="Search your catalog…"
          autoFocus
        />
        {addMutation.isPending && (
          <p className="mt-2 text-xs text-ga-text-secondary">Adding…</p>
        )}
      </div>
    );
  }

  // mode === 'manual'
  return (
    <form
      onSubmit={handleManualSubmit}
      className="mb-4 rounded-lg border border-ga-border bg-ga-bg-card p-3 space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-ga-text-secondary">Add item — name required, others optional</span>
        <button
          type="button"
          onClick={reset}
          className="text-xs text-ga-text-secondary hover:text-ga-text-primary"
        >
          ✕ Cancel
        </button>
      </div>
      <input
        autoFocus
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Item name (e.g. 'Eggs')"
        maxLength={120}
        className="w-full px-3 py-2 bg-ga-bg-primary border border-ga-border rounded-md text-sm text-ga-text-primary placeholder:text-ga-text-secondary focus:outline-none focus:border-ga-accent"
      />
      <div className="grid grid-cols-3 gap-2">
        <input
          type="number"
          step="any"
          min="0"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="Qty"
          className="px-3 py-2 bg-ga-bg-primary border border-ga-border rounded-md text-sm text-ga-text-primary placeholder:text-ga-text-secondary focus:outline-none focus:border-ga-accent"
        />
        <div className="flex">
          <input
            type="number"
            step="any"
            min="0"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="Weight"
            className="flex-1 min-w-0 px-3 py-2 bg-ga-bg-primary border border-ga-border rounded-l-md text-sm text-ga-text-primary placeholder:text-ga-text-secondary focus:outline-none focus:border-ga-accent"
          />
          <select
            value={weightUnit}
            onChange={(e) => setWeightUnit(e.target.value as typeof weightUnit)}
            className="px-2 bg-ga-bg-primary border border-l-0 border-ga-border rounded-r-md text-xs text-ga-text-primary focus:outline-none"
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
            className="flex-1 min-w-0 px-3 py-2 bg-ga-bg-primary border border-ga-border rounded-l-md text-sm text-ga-text-primary placeholder:text-ga-text-secondary focus:outline-none focus:border-ga-accent"
          />
          <select
            value={volumeUnit}
            onChange={(e) => setVolumeUnit(e.target.value as typeof volumeUnit)}
            className="px-2 bg-ga-bg-primary border border-l-0 border-ga-border rounded-r-md text-xs text-ga-text-primary focus:outline-none"
          >
            <option value="ml">ml</option>
            <option value="l">L</option>
            <option value="fl_oz">fl oz</option>
            <option value="cup">cup</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!name.trim() || addMutation.isPending}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-md',
            !name.trim() || addMutation.isPending
              ? 'bg-ga-bg-hover text-ga-text-secondary cursor-not-allowed'
              : 'bg-ga-accent hover:bg-ga-accent-hover text-white',
          )}
        >
          {addMutation.isPending ? 'Adding…' : 'Add to list'}
        </button>
      </div>
    </form>
  );
}
