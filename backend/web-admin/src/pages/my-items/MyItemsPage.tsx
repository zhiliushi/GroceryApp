import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePurchasesInfinite } from '@/api/queries/usePurchases';
import PageHeader from '@/components/shared/PageHeader';
import Breadcrumbs from '@/components/shared/Breadcrumbs';
import { SkeletonList } from '@/components/shared/Skeleton';
import InfiniteScrollSentinel from '@/components/shared/InfiniteScrollSentinel';
import QuickAddModal from '@/components/quickadd/QuickAddModal';
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/utils/cn';
import type { PurchaseEvent } from '@/types/api';

/**
 * MyItemsPage — catalog-grouped view (post-Phase-G feedback redesign).
 *
 * Old design: one row per purchase event. A single item ("Eggs") at multiple
 * locations rendered as N visually-similar rows; users perceived only "one
 * place shown" when really 6 packs sat in fridge alongside 11 loose at
 * pantry.
 *
 * New design: one row per catalog (catalog_name_norm). Each row shows:
 *  - Item name + total qty in base units (e.g. eggs)
 *  - All locations the item is currently at, with per-location qty + soonest
 *    expiry pill
 *  - Most-urgent expiry color on the row border
 *  - Click → /catalog/{name_norm} for the full overview (Phase E + post-deploy
 *    additions: current_locations, cadence, waste_cost)
 *
 * Action buttons removed from the row — they were the source of the mobile
 * cramping AND tied actions to a single event when most users think in terms
 * of the catalog. The catalog overview surface is where actions live; from
 * there you can drill into a specific batch via the movement timeline.
 */
