import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCatalogInfinite } from '@/api/queries/useCatalog';
import PageHeader from '@/components/shared/PageHeader';
import Breadcrumbs from '@/components/shared/Breadcrumbs';
import { SkeletonList } from '@/components/shared/Skeleton';
import InfiniteScrollSentinel from '@/components/shared/InfiniteScrollSentinel';
import QuickAddModal from '@/components/quickadd/QuickAddModal';
import type { CatalogEntry } from '@/types/api';

/**
 * User's catalog — reusable item names.
 * Sorted by last_purchased_at desc by default, filterable by substring.
 */
export default function CatalogListPage() {
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<'last_purchased_at' | 'total_purchases' | 'display_name'>(
    'last_purchased_at',
  );
  const [addTarget, setAddTarget] = useState<CatalogEntry | null>(null);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useCatalogInfinite({ q, sort_by: sortBy, limit: 50 });

  const entries: CatalogEntry[] = useMemo(
    () => (data?.pages ?? []).flatMap((p) => p.items),
    [data],
  );

  const grouped = entries.reduce<Record<string, CatalogEntry[]>>((acc, entry) => {
    const letter = (entry.display_name[0] || '?').toUpperCase();
    (acc[letter] = acc[letter] || []).push(entry);
    return acc;
  }, {});

  const letters = Object.keys(grouped).sort();
  const linkedCount = entries.filter((e) => e.barcode).length;

  return (
    <div className="p-6 space-y-4">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'My Catalog' }]} />
      <div className="flex items-center justify-between">
        <PageHeader title="My Catalog" icon="📚" />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 Search…"
          className="flex-1 min-w-[200px] px-3 py-2 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary focus:outline-none focus:border-ga-accent"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-2 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary"
        >
          <option value="last_purchased_at">Last bought</option>
          <option value="total_purchases">Most bought</option>
          <option value="display_name">Alphabetical</option>
        </select>
      </div>

      {!isLoading && entries.length > 0 && (
        <div className="text-xs text-ga-text-secondary">
          {entries.length}
          {hasNextPage ? '+' : ''} entries · {linkedCount} linked to barcode
        </div>
      )}

      {isLoading ? (
        <SkeletonList count={8} />
      ) : entries.length === 0 ? (
        <p className="text-sm text-ga-text-secondary italic text-center py-10">
          {q ? 'No matching entries.' : 'Your catalog is empty — add some items first.'}
        </p>
      ) : sortBy === 'display_name' ? (
        <div className="space-y-4">
          {letters.map((letter) => (
            <section key={letter}>
              <h3 className="text-sm font-semibold text-ga-text-secondary px-1 mb-1">{letter}</h3>
              <div className="space-y-1">
                {grouped[letter].map((e) => (
                  <CatalogRow key={e.id} entry={e} onAdd={setAddTarget} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map((e) => (
            <CatalogRow key={e.id} entry={e} onAdd={setAddTarget} />
          ))}
        </div>
      )}

      {!isLoading && entries.length > 0 && (
        <InfiniteScrollSentinel
          onIntersect={fetchNextPage}
          enabled={!!hasNextPage && !isFetchingNextPage}
          loading={isFetchingNextPage}
        />
      )}

      <QuickAddModal
        open={!!addTarget}
        onClose={() => setAddTarget(null)}
        defaults={addTarget ? { catalogEntry: addTarget } : undefined}
      />
    </div>
  );
}

function CatalogRow({
  entry,
  onAdd,
}: {
  entry: CatalogEntry;
  onAdd: (e: CatalogEntry) => void;
}) {
  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg p-3 flex items-center gap-3">
      <Link
        to={`/catalog/${entry.name_norm}`}
        className="flex-1 min-w-0 hover:opacity-90"
      >
        <div className="text-sm font-medium text-ga-text-primary truncate">
          {entry.display_name}
        </div>
        <div className="text-xs text-ga-text-secondary flex items-center gap-2">
          {entry.barcode && <span>🏷️ {entry.barcode}</span>}
          <span>{entry.total_purchases}× bought</span>
          {entry.active_purchases > 0 && (
            <span className="text-green-600">{entry.active_purchases} active</span>
          )}
        </div>
      </Link>
      <button
        onClick={() => onAdd(entry)}
        className="text-xs px-3 py-1 bg-ga-accent/20 text-ga-accent rounded hover:bg-ga-accent/30 flex-shrink-0"
      >
        + Add
      </button>
    </div>
  );
}
