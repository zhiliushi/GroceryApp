import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePurchases } from '@/api/queries/usePurchases';
import MarkUsedModal from '@/components/waste/MarkUsedModal';
import AddToShoppingListButton from '@/components/shopping-lists/AddToShoppingListButton';
import { cn } from '@/utils/cn';
import type { PurchaseEvent } from '@/types/api';

/**
 * "Use these soon" card — collapsed by default.
 *
 * Headline answers the urgency question at a glance: how many already
 * expired, how many in 3 days, where they live. The full per-item list
 * (with one-tap Use…) is one click away under a toggle so the dashboard
 * stays uncluttered when nothing's on fire.
 *
 * If anything is already past expiry the card defaults to OPEN — that's
 * a "throw or eat today" situation worth surfacing without an extra
 * click. Otherwise it stays collapsed.
 */
export default function ExpiringSoonCard() {
  const { data, isLoading } = usePurchases({ status: 'active', limit: 200 });
  const [useTarget, setUseTarget] = useState<PurchaseEvent | null>(null);

  const { expired, soon } = useMemo(() => {
    const out = { expired: [] as PurchaseEvent[], soon: [] as PurchaseEvent[] };
    if (!data?.items) return out;
    const now = Date.now();
    for (const ev of data.items) {
      if (!ev.expiry_date) continue;
      const t = new Date(ev.expiry_date).getTime();
      if (Number.isNaN(t)) continue;
      const days = Math.ceil((t - now) / 86400000);
      if (days < 0) out.expired.push(ev);
      else if (days <= 3) out.soon.push(ev);
    }
    out.expired.sort(byExpiry);
    out.soon.sort(byExpiry);
    return out;
  }, [data]);

  // Auto-expand when there's an "already expired" situation — that's
  // urgent enough that a click to see what should be a passive surface.
  const [open, setOpen] = useState(false);
  const shouldDefault = expired.length > 0;
  const isOpen = open || shouldDefault;

  const totalUrgent = expired.length + soon.length;

  if (isLoading) {
    return (
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
        <h4 className="text-sm font-semibold text-ga-text-primary mb-1">Use these soon</h4>
        <p className="text-xs text-ga-text-secondary">Loading…</p>
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          'rounded-lg border',
          expired.length > 0
            ? 'bg-red-500/5 border-red-500/30'
            : soon.length > 0
            ? 'bg-orange-500/5 border-orange-500/30'
            : 'bg-ga-bg-card border-ga-border',
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full text-left px-4 py-3 rounded-lg hover:bg-ga-bg-hover/40"
          aria-expanded={isOpen}
        >
          <div className="flex items-baseline justify-between">
            <h4 className="text-sm font-semibold text-ga-text-primary">Use these soon</h4>
            <span className="text-[11px] text-ga-text-secondary">
              {isOpen ? '▾ hide' : '▸ show'}
            </span>
          </div>
          <p className="mt-1 text-xs text-ga-text-secondary">
            <Headline expired={expired.length} soon={soon.length} />
          </p>
          {totalUrgent > 0 && (
            <LocationLine events={[...expired, ...soon]} />
          )}
        </button>

        {isOpen && totalUrgent > 0 && (
          <div className="px-4 pb-3 -mt-1 space-y-3">
            {expired.length > 0 && (
              <div className="border-t border-ga-border pt-2">
                <div className="text-xs font-medium text-red-400 mb-1.5">
                  ⚠ {expired.length} already past expiry — throw or eat today
                </div>
                <ItemList events={expired.slice(0, 4)} onUse={setUseTarget} mode="expired" />
                {expired.length > 4 && (
                  <Link to="/my-items" className="text-[11px] text-red-400 hover:underline mt-1 inline-block">
                    +{expired.length - 4} more →
                  </Link>
                )}
              </div>
            )}

            {soon.length > 0 && (
              <div className={cn(expired.length === 0 && 'border-t border-ga-border pt-2')}>
                <div className="text-xs font-medium text-orange-400 mb-1.5">
                  ⏰ {soon.length} expiring in 3 days
                </div>
                <ItemList events={soon.slice(0, 6)} onUse={setUseTarget} mode="soon" />
                {soon.length > 6 && (
                  <Link to="/my-items" className="text-[11px] text-ga-accent hover:underline mt-1 inline-block">
                    +{soon.length - 6} more →
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <MarkUsedModal
        open={!!useTarget}
        event={useTarget}
        onClose={() => setUseTarget(null)}
      />
    </>
  );
}

function Headline({ expired, soon }: { expired: number; soon: number }) {
  if (expired === 0 && soon === 0) {
    return <span className="text-green-500">✓ Nothing expires in the next 3 days. Fresh week ahead.</span>;
  }
  if (expired > 0 && soon > 0) {
    return (
      <>
        <span className="text-red-400 font-medium">{expired} expired</span>
        <span className="text-ga-text-secondary"> · </span>
        <span className="text-orange-400 font-medium">{soon} expiring in 3 days</span>
      </>
    );
  }
  if (expired > 0) {
    return (
      <span className="text-red-400 font-medium">
        {expired} already past expiry — throw or eat today
      </span>
    );
  }
  return (
    <span className="text-orange-400 font-medium">
      {soon} expiring in 3 days
    </span>
  );
}

function LocationLine({ events }: { events: PurchaseEvent[] }) {
  const counts: Record<string, number> = {};
  for (const ev of events) {
    const loc = ev.location || 'Unsorted';
    counts[loc] = (counts[loc] || 0) + 1;
  }
  const parts = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([loc, n]) => `${n} in ${loc}`);
  if (parts.length === 0) return null;
  return (
    <p className="mt-0.5 text-[11px] text-ga-text-secondary">{parts.join(' · ')}</p>
  );
}

function ItemList({
  events,
  onUse,
  mode,
}: {
  events: PurchaseEvent[];
  onUse: (e: PurchaseEvent) => void;
  mode: 'expired' | 'soon';
}) {
  return (
    <ul className="space-y-1">
      {events.map((ev) => (
        <li key={ev.id} className="flex items-center justify-between text-xs gap-2">
          <span className="flex-1 min-w-0 truncate text-ga-text-primary">
            {ev.catalog_display}
            {ev.location && (
              <span className="text-ga-text-secondary"> · {ev.location}</span>
            )}
          </span>
          <span className={mode === 'expired' ? 'text-red-400' : 'text-orange-400'}>
            {expiryLabel(ev.expiry_date)}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUse(ev);
            }}
            className="px-2 py-0.5 text-[11px] rounded bg-ga-accent/20 text-ga-accent hover:bg-ga-accent/30 flex-shrink-0"
          >
            Use…
          </button>
          <AddToShoppingListButton
            entry={{
              display_name: ev.catalog_display || '(item)',
              name_norm: ev.catalog_name_norm,
              barcode: ev.barcode,
            }}
            className="px-2 py-0.5 text-[11px] rounded border border-ga-border text-ga-text-secondary hover:bg-ga-bg-hover flex-shrink-0"
            label="+ list"
          />
        </li>
      ))}
    </ul>
  );
}

function expiryLabel(expiryDate: string | null): string {
  if (!expiryDate) return '';
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `${days}d`;
}

function byExpiry(a: PurchaseEvent, b: PurchaseEvent): number {
  const ta = a.expiry_date ? new Date(a.expiry_date).getTime() : Infinity;
  const tb = b.expiry_date ? new Date(b.expiry_date).getTime() : Infinity;
  return ta - tb;
}
