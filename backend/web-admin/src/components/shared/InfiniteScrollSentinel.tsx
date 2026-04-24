import { useEffect, useRef } from 'react';

interface Props {
  onIntersect: () => void;
  enabled: boolean;
  loading?: boolean;
  rootMargin?: string;
}

/**
 * Invisible sentinel placed at the bottom of a list. Calls `onIntersect` when
 * scrolled into view — typically wired to `fetchNextPage` on a useInfiniteQuery.
 *
 * `enabled` should be `hasNextPage && !isFetchingNextPage`. The sentinel still
 * renders when disabled, so the layout stays stable.
 */
export default function InfiniteScrollSentinel({
  onIntersect,
  enabled,
  loading,
  rootMargin = '200px',
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            onIntersect();
            break;
          }
        }
      },
      { rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, onIntersect, rootMargin]);

  return (
    <div ref={ref} className="py-4 text-center text-xs text-ga-text-secondary">
      {loading ? 'Loading more…' : enabled ? ' ' : '— end —'}
    </div>
  );
}
