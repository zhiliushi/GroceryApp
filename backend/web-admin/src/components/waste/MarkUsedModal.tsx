import { useEffect, useState } from 'react';
import { useChangePurchaseStatus } from '@/api/mutations/usePurchaseMutations';
import { useUndoableAction } from '@/hooks/useUndoableAction';
import type { PurchaseEvent } from '@/types/api';

interface MarkUsedModalProps {
  open: boolean;
  event: PurchaseEvent | null;
  onClose: () => void;
}

export default function MarkUsedModal({ open, event, onClose }: MarkUsedModalProps) {
  const [portion, setPortion] = useState<number>(1);
  const changeStatus = useChangePurchaseStatus();
  const undoable = useUndoableAction();

  useEffect(() => {
    if (open && event) setPortion(event.quantity);
  }, [open, event]);

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
  // Slider snaps to whole numbers when there's at least one full unit so
  // drag-stops land on 1, 2, 3 ... N. Number input keeps finer min/step
  // so users can still type 0.5 of any quantity for a fractional portion.
  const sliderStep = fullQty < 1 ? 0.1 : 1;
  const sliderMin = fullQty < 1 ? Math.min(0.1, fullQty) : 1;
  const inputMin = Math.min(0.1, fullQty);

  function handleConfirm() {
    if (!event) return;
    const target = event;
    const qty = portion;
    onClose();
    undoable.run(
      () =>
        changeStatus.mutate({
          id: target.id,
          data: { status: 'used', reason: 'used_up', quantity: qty },
          silent: true,
        }),
      isPartial
        ? `Used ${qty} of "${target.catalog_display}"`
        : `Marked "${target.catalog_display}" as used`,
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
            Mark "{event.catalog_display}" as used
          </h3>
          <p className="text-xs text-ga-text-secondary mt-1">
            Pick the portion you used — partial amounts are fine.
          </p>
        </div>

        <div className="px-5 py-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-ga-text-secondary">
            <span>How many?</span>
            <span className="text-ga-text-primary font-medium tabular-nums">
              {portion} of {fullQty}
              {isPartial && (
                <span className="ml-1 text-ga-text-secondary">
                  ({fullQty - portion} stays active)
                </span>
              )}
            </span>
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="range"
              min={sliderMin}
              max={fullQty}
              step={sliderStep}
              value={portion}
              onChange={(e) => setPortion(Number(e.target.value))}
              className="flex-1 accent-ga-accent"
            />
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
              className="w-20 px-2 py-1 text-sm bg-ga-bg-app border border-ga-border rounded text-ga-text-primary tabular-nums"
            />
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
