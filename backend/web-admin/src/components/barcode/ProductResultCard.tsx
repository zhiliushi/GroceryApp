import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { useUseOneItem } from '@/api/mutations/useBarcodeMutations';
import { useAuthStore } from '@/stores/authStore';
import { useLocations } from '@/api/queries/useLocations';
import { formatExpiry } from '@/utils/format';
import type { BarcodeProduct, PriceSummary, InventoryItem } from '@/types/api';

const SOURCE_LABELS: Record<string, string> = {
  firebase: 'Cached',
  contributed: 'Community',
  openfoodfacts: 'Open Food Facts',
  not_found: 'Not Found',
};

interface StockData {
  items: (InventoryItem & { _member_name?: string; _member_icon?: string; _is_own?: boolean })[];
  total_in_stock: number;
}

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
  const [stock, setStock] = useState<StockData | null>(null);
  const [prices, setPrices] = useState<PriceSummary | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);

  const uid = useAuthStore((s) => s.user?.uid);
  const { locations } = useLocations();
  const useOneMutation = useUseOneItem();

  const hasStock = stock && stock.total_in_stock > 0;

  // Fetch inventory + prices for this barcode (non-blocking, runs once per barcode)
  const barcodeRef = useRef(product.barcode);
  useEffect(() => {
    // Only fetch once per barcode
    if (!product.barcode || !uid || product.barcode === barcodeRef.current && stock !== null) {
      if (!product.barcode || !uid) setLoadingContext(false);
      return;
    }
    barcodeRef.current = product.barcode;

    let cancelled = false;
    setLoadingContext(true);

    Promise.allSettled([
      apiClient.get(API.BARCODE_INVENTORY(product.barcode), { params: { user_id: uid } }),
      apiClient.get(API.BARCODE_PRICES(product.barcode)),
    ]).then(([stockResult, priceResult]) => {
      if (cancelled) return;
      if (stockResult.status === 'fulfilled') setStock(stockResult.value.data);
      if (priceResult.status === 'fulfilled') setPrices(priceResult.value.data);
      setLoadingContext(false);
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.barcode, uid]);

  const handleUseOne = () => {
    if (!uid) return;
    useOneMutation.mutate(
      { barcode: product.barcode, userId: uid },
      {
        onSuccess: () => {
          apiClient.get(API.BARCODE_INVENTORY(product.barcode), { params: { user_id: uid } })
            .then((r) => setStock(r.data))
            .catch(() => {});
        },
      },
    );
  };

  return (
    <div className="space-y-3">
      {/* Product info card */}
      <div className="bg-ga-bg-hover border border-green-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          {product.image_url ? (
            <img src={product.image_url} alt={product.product_name || ''}
              className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-ga-bg-card flex items-center justify-center text-2xl flex-shrink-0">📦</div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-ga-text-primary font-medium text-sm">{product.product_name || 'Unknown Product'}</h3>
            {product.brands && <p className="text-ga-text-secondary text-xs mt-0.5">{product.brands}</p>}
            <div className="flex items-center gap-2 mt-1.5">
              <code className="text-[10px] font-mono text-ga-text-secondary">{product.barcode}</code>
              <span className="text-[10px] bg-green-500/20 text-green-400 rounded px-1.5 py-0.5">
                {SOURCE_LABELS[product.source] || product.source}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* You Already Have (if items in stock) */}
      {loadingContext ? (
        <div className="bg-ga-bg-hover rounded-lg px-4 py-3 text-xs text-ga-text-secondary animate-pulse">
          Checking your inventory...
        </div>
      ) : hasStock ? (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-blue-400 mb-1.5">
            You Already Have ({stock.total_in_stock} in stock)
          </h4>
          <div className="space-y-1">
            {stock.items.map((item, i) => {
              const exp = formatExpiry(item.expiryDate ?? item.expiry_date);
              const isExpired = exp.text === 'Expired' || exp.text.includes('ago');
              const loc = locations.find((l) => l.key === item.location);
              return (
                <div key={i} className={`flex items-center gap-2 text-xs ${isExpired ? 'text-red-400' : 'text-ga-text-primary'}`}>
                  <span>{loc?.icon || '📍'}</span>
                  <span>{loc?.name || item.location || 'Unknown'}: {item.quantity ?? 1} {item.unit || 'pcs'}</span>
                  <span className={`ml-auto ${exp.className}`}>{exp.text}</span>
                  {!item._is_own && item._member_icon && (
                    <span className="text-[10px] text-ga-text-secondary">{item._member_icon} {item._member_name}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Recent Prices (if records exist) */}
      {!loadingContext && prices && prices.total_records > 0 && (
        <div className="bg-ga-bg-hover rounded-lg p-3">
          <h4 className="text-xs font-semibold text-ga-text-secondary mb-1.5">Recent Prices</h4>
          <div className="space-y-1">
            {prices.locations.slice(0, 3).map((loc, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-ga-text-primary">
                <span>🏪</span>
                <span className="flex-1">{loc.store_name}</span>
                <span className="font-medium">RM {loc.latest_price.toFixed(2)}</span>
              </div>
            ))}
          </div>
          {prices.cheapest && (
            <div className="text-[10px] text-green-400 mt-1">
              Cheapest: RM {prices.cheapest.price.toFixed(2)} at {prices.cheapest.store_name}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Used One — only if user has stock */}
        {hasStock && (
          <button
            onClick={handleUseOne}
            disabled={useOneMutation.isPending}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-1.5 transition-colors"
          >
            {useOneMutation.isPending ? 'Using...' : '✅ Used One'}
          </button>
        )}

        {/* Add to Inventory */}
        <select
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="bg-ga-bg-card border border-ga-border rounded px-2 py-1.5 text-xs text-ga-text-primary"
        >
          {locations.map((loc) => (
            <option key={loc.key} value={loc.key}>{loc.icon} {loc.name}</option>
          ))}
        </select>
        <button
          onClick={() => onAddToInventory(location)}
          disabled={isAdding}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-3 py-1.5 transition-colors"
        >
          {isAdding ? 'Adding...' : hasStock ? '➕ Add More' : 'Add to Inventory'}
        </button>

        <button
          onClick={onScanAgain}
          className="border border-ga-border text-ga-text-secondary hover:text-ga-text-primary text-sm rounded-lg px-3 py-1.5 transition-colors"
        >
          Scan Again
        </button>

        {/* View Full History link */}
        {product.barcode && (
          <Link to={`/item/${product.barcode}`} className="text-xs text-ga-accent hover:underline ml-auto">
            View Full History →
          </Link>
        )}
      </div>
    </div>
  );
}
