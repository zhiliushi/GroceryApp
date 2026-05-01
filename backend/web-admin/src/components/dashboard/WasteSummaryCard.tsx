import { Link } from 'react-router-dom';
import { useWasteSummary } from '@/api/queries/useWaste';
import { formatCurrencyWithSymbol } from '@/utils/format';

/**
 * "Wasted this month" — plain-language version of the old WasteSummary.
 *
 * Two changes from the previous design:
 *   1. Lead with the cost in the user's currency, not the count.
 *      "Wasted RM 13.02" lands harder than "7 thrown" — it's the dollar
 *      value of guilt that motivates behavior change.
 *   2. Drop the technical "thrown_count: 7 / total value: 13.02" split.
 *      One headline number; the items list under it is the proof.
 *
 * Empty state is encouraging ("Nothing wasted yet — nice."), not blank.
 */
export default function WasteSummaryCard() {
  const { data, isLoading } = useWasteSummary('month');
  const currency = data?.display_currency || 'SGD';
  const total = data?.thrown_value ?? 0;
  const items = data?.top_wasted ?? [];

  return (
    <Link
      to="/waste"
      className="block bg-ga-bg-card border border-ga-border rounded-lg p-4 hover:border-ga-accent/50 transition-colors"
    >
      <div className="flex items-start justify-between mb-1">
        <h4 className="text-sm font-semibold text-ga-text-primary">Wasted this month →</h4>
        {isLoading ? (
          <span className="text-xs text-ga-text-secondary">…</span>
        ) : (
          <span className="text-lg font-bold text-red-500 tabular-nums">
            {formatCurrencyWithSymbol(total, currency)}
          </span>
        )}
      </div>

      {!isLoading && data && data.thrown_count === 0 && (
        <p className="text-xs text-ga-text-secondary">Nothing wasted yet — nice.</p>
      )}

      {data && data.thrown_count > 0 && (
        <>
          <p className="text-xs text-ga-text-secondary mb-2">
            {data.thrown_count} thrown — money that could have gone elsewhere.
          </p>
          <ul className="space-y-0.5">
            {items.slice(0, 5).map((t) => (
              <li
                key={t.catalog_name_norm}
                className="text-xs text-ga-text-secondary flex justify-between"
              >
                <span className="truncate">{t.display_name}</span>
                <span className="tabular-nums">{t.count}×</span>
              </li>
            ))}
          </ul>
          {items.length > 5 && (
            <p className="mt-1 text-[10px] text-ga-text-secondary">
              +{items.length - 5} more — tap to see all
            </p>
          )}
        </>
      )}
    </Link>
  );
}
