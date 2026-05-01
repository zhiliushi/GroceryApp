import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePurchases } from '@/api/queries/usePurchases';
import MarkUsedModal from '@/components/waste/MarkUsedModal';
import type { PurchaseEvent } from '@/types/api';

/**
 * "Use these soon" card — the second question a Malaysian housewife asks
 * after spending: what's about to go bad, and where is it. Replaces the
 * old "Inventory Health 73" score, which was abstract and didn't tell
 * her what to do next.
 *
 * The card shows up to 6 active items expiring in the next 3 days,
 * grouped by location ("3 in Fridge, 2 in Pantry") so she knows where
 * to look. One-tap "Use" opens the MarkUsedModal — same flow that
 * replaced the destructive Use-1 button.
 *
 * Items already past their date appear in a separate red strip at the
 * top — "throw or eat them today" is a different action than "use the
 * lettuce by Friday."
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

  if (isLoading) {
    return (
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
        <h4 className="text-sm font-semibold text-ga-text-primary mb-2">Use these soon</h4>
        <p className="text-xs text-ga-text-secondary">Loading…</p>
      </div>
    );
  }

  if (expired.length === 0 && soon.length === 0) {
    return (
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
        <h4 className="text-sm font-semibold text-ga-text-primary mb-1">Use these soon</h4>
        <p className="text-xs text-ga-text-secondary">
          ✓ Nothing expires in the next 3 days. Fresh week ahead.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <h4 className="text-sm font-semibold text-ga-text-primary">Use these soon</h4>
          <Link to="/my-items" className="text-xs text-ga-accent hover:underline">
            See all →
          </Link>
        </div>

        {expired.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-md p-2.5">
            <div className="text-xs font-medium text-red-400 mb-1.5">
              ⚠ {expired.length} already past expiry — throw or eat today
            </div>
            <LocationSummary events={expired} />
            <ItemList events={expired.slice(0, 4)} onUse={setUseTarget} mode="expired" />
            {expired.length > 4 && (
              <Link to="/my-items" className="text-[11px] text-red-400 hover:underline mt-1 inline-block">
                +{expired.length - 4} more →
              </Link>
            )}
          </div>
        )}

        {soon.length > 0 && (
          <div>
            <div className="text-xs font-medium text-orange-400 mb-1.5">
              ⏰ {soon.length} expiring in 3 days
            </div>
            <LocationSummary events={soon} />
            <ItemList events={soon.slice(0, 6)} onUse={setUseTarget} mode="soon" />
            {soon.length > 6 && (
              <Link to="/my-items" className="text-[11px] text-ga-accent hover:underline mt-1 inline-block">
                +{soon.length - 6} more →
              </Link>
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

function LocationSummary({ events }: { events: PurchaseEvent[] }) {
  const counts: Record<string, number> = {};
  for (const ev of events) {
    const loc = ev.location || 'Unsorted';
    counts[loc] = (counts[loc] || 0) + 1;
  }
  const parts = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([loc, n]) => `${n} in ${loc}`);
  return (
    <p className="text-[11px] text-ga-text-secondary mb-1.5">{parts.join(' · ')}</p>
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
            onClick={() => onUse(ev)}
            className="px-2 py-0.5 text-[11px] rounded bg-ga-accent/20 text-ga-accent hover:bg-ga-accent/30 flex-shrink-0"
          >
            Use…
          </button>
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
