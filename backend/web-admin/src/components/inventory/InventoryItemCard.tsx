import { Link } from 'react-router-dom';
import { formatExpiry } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { InventoryItem } from '@/types/api';

interface InventoryItemCardProps {
  item: InventoryItem;
}

export default function InventoryItemCard({ item }: InventoryItemCardProps) {
  const expiry = formatExpiry(item.expiryDate ?? item.expiry_date);
  const isDone = ['consumed', 'expired', 'discarded'].includes(item.status);
  const noExpiry = !item.expiryDate && !item.expiry_date;

  // Expiry urgency levels for visual treatment
  const expMs = getExpiryMs(item);
  const now = Date.now();
  const daysLeft = expMs ? Math.ceil((expMs - now) / (1000 * 60 * 60 * 24)) : null;

  const isExpired = daysLeft !== null && daysLeft < 0;
  const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 1; // today or tomorrow
  const isExpiring = daysLeft !== null && daysLeft > 1 && daysLeft <= 3;
  const isWarning = daysLeft !== null && daysLeft > 3 && daysLeft <= 7;

  const borderColor = isExpired
    ? 'border-l-red-500'
    : isUrgent
      ? 'border-l-red-400'
      : isExpiring
        ? 'border-l-orange-400'
        : isWarning
          ? 'border-l-yellow-400'
          : 'border-l-transparent';

  // Background highlight for urgent items
  const bgColor = isExpired
    ? 'bg-red-500/5'
    : isUrgent
      ? 'bg-orange-500/5'
      : '';

  // Household attribution (these fields are added by get_household_items)
  const ext = item as unknown as Record<string, unknown>;
  const memberIcon = ext._member_icon as string | undefined;
  const memberName = ext._member_name as string | undefined;
  const memberRole = ext._member_role as string | undefined;
  const isOther = memberName && memberName !== 'You';

  return (
    <Link
      to={`/inventory/${item.user_id}/${item.id}`}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 border-l-[3px] rounded-r-md transition-all hover:bg-ga-bg-hover group',
        borderColor,
        bgColor,
        isDone && 'opacity-40',
      )}
    >
      {/* Urgency indicator */}
      {(isExpired || isUrgent) && !isDone && (
        <span className="text-sm flex-shrink-0">
          {isExpired ? '🔴' : '⚡'}
        </span>
      )}

      {/* Name + brand + badges */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-medium text-ga-text-primary truncate', isDone && 'line-through')}>
            {item.name}
          </span>
          {item.brand && (
            <span className="text-xs text-ga-text-secondary truncate hidden sm:inline">{item.brand}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-0.5">
          {/* Household member badge */}
          {isOther && (
            <span className="text-[10px] bg-blue-500/15 text-blue-400 rounded px-1 py-0.5">
              {memberIcon ?? ''} {memberRole ?? memberName ?? ''}
            </span>
          )}
          {item.needsReview && (
            <span className="text-[10px] bg-yellow-500/20 text-yellow-400 rounded px-1 py-0.5">Review</span>
          )}
          {/* Action hint for expired items */}
          {isExpired && !isDone && (
            <span className="text-[10px] bg-red-500/20 text-red-400 rounded px-1 py-0.5">Use or discard</span>
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

      {/* Expiry — enhanced with countdown */}
      <div className="w-32 text-right flex-shrink-0">
        {noExpiry ? (
          <span className="text-[10px] text-ga-text-secondary/30 italic">No expiry set</span>
        ) : isExpired ? (
          <span className="text-xs font-bold text-red-500">
            Expired {Math.abs(daysLeft!)}d ago
          </span>
        ) : daysLeft !== null && daysLeft <= 1 ? (
          <span className="text-xs font-bold text-red-400">
            {daysLeft === 0 ? 'Expires today!' : 'Expires tomorrow!'}
          </span>
        ) : (
          <span className={cn('text-xs font-medium', expiry.className)}>{expiry.text}</span>
        )}
      </div>

      {/* Arrow */}
      <span className="text-ga-text-secondary/30 group-hover:text-ga-accent transition-colors text-sm">→</span>
    </Link>
  );
}

function getExpiryMs(item: InventoryItem): number | null {
  const exp = item.expiryDate ?? item.expiry_date;
  if (!exp) return null;
  return exp > 1e12 ? exp : exp * 1000;
}
