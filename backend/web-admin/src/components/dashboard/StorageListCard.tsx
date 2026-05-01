import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLocations } from '@/api/queries/useLocations';
import { usePurchases } from '@/api/queries/usePurchases';
import { cn } from '@/utils/cn';
import type { LocationItem, PurchaseEvent } from '@/types/api';

const UNSORTED_KEY = '_unsorted';

/**
 * Storage list card — dashboard widget that shows the user's storage
 * locations with at-a-glance counts and urgency, each row clickable
 * into the per-location StorageDetailPage.
 *
 * Mirrors how she actually thinks: "what's in the fridge? what's in
 * the pantry?" — not "which catalog rows do I have?".
 *
 * Locations come from useLocations() (the registered list managed at
 * /storage). Purchases come from useUsages-active query, cache-shared
 * with ExpiringSoonCard.
 *
 * Empty locations are shown but de-emphasised — they're still useful
 * as "+ Add to Fridge" entry points.
 */
export default function StorageListCard() {
  const { locations, isLoading: locLoading } = useLocations();
  const { data, isLoading: purchasesLoading } = usePurchases({
    status: 'active',
    limit: 200,
  });

  const rows = useMemo(
    () => buildRows(locations, data?.items ?? []),
    [locations, data],
  );
  const isLoading = locLoading || purchasesLoading;

  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-sm font-semibold text-ga-text-primary">
          Your storage
          <span className="ml-2 text-xs font-normal text-ga-text-secondary">
            ({rows.length} location{rows.length === 1 ? '' : 's'})
          </span>
        </h4>
        <Link to="/storage" className="text-xs text-ga-accent hover:underline">
          Manage →
        </Link>
      </div>
      {isLoading ? (
        <p className="text-xs text-ga-text-secondary">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-ga-text-secondary">
          No storage locations defined yet.{' '}
          <Link to="/storage" className="text-ga-accent hover:underline">
            Add some →
          </Link>
        </p>
      ) : (
        <ul className="divide-y divide-ga-border">
          {rows.map((r) => (
            <StorageRow key={r.key} row={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function StorageRow({ row }: { row: StorageRowData }) {
  const empty = row.count === 0;
  return (
    <Link
      to={`/storage/${row.key}`}
      className={cn(
        'flex items-center gap-3 py-2 px-1 -mx-1 rounded hover:bg-ga-bg-hover/40',
        empty && 'opacity-60',
      )}
    >
      <span
        className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center text-lg"
        style={{ backgroundColor: row.color + '22', color: row.color }}
      >
        {row.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-ga-text-primary truncate">{row.name}</div>
        <div className="text-[11px] text-ga-text-secondary">
          {empty
            ? 'Empty — tap to add'
            : `${row.count} pack${row.count === 1 ? '' : 's'}`}
        </div>
      </div>
      <UrgencyChip days={row.minDaysToExpiry} />
      {row.expired > 0 && (
        <span className="px-1.5 py-0.5 text-[10px] rounded bg-red-500/15 text-red-500 font-medium tabular-nums">
          {row.expired} expired
        </span>
      )}
      <span className="text-xs text-ga-text-secondary flex-shrink-0">›</span>
    </Link>
  );
}

function UrgencyChip({ days }: { days: number | null }) {
  if (days === null)
    return <span className="text-[10px] text-ga-text-secondary">—</span>;
  const cls =
    days < 0
      ? 'bg-red-500/15 text-red-500'
      : days <= 1
      ? 'bg-red-500/15 text-red-500'
      : days <= 3
      ? 'bg-orange-500/15 text-orange-500'
      : days <= 7
      ? 'bg-yellow-500/15 text-yellow-600'
      : 'bg-green-500/10 text-green-600';
  const label =
    days < 0
      ? `${Math.abs(days)}d ago`
      : days === 0
      ? 'today'
      : days === 1
      ? 'tomorrow'
      : `${days}d`;
  return (
    <span className={cn('px-1.5 py-0.5 text-[10px] rounded font-medium', cls)}>
      {label}
    </span>
  );
}

interface StorageRowData {
  key: string;
  name: string;
  icon: string;
  color: string;
  count: number;
  expired: number;
  minDaysToExpiry: number | null;
}

/**
 * Build one row per registered location, plus an "Unsorted" row when
 * any active event has no location. Sort: locations with urgent items
 * first, then registered locations in their configured order, then
 * Unsorted at the end.
 */
function buildRows(
  locations: LocationItem[],
  events: PurchaseEvent[],
): StorageRowData[] {
  const now = Date.now();
  const byLoc = new Map<string, PurchaseEvent[]>();

  for (const ev of events) {
    const key = ev.location || UNSORTED_KEY;
    const arr = byLoc.get(key) ?? [];
    arr.push(ev);
    byLoc.set(key, arr);
  }

  const computed: StorageRowData[] = [];

  // Registered locations first (in configured sort order).
  const registered = [...locations].sort((a, b) => a.sort - b.sort);
  for (const loc of registered) {
    const evs = byLoc.get(loc.key) ?? [];
    computed.push(toRow({ key: loc.key, name: loc.name, icon: loc.icon, color: loc.color }, evs, now));
  }

  // Unsorted at the end if there are any (don't add row when count is 0).
  const unsorted = byLoc.get(UNSORTED_KEY) ?? [];
  if (unsorted.length > 0) {
    computed.push(
      toRow(
        { key: UNSORTED_KEY, name: 'Unsorted', icon: '📥', color: '#6B7280' },
        unsorted,
        now,
      ),
    );
  }

  // Re-sort: rows with most urgent items first; empty registered rows go last.
  computed.sort((a, b) => {
    if (a.count === 0 && b.count === 0) return 0;
    if (a.count === 0) return 1;
    if (b.count === 0) return -1;
    if (a.minDaysToExpiry === null && b.minDaysToExpiry === null) return 0;
    if (a.minDaysToExpiry === null) return 1;
    if (b.minDaysToExpiry === null) return -1;
    return a.minDaysToExpiry - b.minDaysToExpiry;
  });

  return computed;
}

function toRow(
  base: { key: string; name: string; icon: string; color: string },
  events: PurchaseEvent[],
  now: number,
): StorageRowData {
  let minMs: number | null = null;
  let expired = 0;
  for (const ev of events) {
    if (!ev.expiry_date) continue;
    const ms = new Date(ev.expiry_date).getTime();
    if (Number.isNaN(ms)) continue;
    if (ms < now) expired++;
    if (minMs === null || ms < minMs) minMs = ms;
  }
  const minDaysToExpiry =
    minMs === null ? null : Math.ceil((minMs - now) / 86400000);
  return {
    ...base,
    count: events.length,
    expired,
    minDaysToExpiry,
  };
}
