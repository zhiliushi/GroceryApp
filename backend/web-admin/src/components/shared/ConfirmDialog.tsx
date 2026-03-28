import { useEffect, useRef } from 'react';
import { cn } from '@/utils/cn';
import type { ConfirmDialogState } from '@/hooks/useConfirmDialog';

interface ConfirmDialogProps {
  state: ConfirmDialogState | null;
  onCancel: () => void;
}

export default function ConfirmDialog({ state, onCancel }: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (state?.isOpen) {
      confirmRef.current?.focus();
    }
  }, [state?.isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state?.isOpen) onCancel();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [state?.isOpen, onCancel]);

  if (!state?.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={onCancel}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-ga-bg-card border border-ga-border rounded-xl shadow-2xl max-w-sm w-full mx-4 animate-in zoom-in-95 fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-ga-border">
          <h3 className="text-sm font-semibold text-ga-text-primary">{state.title}</h3>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-ga-text-secondary">{state.message}</p>
        </div>
        <div className="px-5 py-3 border-t border-ga-border flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover transition-colors"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            onClick={() => { state.onConfirm(); onCancel(); }}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              state.variant === 'danger'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-ga-accent hover:bg-ga-accent-hover text-white',
            )}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
