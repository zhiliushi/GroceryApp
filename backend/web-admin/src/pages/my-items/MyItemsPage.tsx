import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePurchasesInfinite } from '@/api/queries/usePurchases';
import { useDeletePurchase } from '@/api/mutations/usePurchaseMutations';
import PageHeader from '@/components/shared/PageHeader';
import Breadcrumbs from '@/components/shared/Breadcrumbs';
import { SkeletonList } from '@/components/shared/Skeleton';
import InfiniteScrollSentinel from '@/components/shared/InfiniteScrollSentinel';
import ExpiryCountdownChip from '@/components/waste/ExpiryCountdownChip';
import ThrowAwayModal from '@/components/waste/ThrowAwayModal';
import GiveAwayModal from '@/components/waste/GiveAwayModal';
import MarkUsedModal from '@/components/waste/MarkUsedModal';
import MoveLocationModal from '@/components/waste/MoveLocationModal';
import QuickAddModal from '@/components/quickadd/QuickAddModal';
import { useUiStore } from '@/stores/uiStore';
import { useUndoableAction } from '@/hooks/useUndoableAction';
import {
  getPurchaseEventActions,
  getPurchaseEventState,
  type Action,
} from '@/utils/actionResolver';
import { cn } from '@/utils/cn';
import type { PurchaseEvent } from '@/types/api';

/**
 * MyItemsPage — refactor Phase 4f.
 *
 * Three groups by derived state:
 *  1. Expiring Soon (active + expiry <= 7d or expired)
 *  2. Active (active + expiry > 7d OR no expiry but <7d old)
 *  3. No Expiry Tracked (active + no expiry + >7d old)
 *
 * Each row shows an inline state-driven action set from `getPurchaseEventActions`.
 */
