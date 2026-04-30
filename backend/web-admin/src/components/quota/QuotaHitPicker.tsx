import { useEffect, useState } from 'react';
import { useDeleteCatalogEntry } from '@/api/mutations/useCatalogMutations';
import { cn } from '@/utils/cn';
import type { QuotaExceededDetails } from '@/api/mutations/usePurchaseMutations';

type SortBy = 'oldest' | 'expiry';

interface QuotaHitPickerProps {
  open: boolean;
  details: QuotaExceededDetails | null;
  onCancel: () => void;
  /** Called once the user removed an item — caller should retry the create. */
  onResolved: () => void;
}

/**
 * Catalog quota picker (catalog_evolution.md §2.2 #3, Phase C).
 *
 * Shown when create_purchase fails with `catalog_quota_exceeded`. The error
 * payload carries the eviction candidates already; the user picks one to
 * remove (force=true since `active_purchases > 0` is allowed for quota
 * eviction), then the caller retries the original create.
 */
export default function QuotaHitPicker({
  open,
  details,
  onCancel,
  onResolved,
}: QuotaHitPickerProps) {
  const [sortBy, setSortBy] = useState<SortBy>('oldest');
  const deleteMutation = useDeleteCatalogEntry();

  useEffect(() => {
    if (!open) setSortBy('oldest');
  }, [open]);

  if (!open || !details) return null;

  const sorted = [...details.eviction_candidates].sort((a, b) => {
    if (sortBy === 'expiry') {
      return (a.idle_expires_at ?? '~').localeCompare(b.idle_expires_at ?? '~');
    }
    return (a.last_purchased_at ?? '0').localeCompare(b.last_purchased_at ?? '0');
  });

  function pick(nameNorm: string) {
    if (deleteMutation.isPending) return;
    deleteMutation.mutate(
      { nameNorm, force: true },
      {
        onSuccess: () => onResolved(),
      },
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-ga-bg-card border border-orange-500/40 rounded-xl shadow-2xl max-w-lg w-full">
        <div className="px-5 py-4 border-b border-ga-border">
          <h3 className="text-base font-semibold text-orange-400">
            Catalog full — pick one to remove
          </h3>
          <p className="text-xs text-ga-text-secondary mt-1">
            You're at <strong>{details.used} / {details.limit}</strong> custom items. Free up
            a slot to add a new one.
          </p>
        </div>

        <div className="px-5 py-3 flex items-center gap-2 text-xs">
          <span className="text-ga-text-secondary">Sort:</span>
          {(['oldest', 'expiry'] as SortBy[]).map((k) => (
            <button
              key={k}
              onClick={() => setSortBy(k)}
              className={cn(
                'px-2 py-1 rounded',
                sortBy === k
                  ? 'bg-ga-accent text-white'
                  : 'bg-ga-bg-card border border-ga-border text-ga-text-secondary',
              )}
            >
              {k === 'oldest' ? 'Oldest first' : 'Soonest expiry'}
            </button>
          ))}
        </div>

        <div className="px-5 pb-4 max-h-96 overflow-y-auto space-y-2">
          {sorted.length === 0 ? (
            <p className="text-sm text-ga-text-secondary">No removable items.</p>
          ) : (
            sorted.map((c) => (
              <div
                key={c.name_norm}
                className="flex items-center justify-between bg-ga-bg-hover/30 rounded p-3 gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-ga-text-primary truncate">{c.display_name}</div>
                  <div className="text-[10px] text-ga-text-secondary">
                    {c.barcode && <span className="font-mono mr-2">{c.barcode}</span>}
                    {c.last_purchased_at &&
                      `last: ${new Date(c.last_purchased_at).toLocaleDateString()}`}
                    {c.idle_expires_at && (
                      <span className="ml-2">
                        idles: {new Date(c.idle_expires_at).toLocaleDateString()}
                      </span>
                    )}
                    {c.active_purchases > 0 && (
                      <span className="ml-2 text-orange-400">
                        {c.active_purchases} active item{c.active_purchases === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => pick(c.name_norm)}
                  disabled={deleteMutation.isPending}
                  className="px-3 py-1.5 text-xs rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>

        <div className="px-5 py-3 border-t border-ga-border flex items-center justify-between">
          <p className="text-[10px] text-ga-text-secondary">
            Removing keeps any active purchases visible (their catalog name reverts) for
            barcode-tied items; for no-barcode items the events are deleted too.
          </p>
          <button
            onClick={onCancel}
            className="px-3 py-1 text-xs border border-ga-border rounded text-ga-text-primary hover:bg-ga-bg-hover"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
