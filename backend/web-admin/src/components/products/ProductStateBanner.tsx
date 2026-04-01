import { useRecheckOFF } from '@/api/mutations/useProductMutations';
import { formatRelativeDate } from '@/utils/format';
import type { Product } from '@/types/api';

interface ProductStateBannerProps {
  product: Product;
}

export default function ProductStateBanner({ product }: ProductStateBannerProps) {
  const recheckMutation = useRecheckOFF();

  const source = product.source;
  const isUnknown = source === 'unknown';
  const isContributed = source === 'contributed';
  const isOFF = source === 'openfoodfacts' || source === 'firebase';
  const isManual = source === 'manual';

  // Check stale OFF data (>30 days)
  const lastChecked = product.cached_at;
  const isStale = isOFF && lastChecked && (Date.now() - lastChecked > 30 * 24 * 60 * 60 * 1000);

  if (isUnknown) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
        <div>
          <span className="text-yellow-400 text-sm font-medium">This barcode has no product info</span>
          <span className="block text-xs text-ga-text-secondary mt-0.5">Fill in the details below or re-check Open Food Facts.</span>
        </div>
        <button
          onClick={() => recheckMutation.mutate(product.barcode)}
          disabled={recheckMutation.isPending}
          className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 text-xs font-medium rounded-md px-3 py-1.5 disabled:opacity-50"
        >
          {recheckMutation.isPending ? 'Checking...' : '🔍 Re-check OFF'}
        </button>
      </div>
    );
  }

  if (isContributed) {
    return (
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-3 mb-4">
        <span className="text-blue-400 text-sm font-medium">Contributed by community</span>
        <span className="block text-xs text-ga-text-secondary mt-0.5">This product was submitted by a user and approved.</span>
      </div>
    );
  }

  if (isOFF) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
        <div>
          <span className="text-green-400 text-sm font-medium">Verified via Open Food Facts</span>
          <span className="block text-xs text-ga-text-secondary mt-0.5">
            Last checked: {formatRelativeDate(lastChecked)}
            {isStale && <span className="text-yellow-400 ml-2">Data may be outdated</span>}
          </span>
        </div>
        {isStale && (
          <button
            onClick={() => recheckMutation.mutate(product.barcode)}
            disabled={recheckMutation.isPending}
            className="bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs font-medium rounded-md px-3 py-1.5 disabled:opacity-50"
          >
            {recheckMutation.isPending ? 'Refreshing...' : '🔄 Refresh OFF'}
          </button>
        )}
      </div>
    );
  }

  if (isManual) {
    return (
      <div className="bg-gray-500/10 border border-ga-border rounded-lg px-4 py-3 mb-4">
        <span className="text-ga-text-secondary text-sm">Manually entered by admin</span>
      </div>
    );
  }

  return null;
}
