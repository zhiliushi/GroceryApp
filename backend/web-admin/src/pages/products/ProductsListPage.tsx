import { useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProducts } from '@/api/queries/useProducts';
import { useDeleteProduct, useRecheckOFF } from '@/api/mutations/useProductMutations';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import PageHeader from '@/components/shared/PageHeader';
import SearchBar from '@/components/shared/SearchBar';
import ImagePreview from '@/components/shared/ImagePreview';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import ScanBarcodeButton from '@/components/barcode/ScanBarcodeButton';
import IdentifyProductModal from '@/components/products/IdentifyProductModal';
import DisputeProductModal from '@/components/products/DisputeProductModal';
import { formatRelativeDate, truncateText } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { Product } from '@/types/api';

type StateTab = 'all' | 'unknown' | 'pending' | 'verified' | 'manual';

function getProductState(p: Product): string {
  if (p.source === 'unknown') return 'unknown';
  if (p.source === 'manual') return 'manual';
  return 'verified'; // openfoodfacts, firebase, contributed+approved
}

function getCompleteness(p: Product): number {
  let score = 0;
  if (p.product_name) score += 30;
  if (p.brands) score += 20;
  if (p.categories) score += 15;
  if (p.image_url) score += 15;
  if (p.nutrition_data) score += 20;
  return score;
}

const STATE_BORDERS: Record<string, string> = {
  unknown: 'border-l-yellow-500',
  pending: 'border-l-blue-500',
  verified: 'border-l-green-500',
  manual: 'border-l-gray-500',
};