export default function MyItemsPage() {
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePurchasesInfinite({ status: 'active', limit: 200 });
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const recentlyEditedId = useUiStore((s) => s.recentlyEditedPurchaseId);
  const setRecentlyEditedId = useUiStore((s) => s.setRecentlyEditedPurchaseId);
  const highlightRowRef = useRef<HTMLAnchorElement | null>(null);

  const events = useMemo(
    () => (data?.pages ?? []).flatMap((p) => p.items),
    [data],
  );

  const clusters = useMemo(() => buildClusters(events), [events]);
  const grouped = useMemo(() => groupClustersByStatus(clusters), [clusters]);

  // Find which catalog cluster contains the recently-edited event so we can
  // scroll + highlight that cluster row on save.
  const highlightedCatalogNorm = useMemo(() => {
    if (!recentlyEditedId) return null;
    const ev = events.find((e) => e.id === recentlyEditedId);
    return ev?.catalog_name_norm ?? null;
  }, [recentlyEditedId, events]);

  useEffect(() => {
    if (!highlightedCatalogNorm) return;
    const node = highlightRowRef.current;
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const t = window.setTimeout(() => setRecentlyEditedId(null), 3000);
    return () => window.clearTimeout(t);
  }, [highlightedCatalogNorm, setRecentlyEditedId]);

  return (
    <div className="p-6 space-y-4">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'My Items' }]} />
      <div className="flex items-center justify-between">
        <PageHeader title="My Items" icon="📦" />
        <button
          onClick={() => setQuickAddOpen(true)}
          className="px-4 py-2 rounded bg-ga-accent text-white text-sm font-medium hover:opacity-90"
        >
          + Add item
        </button>
      </div>

      <QuickAddModal open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />

      {isLoading ? (
        <SkeletonList count={6} />
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
          Failed to load: {(error as Error).message}
        </div>
      ) : clusters.length === 0 ? (
        <EmptyState onAdd={() => setQuickAddOpen(true)} />
      ) : (
        <>
          {highlightedCatalogNorm && (
            <div className="text-xs text-ga-text-secondary bg-ga-accent/10 border border-ga-accent/30 rounded px-3 py-2">
              ✓ Saved — your edited item is highlighted below.
            </div>
          )}
          <ClusterGroup
            title="Expiring soon"
            emoji="⚠️"
            emptyText="Nothing expiring — nice."
            clusters={grouped.expiring}
            highlightedNorm={highlightedCatalogNorm}
            highlightRef={highlightRowRef}
          />
          <ClusterGroup
            title="Active"
            emoji="✅"
            emptyText="No fresh items."
            clusters={grouped.active}
            highlightedNorm={highlightedCatalogNorm}
            highlightRef={highlightRowRef}
          />
          <ClusterGroup
            title="No expiry tracked"
            emoji="❓"
            emptyText="All items have expiry dates — great tracking."
            clusters={grouped.untracked}
            highlightedNorm={highlightedCatalogNorm}
            highlightRef={highlightRowRef}
          />
          <InfiniteScrollSentinel
            onIntersect={fetchNextPage}
            enabled={!!hasNextPage && !isFetchingNextPage}
            loading={isFetchingNextPage}
          />
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cluster building
// ─────────────────────────────────────────────────────────────────────────────

interface LocationBucket {
  location: string;
  qty: number;
  eventCount: number;
  soonestExpiry: Date | null;
}

interface CatalogCluster {
  catalogNameNorm: string;
  catalogDisplay: string;
  events: PurchaseEvent[];
  totalBaseUnits: number; // sum of quantity × pack_size
  baseUnitLabel: string;
  locations: LocationBucket[];
  mostUrgentExpiry: Date | null;
  oldestBuy: Date | null;
  totalSpend: number; // optional secondary signal
  spendCurrency: string | null;
}

function buildClusters(events: PurchaseEvent[]): CatalogCluster[] {
  const byNorm = new Map<string, CatalogCluster>();
  for (const ev of events) {
    if (!ev.catalog_name_norm) continue;
    let c = byNorm.get(ev.catalog_name_norm);
    if (!c) {
      c = {
        catalogNameNorm: ev.catalog_name_norm,
        catalogDisplay: ev.catalog_display,
        events: [],
        totalBaseUnits: 0,
        baseUnitLabel: ev.base_unit_label || ev.unit || 'unit',
        locations: [],
        mostUrgentExpiry: null,
        oldestBuy: null,
        totalSpend: 0,
        spendCurrency: null,
      };
      byNorm.set(ev.catalog_name_norm, c);
    }
    c.events.push(ev);

    const qty = Number(ev.quantity) || 0;
    const packSize = ev.pack_size || 1;
    c.totalBaseUnits += qty * packSize;

    const loc = ev.location || '(none)';
    let bucket = c.locations.find((b) => b.location === loc);
    if (!bucket) {
      bucket = { location: loc, qty: 0, eventCount: 0, soonestExpiry: null };
      c.locations.push(bucket);
    }
    bucket.qty += qty * packSize;
    bucket.eventCount += 1;

    if (ev.expiry_date) {
      const d = new Date(ev.expiry_date);
      if (!bucket.soonestExpiry || d < bucket.soonestExpiry) bucket.soonestExpiry = d;
      if (!c.mostUrgentExpiry || d < c.mostUrgentExpiry) c.mostUrgentExpiry = d;
    }

    if (ev.date_bought) {
      const b = new Date(ev.date_bought);
      if (!c.oldestBuy || b < c.oldestBuy) c.oldestBuy = b;
    }

    const amount = ev.display_amount ?? ev.amount ?? ev.price;
    if (amount != null) {
      c.totalSpend += Number(amount);
      c.spendCurrency = c.spendCurrency || ev.display_currency || ev.currency || null;
    }
  }

  // Sort each cluster's locations by qty desc
  for (const c of byNorm.values()) {
    c.locations.sort((a, b) => b.qty - a.qty);
  }

  return Array.from(byNorm.values());
}

function groupClustersByStatus(clusters: CatalogCluster[]) {
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 86400000);
  const weekBefore = new Date(now.getTime() - 7 * 86400000);

  const expiring: CatalogCluster[] = [];
  const active: CatalogCluster[] = [];
  const untracked: CatalogCluster[] = [];

  for (const c of clusters) {
    if (c.mostUrgentExpiry) {
      if (c.mostUrgentExpiry <= weekAhead) expiring.push(c);
      else active.push(c);
    } else {
      // No expiry → "untracked" if oldest buy is more than a week old
      if (c.oldestBuy && c.oldestBuy < weekBefore) untracked.push(c);
      else active.push(c);
    }
  }

  // Sort expiring by soonest expiry; active by oldest expiry first then by name
  expiring.sort((a, b) => {
    const ax = a.mostUrgentExpiry?.getTime() ?? Infinity;
    const bx = b.mostUrgentExpiry?.getTime() ?? Infinity;
    return ax - bx;
  });
  active.sort((a, b) => {
    const ax = a.mostUrgentExpiry?.getTime() ?? Infinity;
    const bx = b.mostUrgentExpiry?.getTime() ?? Infinity;
    return ax - bx;
  });
  untracked.sort((a, b) => (a.oldestBuy?.getTime() ?? 0) - (b.oldestBuy?.getTime() ?? 0));

  return { expiring, active, untracked };
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg p-12 text-center">
      <div className="text-5xl mb-4">📦</div>
      <h3 className="text-lg font-semibold text-ga-text-primary mb-2">No items yet</h3>
      <p className="text-sm text-ga-text-secondary mb-4">
        Add your first item — type a name or scan a barcode.
      </p>
      <button
        onClick={onAdd}
        className="px-4 py-2 rounded bg-ga-accent text-white text-sm font-medium"
      >
        + Add your first item
      </button>
    </div>
  );
}

