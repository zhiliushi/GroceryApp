import { useRef } from 'react';
import { toast } from 'sonner';

/**
 * Delay a destructive action so the user can undo it from a toast (plan UI
 * principle: "Undo over confirm" — no up-front "Are you sure?" dialogs).
 *
 * Pattern: `run(actionFn, label, delay)` schedules `actionFn` to fire after
 * `delay` ms (default 5000) and shows a sonner toast with an Undo button. If
 * the user clicks Undo within the window, the timer is cleared and the action
 * never fires. If the user navigates away, the timer runs anyway — best-effort;
 * the mutation commits as if the user had waited.
 *
 * Why not round-trip the backend then revert? Backend status transitions are
 * terminal (active → used/thrown/transferred can't be reversed by design) so
 * we keep the optimism client-side and defer the commit.
 */
interface UseUndoableActionResult {
  run: (action: () => void, label: string, delay?: number) => void;
}

export function useUndoableAction(): UseUndoableActionResult {
  // Timers are intentionally NOT cleared on unmount — if the user navigates
  // away (e.g. after tapping Delete on a detail page that redirects), their
  // intent was to commit; silently cancelling would be worse than finishing.
  // React Query's mutation client is global, so `mutate` in the closure stays
  // valid even after the component unmounts.
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  function run(action: () => void, label: string, delay = 5000): void {
    let cancelled = false;
    const timerId = setTimeout(() => {
      timersRef.current.delete(timerId);
      if (!cancelled) action();
    }, delay);
    timersRef.current.add(timerId);

    toast(label, {
      duration: delay,
      action: {
        label: 'Undo',
        onClick: () => {
          cancelled = true;
          clearTimeout(timerId);
          timersRef.current.delete(timerId);
          toast.success('Undone');
        },
      },
    });
  }

  return { run };
}
