import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCatalogEntry } from '@/api/queries/useCatalog';
import { usePurchases } from '@/api/queries/usePurchases';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import Breadcrumbs from '@/components/shared/Breadcrumbs';
import QuickAddModal from '@/components/quickadd/QuickAddModal';
import MarkUsedModal from '@/components/waste/MarkUsedModal';
import MoveLocationModal from '@/components/waste/MoveLocationModal';
import ThrowAwayModal from '@/components/waste/ThrowAwayModal';
import GiveAwayModal from '@/components/waste/GiveAwayModal';
import { cn } from '@/utils/cn';
import type { PurchaseEvent } from '@/types/api';

/**
 * Inventory Detail page — the housewife's "what do I have right now?" view.
 *
 * Distinct from CatalogEntryPage on purpose:
 *   - CatalogEntryPage = manager view. Lifetime breakdown, price-by-store,
 *     waste rate, cadence, partial-action lineage, merge/delete actions.
 *   - InventoryDetailPage = current-state view. What's in the kitchen now,
 *     where it lives, when it expires, what to do with it.
 *
 * Conflating both into one toggleable page would make both worse: the
 * manager view buries action under analytics; the inventory view bloats
 * with history the user explicitly said she doesn't need here.
 *
 * Composition:
 *   1. Hero: name + total-available-in-base-units + most-urgent badge.
 *   2. Per-location chip strip — "6 in fridge · 12 in pantry".
 *   3. Per-pack list — each active event as a row with its own
 *      Use / Move / Throw / Give-away buttons. Sorted by expiry urgency
 *      so the action that matters most is at the top.
 *   4. "+ Buy more" primary CTA.
 *   5. Footer link to the full /catalog/:nameNorm view for users who
 *      want price history, waste analytics, etc.
 *
 * Data sources are minimal — this is the lightweight view:
 *   - useCatalogEntry(nameNorm) — for display name + unit_type.
 *   - usePurchases({status:'active', catalog_name_norm}) — for active
 *     events only. No waste/used/transferred queries.
 */
