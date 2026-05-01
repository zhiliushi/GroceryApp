import { Link } from 'react-router-dom';
import { useHealthScore } from '@/api/queries/useWaste';
import { cn } from '@/utils/cn';

/**
 * Inventory stats card — companion to FrequentlyBoughtCard at the bottom
 * of the dashboard. Replaces the thin "InventoryGlance" pill row with
 * something that pulls weight as a card and gives the bottom row a
 * symmetric two-card layout.
 *
 * Shows four numbers, all derived from the existing health-score endpoint
 * so we don't add a new query:
 *   - In stock      = total active items
 *   - Available     = active items NOT expiring soon and NOT expired
 *                     (i.e. fresh stock the user can plan around)
 *   - Almost expired = items expiring in 3 days
 *   - Expired        = items past expiry date
 *
 * Each cell is a Link drilling to the relevant view, so a glance becomes
 * a one-tap action (e.g. tap the red Expired count → /health-score?tab=expired).
 */
export default function InventoryStatsCard() {
  const { data, isLoading } = useHealthScore();

  if (isLoading || !data) {
    return (
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
        <h4 className="text-sm font-semibold text-ga-text-primary mb-2">
          Your kitchen at a glance
        </h4>
        <p className="text-xs text-ga-text-secondary">Counting your stock…</p>
      </div>
    );
  }

  const c = data.components;
  const inStock =
    c.active_healthy + c.active_expiring_7d + c.active_expiring_3d + c.active_untracked;
  const available = c.active_healthy + c.active_untracked;
  const almostExpired = c.active_expiring_3d;
  const expired = c.active_expired;

  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h4 className="text-sm font-semibold text-ga-text-primary">
          Your kitchen at a glance
        </h4>
        <Link to="/my-items" className="text-xs text-ga-accent hover:underline">
          See all →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat
          to="/my-items"
          label="In stock"
          hint="all active items"
          value={inStock}
          tone="neutral"
        />
        <Stat
          to="/my-items?status=active"
          label="Fresh"
          hint="ready to use"
          value={available}
          tone="ok"
        />
        <Stat
          to="/health-score?tab=expiring"
          label="Use soon"
          hint="≤ 3 days to expiry"
          value={almostExpired}
          tone={almostExpired > 0 ? 'warn' : 'neutral'}
        />
        <Stat
          to="/health-score?tab=expired"
          label="Expired"
          hint="past expiry, act today"
          value={expired}
          tone={expired > 0 ? 'bad' : 'neutral'}
        />
      </div>
      {expired > 0 && (
        <p className="mt-3 text-[11px] text-red-400">
          ⚠ {expired} expired item{expired === 1 ? '' : 's'} — throw or eat today
          to keep totals honest.
        </p>
      )}
    </div>
  );
}

function Stat({
  to,
  label,
  hint,
  value,
  tone,
}: {
  to: string;
  label: string;
  hint: string;
  value: number;
  tone: 'neutral' | 'ok' | 'warn' | 'bad';
}) {
  const valueCls =
    tone === 'bad'
      ? 'text-red-500'
      : tone === 'warn'
      ? 'text-orange-500'
      : tone === 'ok'
      ? 'text-green-500'
      : 'text-ga-text-primary';
  const borderCls =
    tone === 'bad'
      ? 'border-red-500/30 bg-red-500/5'
      : tone === 'warn'
      ? 'border-orange-500/30 bg-orange-500/5'
      : 'border-ga-border bg-ga-bg-hover/30';
  return (
    <Link
      to={to}
      className={cn(
        'rounded-md border p-2.5 hover:opacity-90 transition-opacity',
        borderCls,
      )}
    >
      <div className={cn('text-2xl font-bold tabular-nums leading-none', valueCls)}>
        {value}
      </div>
      <div className="text-[11px] font-medium text-ga-text-primary mt-1">{label}</div>
      <div className="text-[10px] text-ga-text-secondary leading-tight">{hint}</div>
    </Link>
  );
}
