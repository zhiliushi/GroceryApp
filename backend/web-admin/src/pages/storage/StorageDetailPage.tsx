import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLocations } from '@/api/queries/useLocations';
import { usePurchases } from '@/api/queries/usePurchases';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import Breadcrumbs from '@/components/shared/Breadcrumbs';
import QuickAddModal from '@/components/quickadd/QuickAddModal';
import MarkUsedModal from '@/components/waste/MarkUsedModal';
import MoveLocationModal from '@/components/waste/MoveLocationModal';
import ThrowAwayModal from '@/components/waste/ThrowAwayModal';
import { cn } from '@/utils/cn';
import type { PurchaseEvent } from '@/types/api';

const UNSORTED_KEY = '_unsorted';

/**
 * Storage Detail page — "what's in this storage location right now?"
 *
 * Distinct from /storage (management view: add/rename/reorder/recolor
 * locations) and from /catalog/:nameNorm (per-item analytics). This is
 * the at-the-fridge-door view: open a location, see what's inside, in
 * urgency order, with one-tap actions.
 *
 * Composition:
 *   1. Hero — location icon + name + count + most-urgent banner.
 *   2. Stat strip — total / expiring (≤7d) / expired chips.
 *   3. Pack list — every active pack here, sorted by expiry urgency.
 *      Each pack: item name, qty, expiry chip, location, Use / Move /
 *      Throw buttons.
 *   4. "+ Add to {location}" CTA opens QuickAdd prefilled with this
 *      location.
 *
 * Special key `_unsorted` covers the "no location set" bucket — when
 * users add items without choosing a location, this is where they can
 * be reviewed and assigned.
 */
