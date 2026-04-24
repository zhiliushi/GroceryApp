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

const REASONS: Array<{ key: ConsumeReason; label: string; description: string }> = [
  { key: 'expired', label: 'Expired', description: 'Past its expiry date' },
  { key: 'bad', label: 'Went bad', description: 'Spoiled before expiry' },
  { key: 'used_up', label: 'Used up', description: 'Actually used — mark as used instead' },
  { key: 'gift', label: 'Given away', description: 'Gifted to someone' },
];

export default function ThrowAwayModal({ open, event, onClose }: ThrowAwayModalProps) {
  const [reason, setReason] = useState<ConsumeReason>('expired');
  const changeStatus = useChangePurchaseStatus();
  const undoable = useUndoableAction();

  useEffect(() => {
    if (open) setReason('expired');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  if (!open || !event) return null;

  function handleConfirm() {
    if (!event) return;
    // Close modal immediately; defer the actual mutation for 5s with Undo toast
    // (plan principle: Undo over confirm).
    const target = event;
    onClose();
    undoable.run(
      () =>
        changeStatus.mutate({
          id: target.id,
          data: { status: 'thrown', reason },
          silent: true,
        }),
      `Threw "${target.catalog_display}" (${reason})`,
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
              <div>
                <div className="text-sm font-medium text-ga-text-primary">{r.label}</div>
                <div className="text-xs text-ga-text-secondary">{r.description}</div>
              </div>
            </button>
          ))}
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
