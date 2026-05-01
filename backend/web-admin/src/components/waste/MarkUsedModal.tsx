import { useEffect, useState } from 'react';
import { useChangePurchaseStatus } from '@/api/mutations/usePurchaseMutations';
import { useUndoableAction } from '@/hooks/useUndoableAction';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import {
  readBaseUnit,
  stepForBaseUnit,
  totalBaseUnits as totalBaseUnitsOf,
  formatPackBreakdown,
} from '@/utils/unitType';
import type { PurchaseEvent } from '@/types/api';

interface MarkUsedModalProps {
  open: boolean;
  event: PurchaseEvent | null;
  onClose: () => void;
}

/**
 * Mark used — operates in BASE UNITS (eggs, ml, g) not event-qty.
 *
 * The bug fixed: an event with quantity=1, pack_size=6 represented "1 pack of
 * 6 eggs". The old modal asked for event-qty (1.0) so users couldn't ask for
 * "use 3 eggs" without doing the 0.5 math themselves. New behaviour:
 *   totalBaseUnits = event.quantity × event.pack_size
 *   user picks N base units via slider (step adapts to unit_type / unit label)
 *   on submit: event_qty_to_use = N / pack_size  (sent to update_status)
 *
 * The split logic in update_status already handles fractional event-qty via
 * partial-action splits, so a "use 250 ml of a 1L carton" becomes one
 * 750 ml active event + one 250 ml used event.
 *
 * Step heuristic (in base units):
 *   - "ml":  10 if total <=200, 50 if <=2000, else 100
 *   - "g" / "gram": 10 if total <=500, 50 if <=5000, else 100
 *   - "L" / "kg": 0.1 (decimal step)
 *   - else (count / container): 1 (integer)
 */
export default function MarkUsedModal({ open, event, onClose }: MarkUsedModalProps) {
  const [portion, setPortion] = useState<number>(1);
  const changeStatus = useChangePurchaseStatus();
  const undoable = useUndoableAction();
  useBodyScrollLock(open);

  // UNIT_TYPE_TOUCHPOINT — read canonical fields with graceful fallback
  // through `readBaseUnit`. Step heuristic mirrors backend `default_step`
  // via `stepForBaseUnit`.
  const packSize = Math.max(1, event?.pack_size ?? 1);
  const baseUnit = readBaseUnit(event);
  const totalBaseUnits = totalBaseUnitsOf(event);
  const { step, decimal } = stepForBaseUnit(baseUnit, totalBaseUnits);
  const inputMin = step;

  useEffect(() => {
    if (open && event) setPortion(totalBaseUnits);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  if (!open || !event) return null;

  const isPartial = portion < totalBaseUnits - step / 2;

  function handleConfirm() {
    if (!event) return;
    const target = event;
    const baseUnitsToUse = portion;
    // Convert base units → event-qty for the API. update_status splits the
    // event correctly when this is fractional.
    const eventQtyToUse = baseUnitsToUse / packSize;
    onClose();
    undoable.run(
      () =>
        changeStatus.mutate({
          id: target.id,
          data: { status: 'used', reason: 'used_up', quantity: eventQtyToUse },
          silent: true,
        }),
      isPartial
        ? `Used ${formatNum(baseUnitsToUse, decimal)} ${baseUnit}${baseUnitsToUse === 1 ? '' : 's'} of "${target.catalog_display}"`
        : `Marked all of "${target.catalog_display}" as used`,
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      {/* Card: capped height + flex-col so the body scrolls instead
          of falling through to page-behind. See useBodyScrollLock for
          the page-scroll lock. */}
      <div
        className="relative bg-ga-bg-card border border-ga-border rounded-xl shadow-2xl max-w-md w-full max-h-[calc(100vh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-ga-border flex-shrink-0">
          <h3 className="text-base font-semibold text-ga-text-primary">
            Mark "{event.catalog_display}" as used
          </h3>
          <p className="text-xs text-ga-text-secondary mt-1">
            Available: {formatNum(totalBaseUnits, decimal)} {baseUnit}
            {totalBaseUnits === 1 ? '' : 's'}
            {packSize > 1 && (
              <span className="ml-1">
                ({formatPackBreakdown(event)})
              </span>
            )}
          </p>
        </div>

        {/* Scrollable middle. Single-unit case: slider + spinner are
            meaningless (min == max == 1). Show a confirmation-only body
            so the user isn't confused by disabled controls. The Mark
            used button still fires the same handleConfirm path. */}
        <div className="flex-1 overflow-y-auto">
        {totalBaseUnits <= step + 1e-9 ? (
          <div className="px-5 py-5">
            <p className="text-sm text-ga-text-primary">
              This will mark <strong>all {formatNum(totalBaseUnits, decimal)} {baseUnit}{totalBaseUnits === 1 ? '' : 's'}</strong> of "{event.catalog_display}" as used.
            </p>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-ga-text-secondary">
              <span>How many to use?</span>
              <span className="text-ga-text-primary font-medium tabular-nums">
                {formatNum(portion, decimal)} {baseUnit}{portion === 1 ? '' : 's'}
                {isPartial && (
                  <span className="ml-1 text-ga-text-secondary">
                    ({formatNum(totalBaseUnits - portion, decimal)} stays active)
                  </span>
                )}
              </span>
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="range"
                min={inputMin}
                max={totalBaseUnits}
                step={step}
                value={portion}
                onChange={(e) => setPortion(Number(e.target.value))}
                className="flex-1 accent-ga-accent"
              />
              <button
                type="button"
                onClick={() => setPortion(Math.max(inputMin, portion - step))}
                disabled={portion <= inputMin + 1e-9}
                className="w-7 h-7 rounded border border-ga-border text-ga-text-primary hover:bg-ga-bg-hover disabled:opacity-40 disabled:cursor-not-allowed text-base leading-none"
                aria-label={`Decrease by ${step}`}
              >
                −
              </button>
              <input
                type="number"
                min={inputMin}
                max={totalBaseUnits}
                step={step}
                value={portion}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isFinite(v)) return;
                  setPortion(Math.max(inputMin, Math.min(totalBaseUnits, v)));
                }}
                className="w-20 px-2 py-1 text-sm bg-ga-bg-app border border-ga-border rounded text-ga-text-primary tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => setPortion(Math.min(totalBaseUnits, portion + step))}
                disabled={portion >= totalBaseUnits - 1e-9}
                className="w-7 h-7 rounded border border-ga-border text-ga-text-primary hover:bg-ga-bg-hover disabled:opacity-40 disabled:cursor-not-allowed text-base leading-none"
                aria-label={`Increase by ${step}`}
              >
                +
              </button>
            </div>
          </div>
        )}
        </div>

        <div className="px-5 py-3 border-t border-ga-border flex justify-end gap-2 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={changeStatus.isPending}
            className="px-4 py-1.5 text-sm font-medium bg-ga-accent text-white rounded-md hover:opacity-90 disabled:opacity-60"
          >
            {changeStatus.isPending ? 'Saving…' : 'Mark used'}
          </button>
        </div>
      </div>
    </div>
  );
}

// UNIT_TYPE_TOUCHPOINT — step heuristic moved to `utils/unitType.ts`
// (`stepForBaseUnit`) so it stays canonical with the backend's
// `unit_type_service.default_step`. Don't reintroduce a local copy here.

function formatNum(n: number, decimal: boolean): string {
  if (decimal) return (Math.round(n * 10) / 10).toFixed(1);
  return String(Math.round(n));
}