function ClusterGroup({
  title,
  emoji,
  clusters,
  emptyText,
  highlightedNorm,
  highlightRef,
}: {
  title: string;
  emoji: string;
  clusters: CatalogCluster[];
  emptyText: string;
  highlightedNorm?: string | null;
  highlightRef?: React.MutableRefObject<HTMLAnchorElement | null>;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-ga-text-primary mb-2">
        {emoji} {title} ({clusters.length})
      </h3>
      {clusters.length === 0 ? (
        <p className="text-xs text-ga-text-secondary italic px-3 py-2">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {clusters.map((c) => (
            <CatalogClusterRow
              key={c.catalogNameNorm}
              cluster={c}
              highlighted={highlightedNorm === c.catalogNameNorm}
              rowRef={
                highlightedNorm === c.catalogNameNorm ? highlightRef : undefined
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CatalogClusterRow({
  cluster,
  highlighted,
  rowRef,
}: {
  cluster: CatalogCluster;
  highlighted?: boolean;
  rowRef?: React.MutableRefObject<HTMLAnchorElement | null>;
}) {
  const expiry = cluster.mostUrgentExpiry;
  const daysToExpiry = expiry
    ? Math.round((expiry.getTime() - Date.now()) / 86400000)
    : null;
  const tone =
    daysToExpiry == null
      ? 'gray'
      : daysToExpiry < 0
        ? 'red'
        : daysToExpiry <= 3
          ? 'orange'
          : daysToExpiry <= 7
            ? 'yellow'
            : 'green';

  const expiryLabel =
    daysToExpiry == null
      ? 'no expiry'
      : daysToExpiry < 0
        ? `expired ${Math.abs(daysToExpiry)}d ago`
        : daysToExpiry === 0
          ? 'expires today'
          : `expires in ${daysToExpiry}d`;

  return (
    <Link
      ref={rowRef}
      to={`/catalog/${cluster.catalogNameNorm}`}
      className={cn(
        'block bg-ga-bg-card border rounded-lg p-3 transition-shadow hover:bg-ga-bg-hover/40',
        tone === 'red' && 'border-red-500/40',
        tone === 'orange' && 'border-orange-500/40',
        tone === 'yellow' && 'border-yellow-500/40',
        tone === 'green' && 'border-green-500/40',
        tone === 'gray' && 'border-ga-border',
        highlighted && 'ring-2 ring-ga-accent ring-offset-2 ring-offset-ga-bg-app animate-pulse',
      )}
    >
      {/* Headline: Name · total qty · most-urgent expiry pill · Use 1 quick action */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-2 min-w-0 flex-1">
          <span className="text-sm font-medium text-ga-text-primary truncate">
            {cluster.catalogDisplay}
          </span>
          <span className="text-xs text-ga-text-secondary tabular-nums">
            {formatQty(cluster.totalBaseUnits)} {cluster.baseUnitLabel}
            {cluster.totalBaseUnits === 1 ? '' : 's'}
          </span>
          {cluster.events.length > cluster.locations.length && (
            <span className="text-[10px] text-ga-text-secondary">
              · {cluster.events.length} batches
            </span>
          )}
        </div>
        {/* Removed the inline "Use 1" button — it called consume_one_by_catalog
            with quantity=1 which means ONE EVENT, not one base unit. A user
            clicking it on Eggs whose most-urgent event was an 11-egg batch
            would lose all 11 eggs in a single click. The proper Use flow lives
            on /catalog/{name_norm} where MarkUsedModal lets the user pick a
            partial quantity with a slider. The row itself is just summary +
            navigation now. */}
        <span
          className={cn(
            'text-[11px] tabular-nums px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0',
            tone === 'red' && 'bg-red-500/15 text-red-400',
            tone === 'orange' && 'bg-orange-500/15 text-orange-400',
            tone === 'yellow' && 'bg-yellow-500/15 text-yellow-500',
            tone === 'green' && 'bg-green-500/15 text-green-400',
            tone === 'gray' && 'bg-ga-bg-hover text-ga-text-secondary',
          )}
        >
          {expiryLabel}
        </span>
      </div>

      {/* Locations breakdown — primary view per user spec: "show all places" */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {cluster.locations.map((loc) => {
          const locDays =
            loc.soonestExpiry == null
              ? null
              : Math.round((loc.soonestExpiry.getTime() - Date.now()) / 86400000);
          return (
            <span
              key={loc.location}
              className="text-xs text-ga-text-secondary inline-flex items-center gap-1"
              title={
                loc.soonestExpiry
                  ? `Soonest expiry at ${loc.location}: ${loc.soonestExpiry.toLocaleDateString()}`
                  : undefined
              }
            >
              📍 <span className="text-ga-text-primary">{loc.location}</span>
              <span className="tabular-nums">
                {formatQty(loc.qty)} {cluster.baseUnitLabel}
                {loc.qty === 1 ? '' : 's'}
              </span>
              {locDays != null && (
                <span
                  className={cn(
                    'text-[10px] tabular-nums',
                    locDays < 0
                      ? 'text-red-400'
                      : locDays <= 3
                        ? 'text-orange-400'
                        : locDays <= 7
                          ? 'text-yellow-500'
                          : 'text-ga-text-secondary',
                  )}
                >
                  · {locDays < 0 ? `${Math.abs(locDays)}d expired` : locDays === 0 ? 'today' : `${locDays}d`}
                </span>
              )}
            </span>
          );
        })}
      </div>
    </Link>
  );
}

function formatQty(n: number): string {
  // Whole numbers without trailing zeros, otherwise one decimal
  if (n === Math.floor(n)) return n.toString();
  return n.toFixed(1);
}
