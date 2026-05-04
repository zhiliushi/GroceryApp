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
 *
 * `emptyVariant` controls behaviour when both lists are empty:
 *   - 'hide' (default) — return null so the surface auto-hides. Used
 *     where space is precious (legacy Settings location).
 *   - 'inline' — render a friendly empty state instead. Used inside
 *     the User Hub's Catalog cleanup tab so the body is never blank.
 */
export default function MergeNudgeWidget({
  emptyVariant = 'hide',
}: {
  emptyVariant?: 'hide' | 'inline';
} = {}) {
  const { data: pairs, isLoading: pairsLoading } = useCatalogDuplicates();
  const { data: log, isLoading: logLoading } = useTransferLog();
  const reverseMutation = useTransferReverse();
  const [expandedLog, setExpandedLog] = useState(false);

  const hasPairs = (pairs?.length ?? 0) > 0;
  const hasLog = (log?.length ?? 0) > 0;
  if (!hasPairs && !hasLog && !pairsLoading && !logLoading) {
    if (emptyVariant === 'inline') {
      return (
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5 text-sm text-ga-text-secondary">
          <p>
            Nothing to clean up right now. The app flags items here when it
            spots two catalog rows that might be the same product (shared
            barcode or near-identical name) and lists merges you ran in the
            last 7 days while the Undo window is open.
          </p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5 space-y-4">
      <h2 className="text-sm font-semibold text-ga-text-primary">
        Catalog cleanup
      </h2>

      <details className="group">
        <summary className="cursor-pointer list-none text-xs text-ga-accent hover:underline">
          ⓘ How does this work? <span className="text-[10px] group-open:rotate-180 inline-block transition-transform">▾</span>
        </summary>
        <div className="text-xs text-ga-text-secondary mt-2 space-y-1.5 pl-1 border-l border-ga-border">
          <p className="pl-2">
            <span className="text-ga-text-primary font-medium">Likely duplicates</span>{' '}
            are pairs of catalog items the app thinks might be the same product, either
            because they share a barcode or because the names are very close. Tap{' '}
            <em>Review</em> to open one side and decide whether to merge into the other.
          </p>
          <p className="pl-2">
            <span className="text-ga-text-primary font-medium">Recent transfers</span>{' '}
            shows merges you ran in the last 7 days. While the window is open, the{' '}
            <em>Reverse</em> button puts every moved purchase back where it came from —
            useful if you merged the wrong way round. After 7 days the merge becomes
            permanent.
          </p>
        </div>
      </details>

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
