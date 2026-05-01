import { useEffect, useState } from 'react';
import { useMovePurchase } from '@/api/mutations/usePurchaseMutations';
import { useLocations, useRecentLocations } from '@/api/queries/useLocations';
import { useUndoableAction } from '@/hooks/useUndoableAction';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import {
  readBaseUnit,
  readPackLabel,
  stepForBaseUnit,
  totalBaseUnits as totalBaseUnitsOf,
  formatPackBreakdown,
} from '@/utils/unitType';
import { cn } from '@/utils/cn';
import type { PurchaseEvent } from '@/types/api';

interface MoveLocationModalProps {
  open: boolean;
  event: PurchaseEvent | null;
  onClose: () => void;
}

/**
 * UNIT_TYPE_TOUCHPOINT — slider mode adapts by canonical model:
 *   - pack_count > 1: slider in WHOLE PACKS (integer step). User sees
 *     "How many cartons to move?".
 *   - pack_count == 1, pack_size > 1: slider in BASE UNITS (ml/g/count).
 *     User sees "How much milk?" / "How many eggs?". Submitted as
 *     fractional quantity = base_units / pack_size.
 *   - pack_count == 1, pack_size == 1: indivisible. No slider; confirm.
 *
 * See `.claude/docs/unit-type-method.md` for the data model.
 */
