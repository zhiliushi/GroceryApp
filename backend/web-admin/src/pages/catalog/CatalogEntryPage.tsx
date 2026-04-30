import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCatalogEntry, useCatalog } from '@/api/queries/useCatalog';
import { useCatalogOverview } from '@/api/queries/useCatalogOverview';
import {
  useDeleteCatalogEntry,
  useMergeCatalogEntry,
  useUpdateCatalogEntry,
} from '@/api/mutations/useCatalogMutations';
import { useConsumeByCatalog } from '@/api/mutations/usePurchaseMutations';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import Breadcrumbs from '@/components/shared/Breadcrumbs';
import QuickAddModal from '@/components/quickadd/QuickAddModal';
import LifetimeUnitBreakdown from '@/components/items/LifetimeUnitBreakdown';
import MovementTimeline from '@/components/items/MovementTimeline';
import SplitLineageTree from '@/components/items/SplitLineageTree';
import PriceHistoryTable from '@/components/items/PriceHistoryTable';
import TransferHistoryFlow from '@/components/items/TransferHistoryFlow';
import CurrentLocations from '@/components/items/CurrentLocations';
import ItemPatterns from '@/components/items/ItemPatterns';
import { getCatalogEntryActions, type Action } from '@/utils/actionResolver';
import { cn } from '@/utils/cn';
import type { CatalogEntry, CatalogOverview } from '@/types/api';

