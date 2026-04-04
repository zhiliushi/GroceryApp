import { useState, useCallback, useMemo } from 'react';
import InventoryItemCard from './InventoryItemCard';
import { cn } from '@/utils/cn';
import type { InventoryItem } from '@/types/api';
import type { LocationItem } from '@/types/api';

interface LocationGroupProps {
  location: LocationItem | null;  // null = "No Location" group
  items: InventoryItem[];
  defaultExpanded?: boolean;
}

const INITIAL_SHOW = 20;

export default function LocationGroup({ location, items, defaultExpanded }: LocationGroupProps) {
  const hasUrgent = useMemo(
    () => items.some((item) => {
      const exp = item.expiryDate ?? item.expiry_date;
      if (!exp) return false;
      const ms = exp > 1e12 ? exp : exp * 1000;
      return ms - Date.now() < 7 * 24 * 60 * 60 * 1000;
    }),
    [items],
  );

  const [expanded, setExpanded] = useState(defaultExpanded ?? ((items.length > 0 && hasUrgent) || items.length > 0));
  const [showAll, setShowAll] = useState(false);

  const toggleExpanded = useCallback(() => setExpanded((p) => !p), []);

  const visibleItems = showAll ? items : items.slice(0, INITIAL_SHOW);
  const hasMore = items.length > INITIAL_SHOW && !showAll;

  const icon = location?.icon ?? '📍';
  const name = location?.name ?? 'No Location';
  const color = location?.color ?? '#6B7280';

  return (
    <div className="mb-3">
      {/* Section header */}
      <button
        onClick={toggleExpanded}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-ga-bg-hover transition-colors group"
      >
        <div
          className="w-1 h-6 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-base">{icon}</span>
        <span className="text-sm font-semibold text-ga-text-primary uppercase tracking-wide">
          {name}
        </span>
        <span className="text-xs text-ga-text-secondary">
          ({items.length} {items.length === 1 ? 'item' : 'items'})
        </span>
        {items.length === 0 && (
          <span className="text-xs text-ga-text-secondary/50 italic">empty</span>
        )}
        <span className="ml-auto text-ga-text-secondary/50 text-xs group-hover:text-ga-text-secondary transition-colors">
          {expanded ? '▼' : '▶'}
        </span>
      </button>

      {/* Items */}
      {expanded && items.length > 0 && (
        <div className={cn(
          'ml-3 border-l-2 rounded-bl-lg',
        )} style={{ borderColor: `${color}30` }}>
          {visibleItems.map((item) => (
            <InventoryItemCard key={`${item.user_id}-${item.id}`} item={item} />
          ))}

          {hasMore && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full text-center py-2 text-xs text-ga-accent hover:underline"
            >
              Show all {items.length} items
            </button>
          )}
        </div>
      )}
    </div>
  );
}
