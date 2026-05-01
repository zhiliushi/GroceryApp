import { useEffect, useState } from 'react';
import { useChangePurchaseStatus } from '@/api/mutations/usePurchaseMutations';
import { useUndoableAction } from '@/hooks/useUndoableAction';
import { cn } from '@/utils/cn';
import type { ConsumeReason, PurchaseEvent } from '@/types/api';

interface ThrowAwayModalProps {
  open: boolean;
  event: PurchaseEvent | null;
  onClose: () => void;
}

// 4 canonical reasons (validation-stage update 2026-05). Waste filter
// in `waste_service.get_waste_summary` only counts `expired` +
// `unexpected_event` as waste — `used_up` and `gift` don't.
// `unexpected_event` replaces the legacy `bad` (broader cover for
// spillage / freezer burn / mouldy / pet incident / kid spilled / etc.).
const REASONS: Array<{
  key: ConsumeReason;
  label: string;
  description: string;
  countsAsWaste: boolean;
}> = [
  { key: 'expired', label: 'Expired', description: 'Past its expiry date', countsAsWaste: true },
  { key: 'unexpected_event', label: 'Unexpected event', description: 'Spilled, mouldy, freezer burn, kid/pet incident, etc.', countsAsWaste: true },
  { key: 'used_up', label: 'Used up', description: "Actually used — doesn't count as waste", countsAsWaste: false },
  { key: 'gift', label: 'Given away', description: "Gifted to someone — doesn't count as waste", countsAsWaste: false },
];

export default function ThrowAwayModal({ open, event, onClose }: ThrowAwayModalProps) {
  const [reason, setReason] = useState<ConsumeReason>('expired');
  // Optional free-text complement to the canonical reason (e.g.
  // "fed to dog", "kid spilled", "found mouldy"). Stored alongside the
  // enum reason for later insight aggregation. Hook for the future
  // free-text-reason insights work.
  const [reasonText, setReasonText] = useState<string>('');
  const [portion, setPortion] = useState<number>(1);
  const changeStatus = useChangePurchaseStatus();
  const undoable = useUndoableAction();

  useEffect(() => {
    if (open && event) {
      setReason('expired');
      setReasonText('');
      setPortion(event.quantity);
    }
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
  // Universal rule: slider drag = 0.1 fine control (so 0.5, 0.7 reachable
  // by drag), number-input arrows = 1 whole unit (so a click on the
  // up-arrow goes 3 -> 4 not 3 -> 3.1). Manual typing in the number input
  // accepts any value within bounds, validation is loose on number step.
  const inputMin = Math.min(0.1, fullQty);

  function handleConfirm() {
    if (!event) return;
    // Close modal immediately; defer the actual mutation for 5s with Undo toast
    // (plan principle: Undo over confirm).
    const target = event;
    const qty = portion;
    const note = reasonText.trim();
    onClose();
    undoable.run(
      () =>
        changeStatus.mutate({
          id: target.id,
          data: {
            status: 'thrown',
            reason,
            reason_text: note || undefined,
            quantity: qty,
          },
          silent: true,
        }),
      isPartial
        ? `Threw ${qty} of "${target.catalog_display}" (${reason})`
        : `Threw "${target.catalog_display}" (${reason})`,
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
            Throw "{event.catalog_display}"
          </h3>
          <p className="text-xs text-ga-text-secondary mt-1">Pick a reason — helps build your waste stats</p>
        </div>

        <div className="px-5 py-3 border-b border-ga-border space-y-2">
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
              min={inputMin}
              max={fullQty}
              step={0.1}
              value={portion}
              onChange={(e) => setPortion(Number(e.target.value))}
              className="flex-1 accent-red-500"
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
          {REASONS.map((r) => (
            <button
              key={r.key}
              onClick={() => setReason(r.key)}
              className={cn(
                'w-full text-left px-3 py-2 rounded border flex items-start gap-3 transition-colors',
                reason === r.key
                  ? 'border-ga-accent bg-ga-accent/10'
                  : 'border-ga-border hover:bg-ga-bg-hover',
              )}
            >
              <div
                className={cn(
                  'w-4 h-4 mt-0.5 rounded-full border-2 flex-shrink-0 transition-all',
                  reason === r.key ? 'border-ga-accent bg-ga-accent' : 'border-ga-border',
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ga-text-primary">
                    {r.label}
                  </span>
                  {r.countsAsWaste && (
                    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/15 text-red-500 font-medium">
                      counts as waste
                    </span>
                  )}
                </div>
                <div className="text-xs text-ga-text-secondary">{r.description}</div>
              </div>
            </button>
          ))}

          {/* Optional free-text complement. Stored on the event as
              `consumed_reason_text` alongside the canonical enum
              `consumed_reason`. Hook for later insight aggregation
              ("you tend to throw out chicken because freezer burn"). */}
          <div className="pt-2">
            <label className="block text-[11px] text-ga-text-secondary mb-1">
              Note (optional)
            </label>
            <input
              type="text"
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="e.g. fed to dog, kid spilled, found mouldy…"
              maxLength={120}
              className="w-full px-3 py-2 text-sm bg-ga-bg-card border border-ga-border rounded text-ga-text-primary placeholder:text-ga-text-secondary focus:outline-none focus:border-ga-accent"
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
            className="px-4 py-1.5 text-sm font-medium bg-red-600 text-white rounded-md hover:opacity-90 disabled:opacity-60"
          >
            {changeStatus.isPending ? 'Saving…' : 'Throw away'}
          </button>
        </div>
      </div>
    </div>
  );
}
