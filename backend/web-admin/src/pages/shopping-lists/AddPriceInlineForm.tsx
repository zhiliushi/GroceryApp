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

export default function AddPriceInlineForm({
  listId,
  itemId,
  onScanForBarcode,
  onClose,
  defaultBarcode,
}: Props) {
  const userCurrency = useAuthStore((s) => s.user?.currency) || 'SGD';
  const [price, setPrice] = useState('');
  const [brand, setBrand] = useState('');
  const [store, setStore] = useState('');
  const [currency, setCurrency] = useState(userCurrency);
  const [barcode, setBarcode] = useState(defaultBarcode || '');

  const addMutation = useAddShoppingListPrice();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const p = parseFloat(price);
    if (!p || p <= 0) return;
    addMutation.mutate(
      {
        listId,
        itemId,
        payload: {
          price: p,
          currency,
          brand: brand.trim() || undefined,
          store_name: store.trim() || undefined,
          barcode: barcode.trim() || undefined,
        },
      },
      { onSuccess: onClose },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-ga-bg-primary border border-ga-border rounded-md p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex">
          <input
            autoFocus
            type="number"
            step="any"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price *"
            className="flex-1 min-w-0 px-2 py-1.5 bg-ga-bg-card border border-ga-border rounded-l text-sm text-ga-text-primary placeholder:text-ga-text-secondary focus:outline-none focus:border-ga-accent"
          />
          <input
            type="text"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
            className="w-14 px-2 py-1.5 bg-ga-bg-card border border-l-0 border-ga-border rounded-r text-xs text-ga-text-primary focus:outline-none"
          />
        </div>
        <input
          type="text"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="Brand (optional)"
          className="px-2 py-1.5 bg-ga-bg-card border border-ga-border rounded text-sm text-ga-text-primary placeholder:text-ga-text-secondary focus:outline-none focus:border-ga-accent"
        />
      </div>
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
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1 text-xs border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!price || addMutation.isPending}
          className="px-3 py-1 text-xs font-medium rounded-md bg-ga-accent hover:bg-ga-accent-hover text-white disabled:opacity-50"
        >
          {addMutation.isPending ? 'Adding…' : 'Add price'}
        </button>
      </div>
    </form>
  );
}
