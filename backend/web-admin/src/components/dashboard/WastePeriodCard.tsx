import { useState } from 'react';
import { useWasteSummary } from '@/api/queries/useWaste';
import { formatCurrencyWithSymbol } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { SpendingPeriod } from '@/types/api';

/**
 * Single-period waste card — symmetrical with SpendingPeriodCard so
 * the user can scan "spent vs wasted" across week / month / last month.
 *
 * Headline number is the cost in the user's currency (the painful one);
 * expand reveals top-5 wasted items sorted by total_value descending,
 * not by count, because two RM-12 items thrown is the lesson, not ten
 * RM-0.50 items thrown.
 */
export default function WastePeriodCard({
  period,
  label,
  hint,
  highlight,
}: {
  period: SpendingPeriod;
  label: string;
  hint: string;
  highlight?: boolean;
}) {
  const { data, isLoading } = useWasteSummary(period);
  const [open, setOpen] = useState(false);

  const currency = data?.display_currency || 'SGD';
  const total = data?.thrown_value ?? 0;
  const count = data?.thrown_count ?? 0;
  const items = data?.top_wasted ?? [];

  return (
    <div
      className={cn(
        'rounded-lg border transition-colors',
        highlight
          ? 'bg-red-500/5 border-red-500/30'
          : 'bg-ga-bg-card border-ga-border',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-3 hover:bg-ga-bg-hover/40 rounded-lg"
        aria-expanded={open}
      >
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-xs text-ga-text-secondary leading-tight">{label}</div>
            <div className="text-[10px] text-ga-text-secondary leading-tight">{hint}</div>
          </div>
          <span className="text-[11px] text-ga-text-secondary ml-2">
            {open ? '▾' : '▸'}
          </span>
        </div>
        <div
          className={cn(
            'mt-1 font-bold tabular-nums',
            highlight ? 'text-2xl' : 'text-xl',
            count > 0 ? 'text-red-500' : 'text-ga-text-primary',
          )}
        >
          {isLoading ? '…' : formatCurrencyWithSymbol(total, currency)}
        </div>
        {!isLoading && count > 0 && (
          <div className="text-[10px] text-ga-text-secondary mt-0.5">
            {count} unit{count === 1 ? '' : 's'} thrown
          </div>
        )}
      </button>

      {open && (
        <div className="px-4 pb-3 -mt-1">
          <div className="border-t border-ga-border pt-2">
            {items.length === 0 ? (
              <p className="text-[11px] text-ga-text-secondary">
                Nothing wasted in this period — nice.
              </p>
            ) : (
              <>
                <div className="text-[11px] text-ga-text-secondary mb-1.5">
                  Top {Math.min(items.length, 5)} most expensive thrown
                </div>
                <ul className="space-y-1">
                  {items.slice(0, 5).map((it, idx) => (
                    <li
                      key={it.catalog_name_norm}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="flex items-center gap-1.5 truncate min-w-0">
                        <span className="text-ga-text-secondary font-mono w-3.5 flex-shrink-0">
                          {idx + 1}.
                        </span>
                        <span className="text-ga-text-primary truncate">
                          {it.display_name}
                        </span>
                        <span className="text-ga-text-secondary text-[10px] flex-shrink-0">
                          ×{formatQty(it.count)}
                        </span>
                      </span>
                      <span className="text-red-500 font-medium tabular-nums flex-shrink-0 ml-2">
                        {formatCurrencyWithSymbol(it.total_value, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatQty(n: number): string {
  return n === Math.floor(n) ? String(n) : n.toFixed(1);
}
