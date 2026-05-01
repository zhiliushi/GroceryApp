import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePurchases } from '@/api/queries/usePurchases';
import { cn } from '@/utils/cn';
import type { PurchaseEvent } from '@/types/api';

const DASH_LIMIT = 8; // catalog rows shown on the dashboard before "+N more"

/**
 * Inventory list card — replaces the abstract InventoryStatsCard.
 *
 * Real housewife mental model: she doesn't think "I have 26 active items
 * and 3 expiring." She thinks "what do I have, and which one needs
 * attention first?". So we list catalog rows directly, sorted by
 * urgency, with a one-tap path to the per-item detail page.
 *
 * Each row is a Link to /inventory/:nameNorm — the new lightweight
 * per-item dashboard. CatalogEntryPage at /catalog/:nameNorm is still
 * available (full price/waste analysis) but isn't the default landing
 * — it's reached via "Full price history & analysis →" on the
 * inventory detail page.
 *
 * Data sourced from useUsages active list (cache-shared with
 * ExpiringSoonCard so this widget is essentially free).
 */
export default function InventoryListCard() {
  const { data, isLoading } = usePurchases({ status: 'active', limit: 200 });

  const groups = useMemo(() => groupByCatalog(data?.items ?? []), [data]);

  if (isLoading) {
    return (
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
        <h4 className="text-sm font-semibold text-ga-text-primary mb-2">
          What's in your kitchen
        </h4>
        <p className="text-xs text-ga-text-secondary">Loading…</p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
        <div className="flex items-baseline justify-between mb-2">
          <h4 className="text-sm font-semibold text-ga-text-primary">
            What's in your kitchen
          </h4>
          <Link to="/my-items" className="text-xs text-ga-accent hover:underline">
            Add items →
          </Link>
        </div>
        <p className="text-xs text-ga-text-secondary">
          No items in stock yet. Tap <code>+ Add item</code> at the top to start.
        </p>
      </div>
    );
  }

  const visible = groups.slice(0, DASH_LIMIT);
  const hidden = groups.length - visible.length;

  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-sm font-semibold text-ga-text-primary">
          What's in your kitchen
          <span className="ml-2 text-xs font-normal text-ga-text-secondary">
            ({groups.length} item{groups.length === 1 ? '' : 's'})
          </span>
        </h4>
        <Link to="/my-items" className="text-xs text-ga-accent hover:underline">
          See all →
        </Link>
      </div>
      <ul className="divide-y divide-ga-border">
        {visible.map((g) => (
          <InventoryRow key={g.nameNorm} group={g} />
        ))}
      </ul>
      {hidden > 0 && (
        <Link
          to="/my-items"
          className="mt-2 block text-xs text-ga-accent hover:underline"
        >
          + {hidden} more →
        </Link>
      )}
    </div>
  );
}

function InventoryRow({ group }: { group: CatalogGroup }) {
  return (
    <Link
      to={`/inventory/${group.nameNorm}`}
      className="flex items-center justify-between gap-2 py-2 px-1 -mx-1 rounded hover:bg-ga-bg-hover/40"
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm text-ga-text-primary truncate">
          {group.displayName}
        </div>
        <div className="text-[11px] text-ga-text-secondary truncate">
          {group.locationLabel}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-ga-text-secondary tabular-nums">
          {formatQty(group.totalBaseUnits)} {group.unitLabel}
          {group.totalBaseUnits === 1 ? '' : 's'}
        </span>
        <ExpiryChip days={group.minDaysToExpiry} />
        <span className="text-xs text-ga-text-secondary">›</span>
      </div>
    </Link>
  );
}

function ExpiryChip({ days }: { days: number | null }) {
  if (days === null) {
    return (
      <span className="px-1.5 py-0.5 text-[10px] rounded bg-ga-bg-hover text-ga-text-secondary">
        no date
      </span>
    );
  }
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

interface CatalogGroup {
  nameNorm: string;
  displayName: string;
  totalBaseUnits: number;
  unitLabel: string;
  locationLabel: string;
  minDaysToExpiry: number | null; // null = no expiry across all packs
}

/**
 * Group active events by catalog row, then sort the groups by urgency
 * (smallest minDaysToExpiry first; null/none-set goes last).
 */
function groupByCatalog(events: PurchaseEvent[]): CatalogGroup[] {
  const map = new Map<string, {
    nameNorm: string;
    displayName: string;
    totalBaseUnits: number;
    unitLabels: Set<string>;
    locations: Map<string, number>;
    minMs: number | null;
  }>();
  const now = Date.now();

  for (const ev of events) {
    const key = ev.catalog_name_norm;
    if (!key) continue;
    const packSize = Math.max(1, ev.pack_size ?? 1);
    const baseUnits = (ev.quantity ?? 0) * packSize;
    const unit = (ev.base_unit_label || ev.unit || 'unit').toLowerCase();
    const loc = ev.location || 'Unsorted';

    let g = map.get(key);
    if (!g) {
      g = {
        nameNorm: key,
        displayName: ev.catalog_display || key,
        totalBaseUnits: 0,
        unitLabels: new Set(),
        locations: new Map(),
        minMs: null,
      };
      map.set(key, g);
    }
    g.totalBaseUnits += baseUnits;
    g.unitLabels.add(unit);
    g.locations.set(loc, (g.locations.get(loc) || 0) + baseUnits);
    if (ev.expiry_date) {
      const ms = new Date(ev.expiry_date).getTime();
      if (!Number.isNaN(ms) && (g.minMs === null || ms < g.minMs)) {
        g.minMs = ms;
      }
    }
  }

  const out: CatalogGroup[] = [];
  for (const g of map.values()) {
    const days =
      g.minMs === null ? null : Math.ceil((g.minMs - now) / 86400000);
    out.push({
      nameNorm: g.nameNorm,
      displayName: g.displayName,
      totalBaseUnits: g.totalBaseUnits,
      // Mixed units across a catalog (e.g. someone bought eggs in 6-pack
      // and 12-pack with different unit_labels) — fall back to "unit".
      unitLabel: g.unitLabels.size === 1 ? Array.from(g.unitLabels)[0] : 'unit',
      locationLabel: locationSummary(g.locations),
      minDaysToExpiry: days,
    });
  }

  // Sort: most urgent first (smallest days), null/no-expiry rows last.
  out.sort((a, b) => {
    if (a.minDaysToExpiry === null && b.minDaysToExpiry === null) {
      return a.displayName.localeCompare(b.displayName);
    }
    if (a.minDaysToExpiry === null) return 1;
    if (b.minDaysToExpiry === null) return -1;
    return a.minDaysToExpiry - b.minDaysToExpiry;
  });

  return out;
}

function locationSummary(locations: Map<string, number>): string {
  if (locations.size === 0) return '—';
  const entries = Array.from(locations.entries()).sort((a, b) => b[1] - a[1]);
  return entries.map(([loc]) => loc).join(' · ');
}

function formatQty(n: number): string {
  if (n === Math.floor(n)) return String(n);
  return n.toFixed(1);
}
