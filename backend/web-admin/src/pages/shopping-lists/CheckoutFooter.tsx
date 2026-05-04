import { useMemo, useState } from 'react';
import { useLocations } from '@/api/queries/useLocations';
import { useExchangeRates } from '@/api/queries/useConfig';
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
  const { data: fxData } = useExchangeRates();
  const [storage, setStorage] = useState<string>(defaultStorage);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeLabel, setStoreLabel] = useState<string>('');
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState<string>(today);

  const checkoutMutation = useConfirmCheckout();

  /** Convert `amount` from `from` to `to` using cached rates relative to fxData.base.
   *  Returns null if rates are unavailable or the conversion can't be computed. */
  function convertCurrency(amount: number, from: string, to: string): number | null {
    if (!Number.isFinite(amount)) return null;
    if (from === to) return amount;
    if (!fxData?.rates) return null;
    const rateFrom = from === fxData.base ? 1 : fxData.rates[from];
    const rateTo = to === fxData.base ? 1 : fxData.rates[to];
    if (!rateFrom || !rateTo) return null;
    // amount(from) → amount(base) → amount(to)
    return (amount / rateFrom) * rateTo;
  }

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

  // Per-currency totals so we can show dual-display when a trip mixes
  // currencies (P2: stored values are exact; conversion is UI-only).
  // `spentByCurrency` is the raw sum per currency; `spentInTrip` converts
  // each per-trip and sums (uses cached FX rates; falls back to raw sum if
  // rates unavailable). Same for the list estimate.
  const spentByCurrency: Record<string, number> = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of ticked) {
      if (r.rowSpend == null) continue;
      out[r.currency] = (out[r.currency] || 0) + r.rowSpend;
    }
    return out;
  }, [ticked]);

  const listEstimateByCurrency: Record<string, number> = useMemo(() => {
    const out: Record<string, number> = {};
    for (const item of items) {
      const alts = (item.prices ?? []) as ShoppingListPrice[];
      const priced = alts.filter((a) => a.price != null);
      if (priced.length === 0) continue;
      // Lowest-price candidate (in its own currency — we don't FX-convert
      // for the per-currency raw view; that's only for the estimate
      // displayed in trip currency below).
      const lowest = priced.reduce((a, b) =>
        Number(a.price) <= Number(b.price) ? a : b,
      );
      const cur = lowest.currency || tripCurrency;
      out[cur] = (out[cur] || 0) + Number(lowest.price);
    }
    return out;
  }, [items, tripCurrency]);

  /** Sum a per-currency map into trip currency. Returns
   *  { value: number, complete: boolean } where complete=false means at
   *  least one currency couldn't be converted (FX missing). */
  function sumIntoTripCurrency(byCurrency: Record<string, number>) {
    let total = 0;
    let complete = true;
    for (const [cur, amt] of Object.entries(byCurrency)) {
      const converted = convertCurrency(amt, cur, tripCurrency);
      if (converted == null) {
        complete = false;
        // Best-effort: include same-currency amounts; skip un-convertible
        if (cur === tripCurrency) total += amt;
      } else {
        total += converted;
      }
    }
    return { value: total, complete };
  }

  const spent = sumIntoTripCurrency(spentByCurrency);
  const listEstimate = sumIntoTripCurrency(listEstimateByCurrency);
  const delta = spent.value - listEstimate.value;
  const deltaComplete = spent.complete && listEstimate.complete;
  const tickedCount = ticked.length;

  // Multi-currency = ticked alts span more than one currency
  const tickedCurrencies = Object.keys(spentByCurrency);
  const isMixedCurrency = tickedCurrencies.length > 1
    || (tickedCurrencies.length === 1 && tickedCurrencies[0] !== tripCurrency);

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
                spent{' '}
                <span className="font-medium">
                  {tripCurrency} {spent.value.toFixed(2)}
                </span>
                {!spent.complete && (
                  <span
                    className="ml-1 text-[10px] text-amber-300"
                    title="Some currencies couldn't be converted (FX rates unavailable). Showing partial total."
                  >
                    ⚠ partial
                  </span>
                )}
              </span>
              {/* Per-currency breakdown when the trip mixes currencies — P2:
                  conversion is UI-only, so we always show the originals. */}
              {isMixedCurrency && (
                <span className="text-[11px] text-ga-text-secondary">
                  (
                  {Object.entries(spentByCurrency)
                    .map(([cur, amt]) => `${cur} ${amt.toFixed(2)}`)
                    .join(' + ')}
                  )
                </span>
              )}
              {listEstimate.value > 0 && (
                <span className="text-xs text-ga-text-secondary">
                  · list est. {tripCurrency} {listEstimate.value.toFixed(2)}
                </span>
              )}
              {listEstimate.value > 0 && deltaComplete && (
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
