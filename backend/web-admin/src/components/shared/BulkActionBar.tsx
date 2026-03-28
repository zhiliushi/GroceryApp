import { cn } from '@/utils/cn';

interface BulkActionBarProps {
  count: number;
  children: React.ReactNode;
  className?: string;
}

export default function BulkActionBar({ count, children, className }: BulkActionBarProps) {
  if (count === 0) return null;

  return (
    <div
      className={cn(
        'bg-ga-bg-card border-2 border-ga-accent rounded-lg px-4 py-2 flex items-center justify-between flex-wrap gap-2 animate-in slide-in-from-top-2',
        className,
      )}
    >
      <span className="text-sm text-ga-text-primary">
        <strong>{count}</strong> product(s) selected
      </span>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}
