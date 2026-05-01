import { useState } from 'react';
import type { CatalogOverviewPriceHistory } from '@/types/api';
import { cn } from '@/utils/cn';

interface Props {
  priceHistory: CatalogOverviewPriceHistory[];
  baseUnitLabel?: string;
}

/**
 * Cross-store price comparison (catalog_evolution.md §7 Phase E).
 * Displays mean / min / max unit_price per store, with a per-store sample
 * drilldown when expanded. Cheapest mean first.
 */
export default function PriceHistoryTable({ priceHistory, baseUnitLabel = 'unit' }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (priceHistory.length === 0) {
    return (
      <p className="text-xs text-ga-text-secondary italic">
        No prices recorded yet.
      </p>
    );
  }

  // Compute the cheapest store for the highlight
  const cheapest = priceHistory.find((p) => p.mean_unit_price != null);

  return (
    <div className="space-y-2">
      {priceHistory.map((store) => {
        const isExpanded = expanded === store.store_id;
        const isCheapest = cheapest && cheapest.store_id === store.store_id && priceHistory.length > 1;
        const currency = store.samples[0]?.display_currency ?? '';
        return (
          <div
            key={store.store_id}
            className={cn(
              'bg-ga-bg-card border rounded-lg p-3',
              isCheapest ? 'border-green-500/40' : 'border-ga-border',
            )}
          >
            <button
              type="button"
              onClick={() => setExpanded(isExpanded ? null : store.store_id)}
              className="w-full flex items-start justify-between gap-3 text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-ga-text-primary flex items-center gap-2">
                  🏪 {store.store_name}
                  {isCheapest && (
                    <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                      Cheapest
                    </span>
                  )}
                </div>
                <div className="text-xs text-ga-text-secondary mt-0.5">
                  {store.sample_count} purchase{store.sample_count === 1 ? '' : 's'}
                </div>
              </div>
              <div className="text-right text-xs flex-shrink-0">
                {store.mean_unit_price != null ? (
                  <>
                    <div className="text-ga-text-primary tabular-nums">
                      {currency} {store.mean_unit_price.toFixed(2)}
                      <span className="text-ga-text-secondary"> / {baseUnitLabel}</span>
                    </div>
                    <div className="text-[10px] text-ga-text-secondary tabular-nums">
                      min {store.min_unit_price?.toFixed(2)} · max {store.max_unit_price?.toFixed(2)}
                    </div>
                  </>
                ) : (
                  <span className="text-ga-text-secondary">—</span>
                )}
              </div>
            </button>

            {isExpanded && (
              <div className="mt-3 pt-3 border-t border-ga-border/50">
                <table className="w-full text-xs">
                  <thead className="text-ga-text-secondary">
                    <tr>
                      <th className="text-left py-1">Date</th>
                      <th className="text-right py-1">Paid</th>
                      <th className="text-right py-1">Per {baseUnitLabel}</th>{/* LABEL_OK: baseUnitLabel is already display-clean (ml/g/L/kg/count). */}
                      <th className="text-right py-1">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {store.samples.map((s) => (
                      <tr key={s.event_id} className="border-t border-ga-border/30">
                        <td className="py-1 text-ga-text-secondary tabular-nums">
                          {s.date ? new Date(s.date).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-1 text-right text-ga-text-primary tabular-nums">
                          {s.currency ?? ''} {s.amount?.toFixed(2) ?? '—'}
                          {s.display_currency && s.display_currency !== s.currency && s.display_amount != null && (
                            <span className="text-[10px] text-ga-text-secondary ml-1">
                              (≈ {s.display_currency} {s.display_amount.toFixed(2)})
                            </span>
                          )}
                        </td>
                        <td className="py-1 text-right text-ga-text-primary tabular-nums">
                          {s.unit_price != null ? s.unit_price.toFixed(2) : '—'}
                        </td>
                        <td className="py-1 text-right text-ga-text-secondary tabular-nums">
                          {s.quantity ?? '—'}
                          {s.pack_size && s.pack_size > 1 && (
                            <span className="text-[10px] ml-1">× {s.pack_size}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
