import { useMemo, useState } from 'react';
import { useLocations } from '@/api/queries/useLocations';
import { useAuthStore } from '@/stores/authStore';
import StoreSelect from '@/components/stores/StoreSelect';
import { useConfirmCheckout } from '@/api/mutations/useShoppingListMutations';
import type { ShoppingListItem, ShoppingListPrice } from '@/types/api';
import { cn } from '@/utils/cn';

/**
 * v3 Checkout footer — sticky at the bottom of the shopping list detail page.
 * Shows:
 *  - tick count + spent vs list-estimate (Δ)
 *  - bulk default storage selector (defaults to user pref or _unsorted)
 *  - store + date inline
 *  - cancel / confirm buttons
 *
 * "Checkout list" is just the subset of alternatives where ticked=true,
 * across all primaries in the list (per G19). No separate state.
 */

interface CheckoutFooterProps {
  listId: string;
  items: ShoppingListItem[];
  /** Called after the user clicks Cancel — parent should untick all
   *  alternatives via per-row untick mutations. */
  onCancel: () => void;
  /** Called after a successful confirm so parent can refetch + reset UI. */
  onConfirmed?: () => void;
}

interface TickedRef {
  itemId: string;
  alt: ShoppingListPrice;
  /** Total qty contribution (pack_count × pack_size, both ≥ 1). */
  totalQty: number;
  /** Estimated spend for this row (pack_count × price), or null if no price. */
  rowSpend: number | null;
  currency: string;
  /** True when this primary's listed unit doesn't match the alternative's unit. */
  unitMismatch: boolean;
}

function computeUnitMismatch(item: ShoppingListItem, alt: ShoppingListPrice): boolean {
  // Per F5: highlight unit mismatch first, then number mismatch.
  // Primary qty unit can be: count (item.unit), weight, or volume.
  const primaryUnit =
    item.weight_unit ? `weight:${item.weight_unit}` :
    item.volume_unit ? `volume:${item.volume_unit}` :
    item.unit ? `count:${item.unit}` :
    null;
  if (!primaryUnit) return false;  // primary has no declared unit → no comparison
  const altUnit =
    alt.weight_unit ? `weight:${alt.weight_unit}` :
    alt.volume_unit ? `volume:${alt.volume_unit}` :
    'count';  // assume count when alt has no weight/volume
  // Treat 'count:X' from primary as 'count' for compare purposes
  const primaryClass = primaryUnit.startsWith('count:') ? 'count' : primaryUnit;
  return primaryClass !== altUnit;
}

