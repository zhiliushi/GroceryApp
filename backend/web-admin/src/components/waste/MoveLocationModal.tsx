import { useEffect, useState } from 'react';
import { useMovePurchase } from '@/api/mutations/usePurchaseMutations';
import { useLocations } from '@/api/queries/useLocations';
import { useUndoableAction } from '@/hooks/useUndoableAction';
import { cn } from '@/utils/cn';
import type { PurchaseEvent } from '@/types/api';

interface MoveLocationModalProps {
  open: boolean;
  event: PurchaseEvent | null;
  onClose: () => void;
}

export default function MoveLocationModal({ open, event, onClose }: MoveLocationModalProps) {
  const [portion, setPortion] = useState<number>(1);
  const [destination, setDestination] = useState<string>('fridge');
  const moveMutation = useMovePurchase();
  const undoable = useUndoableAction();
  // LOCATION_TOUCHPOINT — registered list, not a hardcoded array.
  // Default destination is the first registered location that isn't
  // the current one, so user-renamed/added locations work.
  const { locations } = useLocations();

  useEffect(() => {
    if (open && event) {
      setPortion(event.quantity);
      const current = event.location || '';
      const next = locations.find((l) => l.key !== current) ?? locations[0];
      setDestination(next?.key ?? 'pantry');
    }
  }, [open, event, locations]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  if (!open || !event) return null;

  const fullQty = event.quantity;
  const isPartial = portion < fullQty - 1e-9;
  const inputMin = Math.min(0.1, fullQty);
  const sameLocation =
    !!event.location && destination === event.location;

  function handleConfirm() {
    if (!event) return;
    if (sameLocation) return;
    const target = event;
    const qty = portion;
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
        ? `Moved ${qty} of "${target.catalog_display}" to ${dest}`
        : `Moved "${target.catalog_display}" to ${dest}`,
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-ga-bg-card border border-ga-border rounded-xl shadow-2xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-ga-border">
          <h3 className="text-base font-semibold text-ga-text-primary">
            Move "{event.catalog_display}"
          </h3>
          <p className="text-xs text-ga-text-secondary mt-1">
            From <span className="text-ga-text-primary">📍 {event.location || '—'}</span> to a new location.
            Pick a portion if only some should move.
          </p>
        </div>

        <div className="px-5 py-3 border-b border-ga-border space-y-2">
          <div className="flex items-center justify-between text-xs text-ga-text-secondary">
            <span>How many?</span>
            <span className="text-ga-text-primary font-medium tabular-nums">
              {portion} of {fullQty}
              {isPartial && (
                <span className="ml-1 text-ga-text-secondary">
                  ({(fullQty - portion).toFixed(1)} stays at {event.location})
                </span>
              )}
            </span>
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="range"
              min={inputMin}
              max={fullQty}
              step={0.1}
              value={portion}
              onChange={(e) => setPortion(Number(e.target.value))}
              className="flex-1 accent-blue-500"
            />
            <button
              type="button"
              onClick={() => setPortion(Math.max(inputMin, Math.ceil(portion) - 1))}
              disabled={portion <= inputMin + 1e-9}
              className="w-7 h-7 rounded border border-ga-border text-ga-text-primary hover:bg-ga-bg-hover disabled:opacity-40 disabled:cursor-not-allowed text-base leading-none"
              aria-label="Decrease by 1 (snaps to whole number)"
            >
              −
            </button>
            <input
              type="number"
              min={inputMin}
              max={fullQty}
              step={0.1}
              value={portion}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isFinite(v)) return;
                setPortion(Math.max(inputMin, Math.min(fullQty, v)));
              }}
              className="w-16 px-2 py-1 text-sm bg-ga-bg-app border border-ga-border rounded text-ga-text-primary tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => setPortion(Math.min(fullQty, Math.floor(portion) + 1))}
              disabled={portion >= fullQty - 1e-9}
              className="w-7 h-7 rounded border border-ga-border text-ga-text-primary hover:bg-ga-bg-hover disabled:opacity-40 disabled:cursor-not-allowed text-base leading-none"
              aria-label="Increase by 1 (snaps to whole number)"
            >
              +
            </button>
          </div>
        </div>

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
        </div>

        <div className="px-5 py-3 border-t border-ga-border flex justify-end gap-2">
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
