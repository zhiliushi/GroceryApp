import { Link } from 'react-router-dom';
import { formatExpiry } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { InventoryItem } from '@/types/api';

interface InventoryItemCardProps {
  item: InventoryItem;
}

export default function InventoryItemCard({ item }: InventoryItemCardProps) {
  const expiry = formatExpiry(item.expiryDate ?? item.expiry_date);
  const isExpired = expiry.text === 'Expired' || expiry.text.includes('ago');
  const isExpiring = expiry.className.includes('red') || expiry.className.includes('orange');
  const isDone = ['consumed', 'expired', 'discarded'].includes(item.status);
  const noLocation = !item.location && !item.storage_location;
  const noExpiry = !item.expiryDate && !item.expiry_date;

  const borderColor = isExpired
    ? 'border-l-red-500'
    : isExpiring
      ? 'border-l-orange-400'
      : 'border-l-transparent';

  return (
    <Link
      to={`/inventory/${item.user_id}/${item.id}`}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 border-l-[3px] rounded-r-md transition-all hover:bg-ga-bg-hover group',
        borderColor,
        isDone && 'opacity-40',
      )}
    >
      {/* Name + brand */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-medium text-ga-text-primary truncate', isDone && 'line-through')}>
            {item.name}
          </span>
          {item.brand && (
            <span className="text-xs text-ga-text-secondary truncate hidden sm:inline">
              {item.brand}
            </span>
          )}
        </div>

        {/* Badges row */}
        <div className="flex items-center gap-1.5 mt-0.5">
          {item.needsReview && (
            <span className="text-[10px] bg-yellow-500/20 text-yellow-400 rounded px-1 py-0.5">Review</span>
          )}
          {noLocation && !isDone && (
            <span className="text-[10px] bg-gray-500/20 text-gray-400 rounded px-1 py-0.5">No location</span>
          )}
          {isDone && (
            <span className="text-[10px] bg-gray-500/20 text-gray-400 rounded px-1 py-0.5 capitalize">{item.status}</span>
          )}
        </div>
      </div>

      {/* Quantity */}
      <div className="text-xs text-ga-text-secondary w-16 text-right flex-shrink-0">
        {item.quantity != null ? (
          <span>{item.quantity} {item.unit || ''}</span>
        ) : (
          <span className="text-ga-text-secondary/30">—</span>
        )}
      </div>

      {/* Expiry */}
      <div className="w-28 text-right flex-shrink-0">
        {noExpiry ? (
          <span className="text-xs text-ga-text-secondary/30">No expiry</span>
        ) : (
          <span className={cn('text-xs font-medium', expiry.className)}>{expiry.text}</span>
        )}
      </div>

      {/* Hover arrow */}
      <span className="text-ga-text-secondary/30 group-hover:text-ga-accent transition-colors text-sm">
        →
      </span>
    </Link>
  );
}
