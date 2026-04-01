import { cn } from '@/utils/cn';

interface ExpiryBarProps {
  purchaseDate: number | null | undefined;
  addedDate: number | null | undefined;
  expiryDate: number | null | undefined;
  className?: string;
}

export default function ExpiryBar({ purchaseDate, addedDate, expiryDate, className }: ExpiryBarProps) {
  if (!expiryDate) return null;

  const expiryMs = expiryDate > 1e12 ? expiryDate : expiryDate * 1000;
  const startMs = purchaseDate
    ? (purchaseDate > 1e12 ? purchaseDate : purchaseDate * 1000)
    : addedDate
      ? (addedDate > 1e12 ? addedDate : addedDate * 1000)
      : expiryMs - 30 * 24 * 60 * 60 * 1000; // fallback: assume 30 day shelf life

  const now = Date.now();
  const totalLife = expiryMs - startMs;
  const elapsed = now - startMs;
  const percent = totalLife > 0 ? Math.min(100, Math.max(0, (elapsed / totalLife) * 100)) : 100;

  const isExpired = now > expiryMs;
  const daysLeft = Math.ceil((expiryMs - now) / (24 * 60 * 60 * 1000));

  const barColor = isExpired
    ? 'bg-red-500'
    : percent > 80
      ? 'bg-red-400'
      : percent > 60
        ? 'bg-orange-400'
        : percent > 40
          ? 'bg-yellow-400'
          : 'bg-green-400';

  const label = isExpired
    ? `Expired ${Math.abs(daysLeft)} days ago`
    : `${Math.round(percent)}% of shelf life used — ${daysLeft} days left`;

  return (
    <div className={cn('space-y-1', className)}>
      <div className="h-2 bg-ga-bg-hover rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <p className={cn('text-xs', isExpired ? 'text-red-400' : 'text-ga-text-secondary')}>{label}</p>
    </div>
  );
}
