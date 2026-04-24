import { useEffect, useMemo, useState } from 'react';
import { useFoodbanks } from '@/api/queries/useFoodbanks';
import { useChangePurchaseStatus } from '@/api/mutations/usePurchaseMutations';
import { useUndoableAction } from '@/hooks/useUndoableAction';
import { cn } from '@/utils/cn';
import type { PurchaseEvent } from '@/types/api';

interface GiveAwayModalProps {
  open: boolean;
  event: PurchaseEvent | null;
  onClose: () => void;
}

export default function GiveAwayModal({ open, event, onClose }: GiveAwayModalProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string>('');
  const [manual, setManual] = useState<string>('');
  const [mode, setMode] = useState<'foodbank' | 'person'>('foodbank');

  const { data } = useFoodbanks();
  const changeStatus = useChangePurchaseStatus();
  const undoable = useUndoableAction();

  useEffect(() => {
    if (open) {
      setSearch('');
      setSelected('');
      setManual('');
      setMode('foodbank');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    if (!data?.foodbanks) return [];
    const q = search.trim().toLowerCase();
    const active = data.foodbanks.filter((f) => f.is_active);
    if (!q) return active.slice(0, 20);
    return active
      .filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          (f.location_name && f.location_name.toLowerCase().includes(q)),
      )
      .slice(0, 20);
  }, [data, search]);

  if (!open || !event) return null;

  const canConfirm =
    mode === 'foodbank' ? !!selected : !!manual.trim();

  function handleConfirm() {
    if (!event) return;
    const transferredTo = mode === 'foodbank' ? selected : manual.trim();
    if (!transferredTo) return;
    // Close immediately; defer mutation 5s behind Undo toast (plan principle).
    const target = event;
    onClose();
    undoable.run(
      () =>
        changeStatus.mutate({
          id: target.id,
          data: { status: 'transferred', reason: 'gift', transferred_to: transferredTo },
          silent: true,
        }),
      `Gave "${target.catalog_display}" to ${transferredTo}`,
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-ga-bg-card border border-ga-border rounded-xl shadow-2xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-ga-border">
          <h3 className="text-base font-semibold text-ga-text-primary">
            Give "{event.catalog_display}" away
          </h3>
          <p className="text-xs text-ga-text-secondary mt-1">
            Pick a foodbank or enter a recipient name
          </p>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="flex gap-2">
            {(['foodbank', 'person'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'flex-1 px-3 py-1.5 text-sm rounded border',
                  mode === m
                    ? 'bg-ga-accent text-white border-ga-accent'
                    : 'border-ga-border text-ga-text-secondary hover:bg-ga-bg-hover',
                )}
              >
                {m === 'foodbank' ? '🏢 Foodbank' : '👤 Person'}
              </button>
            ))}
          </div>

          {mode === 'foodbank' ? (
            <>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search foodbanks…"
                className="w-full px-3 py-2 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary focus:outline-none focus:border-ga-accent"
              />
              <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                {filtered.length === 0 ? (
                  <p className="text-xs text-ga-text-secondary italic text-center py-4">
                    No matching foodbanks
                  </p>
                ) : (
                  filtered.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setSelected(f.id)}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded border text-sm',
                        selected === f.id
                          ? 'border-ga-accent bg-ga-accent/10'
                          : 'border-ga-border hover:bg-ga-bg-hover',
                      )}
                    >
                      <div className="text-ga-text-primary font-medium">{f.name}</div>
                      {f.location_name && (
                        <div className="text-xs text-ga-text-secondary">📍 {f.location_name}</div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <input
              type="text"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Recipient name — e.g. 'Auntie Siti next door'"
              autoFocus
              className="w-full px-3 py-2 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary focus:outline-none focus:border-ga-accent"
            />
          )}
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
            disabled={!canConfirm || changeStatus.isPending}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md',
              canConfirm
                ? 'bg-purple-600 text-white hover:opacity-90'
                : 'bg-ga-bg-hover text-ga-text-secondary cursor-not-allowed',
            )}
          >
            {changeStatus.isPending ? 'Saving…' : 'Give away'}
          </button>
        </div>
      </div>
    </div>
  );
}
