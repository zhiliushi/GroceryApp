import { useState } from 'react';
import type { BarcodeProduct } from '@/types/api';

const SOURCE_LABELS: Record<string, string> = {
  firebase: 'Cached',
  contributed: 'Community',
  openfoodfacts: 'Open Food Facts',
  not_found: 'Not Found',
};

const LOCATIONS = ['fridge', 'pantry', 'freezer'];

interface ProductResultCardProps {
  product: BarcodeProduct;
  onAddToInventory: (location: string) => void;
  onScanAgain: () => void;
  isAdding: boolean;
}

export default function ProductResultCard({
  product,
  onAddToInventory,
  onScanAgain,
  isAdding,
}: ProductResultCardProps) {
  const [location, setLocation] = useState('pantry');

  return (
    <div className="bg-ga-bg-hover border border-green-500/30 rounded-lg p-4">
      <div className="flex items-start gap-3">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.product_name || ''}
            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-ga-bg-card flex items-center justify-center text-2xl flex-shrink-0">
            📦
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-ga-text-primary font-medium text-sm">
            {product.product_name || 'Unknown Product'}
          </h3>
          {product.brands && (
            <p className="text-ga-text-secondary text-xs mt-0.5">{product.brands}</p>
          )}
          {product.categories && (
            <p className="text-ga-text-secondary text-xs">{product.categories}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <code className="text-[10px] font-mono text-ga-text-secondary">{product.barcode}</code>
            <span className="text-[10px] bg-green-500/20 text-green-400 rounded px-1.5 py-0.5">
              {SOURCE_LABELS[product.source] || product.source}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <select
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="bg-ga-bg-card border border-ga-border rounded px-2 py-1.5 text-xs text-ga-text-primary"
        >
          {LOCATIONS.map((loc) => (
            <option key={loc} value={loc}>📍 {loc}</option>
          ))}
        </select>
        <button
          onClick={() => onAddToInventory(location)}
          disabled={isAdding}
          className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-3 py-1.5 transition-colors"
        >
          {isAdding ? 'Adding...' : 'Add to Inventory'}
        </button>
        <button
          onClick={onScanAgain}
          className="border border-ga-border text-ga-text-secondary hover:text-ga-text-primary text-sm rounded-lg px-3 py-1.5 transition-colors"
        >
          Scan Again
        </button>
      </div>
    </div>
  );
}
