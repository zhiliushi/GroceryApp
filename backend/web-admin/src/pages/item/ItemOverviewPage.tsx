import { useParams, Link } from 'react-router-dom';
import { useItemOverview } from '@/api/queries/useItemOverview';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { useUseOneItem } from '@/api/mutations/useBarcodeMutations';
import { useAuthStore } from '@/stores/authStore';
import { useLocations } from '@/api/queries/useLocations';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { formatExpiry, formatRelativeDate } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { PriceSummary } from '@/types/api';

export default function ItemOverviewPage() {
  const { barcode } = useParams<{ barcode: string }>();
  const { data, isLoading, error } = useItemOverview(barcode);
  const user = useAuthStore((s) => s.user);
  const { getLocation } = useLocations();
  const useOneMutation = useUseOneItem();

  // Fetch prices separately
  const { data: prices } = useQuery({
    queryKey: ['prices', barcode],
    queryFn: () => apiClient.get<PriceSummary>(API.BARCODE_PRICES(barcode!)).then((r) => r.data),
    enabled: !!barcode,
    staleTime: 60_000,
  });

  if (isLoading) return <LoadingSpinner text="Loading item overview..." />;

  if (!barcode || error) {
    return (
      <div className="p-6 text-center">
        <div className="text-4xl mb-3">🔍</div>
        <h2 className="text-ga-text-primary font-medium">No product found</h2>
        <p className="text-sm text-ga-text-secondary mt-1">{error ? (error as Error).message : 'Invalid barcode'}</p>
      </div>
    );
  }

  if (!data) return null;

  const { product, completeness, current_stock, usage_history, waste_stats } = data;
  const productName = product?.product_name || (product as Record<string, unknown> | null)?.name as string || barcode;
  const hasStock = current_stock.total_in_stock > 0;

  return (
    <div className="p-6 max-w-3xl">
      {/* Breadcrumb */}
      <div className="mb-4 text-sm">
        <Link to="/inventory" className="text-ga-accent hover:underline">← Inventory</Link>
        <span className="text-ga-text-secondary mx-2">/</span>
        <span className="text-ga-text-primary">{productName}</span>
      </div>

      {/* Header */}
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5 mb-4">
        <h1 className="text-xl font-semibold text-ga-text-primary">{productName}</h1>
        <div className="flex items-center gap-2 mt-1 text-sm text-ga-text-secondary">
          {product?.brands && <span>{product.brands}</span>}
          <code className="text-xs font-mono">{barcode}</code>
          {product?.source && (
            <span className="text-[10px] bg-green-500/20 text-green-400 rounded px-1.5 py-0.5">{product.source}</span>
          )}
        </div>
      </div>

      {/* Data Completeness */}
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-ga-text-secondary uppercase">Data Completeness</h3>
          <span className={cn('text-sm font-bold', completeness.score >= 75 ? 'text-green-400' : completeness.score >= 50 ? 'text-yellow-400' : 'text-red-400')}>
            {completeness.score}%
          </span>
        </div>
        <div className="h-2 bg-ga-bg-hover rounded-full overflow-hidden mb-2">
          <div className={cn('h-full rounded-full', completeness.score >= 75 ? 'bg-green-500' : completeness.score >= 50 ? 'bg-yellow-500' : 'bg-red-500')}
            style={{ width: `${completeness.score}%` }} />
        </div>
        {completeness.missing.length > 0 && (
          <p className="text-xs text-ga-text-secondary">
            Missing: {completeness.missing.join(', ')}
            <Link to={`/products/${barcode}/edit`} className="text-ga-accent hover:underline ml-2">Complete data →</Link>
          </p>
        )}
      </div>

      {/* Current Stock */}
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4 mb-4">
        <h3 className="text-xs font-semibold text-ga-text-secondary uppercase mb-2">
          Current Stock {hasStock && `(${current_stock.total_in_stock} total)`}
        </h3>
        {hasStock ? (
          <>
            <div className="space-y-1 mb-3">
              {current_stock.items.map((item, i) => {
                const exp = formatExpiry(item.expiryDate ?? item.expiry_date);
                const loc = getLocation(item.location || item.storage_location);
                const ext = item as unknown as Record<string, unknown>;
                return (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span>{loc?.icon || '📍'}</span>
                    <span className="text-ga-text-primary">{loc?.name || item.location}: {item.quantity ?? 1} {item.unit || 'pcs'}</span>
                    <span className={cn('text-xs ml-auto', exp.className)}>{exp.text}</span>
                    {Boolean(ext._member_name) && String(ext._member_name) !== 'You' && (
                      <span className="text-[10px] text-blue-400">{String(ext._member_icon || '')} {String(ext._member_name)}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button onClick={() => user?.uid && useOneMutation.mutate({ barcode: barcode!, userId: user.uid })}
                disabled={useOneMutation.isPending}
                className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg px-3 py-1.5">
                {useOneMutation.isPending ? 'Using...' : '✅ Used One'}
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-ga-text-secondary">None in stock.</p>
        )}
      </div>

      {/* Usage History */}
      {usage_history.length > 0 && (
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4 mb-4">
          <h3 className="text-xs font-semibold text-ga-text-secondary uppercase mb-2">Usage History</h3>
          <div className="space-y-1.5">
            {usage_history.slice(0, 20).map((entry, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full flex-shrink-0',
                  entry.action === 'added' ? 'bg-green-400' :
                  entry.action === 'consumed' ? 'bg-blue-400' :
                  entry.action === 'expired' ? 'bg-red-400' :
                  entry.action === 'discarded' ? 'bg-gray-400' : 'bg-ga-text-secondary',
                )} />
                <span className="text-ga-text-secondary w-20 flex-shrink-0">{formatRelativeDate(entry.date)}</span>
                <span className="text-ga-text-primary capitalize">{entry.action}</span>
                {entry.quantity && <span className="text-ga-text-secondary">{entry.quantity} {entry.location ? `from ${entry.location}` : ''}</span>}
                {entry.source && entry.source !== 'manual' && (
                  <span className="text-[10px] text-ga-text-secondary/50">({entry.source})</span>
                )}
                {entry.member_icon && entry.member_name && (
                  <span className="text-[10px] text-blue-400 ml-auto">{entry.member_icon}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Price History */}
      {prices && prices.total_records > 0 && (
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4 mb-4">
          <h3 className="text-xs font-semibold text-ga-text-secondary uppercase mb-2">Price History</h3>
          <div className="space-y-1">
            {prices.locations.map((loc, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span>🏪</span>
                <span className="text-ga-text-primary flex-1">{loc.store_name}</span>
                <span className="font-medium">RM {loc.latest_price.toFixed(2)}</span>
                <span className="text-xs text-ga-text-secondary">×{loc.record_count}</span>
              </div>
            ))}
          </div>
          {prices.cheapest && (
            <p className="text-xs text-green-400 mt-2">Best: RM {prices.cheapest.price.toFixed(2)} at {prices.cheapest.store_name}</p>
          )}
        </div>
      )}

      {/* Waste Stats */}
      {waste_stats && (
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4 mb-4">
          <h3 className="text-xs font-semibold text-ga-text-secondary uppercase mb-2">Waste Stats</h3>
          <div className="grid grid-cols-3 gap-3 text-center mb-3">
            <div>
              <div className="text-lg font-bold text-ga-text-primary">{waste_stats.total_items}</div>
              <div className="text-[10px] text-ga-text-secondary">Total purchased</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-400">{waste_stats.used}</div>
              <div className="text-[10px] text-ga-text-secondary">Used ({100 - waste_stats.waste_pct}%)</div>
            </div>
            <div>
              <div className={cn('text-lg font-bold', waste_stats.waste_pct > 20 ? 'text-red-400' : waste_stats.waste_pct > 10 ? 'text-yellow-400' : 'text-green-400')}>
                {waste_stats.wasted}
              </div>
              <div className="text-[10px] text-ga-text-secondary">Wasted ({waste_stats.waste_pct}%)</div>
            </div>
          </div>
          {waste_stats.avg_days_in_inventory && (
            <p className="text-xs text-ga-text-secondary">Avg {waste_stats.avg_days_in_inventory} days in inventory</p>
          )}
          {waste_stats.suggestion && (
            <p className={cn('text-xs mt-1', waste_stats.waste_pct > 20 ? 'text-red-400' : waste_stats.waste_pct <= 5 ? 'text-green-400' : 'text-yellow-400')}>
              {waste_stats.waste_pct <= 5 ? '🎉' : '💡'} {waste_stats.suggestion}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
