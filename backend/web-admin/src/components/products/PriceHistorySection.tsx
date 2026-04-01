import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { useVisibility } from '@/hooks/useVisibility';
import UpgradeBanner from '@/components/shared/UpgradeBanner';
import type { PriceSummary } from '@/types/api';

interface PriceHistorySectionProps {
  barcode: string;
}

export default function PriceHistorySection({ barcode }: PriceHistorySectionProps) {
  const { isAdmin, canUseTool } = useVisibility();
  const canSeeAll = isAdmin || canUseTool('price_tracking');

  const { data: summary, isLoading } = useQuery({
    queryKey: ['prices', barcode],
    queryFn: () => apiClient.get<PriceSummary>(API.BARCODE_PRICES(barcode)).then((r) => r.data),
    enabled: !!barcode,
    staleTime: 60_000,
  });

  if (isLoading) return <div className="text-xs text-ga-text-secondary py-2">Loading price history...</div>;
  if (!summary || summary.total_records === 0) {
    return (
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4 mt-4">
        <h3 className="text-sm font-semibold text-ga-text-primary mb-2">Price History</h3>
        <p className="text-xs text-ga-text-secondary">No price records yet. Prices will appear when you scan receipts at stores.</p>
      </div>
    );
  }

  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4 mt-4">
      <h3 className="text-sm font-semibold text-ga-text-primary mb-3">
        {canSeeAll ? 'Price History (all users)' : 'Your Price History'}
      </h3>

      <div className="space-y-2">
        {summary.locations.map((loc, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <span className="text-base">🏪</span>
            <span className="text-ga-text-primary font-medium flex-1">{loc.store_name}</span>
            <span className="text-ga-text-primary">RM {loc.latest_price.toFixed(2)}</span>
            <span className="text-xs text-ga-text-secondary">
              x{loc.record_count} (avg RM {loc.average_price.toFixed(2)})
            </span>
          </div>
        ))}
      </div>

      {canSeeAll && summary.cheapest && summary.most_expensive && (
        <div className="mt-3 pt-3 border-t border-ga-border/50 space-y-1 text-xs">
          <div className="text-green-400">
            🏆 Cheapest: RM {summary.cheapest.price.toFixed(2)} at {summary.cheapest.store_name}
          </div>
          <div className="text-red-400">
            ⚠️ Most expensive: RM {summary.most_expensive.price.toFixed(2)} at {summary.most_expensive.store_name}
          </div>
          {summary.average_price && (
            <div className="text-ga-text-secondary">
              📊 Average: RM {summary.average_price.toFixed(2)} across {summary.total_records} records
            </div>
          )}
        </div>
      )}

      {!canSeeAll && (
        <div className="mt-3">
          <UpgradeBanner feature="price comparison across users" requiredTier="Smart Cart" compact />
        </div>
      )}
    </div>
  );
}