export default function InventoryDetailPage() {
  const { nameNorm } = useParams<{ nameNorm: string }>();
  const { data: entry, isLoading: entryLoading } = useCatalogEntry(nameNorm);
  const { data: purchases, isLoading: purchasesLoading } = usePurchases({
    status: 'active',
    catalog_name_norm: nameNorm,
    limit: 100,
  });

  const [addOpen, setAddOpen] = useState(false);
  const [useTarget, setUseTarget] = useState<PurchaseEvent | null>(null);
  const [moveTarget, setMoveTarget] = useState<PurchaseEvent | null>(null);
  const [throwTarget, setThrowTarget] = useState<PurchaseEvent | null>(null);
  const [giveTarget, setGiveTarget] = useState<PurchaseEvent | null>(null);

  const events = useMemo(() => {
    const items = purchases?.items ?? [];
    return [...items].sort(byExpiryUrgency);
  }, [purchases]);

  const summary = useMemo(() => {
    let totalBaseUnits = 0;
    let mostUrgent: { days: number; eventId: string } | null = null;
    const locations: Record<string, number> = {};
    for (const ev of events) {
      const packSize = Math.max(1, ev.pack_size ?? 1);
      const baseUnits = (ev.quantity ?? 0) * packSize;
      totalBaseUnits += baseUnits;
      const loc = ev.location || 'Unsorted';
      locations[loc] = (locations[loc] || 0) + baseUnits;
      if (ev.expiry_date) {
        const days = Math.ceil(
          (new Date(ev.expiry_date).getTime() - Date.now()) / 86400000,
        );
        if (!mostUrgent || days < mostUrgent.days) {
          mostUrgent = { days, eventId: ev.id };
        }
      }
    }
    return { totalBaseUnits, mostUrgent, locations };
  }, [events]);

  if (entryLoading || purchasesLoading) {
    return <LoadingSpinner text="Loading…" />;
  }

  if (!entry) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
          Could not find this item in your catalog.
        </div>
      </div>
    );
  }

  const baseUnitLabel =
    (events[0]?.base_unit_label || events[0]?.unit || 'unit').toLowerCase();
  const unitType = entry.unit_type ?? 'count';

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'My Items', to: '/my-items' },
          { label: entry.display_name },
        ]}
      />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div
        className={cn(
          'bg-ga-bg-card border rounded-xl p-5 space-y-3',
          summary.mostUrgent && summary.mostUrgent.days < 0
            ? 'border-red-500/40'
            : summary.mostUrgent && summary.mostUrgent.days <= 3
            ? 'border-orange-500/40'
            : 'border-ga-border',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-ga-text-primary truncate">
              {entry.display_name}
            </h1>
            <p className="text-xs text-ga-text-secondary mt-0.5">
              {events.length === 0
                ? 'Out of stock'
                : `${formatQty(summary.totalBaseUnits)} ${baseUnitLabel}${summary.totalBaseUnits === 1 ? '' : 's'} available`}
              {events.length > 0 && (
                <>
                  {' · '}
                  {events.length} pack{events.length === 1 ? '' : 's'}
                </>
              )}
              {' · '}
              <span className="capitalize">{unitType}</span>
            </p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex-shrink-0 px-3 py-1.5 text-sm rounded bg-ga-accent text-white hover:opacity-90 font-medium"
          >
            + Buy more
          </button>
        </div>

        {/* Status banner — one of red / orange / accent / quiet */}
        <StatusBanner mostUrgent={summary.mostUrgent} stockCount={events.length} />

        {/* Per-location chips */}
        {Object.keys(summary.locations).length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {Object.entries(summary.locations)
              .sort((a, b) => b[1] - a[1])
              .map(([loc, qty]) => (
                <span
                  key={loc}
                  className="px-2 py-1 text-xs rounded bg-ga-bg-hover border border-ga-border text-ga-text-primary"
                >
                  <span className="text-ga-text-secondary">{loc}:</span>{' '}
                  <span className="font-medium tabular-nums">
                    {formatQty(qty)}
                  </span>
                </span>
              ))}
          </div>
        )}
      </div>

      {/* ── Per-pack list ────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-ga-text-primary mb-2">
          Your packs ({events.length})
        </h2>
        {events.length === 0 ? (
          <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5 text-center">
            <p className="text-sm text-ga-text-secondary mb-3">
              You're out of {entry.display_name.toLowerCase()}.
            </p>
            <button
              onClick={() => setAddOpen(true)}
              className="px-3 py-1.5 text-sm rounded bg-ga-accent text-white hover:opacity-90"
            >
              + Buy more
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
                onGive={() => setGiveTarget(ev)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Footer link to the management view (price history, lifetime
          breakdown, waste analytics — everything we deliberately hid here). */}
      <div className="pt-2">
        <Link
          to={`/catalog/${entry.name_norm}`}
          className="text-xs text-ga-accent hover:underline"
        >
          Full price history & analysis →
        </Link>
      </div>

      {/* Modals */}
      <QuickAddModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        defaults={{ catalogEntry: entry }}
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
      <GiveAwayModal
        open={!!giveTarget}
        event={giveTarget}
        onClose={() => setGiveTarget(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero status banner — picks the most-urgent narrative for this catalog row.
// ---------------------------------------------------------------------------

function StatusBanner({
  mostUrgent,
  stockCount,
}: {
  mostUrgent: { days: number; eventId: string } | null;
  stockCount: number;
}) {
  if (stockCount === 0) {
    return (
      <div className="text-sm text-ga-text-secondary">
        📦 Nothing in stock right now.
      </div>
    );
  }
  if (!mostUrgent) {
    return (
      <div className="text-sm text-ga-text-secondary">
        ✓ All stocked, no expiry dates set on packs.
      </div>
    );
  }
  if (mostUrgent.days < 0) {
    return (
      <div className="text-sm font-medium text-red-400">
        ⚠ Some packs are past expiry — throw or eat them today.
      </div>
    );
  }
  if (mostUrgent.days === 0) {
    return (
      <div className="text-sm font-medium text-red-400">
        ⏰ A pack expires <strong>today</strong> — use it first.
      </div>
    );
  }
  if (mostUrgent.days <= 3) {
    return (
      <div className="text-sm font-medium text-orange-400">
        ⏰ A pack expires in {mostUrgent.days} day{mostUrgent.days === 1 ? '' : 's'} — use it first.
      </div>
    );
  }
  if (mostUrgent.days <= 7) {
    return (
      <div className="text-sm text-yellow-500">
        Soonest expiry: {mostUrgent.days} days.
      </div>
    );
  }
  return (
    <div className="text-sm text-green-500">
      ✓ Fresh — soonest expiry {mostUrgent.days} days.
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single-pack row — focused on the per-pack actions (Use / Move / Throw /
// Give). Big tap targets, color-coded urgency, no analytics noise.
// ---------------------------------------------------------------------------

function PackRow({
  event,
  onUse,
  onMove,
  onThrow,
  onGive,
}: {
  event: PurchaseEvent;
  onUse: () => void;
  onMove: () => void;
  onThrow: () => void;
  onGive: () => void;
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
          <div className="text-sm font-medium text-ga-text-primary tabular-nums">
            {formatQty(baseUnits)} {baseUnit}{baseUnits === 1 ? '' : 's'}
            {packSize > 1 && (
              <span className="text-ga-text-secondary text-xs ml-1">
                ({event.quantity} × {packSize})
              </span>
            )}
          </div>
          <div className="text-xs text-ga-text-secondary mt-0.5">
            {event.location || 'Unsorted'}
            {event.date_bought && (
              <> · bought {formatBoughtDate(event.date_bought)}</>
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
        <ActionButton onClick={onGive}>Give away</ActionButton>
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

function formatBoughtDate(iso: string): string {
  const t = new Date(iso).getTime();
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(t).toLocaleDateString();
}

function byExpiryUrgency(a: PurchaseEvent, b: PurchaseEvent): number {
  const ta = a.expiry_date ? new Date(a.expiry_date).getTime() : Infinity;
  const tb = b.expiry_date ? new Date(b.expiry_date).getTime() : Infinity;
  return ta - tb;
}
