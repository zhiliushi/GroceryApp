import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePurchasesInfinite } from '@/api/queries/usePurchases';
import { useChangePurchaseStatus, useDeletePurchase } from '@/api/mutations/usePurchaseMutations';
import PageHeader from '@/components/shared/PageHeader';
import Breadcrumbs from '@/components/shared/Breadcrumbs';
import { SkeletonList } from '@/components/shared/Skeleton';
import InfiniteScrollSentinel from '@/components/shared/InfiniteScrollSentinel';
import ExpiryCountdownChip from '@/components/waste/ExpiryCountdownChip';
import ThrowAwayModal from '@/components/waste/ThrowAwayModal';
import GiveAwayModal from '@/components/waste/GiveAwayModal';
import QuickAddModal from '@/components/quickadd/QuickAddModal';
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

  const events = useMemo(
    () => (data?.pages ?? []).flatMap((p) => p.items),
    [data],
  );

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
          <Group
            title="Expiring soon"
            emoji="⚠️"
            emptyText="Nothing expiring — nice."
            events={groups.expiring}
            onThrow={setThrowTarget}
            onGive={setGiveTarget}
          />
          <Group
            title="Active"
            emoji="✅"
            emptyText="No fresh items."
            events={groups.active}
            onThrow={setThrowTarget}
            onGive={setGiveTarget}
          />
          <Group
            title="No expiry tracked"
            emoji="❓"
            emptyText="All items have expiry dates — great tracking."
            events={groups.untracked}
            onThrow={setThrowTarget}
            onGive={setGiveTarget}
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
}: {
  title: string;
  emoji: string;
  events: PurchaseEvent[];
  emptyText: string;
  onThrow: (e: PurchaseEvent) => void;
  onGive: (e: PurchaseEvent) => void;
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
          {events.map((e) => (
            <PurchaseEventRow key={e.id} event={e} onThrow={onThrow} onGive={onGive} />
          ))}
        </div>
      )}
    </section>
  );
}

function PurchaseEventRow({
  event,
  onThrow,
  onGive,
}: {
  event: PurchaseEvent;
  onThrow: (e: PurchaseEvent) => void;
  onGive: (e: PurchaseEvent) => void;
}) {
  const actions = getPurchaseEventActions(event);
  const state = getPurchaseEventState(event);
  const changeStatus = useChangePurchaseStatus();
  const deletePurchase = useDeletePurchase();
  const undoable = useUndoableAction();

  function handleAction(action: Action) {
    if (action.disabled) return;
    switch (action.id) {
      case 'mark_used':
        // Plan principle: Undo over confirm. Fire after 5s; user can Undo.
        undoable.run(
          () =>
            changeStatus.mutate({
              id: event.id,
              data: { status: 'used', reason: 'used_up' },
              silent: true,
            }),
          `Marked "${event.catalog_display}" as used`,
        );
        break;
      case 'mark_thrown':
        onThrow(event);
        break;
      case 'give_away':
        onGive(event);
        break;
      case 'delete':
        // No up-front confirm — deferred mutation with Undo (plan principle)
        undoable.run(
          () => deletePurchase.mutate({ id: event.id, silent: true }),
          `Deleted "${event.catalog_display}"`,
        );
        break;
      default:
        // set_expiry / set_location / move_location / view_history — navigation handled by parent link
        break;
    }
  }

  return (
    <div
      className={cn(
        'bg-ga-bg-card border rounded-lg p-3 flex items-center gap-3',
        state === 'active_expired'
          ? 'border-red-500/30'
          : state === 'active_expiring_urgent'
          ? 'border-orange-500/30'
          : state === 'active_expiring_soon'
          ? 'border-yellow-500/30'
          : 'border-ga-border',
      )}
    >
      <Link
        to={`/my-items/${event.id}`}
        className="flex-1 min-w-0 hover:opacity-90"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ga-text-primary truncate">
            {event.catalog_display}
          </span>
          {event.quantity !== 1 && (
            <span className="text-xs text-ga-text-secondary">× {event.quantity}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
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
      <div className="flex flex-wrap gap-1 justify-end">
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
