import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useCatalogDuplicates,
  useTransferLog,
  useTransferReverse,
} from '@/api/queries/useCatalogTransfer';
import { cn } from '@/utils/cn';

/**
 * Merge nudge + transfer audit log (catalog_evolution.md §6.2 #2 + §6.3).
 *
 * Two stacked cards:
 *  1. Likely-duplicate catalog pairs the user can review (passive — no
 *     destructive default action, just a deep-link to the catalog row).
 *  2. Recent transfers with a 7d Reverse button while the window is open.
 */
export default function MergeNudgeWidget() {
  const { data: pairs, isLoading: pairsLoading } = useCatalogDuplicates();
  const { data: log, isLoading: logLoading } = useTransferLog();
  const reverseMutation = useTransferReverse();
  const [expandedLog, setExpandedLog] = useState(false);

  const hasPairs = (pairs?.length ?? 0) > 0;
  const hasLog = (log?.length ?? 0) > 0;
  if (!hasPairs && !hasLog && !pairsLoading && !logLoading) return null;

  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5 space-y-4">
      <h2 className="text-sm font-semibold text-ga-text-primary">
        Catalog cleanup
      </h2>

      {/* Duplicate pairs */}
      <div>
        <h3 className="text-xs uppercase tracking-wide text-ga-text-secondary mb-2">
          Likely duplicates
        </h3>
        {pairsLoading ? (
          <p className="text-xs text-ga-text-secondary italic">Scanning catalog…</p>
        ) : !hasPairs ? (
          <p className="text-xs text-ga-text-secondary italic">No likely duplicates.</p>
        ) : (
          <div className="space-y-2">
            {pairs!.map((p, idx) => (
              <div
                key={`${p.a.name_norm}_${p.b.name_norm}_${idx}`}
                className="flex items-center justify-between gap-3 bg-ga-bg-hover/30 rounded p-2.5"
              >
                <div className="min-w-0 flex-1 text-xs">
                  <div className="text-ga-text-primary">
                    <Link to={`/catalog/${p.a.name_norm}`} className="hover:underline">
                      {p.a.display_name}
                    </Link>
                    <span className="text-ga-text-secondary mx-2">↔</span>
                    <Link to={`/catalog/${p.b.name_norm}`} className="hover:underline">
                      {p.b.display_name}
                    </Link>
                  </div>
                  <div className="text-[10px] text-ga-text-secondary mt-0.5">
                    {p.why === 'shared_barcode' ? 'shared barcode' : 'name similarity'}{' '}
                    · score {(p.score * 100).toFixed(0)}%
                    {p.a.total_purchases > 0 && ` · ${p.a.total_purchases + p.b.total_purchases} combined purchases`}
                  </div>
                </div>
                <Link
                  to={`/catalog/${p.a.name_norm}`}
                  className="text-xs text-ga-accent hover:underline whitespace-nowrap"
                >
                  Review →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transfer audit log */}
      {hasLog && (
        <div>
          <button
            onClick={() => setExpandedLog(!expandedLog)}
            className="text-xs uppercase tracking-wide text-ga-text-secondary mb-2 flex items-center gap-1 hover:text-ga-text-primary"
          >
            Recent transfers ({log!.length}) {expandedLog ? '▾' : '▸'}
          </button>
          {expandedLog && (
            <div className="space-y-2">
              {log!.map((t) => (
                <div
                  key={t.transfer_id}
                  className="flex items-center justify-between gap-3 bg-ga-bg-hover/30 rounded p-2.5 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-ga-text-primary">
                      {t.from_display_name ?? t.from_catalog_id}
                      <span className="text-ga-text-secondary mx-1">→</span>
                      {t.to_display_name ?? t.to_catalog_id}
                    </div>
                    <div className="text-[10px] text-ga-text-secondary mt-0.5">
                      {t.transferred_at && new Date(t.transferred_at).toLocaleString()}
                      · {t.transferred_event_count} event{t.transferred_event_count === 1 ? '' : 's'}
                      {t.reversed_at && (
                        <span className="ml-2 text-orange-400">↩ reversed</span>
                      )}
                      {!t.reversed_at && t.reversal_window_open && t.reversal_expires_at && (
                        <span className="ml-2 text-ga-text-secondary">
                          window closes {new Date(t.reversal_expires_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  {!t.reversed_at && t.reversal_window_open && (
                    <button
                      onClick={() => reverseMutation.mutate(t.transfer_id)}
                      disabled={reverseMutation.isPending}
                      className={cn(
                        'px-2 py-1 text-[11px] rounded border whitespace-nowrap',
                        reverseMutation.isPending
                          ? 'border-ga-border text-ga-text-secondary'
                          : 'border-orange-500/40 text-orange-400 hover:bg-orange-500/10',
                      )}
                    >
                      Reverse
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