export default function CheckoutFooter({
  listId,
  items,
  onCancel,
  onConfirmed,
}: CheckoutFooterProps) {
  const tripCurrency = useAuthStore((s) => s.user?.currency_preference) || 'SGD';
  const defaultStorage = useAuthStore(
    (s) => (s.user as unknown as { default_grocery_storage?: string })?.default_grocery_storage,
  ) || '_unsorted';

  const { locations } = useLocations();
  const [storage, setStorage] = useState<string>(defaultStorage);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeLabel, setStoreLabel] = useState<string>('');
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState<string>(today);

  const checkoutMutation = useConfirmCheckout();

  const ticked: TickedRef[] = useMemo(() => {
    const out: TickedRef[] = [];
    for (const item of items) {
      const alts = (item.prices ?? []) as ShoppingListPrice[];
      for (const alt of alts) {
        if (!alt.ticked) continue;
        const packCount = alt.pack_count ?? 1;
        const packSize = alt.pack_size ?? 1;
        const totalQty = packCount * packSize;
        const rowSpend =
          alt.price != null && Number.isFinite(alt.price)
            ? Number(alt.price) * packCount
            : null;
        out.push({
          itemId: item.id,
          alt,
          totalQty,
          rowSpend,
          currency: alt.currency || tripCurrency,
          unitMismatch: computeUnitMismatch(item, alt),
        });
      }
    }
    return out;
  }, [items, tripCurrency]);

  // List estimate = sum of lowest-price alternative per primary (only counts
  // primaries that have at least one priced alternative).
  const listEstimate = useMemo(() => {
    let total = 0;
    for (const item of items) {
      const alts = (item.prices ?? []) as ShoppingListPrice[];
      const priced = alts.filter((a) => a.price != null);
      if (priced.length === 0) continue;
      const min = Math.min(...priced.map((a) => Number(a.price)));
      total += min;
    }
    return total;
  }, [items]);

  const spent = useMemo(
    () => ticked.reduce((sum, r) => sum + (r.rowSpend ?? 0), 0),
    [ticked],
  );
  const delta = spent - listEstimate;
  const tickedCount = ticked.length;

  const noPriceTickedCount = ticked.filter((r) => r.rowSpend === null).length;
  const unitMismatchCount = ticked.filter((r) => r.unitMismatch).length;

  function handleConfirm() {
    if (tickedCount === 0) return;
    checkoutMutation.mutate(
      {
        listId,
        payload: {
          store_id: storeId || undefined,
          date,
          default_location: storage,
        },
      },
      { onSuccess: () => onConfirmed?.() },
    );
  }

  return (
    <div className="sticky bottom-0 left-0 right-0 z-30 bg-ga-bg-card border-t border-ga-border shadow-[0_-4px_12px_rgba(0,0,0,0.15)]">
      <div className="px-4 py-3 max-w-4xl mx-auto">
        {/* Top row: counts + totals */}
        <div className="flex flex-wrap items-baseline gap-3 mb-3">
          {tickedCount === 0 ? (
            <span className="text-sm text-ga-text-secondary">
              Tick alternatives to start a checkout
            </span>
          ) : (
            <>
              <span className="text-sm font-semibold text-ga-text-primary">
                {tickedCount} ticked
              </span>
              <span className="text-sm text-ga-text-primary">
                spent <span className="font-medium">{tripCurrency} {spent.toFixed(2)}</span>
              </span>
              {listEstimate > 0 && (
                <span className="text-xs text-ga-text-secondary">
                  · list est. {tripCurrency} {listEstimate.toFixed(2)}
                </span>
              )}
              {listEstimate > 0 && (
                <span
                  className={cn(
                    'text-xs font-medium',
                    delta < 0 && 'text-green-400',
                    delta > 0 && 'text-orange-400',
                    delta === 0 && 'text-ga-text-secondary',
                  )}
                >
                  Δ {delta < 0 ? '−' : '+'}{tripCurrency} {Math.abs(delta).toFixed(2)}
                  {delta < 0 && ' ↓'}
                  {delta > 0 && ' ↑'}
                </span>
              )}
              {noPriceTickedCount > 0 && (
                <span className="text-xs text-ga-text-secondary italic">
                  · {noPriceTickedCount} no-price
                </span>
              )}
              {unitMismatchCount > 0 && (
                <span className="text-xs text-red-400">
                  · ⚠ {unitMismatchCount} unit mismatch
                </span>
              )}
            </>
          )}
        </div>

        {tickedCount > 0 && (
          <>
            {/* Mid row: store + date + storage */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
              <StoreSelect
                value={storeId}
                onChange={(id, label) => {
                  setStoreId(id);
                  setStoreLabel(label || '');
                }}
                placeholder="Store (optional)"
              />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-3 py-2 bg-ga-bg-primary border border-ga-border rounded-md text-sm text-ga-text-primary focus:outline-none focus:border-ga-accent"
              />
              <select
                value={storage}
                onChange={(e) => setStorage(e.target.value)}
                className="px-3 py-2 bg-ga-bg-primary border border-ga-border rounded-md text-sm text-ga-text-primary focus:outline-none focus:border-ga-accent"
                title="Bulk default storage — items land here, redistribute later from the storage page"
              >
                <option value="_unsorted">🏠 Home / Unsorted (sort later)</option>
                {locations.map((loc) => (
                  <option key={loc.key} value={loc.key}>
                    {loc.icon || '📦'} {loc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Bottom row: action buttons */}
            <div className="flex justify-end gap-2">
              <button
                onClick={onCancel}
                disabled={checkoutMutation.isPending}
                className="px-3 py-1.5 text-sm border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover disabled:opacity-50"
              >
                Cancel checkout
              </button>
              <button
                onClick={handleConfirm}
                disabled={tickedCount === 0 || checkoutMutation.isPending}
                className={cn(
                  'px-4 py-1.5 text-sm font-medium rounded-md text-white',
                  checkoutMutation.isPending
                    ? 'bg-ga-bg-hover text-ga-text-secondary cursor-not-allowed'
                    : 'bg-ga-accent hover:bg-ga-accent-hover',
                )}
              >
                {checkoutMutation.isPending
                  ? 'Confirming…'
                  : `Confirm checkout (${tickedCount})`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