export default function MyItemsPage() {
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePurchasesInfinite({ status: 'active', limit: 100 });
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [throwTarget, setThrowTarget] = useState<PurchaseEvent | null>(null);
  const [giveTarget, setGiveTarget] = useState<PurchaseEvent | null>(null);
  const [usedTarget, setUsedTarget] = useState<PurchaseEvent | null>(null);
  const [moveTarget, setMoveTarget] = useState<PurchaseEvent | null>(null);

  const recentlyEditedId = useUiStore((s) => s.recentlyEditedPurchaseId);
  const setRecentlyEditedId = useUiStore((s) => s.setRecentlyEditedPurchaseId);
  const highlightRowRef = useRef<HTMLDivElement | null>(null);

  // After data lands and we have a recently-edited id, scroll the row into view
  // and clear the marker after the highlight pulse completes.
  useEffect(() => {
    if (!recentlyEditedId) return;
    const node = highlightRowRef.current;
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const t = window.setTimeout(() => setRecentlyEditedId(null), 3000);
    return () => window.clearTimeout(t);
  }, [recentlyEditedId, setRecentlyEditedId]);

  const events = useMemo(
    () => (data?.pages ?? []).flatMap((p) => p.items),
    [data],
  );

  const recentlyEditedExists = !!recentlyEditedId && events.some((e) => e.id === recentlyEditedId);

  const groups = useMemo(() => {
    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const weekBefore = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const expiring: PurchaseEvent[] = [];
    const active: PurchaseEvent[] = [];
    const untracked: PurchaseEvent[] = [];

    for (const event of events) {
      if (event.expiry_date) {
        const expiry = new Date(event.expiry_date);
        if (expiry <= weekAhead) {
          expiring.push(event);
        } else {
          active.push(event);
        }
      } else {
        const bought = event.date_bought ? new Date(event.date_bought) : now;
        if (bought < weekBefore) {
          untracked.push(event);
        } else {
          active.push(event);
        }
      }
    }

    // Sort each group
    expiring.sort(
      (a, b) =>
        new Date(a.expiry_date || '').getTime() - new Date(b.expiry_date || '').getTime(),
    );
    active.sort(
      (a, b) =>
        (new Date(a.expiry_date || '9999-01-01').getTime() -
          new Date(b.expiry_date || '9999-01-01').getTime()),
    );
    untracked.sort(
      (a, b) => new Date(a.date_bought).getTime() - new Date(b.date_bought).getTime(),
    );

    return { expiring, active, untracked };
  }, [events]);

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
      <ThrowAwayModal open={!!throwTarget} event={throwTarget} onClose={() => setThrowTarget(null)} />
      <GiveAwayModal open={!!giveTarget} event={giveTarget} onClose={() => setGiveTarget(null)} />
      <MarkUsedModal open={!!usedTarget} event={usedTarget} onClose={() => setUsedTarget(null)} />
      <MoveLocationModal open={!!moveTarget} event={moveTarget} onClose={() => setMoveTarget(null)} />

      {isLoading ? (
        <SkeletonList count={6} />
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
          Failed to load: {(error as Error).message}
        </div>
      ) : events.length === 0 ? (
        <EmptyState onAdd={() => setQuickAddOpen(true)} />
      ) : (
        <>
          {recentlyEditedExists && (
            <div className="text-xs text-ga-text-secondary bg-ga-accent/10 border border-ga-accent/30 rounded px-3 py-2">
              ✓ Saved — your edited item is highlighted below.
            </div>
          )}
          <Group
            title="Expiring soon"
            emoji="⚠️"
            emptyText="Nothing expiring — nice."
            events={groups.expiring}
            onThrow={setThrowTarget}
            onGive={setGiveTarget}
            onUsed={setUsedTarget}
            onMove={setMoveTarget}
            highlightId={recentlyEditedId}
            highlightRef={highlightRowRef}
          />
          <Group
            title="Active"
            emoji="✅"
            emptyText="No fresh items."
            events={groups.active}
            onThrow={setThrowTarget}
            onGive={setGiveTarget}
            onUsed={setUsedTarget}
            onMove={setMoveTarget}
            highlightId={recentlyEditedId}
            highlightRef={highlightRowRef}
          />
          <Group
            title="No expiry tracked"
            emoji="❓"
            emptyText="All items have expiry dates — great tracking."
            events={groups.untracked}
            onThrow={setThrowTarget}
            onGive={setGiveTarget}
            onUsed={setUsedTarget}
            onMove={setMoveTarget}
            highlightId={recentlyEditedId}
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

function Group({
  title,
  emoji,
  events,
  emptyText,
  onThrow,
  onGive,
  onUsed,
  onMove,
  highlightId,
  highlightRef,
}: {
  title: string;
  emoji: string;
  events: PurchaseEvent[];
  emptyText: string;
  onThrow: (e: PurchaseEvent) => void;
  onGive: (e: PurchaseEvent) => void;
  onUsed: (e: PurchaseEvent) => void;
  onMove: (e: PurchaseEvent) => void;
  highlightId?: string | null;
  highlightRef?: React.MutableRefObject<HTMLDivElement | null>;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-ga-text-primary mb-2">
        {emoji} {title} ({events.length})
      </h3>
      {events.length === 0 ? (
        <p className="text-xs text-ga-text-secondary italic px-3 py-2">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {groupByParent(events).map((entry) =>
            entry.kind === 'group' ? (
              <MultiPackGroupCard
                key={`mpg_${entry.parentId}`}
                events={entry.events}
                onThrow={onThrow}
                onGive={onGive}
                onUsed={onUsed}
                onMove={onMove}
                highlightId={highlightId ?? undefined}
                highlightRef={highlightRef}
              />
            ) : (
              <PurchaseEventRow
                key={entry.event.id}
                event={entry.event}
                onThrow={onThrow}
                onGive={onGive}
                onUsed={onUsed}
                onMove={onMove}
                highlighted={highlightId === entry.event.id}
                rowRef={highlightId === entry.event.id ? highlightRef : undefined}
              />
            ),
          )}
        </div>
      )}
    </section>
  );
}

type GroupedEntry =
  | { kind: 'single'; event: PurchaseEvent }
  | { kind: 'group'; parentId: string; events: PurchaseEvent[] };

/** Cluster events sharing a `multi_pack_parent_id` (≥2 siblings). Single-event
 *  groups stay as singletons so they render the regular row UI. Preserves
 *  insertion order: a group sits where its first member would have. */
function groupByParent(events: PurchaseEvent[]): GroupedEntry[] {
  const out: GroupedEntry[] = [];
  const indexByParent = new Map<string, number>();
  for (const e of events) {
    const pid = e.multi_pack_parent_id || null;
    if (!pid) {
      out.push({ kind: 'single', event: e });
      continue;
    }
    const existing = indexByParent.get(pid);
    if (existing !== undefined) {
      const slot = out[existing];
      if (slot.kind === 'group') slot.events.push(e);
    } else {
      indexByParent.set(pid, out.length);
      out.push({ kind: 'group', parentId: pid, events: [e] });
    }
  }
  // Demote single-member "groups" back to singletons.
  return out.map((entry) =>
    entry.kind === 'group' && entry.events.length === 1
      ? { kind: 'single', event: entry.events[0] }
      : entry,
  );
}

function PurchaseEventRow({
  event,
  onThrow,
  onGive,
  onUsed,
  onMove,
  highlighted,
  rowRef,
}: {
  event: PurchaseEvent;
  onThrow: (e: PurchaseEvent) => void;
  onGive: (e: PurchaseEvent) => void;
  onUsed: (e: PurchaseEvent) => void;
  onMove: (e: PurchaseEvent) => void;
  highlighted?: boolean;
  rowRef?: React.MutableRefObject<HTMLDivElement | null>;
}) {
  const actions = getPurchaseEventActions(event);
  const state = getPurchaseEventState(event);
  const deletePurchase = useDeletePurchase();
  const undoable = useUndoableAction();
  const navigate = useNavigate();

  function handleAction(action: Action) {
    if (action.disabled) return;
    switch (action.id) {
      case 'mark_used':
        onUsed(event);
        break;
      case 'mark_thrown':
        onThrow(event);
        break;
      case 'give_away':
        onGive(event);
        break;
      case 'move_location':
      case 'set_location':
        onMove(event);
        break;
      case 'set_expiry':
        navigate(`/my-items/${event.id}?edit=expiry`);
        break;
      case 'view_history':
        if (event.catalog_name_norm) {
          navigate(`/catalog/${event.catalog_name_norm}`);
        }
        break;
      case 'delete':
        // No up-front confirm — deferred mutation with Undo (plan principle)
        undoable.run(
          () => deletePurchase.mutate({ id: event.id, silent: true }),
          `Deleted "${event.catalog_display}"`,
        );
        break;
      default:
        break;
    }
  }

  return (
    <div
      ref={rowRef}
      className={cn(
        'bg-ga-bg-card border rounded-lg p-3 transition-shadow',
        // Stack vertically on phones, side-by-side from sm: up. The 3-action
        // row was getting squeezed against the title on narrow screens.
        'flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3',
        state === 'active_expired'
          ? 'border-red-500/30'
          : state === 'active_expiring_urgent'
          ? 'border-orange-500/30'
          : state === 'active_expiring_soon'
          ? 'border-yellow-500/30'
          : 'border-ga-border',
        highlighted && 'ring-2 ring-ga-accent ring-offset-2 ring-offset-ga-bg-app animate-pulse',
      )}
    >
      <Link
        to={`/my-items/${event.id}`}
        className="flex-1 min-w-0 hover:opacity-90"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-ga-text-primary truncate">
            {event.catalog_display}
          </span>
          {(event.quantity !== 1 || (event.unit && event.unit !== 'count')) && (
            <span className="text-xs text-ga-text-secondary">
              × {event.quantity}{event.unit && event.unit !== 'count' ? ` ${event.unit}` : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <ExpiryCountdownChip expiryDate={event.expiry_date} />
          {event.location && (
            <span className="text-xs text-ga-text-secondary">📍 {event.location}</span>
          )}
          {event.price !== null && event.price !== undefined && (
            <span className="text-xs text-ga-text-secondary">
              {event.currency ? `${event.currency} ` : ''}
              {event.price.toFixed(2)}
            </span>
          )}
        </div>
      </Link>
      <div className="flex flex-wrap gap-1 sm:justify-end -mx-1 sm:mx-0">
        {actions.slice(0, 3).map((action) => (
          <button
            key={action.id}
            disabled={action.disabled}
            onClick={() => handleAction(action)}
            title={action.disabledReason}
            className={cn(
              'px-2 py-1 text-xs rounded whitespace-nowrap',
              action.severity === 'primary' && 'bg-ga-accent text-white hover:opacity-90',
              action.severity === 'secondary' && 'bg-ga-bg-hover text-ga-text-primary hover:bg-ga-bg-card',
              action.severity === 'tertiary' && 'text-ga-text-secondary hover:bg-ga-bg-hover',
              action.severity === 'danger' && 'bg-red-500/10 text-red-500 hover:bg-red-500/20',
              action.disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Multi-pack sibling group card. When 2+ events share `multi_pack_parent_id`
 * they collapse into one card showing total pack count + summary, expandable
 * to per-pack rows. Surfaces "I added 6 packs" without flooding the list with
 * 6 visually-identical rows (which prior to this fix users mistook for "only
 * one shown" because the cards looked the same).
 */
function MultiPackGroupCard({
  events,
  onThrow,
  onGive,
  onUsed,
  onMove,
  highlightId,
  highlightRef,
}: {
  events: PurchaseEvent[];
  onThrow: (e: PurchaseEvent) => void;
  onGive: (e: PurchaseEvent) => void;
  onUsed: (e: PurchaseEvent) => void;
  onMove: (e: PurchaseEvent) => void;
  highlightId?: string;
  highlightRef?: React.MutableRefObject<HTMLDivElement | null>;
}) {
  const [expanded, setExpanded] = useState(false);
  // Use the most-urgent expiry for the headline state coloring
  const sorted = [...events].sort((a, b) => {
    const ax = a.expiry_date ? new Date(a.expiry_date).getTime() : Infinity;
    const bx = b.expiry_date ? new Date(b.expiry_date).getTime() : Infinity;
    return ax - bx;
  });
  const head = sorted[0];
  const headState = getPurchaseEventState(head);
  const isHighlighted = events.some((e) => e.id === highlightId);
  const groupRef = isHighlighted ? highlightRef : undefined;

  const totalUnits = events.reduce((sum, e) => sum + (e.quantity || 1) * (e.pack_size || 1), 0);
  const baseUnit = head.base_unit_label || head.unit || 'unit';
  const allSameLocation = events.every((e) => e.location === head.location);

  return (
    <div
      ref={groupRef}
      className={cn(
        'bg-ga-bg-card border rounded-lg transition-shadow',
        headState === 'active_expired'
          ? 'border-red-500/30'
          : headState === 'active_expiring_urgent'
          ? 'border-orange-500/30'
          : headState === 'active_expiring_soon'
          ? 'border-yellow-500/30'
          : 'border-ga-border',
        isHighlighted && 'ring-2 ring-ga-accent ring-offset-2 ring-offset-ga-bg-app animate-pulse',
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-left hover:bg-ga-bg-hover/40 rounded-lg"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-ga-text-primary truncate">
              {head.catalog_display}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-ga-accent/15 text-ga-accent">
              {events.length} packs
            </span>
            <span className="text-xs text-ga-text-secondary">
              · {totalUnits} {baseUnit}{totalUnits === 1 ? '' : 's'} total
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <ExpiryCountdownChip expiryDate={head.expiry_date} />
            {allSameLocation && head.location && (
              <span className="text-xs text-ga-text-secondary">📍 {head.location}</span>
            )}
            {!allSameLocation && (
              <span className="text-xs text-ga-text-secondary">📍 multiple locations</span>
            )}
            {head.price !== null && head.price !== undefined && (
              <span className="text-xs text-ga-text-secondary">
                {head.currency ? `${head.currency} ` : ''}
                {head.price.toFixed(2)} / pack
              </span>
            )}
          </div>
        </div>
        <span className="text-xs text-ga-text-secondary self-start sm:self-center">
          {expanded ? '▾ collapse' : '▸ expand'}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-ga-border/50 px-3 py-2 space-y-2">
          {events.map((e) => (
            <PurchaseEventRow
              key={e.id}
              event={e}
              onThrow={onThrow}
              onGive={onGive}
              onUsed={onUsed}
              onMove={onMove}
              highlighted={highlightId === e.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