export default function CatalogEntryPage() {
  const { nameNorm } = useParams<{ nameNorm: string }>();
  const navigate = useNavigate();
  const { data: entry, isLoading, error } = useCatalogEntry(nameNorm);
  const { data: overview } = useCatalogOverview(nameNorm);
  const updateMutation = useUpdateCatalogEntry();
  const deleteMutation = useDeleteCatalogEntry();
  const mergeMutation = useMergeCatalogEntry();

  const consumeMutation = useConsumeByCatalog();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [showLifetime, setShowLifetime] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showLineage, setShowLineage] = useState(false);

  if (isLoading) return <LoadingSpinner text="Loading…" />;
  if (error || !entry) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
          Could not load catalog entry.
        </div>
      </div>
    );
  }

  function handleAction(action: Action) {
    if (!entry || action.disabled) return;
    switch (action.id) {
      case 'new_purchase':
        setAddOpen(true);
        break;
      case 'edit_name':
        setEditingName(true);
        setNameDraft(entry.display_name);
        break;
      case 'unlink_barcode':
        if (window.confirm('Unlink barcode from this catalog entry?')) {
          updateMutation.mutate({ nameNorm: entry.name_norm, data: { barcode: null } });
        }
        break;
      case 'merge_into':
        setMergeOpen(true);
        break;
      case 'delete':
        if (
          window.confirm(
            `Delete catalog entry "${entry.display_name}"? Its ${entry.total_purchases} purchase(s) will become orphan history.`,
          )
        ) {
          deleteMutation.mutate(
            { nameNorm: entry.name_norm },
            { onSuccess: () => navigate('/catalog') },
          );
        }
        break;
      default:
        break;
    }
  }

  function saveName() {
    if (!entry || !nameDraft.trim()) {
      setEditingName(false);
      return;
    }
    updateMutation.mutate(
      { nameNorm: entry.name_norm, data: { display_name: nameDraft.trim() } },
      { onSuccess: () => setEditingName(false) },
    );
  }

  const actions = getCatalogEntryActions(entry);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'My Catalog', to: '/catalog' },
          { label: entry.display_name },
        ]}
      />
      <Link to="/catalog" className="text-sm text-ga-accent hover:underline">
        ← My Catalog
      </Link>

      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  autoFocus
                  className="text-xl font-semibold bg-ga-bg-hover px-2 py-1 rounded"
                />
                <button onClick={saveName} className="text-xs px-2 py-1 bg-ga-accent text-white rounded">
                  Save
                </button>
                <button onClick={() => setEditingName(false)} className="text-xs px-2 py-1 border border-ga-border rounded">
                  Cancel
                </button>
              </div>
            ) : (
              <h1
                className="text-xl font-semibold text-ga-text-primary cursor-pointer hover:underline"
                onClick={() => {
                  setEditingName(true);
                  setNameDraft(entry.display_name);
                }}
                title="Click to edit"
              >
                {entry.display_name} ✎
              </h1>
            )}
            <div className="flex items-center gap-3 text-xs text-ga-text-secondary mt-1">
              {entry.barcode && <span>🏷️ {entry.barcode}</span>}
              {entry.country_code && <span>{entry.country_code}</span>}
              {entry.needs_review && (
                <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                  Needs review
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Hero action bar — surfaces the most-pressing thing about this item
            and the obvious next move, so common actions don't require scrolling
            past read-out sections. */}
        {overview && (
          <HeroActionBar
            overview={overview}
            entryName={entry.display_name}
            onBuyMore={() => setAddOpen(true)}
            onUseOne={() =>
              consumeMutation.mutate({
                catalog_name_norm: entry.name_norm,
                quantity: 1,
              })
            }
            consumeBusy={consumeMutation.isPending}
          />
        )}

        <dl className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <Stat
            label="Times bought"
            value={overview?.counters.logical_purchase_count ?? entry.total_purchases}
          />
          <Stat label="Active batches" value={entry.active_purchases} />
          <Stat
            label="Total on hand"
            value={
              overview
                ? `${formatQty(overview.lifetime_breakdown.active_qty)}`
                : entry.active_purchases
            }
          />
          <Stat
            label="Last bought"
            value={
              entry.last_purchased_at
                ? new Date(entry.last_purchased_at).toLocaleDateString()
                : '—'
            }
          />
        </dl>
        {overview &&
          overview.counters.total_event_count !== overview.counters.logical_purchase_count && (
            <p className="text-[10px] text-ga-text-secondary -mt-1">
              {overview.counters.total_event_count - overview.counters.logical_purchase_count}{' '}
              additional split event{overview.counters.total_event_count - overview.counters.logical_purchase_count === 1 ? '' : 's'}{' '}
              from partial actions (used / thrown / moved) — visible in lineage tree below.
            </p>
          )}

        {overview && (
          <>
            <div className="border-t border-ga-border pt-4">
              <h3 className="text-sm font-semibold text-ga-text-primary mb-3">
                Currently stored
              </h3>
              <CurrentLocations
                locations={overview.current_locations}
                baseUnitLabel="unit"
              />
            </div>

            <div className="border-t border-ga-border pt-4">
              <h3 className="text-sm font-semibold text-ga-text-primary mb-3">
                Patterns
              </h3>
              <ItemPatterns
                cadence={overview.cadence}
                wasteCost={overview.waste_cost}
                wasteRate={overview.waste_rate}
                baseUnitLabel="unit"
              />
            </div>

            {/* Price by store — kept above-fold when present, since cross-store
                price comparison is the most actionable financial insight. */}
            {overview.price_history_per_store.length > 0 && (
              <div className="border-t border-ga-border pt-4">
                <h3 className="text-sm font-semibold text-ga-text-primary mb-2">
                  Price by store ({overview.price_history_per_store.length})
                </h3>
                <PriceHistoryTable
                  priceHistory={overview.price_history_per_store}
                  baseUnitLabel="unit"
                />
              </div>
            )}

            {/* Lifetime breakdown — reference data, collapsed by default. */}
            <div className="border-t border-ga-border pt-4">
              <button
                onClick={() => setShowLifetime((v) => !v)}
                className="flex items-center justify-between w-full text-sm font-semibold text-ga-text-primary"
              >
                <span>Lifetime breakdown</span>
                <span className="text-xs text-ga-text-secondary">
                  {showLifetime ? '▾' : '▸'} {showLifetime ? 'hide' : 'show'}
                </span>
              </button>
              {showLifetime && (
                <div className="mt-3">
                  <LifetimeUnitBreakdown
                    lifetime={overview.lifetime_breakdown}
                    wasteRate={overview.waste_rate}
                    baseUnitLabel="unit"
                  />
                </div>
              )}
            </div>

            {/* Activity timeline — history view, collapsed. */}
            <div className="border-t border-ga-border pt-4">
              <button
                onClick={() => setShowTimeline((v) => !v)}
                className="flex items-center justify-between w-full text-sm font-semibold text-ga-text-primary"
              >
                <span>
                  Activity timeline
                  <span className="ml-2 text-xs text-ga-text-secondary font-normal">
                    ({overview.movement_timeline.length} events)
                  </span>
                </span>
                <span className="text-xs text-ga-text-secondary">
                  {showTimeline ? '▾' : '▸'} {showTimeline ? 'hide' : 'show'}
                </span>
              </button>
              {showTimeline && (
                <div className="mt-3">
                  <MovementTimeline timeline={overview.movement_timeline} />
                </div>
              )}
            </div>

            {/* Split lineage — only show when splits exist. Auto-expand because
                its presence is itself the signal worth seeing. */}
            {overview.split_lineage.some((p) => p.children.length > 0) && (
              <div className="border-t border-ga-border pt-4">
                <button
                  onClick={() => setShowLineage((v) => !v)}
                  className="flex items-center justify-between w-full text-sm font-semibold text-ga-text-primary"
                >
                  <span>Split lineage</span>
                  <span className="text-xs text-ga-text-secondary">
                    {showLineage ? '▾' : '▸'} {showLineage ? 'hide' : 'show'}
                  </span>
                </button>
                {showLineage && (
                  <div className="mt-3">
                    <SplitLineageTree lineage={overview.split_lineage} />
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Manage entry — admin / rare actions. Common actions (buy more, use)
            are surfaced in the Hero bar above so this stays out of the way. */}
        <div className="border-t border-ga-border pt-4">
          <h3 className="text-sm font-semibold text-ga-text-primary mb-2">
            Manage entry
          </h3>
          <div className="flex flex-wrap gap-2">
            {actions
              .filter((a) => a.id !== 'new_purchase') // already in Hero bar as "Buy more"
              .map((action) => (
                <button
                  key={action.id}
                  disabled={action.disabled}
                  onClick={() => handleAction(action)}
                  title={action.disabledReason}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded border',
                    action.severity === 'danger'
                      ? 'border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/20'
                      : 'border-ga-border text-ga-text-secondary hover:bg-ga-bg-hover',
                    action.disabled && 'cursor-not-allowed opacity-50',
                  )}
                >
                  {action.label}
                </button>
              ))}
            {/* Phase G: transfer history into another catalog row */}
            <button
              onClick={() => setTransferOpen(true)}
              className="px-3 py-1.5 text-sm rounded text-ga-text-secondary hover:bg-ga-bg-hover border border-ga-border"
            >
              ↪ Transfer history…
            </button>
          </div>
        </div>
      </div>

      <QuickAddModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        defaults={{ catalogEntry: entry }}
      />

      <TransferHistoryFlow
        open={transferOpen}
        source={entry}
        onClose={() => setTransferOpen(false)}
      />

      {mergeOpen && (
        <MergeModal
          source={entry}
          onClose={() => setMergeOpen(false)}
          onMerge={(target) => {
            mergeMutation.mutate(
              { srcNameNorm: entry.name_norm, targetNameNorm: target.name_norm },
              {
                onSuccess: () => {
                  setMergeOpen(false);
                  navigate(`/catalog/${target.name_norm}`);
                },
              },
            );
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-xs text-ga-text-secondary">{label}</div>
      <div className="text-lg font-semibold text-ga-text-primary">{value}</div>
    </div>
  );
}

function formatQty(n: number): string {
  if (n === Math.floor(n)) return n.toString();
  return n.toFixed(1);
}

/**
 * Hero action bar — picks the most-pressing situation about this item and
 * surfaces a contextual primary CTA, plus quick "+ Buy more" / "Use 1 (FIFO)"
 * always-on actions. Sits directly under the header so the user doesn't have
 * to scroll past read-out tables to act.
 *
 * Decision order (most urgent first):
 *   1. Anything expired   → red banner + "1 expired — review batches"
 *   2. Expiring ≤3 days   → orange banner + "Use soon — N expire in Xd"
 *   3. Predicted next buy ≤0 → accent banner + "Restock due"
 *   4. Active inventory low (<= 1 unit) → "Almost out"
 *   5. All fresh          → quiet banner + "Buy more"
 */
function HeroActionBar({
  overview,
  entryName,
  onBuyMore,
  onUseOne,
  consumeBusy,
}: {
  overview: CatalogOverview;
  entryName: string;
  onBuyMore: () => void;
  onUseOne: () => void;
  consumeBusy: boolean;
}) {
  const banner = useMemo(() => buildHeroBanner(overview), [overview]);
  const hasActiveBatches =
    overview.lifetime_breakdown.active_qty > 0 || overview.counters.active_count > 0;

  return (
    <div
      className={cn(
        'rounded-md p-3 flex flex-col sm:flex-row sm:items-center gap-3',
        banner.tone === 'red' && 'bg-red-500/10 border border-red-500/30',
        banner.tone === 'orange' && 'bg-orange-500/10 border border-orange-500/30',
        banner.tone === 'accent' && 'bg-ga-accent/10 border border-ga-accent/30',
        banner.tone === 'quiet' && 'bg-ga-bg-hover/40 border border-ga-border',
      )}
    >
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'text-sm flex items-baseline gap-2',
            banner.tone === 'red' && 'text-red-400',
            banner.tone === 'orange' && 'text-orange-400',
            banner.tone === 'accent' && 'text-ga-accent',
            banner.tone === 'quiet' && 'text-ga-text-primary',
          )}
        >
          <span className="text-base">{banner.icon}</span>
          <span className="font-medium">{banner.headline}</span>
        </div>
        {banner.detail && (
          <p className="text-xs text-ga-text-secondary mt-0.5 ml-6">{banner.detail}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2 sm:flex-shrink-0">
        <button
          onClick={onBuyMore}
          className="px-3 py-1.5 text-sm rounded bg-ga-accent text-white hover:opacity-90"
          title={`Buy more ${entryName}`}
        >
          + Buy more
        </button>
        {hasActiveBatches && (
          <button
            onClick={onUseOne}
            disabled={consumeBusy}
            className="px-3 py-1.5 text-sm rounded border border-ga-border text-ga-text-primary hover:bg-ga-bg-hover disabled:opacity-50"
            title="Mark the oldest-expiry active batch as used (FIFO)"
          >
            {consumeBusy ? 'Marking…' : 'Use 1'}
          </button>
        )}
      </div>
    </div>
  );
}

interface HeroBanner {
  tone: 'red' | 'orange' | 'accent' | 'quiet';
  icon: string;
  headline: string;
  detail?: string;
}

function buildHeroBanner(o: CatalogOverview): HeroBanner {
  // Find the soonest-expiring active location for "expired" / "expiring soon"
  const now = Date.now();
  let soonestExpiry: { loc: string; days: number; qty: number } | null = null;
  for (const loc of o.current_locations) {
    if (!loc.soonest_expiry) continue;
    const days = Math.round((new Date(loc.soonest_expiry).getTime() - now) / 86400000);
    if (!soonestExpiry || days < soonestExpiry.days) {
      soonestExpiry = { loc: loc.location, days, qty: loc.active_qty };
    }
  }

  if (soonestExpiry && soonestExpiry.days < 0) {
    return {
      tone: 'red',
      icon: '⚠',
      headline: `${formatQty(soonestExpiry.qty)} units expired at ${soonestExpiry.loc}`,
      detail: `${Math.abs(soonestExpiry.days)} day${
        Math.abs(soonestExpiry.days) === 1 ? '' : 's'
      } past expiry — review batches and throw if needed.`,
    };
  }
  if (soonestExpiry && soonestExpiry.days <= 3) {
    return {
      tone: 'orange',
      icon: '⏰',
      headline: `Use soon — ${formatQty(soonestExpiry.qty)} expire in ${
        soonestExpiry.days === 0 ? 'today' : `${soonestExpiry.days}d`
      }`,
      detail: `At ${soonestExpiry.loc}. Tap "Use 1" to mark the oldest-expiry batch consumed.`,
    };
  }
  // Predicted restock due
  const next = o.cadence.predicted_next_buy_in_days;
  if (next != null && next <= 0) {
    return {
      tone: 'accent',
      icon: '🛒',
      headline: `Restock due — ${Math.abs(next).toFixed(0)} day${
        Math.abs(next) >= 2 ? 's' : ''
      } overdue`,
      detail: `You buy these every ~${o.cadence.avg_days_between_buys} days; last ${o.cadence.days_since_last_buy} days ago.`,
    };
  }
  // Almost out — small active inventory
  const totalActive = o.lifetime_breakdown.active_qty;
  if (totalActive > 0 && totalActive <= 1) {
    return {
      tone: 'orange',
      icon: '🪫',
      headline: 'Almost out',
      detail: `Only ${formatQty(totalActive)} on hand — consider buying soon.`,
    };
  }
  if (totalActive === 0) {
    return {
      tone: 'accent',
      icon: '📦',
      headline: 'Out of stock',
      detail:
        next != null && next > 0
          ? `Last bought ${o.cadence.days_since_last_buy ?? '?'}d ago — next buy expected in ~${next.toFixed(0)}d.`
          : `No active batches. Buy more when you need them.`,
    };
  }
  // Healthy
  return {
    tone: 'quiet',
    icon: '✓',
    headline: `${formatQty(totalActive)} on hand · all fresh`,
    detail:
      o.cadence.avg_days_between_buys != null
        ? `You buy these every ~${o.cadence.avg_days_between_buys} days.`
        : undefined,
  };
}

function MergeModal({
  source,
  onClose,
  onMerge,
}: {
  source: CatalogEntry;
  onClose: () => void;
  onMerge: (target: CatalogEntry) => void;
}) {
  const [q, setQ] = useState('');
  const { data } = useCatalog({ q, limit: 20 });
  const candidates = (data?.items ?? []).filter((e) => e.name_norm !== source.name_norm);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-ga-bg-card border border-ga-border rounded-xl shadow-2xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-ga-border">
          <h3 className="text-base font-semibold text-ga-text-primary">
            Merge "{source.display_name}" into…
          </h3>
          <p className="text-xs text-ga-text-secondary mt-1">
            All {source.total_purchases} purchase(s) will be re-parented to the target. Source entry is deleted.
          </p>
        </div>
        <div className="px-5 py-4 space-y-2">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search catalog…"
            autoFocus
            className="w-full px-3 py-2 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary focus:outline-none focus:border-ga-accent"
          />
          <div className="max-h-64 overflow-y-auto space-y-1">
            {candidates.length === 0 ? (
              <p className="text-xs text-ga-text-secondary italic text-center py-4">
                No candidates. Create another catalog entry first.
              </p>
            ) : (
              candidates.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onMerge(c)}
                  className="w-full text-left px-3 py-2 rounded hover:bg-ga-bg-hover text-sm"
                >
                  <div className="text-ga-text-primary">{c.display_name}</div>
                  <div className="text-xs text-ga-text-secondary">
                    {c.total_purchases}× bought
                    {c.barcode && ` · ${c.barcode}`}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
        <div className="px-5 py-3 border-t border-ga-border flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