export default function StorageDetailPage() {
  const { locationKey } = useParams<{ locationKey: string }>();
  const { locations, isLoading: locLoading } = useLocations();
  const { data: purchases, isLoading: purchasesLoading } = usePurchases({
    status: 'active',
    limit: 200,
  });

  const [addOpen, setAddOpen] = useState(false);
  const [useTarget, setUseTarget] = useState<PurchaseEvent | null>(null);
  const [moveTarget, setMoveTarget] = useState<PurchaseEvent | null>(null);
  const [throwTarget, setThrowTarget] = useState<PurchaseEvent | null>(null);

  const location = useMemo(() => {
    if (!locationKey) return null;
    if (locationKey === UNSORTED_KEY) {
      return {
        key: UNSORTED_KEY,
        name: 'Unsorted',
        icon: '📥',
        color: '#6B7280',
        sort: 999,
      };
    }
    return locations.find((l) => l.key === locationKey) ?? null;
  }, [locationKey, locations]);

  const events = useMemo(() => {
    const items = purchases?.items ?? [];
    const filtered =
      locationKey === UNSORTED_KEY
        ? items.filter((ev) => !ev.location)
        : items.filter((ev) => ev.location === locationKey);
    return [...filtered].sort(byExpiryUrgency);
  }, [purchases, locationKey]);

  const stats = useMemo(() => {
    const now = Date.now();
    let expired = 0;
    let expiring = 0;
    for (const ev of events) {
      if (!ev.expiry_date) continue;
      const ms = new Date(ev.expiry_date).getTime();
      const days = Math.ceil((ms - now) / 86400000);
      if (days < 0) expired++;
      else if (days <= 7) expiring++;
    }
    return { total: events.length, expiring, expired };
  }, [events]);

  if (locLoading || purchasesLoading) {
    return <LoadingSpinner text="Loading…" />;
  }

  if (!location) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', to: '/dashboard' },
            { label: 'Storage', to: '/storage' },
            { label: 'Unknown' },
          ]}
        />
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm mt-4">
          Storage location "{locationKey}" not found. It may have been
          renamed or removed.{' '}
          <Link to="/storage" className="underline">
            Back to all storage →
          </Link>
        </div>
      </div>
    );
  }

  // Status banner picks one urgent narrative based on the soonest pack.
  const banner = buildBanner(events);
  const heroBorder =
    banner.tone === 'red'
      ? 'border-red-500/40'
      : banner.tone === 'orange'
      ? 'border-orange-500/40'
      : 'border-ga-border';

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'Storage', to: '/storage' },
          { label: location.name },
        ]}
      />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div
        className={cn('bg-ga-bg-card border rounded-xl p-5 space-y-3', heroBorder)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="text-3xl flex-shrink-0"
              style={{ filter: 'drop-shadow(0 0 0.5px rgba(0,0,0,0.1))' }}
            >
              {location.icon}
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-ga-text-primary truncate">
                {location.name}
              </h1>
              <p className="text-xs text-ga-text-secondary mt-0.5">
                {stats.total === 0
                  ? 'Empty'
                  : `${stats.total} pack${stats.total === 1 ? '' : 's'} stored here`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex-shrink-0 px-3 py-1.5 text-sm rounded bg-ga-accent text-white hover:opacity-90 font-medium"
          >
            + Add here
          </button>
        </div>

        <div className="text-sm">{banner.text}</div>

        {/* Stat strip — only show when there's something worth flagging */}
        {(stats.expiring > 0 || stats.expired > 0) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {stats.expired > 0 && (
              <span className="px-2 py-1 text-xs rounded bg-red-500/15 text-red-500 font-medium">
                ⚠ {stats.expired} expired
              </span>
            )}
            {stats.expiring > 0 && (
              <span className="px-2 py-1 text-xs rounded bg-orange-500/15 text-orange-500 font-medium">
                ⏰ {stats.expiring} expiring soon
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Pack list ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-ga-text-primary mb-2">
          What's inside ({events.length})
        </h2>
        {events.length === 0 ? (
          <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5 text-center">
            <p className="text-sm text-ga-text-secondary mb-3">
              {location.name} is empty.
            </p>
            <button
              onClick={() => setAddOpen(true)}
              className="px-3 py-1.5 text-sm rounded bg-ga-accent text-white hover:opacity-90"
            >
              + Add something here
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {events.map((ev) => (
              <PackRow
                key={ev.id}
                event={ev}
                onUse={() => setUseTarget(ev)}
                onMove={() => setMoveTarget(ev)}
                onThrow={() => setThrowTarget(ev)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Modals */}
      <QuickAddModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        defaults={{ location: location.key === UNSORTED_KEY ? undefined : location.key }}
      />
      <MarkUsedModal
        open={!!useTarget}
        event={useTarget}
        onClose={() => setUseTarget(null)}
      />
      <MoveLocationModal
        open={!!moveTarget}
        event={moveTarget}
        onClose={() => setMoveTarget(null)}
      />
      <ThrowAwayModal
        open={!!throwTarget}
        event={throwTarget}
        onClose={() => setThrowTarget(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero banner — picks one most-urgent narrative.
// ---------------------------------------------------------------------------

function buildBanner(events: PurchaseEvent[]): {
  text: React.ReactNode;
  tone: 'red' | 'orange' | 'green' | 'quiet';
} {
  if (events.length === 0) {
    return {
      text: <span className="text-ga-text-secondary">📦 Nothing stored here right now.</span>,
      tone: 'quiet',
    };
  }
  const now = Date.now();
  let mostUrgent: { days: number; name: string } | null = null;
  for (const ev of events) {
    if (!ev.expiry_date) continue;
    const ms = new Date(ev.expiry_date).getTime();
    const days = Math.ceil((ms - now) / 86400000);
    if (!mostUrgent || days < mostUrgent.days) {
      mostUrgent = { days, name: ev.catalog_display };
    }
  }
  if (!mostUrgent) {
    return {
      text: (
        <span className="text-ga-text-secondary">
          ✓ {events.length} pack{events.length === 1 ? '' : 's'} stored, no expiry dates
          set.
        </span>
      ),
      tone: 'quiet',
    };
  }
  if (mostUrgent.days < 0) {
    return {
      text: (
        <span className="text-red-400 font-medium">
          ⚠ {mostUrgent.name} is past expiry — throw or eat today.
        </span>
      ),
      tone: 'red',
    };
  }
  if (mostUrgent.days === 0) {
    return {
      text: (
        <span className="text-red-400 font-medium">
          ⏰ {mostUrgent.name} expires <strong>today</strong>.
        </span>
      ),
      tone: 'red',
    };
  }
  if (mostUrgent.days <= 3) {
    return {
      text: (
        <span className="text-orange-400 font-medium">
          ⏰ {mostUrgent.name} expires in {mostUrgent.days} day
          {mostUrgent.days === 1 ? '' : 's'}.
        </span>
      ),
      tone: 'orange',
    };
  }
  if (mostUrgent.days <= 7) {
    return {
      text: (
        <span className="text-yellow-500">
          Soonest expiry: {mostUrgent.name} in {mostUrgent.days} days.
        </span>
      ),
      tone: 'quiet',
    };
  }
  return {
    text: (
      <span className="text-green-500">
        ✓ Fresh — soonest expiry {mostUrgent.days} days.
      </span>
    ),
    tone: 'green',
  };
}

// ---------------------------------------------------------------------------
// Pack row — focused per-pack actions. No analytics noise.
// ---------------------------------------------------------------------------

function PackRow({
  event,
  onUse,
  onMove,
  onThrow,
}: {
  event: PurchaseEvent;
  onUse: () => void;
  onMove: () => void;
  onThrow: () => void;
}) {
  const packSize = Math.max(1, event.pack_size ?? 1);
  const baseUnits = (event.quantity ?? 0) * packSize;
  const baseUnit = (event.base_unit_label || event.unit || 'unit').toLowerCase();
  const expiryInfo = expiryStatus(event.expiry_date);

  return (
    <li
      className={cn(
        'bg-ga-bg-card border rounded-lg p-3',
        expiryInfo.tone === 'expired' && 'border-red-500/40 bg-red-500/5',
        expiryInfo.tone === 'urgent' && 'border-orange-500/40 bg-orange-500/5',
        expiryInfo.tone === 'warn' && 'border-yellow-500/40',
        (expiryInfo.tone === 'fresh' || expiryInfo.tone === 'none') &&
          'border-ga-border',
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <Link
            to={`/catalog/${event.catalog_name_norm ?? ''}`}
            className="text-sm font-medium text-ga-text-primary hover:underline truncate block"
          >
            {event.catalog_display}
          </Link>
          <div className="text-xs text-ga-text-secondary mt-0.5 tabular-nums">
            {formatQty(baseUnits)} {baseUnit}{baseUnits === 1 ? '' : 's'}
            {packSize > 1 && (
              <span className="ml-1">
                ({event.quantity} × {packSize})
              </span>
            )}
          </div>
        </div>
        <span
          className={cn(
            'px-2 py-0.5 text-xs rounded font-medium flex-shrink-0',
            expiryInfo.cls,
          )}
        >
          {expiryInfo.label}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <ActionButton variant="primary" onClick={onUse}>
          Use…
        </ActionButton>
        <ActionButton onClick={onMove}>Move</ActionButton>
        <ActionButton onClick={onThrow} variant="danger">
          Throw
        </ActionButton>
      </div>
    </li>
  );
}

function ActionButton({
  onClick,
  children,
  variant = 'default',
}: {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'danger';
}) {
  const cls =
    variant === 'primary'
      ? 'bg-ga-accent text-white hover:opacity-90'
      : variant === 'danger'
      ? 'bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20'
      : 'bg-ga-bg-hover text-ga-text-primary border border-ga-border hover:bg-ga-bg-card';
  return (
    <button
      onClick={onClick}
      className={cn('px-3 py-1.5 text-xs rounded font-medium', cls)}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function expiryStatus(expiryDate: string | null | undefined): {
  label: string;
  cls: string;
  tone: 'expired' | 'urgent' | 'warn' | 'fresh' | 'none';
} {
  if (!expiryDate)
    return {
      label: 'no date',
      cls: 'bg-ga-bg-hover text-ga-text-secondary',
      tone: 'none',
    };
  const days = Math.ceil(
    (new Date(expiryDate).getTime() - Date.now()) / 86400000,
  );
  if (days < 0)
    return {
      label: `${Math.abs(days)}d ago`,
      cls: 'bg-red-500/15 text-red-500',
      tone: 'expired',
    };
  if (days === 0)
    return { label: 'today', cls: 'bg-red-500/15 text-red-500', tone: 'urgent' };
  if (days === 1)
    return {
      label: 'tomorrow',
      cls: 'bg-orange-500/15 text-orange-500',
      tone: 'urgent',
    };
  if (days <= 3)
    return {
      label: `${days}d`,
      cls: 'bg-orange-500/15 text-orange-500',
      tone: 'urgent',
    };
  if (days <= 7)
    return {
      label: `${days}d`,
      cls: 'bg-yellow-500/15 text-yellow-600',
      tone: 'warn',
    };
  return {
    label: `${days}d`,
    cls: 'bg-green-500/10 text-green-600',
    tone: 'fresh',
  };
}

function formatQty(n: number): string {
  if (n === Math.floor(n)) return String(n);
  return n.toFixed(1);
}

function byExpiryUrgency(a: PurchaseEvent, b: PurchaseEvent): number {
  const ta = a.expiry_date ? new Date(a.expiry_date).getTime() : Infinity;
  const tb = b.expiry_date ? new Date(b.expiry_date).getTime() : Infinity;
  return ta - tb;
}
