import { useState } from 'react';
import type { ShoppingListPrice } from '@/types/api';

export type BuyChoice =
  | { kind: 'price'; price: ShoppingListPrice }
  | { kind: 'rescan' }
  | { kind: 'manual' };

interface Props {
  itemName: string;
  prices: ShoppingListPrice[];
  onPick: (choice: BuyChoice) => void;
  onCancel: () => void;
}

/**
 * Modal shown when user clicks Buy on an item with multiple price entries.
 * Pre-buy step: pick which one (or rescan / manual entry).
 * Single-price items skip this and go straight to QuickAddModal.
 */
export default function PricePickerDialog({ itemName, prices, onPick, onCancel }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(prices[0]?.id ?? null);

  function confirmPrice() {
    const p = prices.find((p) => p.id === selectedId);
    if (p) onPick({ kind: 'price', price: p });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]" onClick={onCancel}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-ga-bg-card border border-ga-border rounded-xl shadow-2xl max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-ga-border">
          <h3 className="text-sm font-semibold text-ga-text-primary">
            Which one are you buying?
          </h3>
          <p className="text-xs text-ga-text-secondary mt-0.5">{itemName}</p>
        </div>

        <div className="px-5 py-3 space-y-2 max-h-[40vh] overflow-y-auto">
          {prices.map((p) => (
            <label
              key={p.id}
              className={`flex items-center gap-3 p-2 rounded-md border cursor-pointer transition-colors ${
                selectedId === p.id
                  ? 'border-ga-accent bg-ga-accent/10'
                  : 'border-ga-border hover:bg-ga-bg-hover'
              }`}
            >
              <input
                type="radio"
                name="price"
                checked={selectedId === p.id}
                onChange={() => setSelectedId(p.id)}
                className="accent-ga-accent"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-ga-text-primary">
                  {p.brand || '—'}{' '}
                  <span className="text-ga-accent">
                    {p.currency} {p.price.toFixed(2)}
                  </span>
                </div>
                <div className="text-xs text-ga-text-secondary">
                  {p.store_name && <span>{p.store_name}</span>}
                  {p.store_name && p.barcode && <span> · </span>}
                  {p.barcode && <span className="font-mono">{p.barcode}</span>}
                </div>
              </div>
            </label>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-ga-border space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => onPick({ kind: 'rescan' })}
              className="flex-1 px-3 py-1.5 text-xs border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover"
            >
              📷 Different one (rescan)
            </button>
            <button
              onClick={() => onPick({ kind: 'manual' })}
              className="flex-1 px-3 py-1.5 text-xs border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover"
            >
              Manual entry
            </button>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-sm border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover"
            >
              Cancel
            </button>
            <button
              onClick={confirmPrice}
              disabled={!selectedId}
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-ga-accent hover:bg-ga-accent-hover text-white disabled:opacity-50"
            >
              Buy this one
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
