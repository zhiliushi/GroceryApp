import { cn } from '@/utils/cn';

/**
 * CSS skeleton placeholders. Plan UI principle: "skeleton placeholders for
 * lists/cards; spinner only for blocking writes".
 *
 * Base `<Skeleton />` is a raw shimmer block. Use composition helpers for
 * common shapes.
 */
export default function Skeleton({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-pulse bg-ga-bg-hover rounded',
        className,
      )}
      {...rest}
    />
  );
}

/** Card-shaped skeleton row — matches the height of a typical list item. */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-ga-bg-card border border-ga-border rounded-lg p-3 flex items-center gap-3',
        className,
      )}
    >
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-7 w-14" />
    </div>
  );
}

/** Skeleton for a group of rows (MyItems, CatalogList, etc.) */
export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

/** Dashboard card shimmer (hero + stats grid) */
export function SkeletonDashboardCard() {
  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4 space-y-3">
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-8 w-1/3" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-3" />
        <Skeleton className="h-3" />
        <Skeleton className="h-3" />
      </div>
    </div>
  );
}
