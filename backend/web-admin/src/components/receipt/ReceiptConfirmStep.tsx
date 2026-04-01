import { useState, useMemo, useCallback } from 'react';
import type { ReceiptScanResult, ReceiptConfirmRequest } from '@/types/api';

interface EditableItem {
  id: string;
  checked: boolean;
  name: string;
  price: number;
  quantity: number;
  barcode: string | null;
  location: string;
  confidence: number;
  brand: string | null;
  image_url: string | null;
  barcode_source: string | null;
}

interface ReceiptConfirmStepProps {
  scanResult: ReceiptScanResult;
  destination: 'inventory' | 'shopping_list' | 'price_only';
  listId?: string;
  onConfirm: (data: ReceiptConfirmRequest) => void;
  onRetry: () => void;
  isConfirming: boolean;
  confirmError: string | null;
}

const LOCATIONS = ['fridge', 'pantry', 'freezer'];
let nextId = 0;

export default function ReceiptConfirmStep({
  scanResult,
  destination,
  listId,
  onConfirm,
  onRetry,
  isConfirming,
  confirmError,
}: ReceiptConfirmStepProps) {
  const [storeName, setStoreName] = useState(scanResult.store.name ?? '');
  const [storeAddress, setStoreAddress] = useState(scanResult.store.address ?? '');
  const [receiptDate, setReceiptDate] = useState(scanResult.date ?? '');
  const [showRaw, setShowRaw] = useState(false);

  const [items, setItems] = useState<EditableItem[]>(() =>
    scanResult.items.map((item) => ({
      id: `item_${nextId++}`,
      checked: true,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      barcode: item.barcode,
      location: 'pantry',
      confidence: item.confidence,
      brand: item.brand,
      image_url: item.image_url,
      barcode_source: item.barcode_source,
    })),
  );

  const checkedCount = useMemo(() => items.filter((i) => i.checked).length, [items]);
  const itemsTotal = useMemo(
    () => items.filter((i) => i.checked).reduce((sum, i) => sum + i.price * i.quantity, 0),
    [items],
  );

  const hasInvalidItems = useMemo(
    () => items.some((i) => i.checked && (!i.name.trim() || i.price < 0)),
    [items],
  );

  const updateItem = useCallback((id: string, updates: Partial<EditableItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const addItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      {
        id: `item_${nextId++}`,
        checked: true,
        name: '',
        price: 0,
        quantity: 1,
        barcode: null,
        location: 'pantry',
        confidence: 1.0,
        brand: null,
        image_url: null,
        barcode_source: null,
      },
    ]);
  }, []);

  const handleConfirm = useCallback(() => {
    const confirmed = items.filter((i) => i.checked && i.name.trim());
    onConfirm({
      scan_id: scanResult.scan_id,
      store_name: storeName || null,
      store_address: storeAddress || null,
      date: receiptDate || null,
      destination,
      list_id: listId,
      items: confirmed.map((i) => ({
        name: i.name.trim(),
        price: i.price,
        quantity: i.quantity,
        barcode: i.barcode,
        location: i.location,
      })),
      total: itemsTotal,
    });
  }, [items, scanResult.scan_id, storeName, storeAddress, receiptDate, destination, listId, itemsTotal, onConfirm]);

  return (
    <div className="space-y-4">
      {/* Provider info */}
      <div className="flex items-center gap-3 text-xs text-ga-text-secondary">
        <span>Provider: <strong className="text-ga-text-primary">{scanResult.provider_used}</strong></span>
        <span>Confidence: <strong className={scanResult.confidence >= 0.7 ? 'text-green-400' : 'text-yellow-400'}>
          {Math.round(scanResult.confidence * 100)}%
        </strong></span>
      </div>

      {/* Store + Date */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-ga-text-secondary mb-1">Store</label>
          <input
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary"
            placeholder="Store name"
          />
        </div>
        <div>
          <label className="block text-xs text-ga-text-secondary mb-1">Address</label>
          <input
            value={storeAddress}
            onChange={(e) => setStoreAddress(e.target.value)}
            className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary"
            placeholder="Store address"
          />
        </div>
        <div>
          <label className="block text-xs text-ga-text-secondary mb-1">Date</label>
          <input
            type="date"
            value={receiptDate}
            onChange={(e) => setReceiptDate(e.target.value)}
            className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary"
          />
        </div>
      </div>

      {/* Items table */}
      <div className="border border-ga-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ga-bg-hover border-b border-ga-border">
              <th className="w-10 px-3 py-2 text-center">
                <input
                  type="checkbox"
                  checked={checkedCount === items.length && items.length > 0}
                  onChange={(e) =>
                    setItems((prev) => prev.map((i) => ({ ...i, checked: e.target.checked })))
                  }
                  className="accent-ga-accent"
                />
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-ga-text-secondary">Item</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-ga-text-secondary w-16">Qty</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-ga-text-secondary w-24">Price</th>
              {destination === 'inventory' && (
                <th className="px-3 py-2 text-center text-xs font-semibold text-ga-text-secondary w-24">Location</th>
              )}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className={`border-b border-ga-border/30 ${
                  !item.checked ? 'opacity-40' : ''
                } ${item.confidence < 0.6 ? 'bg-yellow-500/5' : ''}`}
              >
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => updateItem(item.id, { checked: e.target.checked })}
                    className="accent-ga-accent"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {item.image_url && (
                      <img src={item.image_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <input
                        value={item.name}
                        onChange={(e) => updateItem(item.id, { name: e.target.value })}
                        className={`w-full bg-transparent text-sm text-ga-text-primary outline-none border-b ${
                          item.checked && !item.name.trim()
                            ? 'border-red-500'
                            : 'border-transparent focus:border-ga-accent'
                        }`}
                        placeholder="Item name"
                      />
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.barcode && (
                          <span className="text-[10px] font-mono text-ga-text-secondary">{item.barcode}</span>
                        )}
                        {item.barcode_source && (
                          <span className="text-[10px] bg-green-500/20 text-green-400 rounded px-1">
                            {item.barcode_source === 'openfoodfacts' ? 'OFF' : item.barcode_source}
                          </span>
                        )}
                        {item.confidence < 0.6 && (
                          <span className="text-[10px] text-yellow-400">Low confidence</span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-14 bg-ga-bg-hover border border-ga-border rounded px-2 py-1 text-center text-sm text-ga-text-primary"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.price}
                    onChange={(e) => updateItem(item.id, { price: parseFloat(e.target.value) || 0 })}
                    className={`w-20 bg-ga-bg-hover border rounded px-2 py-1 text-right text-sm text-ga-text-primary ${
                      item.price < 0 ? 'border-red-500' : 'border-ga-border'
                    }`}
                  />
                </td>
                {destination === 'inventory' && (
                  <td className="px-3 py-2 text-center">
                    <select
                      value={item.location}
                      onChange={(e) => updateItem(item.id, { location: e.target.value })}
                      className="bg-ga-bg-hover border border-ga-border rounded px-2 py-1 text-xs text-ga-text-primary"
                    >
                      {LOCATIONS.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  </td>
                )}
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-red-400 hover:text-red-300 text-xs"
                    title="Remove"
                  >
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center justify-between px-3 py-2 bg-ga-bg-hover border-t border-ga-border">
          <button
            onClick={addItem}
            className="text-ga-accent hover:text-ga-accent/80 text-xs font-medium"
          >
            + Add item
          </button>
          <div className="text-sm text-ga-text-primary font-medium">
            Total: RM {itemsTotal.toFixed(2)}
            {scanResult.total != null && Math.abs(itemsTotal - scanResult.total) > 0.01 && (
              <span className="text-yellow-400 text-xs ml-2">
                (receipt: RM {scanResult.total.toFixed(2)})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Raw text toggle */}
      {scanResult.raw_text && (
        <details open={showRaw} onToggle={(e) => setShowRaw((e.target as HTMLDetailsElement).open)}>
          <summary className="text-xs text-ga-text-secondary cursor-pointer hover:text-ga-text-primary">
            Raw OCR text
          </summary>
          <pre className="mt-2 bg-ga-bg-hover rounded-lg p-3 text-xs whitespace-pre-wrap text-ga-text-primary font-mono max-h-48 overflow-y-auto">
            {scanResult.raw_text}
          </pre>
        </details>
      )}

      {/* Error */}
      {confirmError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-sm text-red-400">
          {confirmError}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onRetry}
          className="text-ga-text-secondary hover:text-ga-text-primary text-sm transition-colors"
        >
          ← Upload different photo
        </button>
        <button
          onClick={handleConfirm}
          disabled={checkedCount === 0 || hasInvalidItems || isConfirming}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg px-5 py-2.5 transition-colors"
        >
          {isConfirming
            ? 'Saving...'
            : `Confirm ${checkedCount} item${checkedCount !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}