export default function MoveLocationModal({ open, event, onClose }: MoveLocationModalProps) {
  const [portion, setPortion] = useState<number>(1);
  const [destination, setDestination] = useState<string>('fridge');
  const moveMutation = useMovePurchase();
  const undoable = useUndoableAction();
  useBodyScrollLock(open);
  // LOCATION_TOUCHPOINT — registered list + recent free-text strings.
  // Default destination is the first registered location that isn't
  // the current one. User can ALSO type any custom destination via the
  // free-text input below the quick-pick grid.
  const { locations } = useLocations();
  const recentLocations = useRecentLocations();

  // Slider-mode derivation per the canonical rules above.
  const packCount = event?.quantity ?? 0;
  const packSize = Math.max(1, event?.pack_size ?? 1);
  const baseUnit = readBaseUnit(event);
  const packLabel = readPackLabel(event);
  const totalBase = totalBaseUnitsOf(event);
  const sliderMode: 'pack' | 'base-unit' | 'indivisible' =
    packCount > 1 ? 'pack' : packSize > 1 ? 'base-unit' : 'indivisible';

  // Slider domain depends on mode.
  const sliderMax = sliderMode === 'pack' ? packCount : totalBase;
  const sliderStep =
    sliderMode === 'pack' ? 1 : stepForBaseUnit(baseUnit, totalBase).step;
  const sliderMin = sliderStep;

  useEffect(() => {
    if (open && event) {
      // Default to the full amount in whichever mode applies.
      if (sliderMode === 'pack') setPortion(packCount);
      else setPortion(totalBase);
      const current = event.location || '';
      const next = locations.find((l) => l.key !== current) ?? locations[0];
      setDestination(next?.key ?? 'pantry');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id, locations]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  if (!open || !event) return null;

  // For the API: quantity field is in pack_count. Convert from slider value
  // to API quantity per slider mode.
  const apiQuantity =
    sliderMode === 'pack' ? portion : portion / packSize;
  const isPartial =
    sliderMode === 'indivisible'
      ? false
      : portion < sliderMax - sliderStep / 2;
  const sameLocation =
    !!event.location && destination === event.location;

  function handleConfirm() {
    if (!event) return;
    if (sameLocation) return;
    const target = event;
    const qty = apiQuantity;
    const dest = destination;
    onClose();
    undoable.run(
      () =>
        moveMutation.mutate({
          id: target.id,
          data: { location: dest, quantity: qty },
          silent: true,
        }),
      isPartial
        ? sliderMode === 'pack'
          ? `Moved ${portion} ${packLabel}${portion === 1 ? '' : 's'} of "${target.catalog_display}" to ${dest}`
          : `Moved ${formatNum(portion)} ${baseUnit} of "${target.catalog_display}" to ${dest}`
        : `Moved "${target.catalog_display}" to ${dest}`,
    );
  }

  function formatNum(n: number): string {
    if (n === Math.floor(n)) return String(n);
    return n.toFixed(1);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-ga-bg-card border border-ga-border rounded-xl shadow-2xl max-w-md w-full max-h-[calc(100vh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-ga-border flex-shrink-0">
          <h3 className="text-base font-semibold text-ga-text-primary">
            Move "{event.catalog_display}"
          </h3>
          <p className="text-xs text-ga-text-secondary mt-1">
            From <span className="text-ga-text-primary">📍 {event.location || '—'}</span> to a new location.
            {sliderMode === 'pack' && ` ${packLabel.charAt(0).toUpperCase()}${packLabel.slice(1)}-level granularity.`}
            {sliderMode === 'base-unit' && ` Up to ${formatNum(totalBase)} ${baseUnit} available.`}
            {sliderMode === 'indivisible' && ` This pack is whole-only.`}
          </p>
          <p className="text-[11px] text-ga-text-secondary mt-0.5">
            {formatPackBreakdown(event)}
          </p>
        </div>

        {/* Scrollable middle. Contains the slider/spinner section AND
            the destination picker. Keeps the page-behind from scrolling
            when content overflows the viewport. */}
        <div className="flex-1 overflow-y-auto">
        {/* UNIT_TYPE_TOUCHPOINT — slider mode adapts. See class doc above. */}
        {sliderMode === 'indivisible' ? (
          <div className="px-5 py-4 border-b border-ga-border">
            <p className="text-sm text-ga-text-primary">
              Move this whole {packLabel} to the new location.
            </p>
          </div>
        ) : (
          <div className="px-5 py-3 border-b border-ga-border space-y-2">
            <div className="flex items-center justify-between text-xs text-ga-text-secondary">
              <span>
                {sliderMode === 'pack'
                  ? `How many ${packLabel}${portion === 1 ? '' : 's'}?`
                  : `How much to move?`}
              </span>
              <span className="text-ga-text-primary font-medium tabular-nums">
                {sliderMode === 'pack'
                  ? `${portion} of ${packCount}`
                  : `${formatNum(portion)} ${baseUnit} of ${formatNum(totalBase)}`}
                {isPartial && (
                  <span className="ml-1 text-ga-text-secondary">
                    ({sliderMode === 'pack'
                      ? `${packCount - portion} stays at ${event.location}`
                      : `${formatNum(totalBase - portion)} ${baseUnit} stays`})
                  </span>
                )}
              </span>
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="range"
                min={sliderMin}
                max={sliderMax}
                step={sliderStep}
                value={portion}
                onChange={(e) => setPortion(Number(e.target.value))}
                className="flex-1 accent-blue-500"
              />
              <button
                type="button"
                onClick={() => setPortion(Math.max(sliderMin, portion - sliderStep))}
                disabled={portion <= sliderMin + 1e-9}
                className="w-7 h-7 rounded border border-ga-border text-ga-text-primary hover:bg-ga-bg-hover disabled:opacity-40 disabled:cursor-not-allowed text-base leading-none"
                aria-label={`Decrease by ${sliderStep}`}
              >
                −
              </button>
              <input
                type="number"
                min={sliderMin}
                max={sliderMax}
                step={sliderStep}
                value={portion}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isFinite(v)) return;
                  setPortion(Math.max(sliderMin, Math.min(sliderMax, v)));
                }}
                className="w-16 px-2 py-1 text-sm bg-ga-bg-app border border-ga-border rounded text-ga-text-primary tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => setPortion(Math.min(sliderMax, portion + sliderStep))}
                disabled={portion >= sliderMax - 1e-9}
                className="w-7 h-7 rounded border border-ga-border text-ga-text-primary hover:bg-ga-bg-hover disabled:opacity-40 disabled:cursor-not-allowed text-base leading-none"
                aria-label={`Increase by ${sliderStep}`}
              >
                +
              </button>
            </div>
          </div>
        )}

        <div className="px-5 py-4 space-y-2">
          <label className="block text-xs text-ga-text-secondary">Move to</label>
          <div className="grid grid-cols-3 gap-2">
            {locations.map((loc) => {
              const isCurrent = event.location === loc.key;
              const isSelected = destination === loc.key;
              return (
                <button
                  key={loc.key}
                  type="button"
                  onClick={() => setDestination(loc.key)}
                  disabled={isCurrent}
                  className={cn(
                    'px-3 py-2 text-sm rounded border flex items-center justify-center gap-1',
                    isCurrent
                      ? 'border-ga-border text-ga-text-secondary opacity-40 cursor-not-allowed'
                      : isSelected
                      ? 'border-ga-accent bg-ga-accent/10 text-ga-text-primary'
                      : 'border-ga-border text-ga-text-primary hover:bg-ga-bg-hover',
                  )}
                  title={isCurrent ? 'Already at this location' : undefined}
                >
                  <span>{loc.icon}</span>
                  <span>{loc.name}</span>
                  {isCurrent && <span className="text-[10px]">(here)</span>}
                </button>
              );
            })}
          </div>

          {/* LOCATION_TOUCHPOINT — free-text destination. Pick a registered
              location above for one tap; OR type any custom destination
              here. Backend stores the literal string. */}
          <div>
            <label className="block text-[11px] text-ga-text-secondary mt-2 mb-1">
              Or type a custom destination:
            </label>
            <input
              type="text"
              list="move-location-suggestions"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Mum's house, Office fridge…"
              className="w-full px-3 py-2 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary placeholder:text-ga-text-secondary focus:outline-none focus:border-ga-accent text-sm"
            />
            <datalist id="move-location-suggestions">
              {locations.map((l) => (
                <option key={`reg-${l.key}`} value={l.name}>
                  {l.icon} {l.name}
                </option>
              ))}
              {recentLocations
                .filter((rl) => !locations.find((l) => l.name === rl || l.key === rl))
                .map((rl) => (
                  <option key={`recent-${rl}`} value={rl}>
                    {rl} (recent)
                  </option>
                ))}
            </datalist>
          </div>
        </div>
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
            disabled={moveMutation.isPending || sameLocation}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md',
              moveMutation.isPending || sameLocation
                ? 'bg-ga-bg-hover text-ga-text-secondary cursor-not-allowed'
                : 'bg-blue-600 text-white hover:opacity-90',
            )}
          >
            {moveMutation.isPending ? 'Saving…' : 'Move'}
          </button>
        </div>
      </div>
    </div>
  );
}
