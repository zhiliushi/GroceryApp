import { useEffect } from 'react';

/**
 * Lock body scroll while `active` is true.
 *
 * Used by modal components so the page behind the modal doesn't scroll
 * when the user wheels / touches inside (or even outside) the modal
 * card. Without this, a wheel event over the backdrop falls through to
 * `document.body` and the underlying page moves — the original
 * QuickAddModal complaint.
 *
 * Multi-modal safe: the hook stacks. Each active instance pushes the
 * lock; when all instances unmount or pass `active=false`, the previous
 * `overflow` style is restored.
 *
 * Implementation note: we don't use `position: fixed` body-shifting
 * tricks (which iOS Safari needs for scroll-position preservation).
 * For this app's web-only desktop-first surface, plain
 * `overflow: hidden` + a counter is enough.
 */
let activeLockCount = 0;
let savedOverflow: string | null = null;

export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    if (activeLockCount === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    activeLockCount += 1;

    return () => {
      activeLockCount = Math.max(0, activeLockCount - 1);
      if (activeLockCount === 0) {
        document.body.style.overflow = savedOverflow ?? '';
        savedOverflow = null;
      }
    };
  }, [active]);
}
