import { cn } from '@/utils/cn';
import type { CatalogOverviewLifetime, CatalogOverviewWasteRate } from '@/types/api';

interface Props {
  lifetime: CatalogOverviewLifetime;
  wasteRate: CatalogOverviewWasteRate;
  baseUnitLabel?: string;
}

/**
 * Quantity-based lifetime breakdown (catalog_evolution.md §7 Phase E).
 * Shows total + each terminal-state qty + per-state percentages, all measured
 * by quantity, NOT event count. Headline waste % is `thrown_qty / total_qty`.
 */
export default function LifetimeUnitBreakdown({
  lifetime,
  wasteRate,
  baseUnitLabel = 'unit',
}: Props) {
  const total = lifetime.total_qty;
  const segments = [
    { key: 'active', qty: lifetime.active_qty, pct: wasteRate.active_pct, label: 'Active', color: 'bg-green-500' },
    { key: 'used', qty: lifetime.used_qty, pct: wasteRate.used_pct, label: 'Used', color: 'bg-ga-accent' },
    { key: 'thrown', qty: lifetime.thrown_qty, pct: wasteRate.thrown_pct, label: 'Thrown', color: 'bg-red-500' },
    {
      key: 'given',
      qty: lifetime.given_qty + lifetime.transferred_qty,
      pct: wasteRate.given_pct,
      label: 'Given / moved',
      color: 'bg-orange-400',
    },
  ];

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-semibold text-ga-text-primary">Lifetime breakdown</h3>
        <p className="text-xs text-ga-text-secondary">
          Waste rate <span className={cn('font-medium', wasteRate.thrown_pct > 20 ? 'text-red-400' : 'text-ga-text-primary')}>
            {wasteRate.thrown_pct.toFixed(1)}%
          </span>{' '}
          (by quantity)
        </p>
      </div>

      {/* Stacked horizontal bar */}
      {total > 0 ? (
        <>
          <div className="h-2 rounded-full overflow-hidden flex bg-ga-bg-hover">
            {segments.map((s) =>
              s.qty > 0 ? (
                <div
                  key={s.key}
                  className={cn('h-full', s.color)}
                  style={{ width: `${s.pct}%` }}
                  title={`${s.label}: ${s.qty} ${baseUnitLabel} (${s.pct}%)`}
                />
              ) : null,
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
            {segments.map((s) => (
              <div key={s.key} className="flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-sm', s.color)} />
                <div className="text-xs">
                  <div className="text-ga-text-primary">
                    {s.qty.toFixed(s.qty % 1 === 0 ? 0 : 1)} {baseUnitLabel}
                    {s.qty === 1 ? '' : 's'}
                  </div>
                  <div className="text-ga-text-secondary">
                    {s.label} · {s.pct.toFixed(0)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-ga-text-secondary">
            Total: {total.toFixed(total % 1 === 0 ? 0 : 1)} {baseUnitLabel}{total === 1 ? '' : 's'} across all events.
          </p>
        </>
      ) : (
        <p className="text-xs text-ga-text-secondary italic">No quantity data yet.</p>
      )}
    </div>
  );
}
