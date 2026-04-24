import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { useCatalogAnalysis } from '@/api/queries/useCatalogAnalysis';
import {
  useFlagSpam,
  usePromoteToGlobal,
} from '@/api/mutations/useCatalogAnalysisMutations';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import { cn } from '@/utils/cn';

type TabKey = 'barcode_to_names' | 'no_barcode_names' | 'cleanup_preview';

export default function CatalogAnalysisPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useCatalogAnalysis();
  const [tab, setTab] = useState<TabKey>('barcode_to_names');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const promote = usePromoteToGlobal();
  const flagSpam = useFlagSpam();

  async function forceRefresh() {
    setIsRefreshing(true);
    try {
      await apiClient.get(API.ADMIN_CATALOG_ANALYSIS, { params: { refresh: true } });
      qc.invalidateQueries({ queryKey: ['catalog-analysis'] });
    } finally {
      setIsRefreshing(false);
    }
  }

  if (isLoading) return <LoadingSpinner text="Loading catalog analysis…" />;
  if (error)
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
          Failed to load: {(error as Error).message}
        </div>
      </div>
    );
  if (!data) return null;

  const computedAt = data.computed_at ? new Date(data.computed_at).toLocaleString() : '—';
  const TABS: Array<{ key: TabKey; label: string; count: number }> = [
    { key: 'barcode_to_names', label: 'Barcode → Names', count: data.barcode_to_names?.length ?? 0 },
    { key: 'no_barcode_names', label: 'Unnamed / No-barcode', count: data.no_barcode_names?.length ?? 0 },
    { key: 'cleanup_preview', label: 'Cleanup Preview', count: data.cleanup_preview?.length ?? 0 },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <PageHeader title="Catalog Analysis" icon="🔎" />
        <button
          onClick={forceRefresh}
          disabled={isRefreshing}
          className="px-4 py-2 rounded bg-ga-accent text-white text-sm disabled:opacity-60"
        >
          {isRefreshing ? 'Refreshing…' : 'Refresh now'}
        </button>
      </div>
      <p className="text-xs text-ga-text-secondary">Last computed: {computedAt}</p>

      <div className="flex gap-2 border-b border-ga-border pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-t',
              tab === t.key
                ? 'bg-ga-accent text-white font-medium'
                : 'text-ga-text-secondary hover:bg-ga-bg-hover',
            )}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {tab === 'barcode_to_names' && (
        <div className="space-y-3">
          {data.barcode_to_names.map((row) => (
            <div
              key={row.barcode}
              className={cn(
                'bg-ga-bg-card border rounded-lg p-4',
                row.consistent ? 'border-ga-border' : 'border-orange-500/40',
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-mono text-ga-text-primary">
                    {row.barcode}
                    {row.country_code && <span className="ml-2 text-xs text-ga-text-secondary">({row.country_code})</span>}
                  </div>
                  <div className="text-xs text-ga-text-secondary mt-1">
                    {row.user_count} users · {row.names.length} distinct name(s)
                    {row.consistent && <span className="ml-2 text-green-500">✓ consistent</span>}
                  </div>
                  <ul className="mt-2 space-y-0.5">
                    {row.names.slice(0, 5).map((n) => (
                      <li key={n.name} className="text-xs text-ga-text-secondary">
                        → <span className="text-ga-text-primary">{n.name}</span> ({n.count})
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      const defaultName = row.names[0]?.name || '';
                      const canonical = window.prompt(
                        'Promote to global products — canonical name:',
                        defaultName,
                      );
                      if (canonical && canonical.trim()) {
                        promote.mutate({ barcode: row.barcode, canonical_name: canonical.trim() });
                      }
                    }}
                    className="px-3 py-1 text-xs bg-ga-accent text-white rounded hover:opacity-90"
                  >
                    Promote
                  </button>
                  <button
                    onClick={() => {
                      const reason = window.prompt('Flag as spam — reason (optional):', '');
                      flagSpam.mutate({ barcode: row.barcode, reason: reason || '' });
                    }}
                    className="px-3 py-1 text-xs border border-red-500/30 text-red-400 rounded hover:bg-red-500/10"
                  >
                    Flag spam
                  </button>
                </div>
              </div>
            </div>
          ))}
          {data.barcode_to_names.length === 0 && (
            <p className="text-sm text-ga-text-secondary text-center py-8">
              No barcode/name data yet. Users need to scan products.
            </p>
          )}
        </div>
      )}

      {tab === 'no_barcode_names' && (
        <div className="space-y-2">
          {data.no_barcode_names.map((row) => (
            <div key={row.name_norm} className="bg-ga-bg-card border border-ga-border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-ga-text-primary">
                    {row.display_names[0]?.name ?? row.name_norm}
                  </div>
                  <div className="text-xs text-ga-text-secondary">
                    {row.user_count} users · {row.total_purchases} total purchases
                  </div>
                </div>
                <div className="text-xs text-ga-text-secondary">
                  {row.display_names.length} variant(s)
                </div>
              </div>
            </div>
          ))}
          {data.no_barcode_names.length === 0 && (
            <p className="text-sm text-ga-text-secondary text-center py-8">
              No unbranded catalog entries to review.
            </p>
          )}
        </div>
      )}

      {tab === 'cleanup_preview' && (
        <div className="space-y-2">
          <p className="text-xs text-ga-text-secondary">
            These entries will be deleted on the next weekly cleanup run
            (no barcode, no active purchases, last purchase &gt; 365 days ago).
          </p>
          {data.cleanup_preview.map((row) => (
            <div key={row.catalog_id} className="bg-ga-bg-card border border-ga-border rounded-lg p-3 flex items-center justify-between">
              <div>
                <div className="text-sm text-ga-text-primary">{row.display_name}</div>
                <div className="text-xs text-ga-text-secondary font-mono">{row.catalog_id}</div>
              </div>
              <div className="text-xs text-ga-text-secondary">
                last: {row.last_purchased_at ? new Date(row.last_purchased_at).toLocaleDateString() : '—'} · {row.total_purchases} total
              </div>
            </div>
          ))}
          {data.cleanup_preview.length === 0 && (
            <p className="text-sm text-ga-text-secondary text-center py-8">Nothing to clean up.</p>
          )}
        </div>
      )}
    </div>
  );
}
