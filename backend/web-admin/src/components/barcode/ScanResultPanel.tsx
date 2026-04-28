import { Link } from 'react-router-dom';
import type { ScanInfo } from '@/types/api';
import { cn } from '@/utils/cn';

export type ScanResultAction =
  | { kind: 'add_purchase'; nameNorm: string; display: string; barcode: string }
  | { kind: 'name_unknown'; barcode: string; suggestedName?: string; inStoreLabel?: boolean }
  | { kind: 'mark_used'; nameNorm: string; display: string }
  | { kind: 'move_location'; nameNorm: string; display: string }
  | { kind: 'tick_list_item'; nameNorm: string; display: string; barcode: string }
  | { kind: 'rescan' };

interface ScanResultPanelProps {
  info: ScanInfo;
  onAction: (action: ScanResultAction) => void;
  onClose: () => void;
  /**
   * Route context — influences which action is shown as "primary".
   * "my-items" → Mark used is primary
   * "shopping-lists" → Add to list (not implemented yet, falls back to add_purchase)
   * default → Add new purchase is primary
   */
  context?: 'dashboard' | 'my-items' | 'shopping-lists' | 'catalog';
}

export default function ScanResultPanel({
  info,
  onAction,
  onClose,
  context = 'dashboard',
}: ScanResultPanelProps) {
  const match = info.user_catalog_match;
  const global = info.global_product;
  const history = info.user_history;
  const inStore = info.is_in_store_label;

  return (
    <div className="space-y-3">
      <header>
        <div className="text-xs text-ga-text-secondary">
          Scanned <span className="font-mono">{info.barcode}</span>
          {info.country_code && <span className="ml-2">({info.country_code})</span>}
        </div>
      </header>

      {inStore && !match && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded p-3 text-xs text-amber-700">
          <div className="font-semibold mb-1">⚠️ Store-internal barcode</div>
          <div className="text-amber-800/80">
            This prefix (02xx / 200-299) is reserved for in-store stickers (deli, fresh produce,
            butcher, weighed items). The same code means different things at different shops, so
            we won't share the name with the global catalog. You name it; only your inventory
            sees it.
          </div>
        </div>
      )}

      {match ? (
        <>
          <div className="bg-ga-bg-hover rounded p-3 border border-ga-border">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-base font-semibold text-ga-text-primary">
                  {match.display_name}
                </div>
                <div className="text-xs text-ga-text-secondary mt-0.5">
                  You've bought this {history.count_purchased}× · {history.active_stock} currently active
                </div>
              </div>
              <Link
                to={`/catalog/${match.name_norm}`}
                onClick={onClose}
                className="text-xs text-ga-accent hover:underline flex-shrink-0"
              >
                View history →
              </Link>
            </div>

            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <Stat label="Last bought" value={history.last_bought ? new Date(history.last_bought).toLocaleDateString() : '—'} />
              <Stat
                label="Avg price"
                value={history.avg_price !== null ? history.avg_price.toFixed(2) : '—'}
              />
              <Stat
                label="Waste rate"
                value={history.waste_rate > 0 ? `${(history.waste_rate * 100).toFixed(0)}%` : '0%'}
                tone={history.waste_rate > 0.2 ? 'warn' : 'ok'}
              />
            </dl>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Primary action — context-aware. my-items defaults to mark
                used; shopping-lists context still adds a purchase (scan-tick
                requires a list-item toggle endpoint not yet built). */}
            <button
              onClick={() =>
                onAction({
                  kind: context === 'my-items' && history.active_stock > 0 ? 'mark_used' : 'add_purchase',
                  nameNorm: match.name_norm,
                  display: match.display_name,
                  barcode: info.barcode,
                })
              }
              className="px-3 py-1.5 text-sm bg-ga-accent text-white rounded hover:opacity-90 font-medium"
            >
              {context === 'my-items' && history.active_stock > 0
                ? `Mark one as used (FIFO, ${history.active_stock} in stock)`
                : context === 'shopping-lists'
                ? `+ Bought: add purchase`
                : '+ Add new purchase'}
            </button>
            {context === 'shopping-lists' && (
              <button
                onClick={() =>
                  onAction({
                    kind: 'tick_list_item',
                    nameNorm: match.name_norm,
                    display: match.display_name,
                    barcode: info.barcode,
                  })
                }
                className="px-3 py-1.5 text-sm bg-ga-bg-hover text-ga-text-primary rounded hover:bg-ga-bg-card"
                title="Dispatches a DOM event the list page can listen for. Toggle endpoint pending."
              >
                ✓ Tick on list
              </button>
            )}
            {context !== 'my-items' && history.active_stock > 0 && (
              <button
                onClick={() =>
                  onAction({
                    kind: 'mark_used',
                    nameNorm: match.name_norm,
                    display: match.display_name,
                  })
                }
                className="px-3 py-1.5 text-sm bg-ga-bg-hover text-ga-text-primary rounded hover:bg-ga-bg-card"
              >
                Mark used
              </button>
            )}
            {/* Move-location: available whenever there's at least 1 active event,
                regardless of context — useful when restocking the fridge. */}
            {history.active_stock > 0 && (
              <button
                onClick={() =>
                  onAction({
                    kind: 'move_location',
                    nameNorm: match.name_norm,
                    display: match.display_name,
                  })
                }
                className="px-3 py-1.5 text-sm bg-ga-bg-hover text-ga-text-primary rounded hover:bg-ga-bg-card"
              >
                Move location
              </button>
            )}
            <button
              onClick={() => onAction({ kind: 'rescan' })}
              className="px-3 py-1.5 text-sm text-ga-text-secondary hover:bg-ga-bg-hover rounded"
            >
              Scan another
            </button>
          </div>
        </>
      ) : global && typeof global === 'object' ? (
        <>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
            <div className="text-xs uppercase tracking-wider text-yellow-600 font-semibold">
              Not in your catalog yet
            </div>
            <div className="text-sm text-ga-text-primary mt-1">
              Global database says this is{' '}
              <strong>{(global as { product_name?: string }).product_name || 'unknown'}</strong>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                onAction({
                  kind: 'name_unknown',
                  barcode: info.barcode,
                  suggestedName: (global as { product_name?: string }).product_name,
                })
              }
              className="px-3 py-1.5 text-sm bg-ga-accent text-white rounded hover:opacity-90 font-medium"
            >
              Add to catalog → purchase
            </button>
            <button
              onClick={() => onAction({ kind: 'rescan' })}
              className="px-3 py-1.5 text-sm text-ga-text-secondary hover:bg-ga-bg-hover rounded"
            >
              Scan another
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="bg-ga-bg-hover rounded p-3 text-sm text-ga-text-secondary">
            {inStore
              ? "In-store label. Name it for your inventory only — won't be shared with the global catalog."
              : 'Unknown barcode — not in your catalog, not in the global database. What do you call this?'}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                onAction({ kind: 'name_unknown', barcode: info.barcode, inStoreLabel: inStore })
              }
              className="px-3 py-1.5 text-sm bg-ga-accent text-white rounded hover:opacity-90 font-medium"
            >
              Name this item
            </button>
            <button
              onClick={() => onAction({ kind: 'rescan' })}
              className="px-3 py-1.5 text-sm text-ga-text-secondary hover:bg-ga-bg-hover rounded"
            >
              Scan another
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'ok' | 'warn';
}) {
  return (
    <div>
      <div className="text-ga-text-secondary">{label}</div>
      <div
        className={cn(
          'font-medium',
          tone === 'ok' && 'text-green-600',
          tone === 'warn' && 'text-orange-600',
          tone === 'neutral' && 'text-ga-text-primary',
        )}
      >
        {value}
      </div>
    </div>
  );
}