export default function ProductsListPage() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<StateTab>('all');
  const [identifyBarcode, setIdentifyBarcode] = useState<string | null>(null);
  const [disputeProduct, setDisputeProduct] = useState<Product | null>(null);

  const { data, isLoading } = useProducts(search);
  const deleteMutation = useDeleteProduct();
  const recheckMutation = useRecheckOFF();
  const dialog = useConfirmDialog();
  const navigate = useNavigate();

  const handleSearch = useCallback((v: string) => setSearch(v), []);

  const products = data?.products ?? [];

  const counts = useMemo(() => ({
    all: products.length,
    unknown: products.filter((p) => p.source === 'unknown').length,
    verified: products.filter((p) => ['openfoodfacts', 'firebase', 'contributed'].includes(p.source) && p.source !== 'unknown').length,
    manual: products.filter((p) => p.source === 'manual').length,
    pending: 0, // TODO: merge contributed_products
  }), [products]);

  const filtered = useMemo(() => {
    if (activeTab === 'all') return products;
    return products.filter((p) => getProductState(p) === activeTab);
  }, [products, activeTab]);

  const tabs: { key: StateTab; label: string; count: number; color: string }[] = [
    { key: 'all', label: 'All', count: counts.all, color: 'bg-gray-500' },
    { key: 'unknown', label: 'Unknown', count: counts.unknown, color: counts.unknown > 0 ? 'bg-yellow-500 animate-pulse' : 'bg-yellow-500' },
    { key: 'verified', label: 'Verified', count: counts.verified, color: 'bg-green-500' },
    { key: 'manual', label: 'Manual', count: counts.manual, color: 'bg-gray-400' },
  ];

  if (isLoading) return <LoadingSpinner text="Loading products..." />;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <PageHeader title="Products" icon="🏷️" count={counts.all} />
        <div className="flex items-center gap-2">
          <ScanBarcodeButton />
          <Link to="/products/new"
            className="bg-ga-accent hover:bg-ga-accent/90 text-white text-sm font-medium rounded-lg px-4 py-2">
            + Add Product
          </Link>
        </div>
      </div>

      {/* State tabs */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg transition-colors inline-flex items-center gap-2',
              activeTab === tab.key ? 'bg-ga-accent text-white font-medium' : 'border border-ga-border text-ga-text-secondary hover:bg-ga-bg-hover',
            )}>
            {tab.label}
            {tab.count > 0 && (
              <span className={cn('text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-bold text-white', tab.color)}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <SearchBar value={search} onChange={handleSearch} placeholder="Search by barcode, name, or brand..." className="mb-4" />

      {/* Product rows */}
      {filtered.length === 0 ? (
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-12 text-center">
          {counts.all === 0 ? (
            <>
              <div className="text-4xl mb-3">📦</div>
              <h3 className="text-ga-text-primary font-medium mb-2">No products yet</h3>
              <p className="text-sm text-ga-text-secondary">Products are added automatically when users scan barcodes.</p>
            </>
          ) : activeTab === 'unknown' && counts.unknown === 0 ? (
            <>
              <div className="text-4xl mb-3">🎉</div>
              <h3 className="text-ga-text-primary font-medium">All products have been identified!</h3>
            </>
          ) : (
            <>
              <div className="text-4xl mb-3">🔍</div>
              <h3 className="text-ga-text-primary font-medium">No products match this filter</h3>
              <button onClick={() => setActiveTab('all')} className="text-ga-accent text-sm mt-2 hover:underline">Show all</button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((product) => {
            const state = getProductState(product);
            const completeness = getCompleteness(product);
            const isUnknown = state === 'unknown';

            return (
              <div key={product.barcode}
                className={cn(
                  'bg-ga-bg-card border border-ga-border rounded-lg p-4 border-l-[3px] flex items-center gap-4 hover:bg-ga-bg-hover transition-colors cursor-pointer',
                  STATE_BORDERS[state] || 'border-l-transparent',
                )}
                onClick={() => navigate(`/products/${product.barcode}/edit`)}
              >
                {/* Image */}
                <ImagePreview src={product.image_url} size={40} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {product.product_name ? (
                      <span className="text-sm font-medium text-ga-text-primary truncate">{product.product_name}</span>
                    ) : (
                      <span className="text-sm text-ga-text-secondary/50 italic">No product name</span>
                    )}
                    {product.brands && <span className="text-xs text-ga-text-secondary">{product.brands}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <code className="text-[10px] font-mono text-ga-text-secondary">{product.barcode}</code>
                    <span className={cn('text-[10px] rounded px-1.5 py-0.5', {
                      'bg-yellow-500/20 text-yellow-400': isUnknown,
                      'bg-green-500/20 text-green-400': state === 'verified',
                      'bg-gray-500/20 text-gray-400': state === 'manual',
                      'bg-blue-500/20 text-blue-400': state === 'pending',
                    })}>
                      {product.source}
                    </span>
                    {completeness > 0 && (
                      <span className={cn('text-[10px] rounded px-1.5 py-0.5', {
                        'bg-red-500/20 text-red-400': completeness < 30,
                        'bg-yellow-500/20 text-yellow-400': completeness >= 30 && completeness < 50,
                        'bg-green-500/20 text-green-400': completeness >= 50,
                      })}>
                        {completeness}%
                      </span>
                    )}
                    <span className="text-[10px] text-ga-text-secondary">{formatRelativeDate(product.cached_at)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {isUnknown && (
                    <>
                      <button onClick={() => recheckMutation.mutate(product.barcode)}
                        disabled={recheckMutation.isPending}
                        className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 text-xs rounded px-2 py-1 disabled:opacity-50"
                        title="Re-check Open Food Facts">
                        🔍
                      </button>
                      <button onClick={() => setIdentifyBarcode(product.barcode)}
                        className="bg-ga-accent/20 hover:bg-ga-accent/30 text-ga-accent text-xs rounded px-2 py-1"
                        title="Identify this product">
                        ✏️
                      </button>
                    </>
                  )}
                  {state === 'verified' && (
                    <>
                      <button onClick={() => recheckMutation.mutate(product.barcode)}
                        disabled={recheckMutation.isPending}
                        className="text-ga-text-secondary hover:text-ga-text-primary text-xs px-1"
                        title="Refresh from OFF">
                        🔄
                      </button>
                      <button onClick={() => setDisputeProduct(product)}
                        className="text-ga-text-secondary hover:text-yellow-400 text-xs px-1"
                        title="Report issue">
                        ⚑
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => dialog.confirm({
                      title: 'Delete Product',
                      message: `Delete "${product.product_name || product.barcode}"?`,
                      variant: 'danger',
                      onConfirm: () => deleteMutation.mutate(product.barcode),
                    })}
                    className="text-red-400 hover:text-red-300 text-xs px-1"
                    title="Delete">
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {identifyBarcode && (
        <IdentifyProductModal
          barcode={identifyBarcode}
          onClose={() => setIdentifyBarcode(null)}
          onIdentified={() => setIdentifyBarcode(null)}
        />
      )}
      {disputeProduct && (
        <DisputeProductModal
          barcode={disputeProduct.barcode}
          currentName={disputeProduct.product_name}
          onClose={() => setDisputeProduct(null)}
        />
      )}
      <ConfirmDialog state={dialog.state} onCancel={dialog.close} />
    </div>
  );
}
