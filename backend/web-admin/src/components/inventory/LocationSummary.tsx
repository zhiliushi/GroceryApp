import { Link } from 'react-router-dom';
import { useLocations } from '@/api/queries/useLocations';
import type { InventoryItem } from '@/types/api';

interface LocationSummaryProps {
  items: InventoryItem[];
}

export default function LocationSummary({ items }: LocationSummaryProps) {
  const { locations } = useLocations();

  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  // Count active items per location
  const activeItems = items.filter((i) => i.status === 'active');

  const locationStats = locations.map((loc) => {
    const locItems = activeItems.filter(
      (i) => (i.location || i.storage_location) === loc.key,
    );
    const expiring = locItems.filter((i) => {
      const exp = i.expiryDate ?? i.expiry_date;
      if (!exp) return false;
      const ms = exp > 1e12 ? exp : exp * 1000;
      return ms - now < sevenDays;
    });
    return { ...loc, count: locItems.length, expiringCount: expiring.length };
  });

  // Items with no location
  const noLocCount = activeItems.filter(
    (i) => !i.location && !i.storage_location,
  ).length;

  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-ga-border">
        <h3 className="text-sm font-semibold text-ga-text-primary">Storage Locations</h3>
      </div>

      <div className="divide-y divide-ga-border/30">
        {locationStats.map((loc) => (
          <Link
            key={loc.key}
            to="/inventory"
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-ga-bg-hover transition-colors"
          >
            <div
              className="w-1.5 h-8 rounded-full flex-shrink-0"
              style={{ backgroundColor: loc.color }}
            />
            <span className="text-base">{loc.icon}</span>
            <span className="text-sm text-ga-text-primary font-medium flex-1">{loc.name}</span>
            <span className="text-xs text-ga-text-secondary">
              {loc.count} {loc.count === 1 ? 'item' : 'items'}
            </span>
            {loc.expiringCount > 0 && (
              <span className="text-xs bg-orange-500/20 text-orange-400 rounded px-1.5 py-0.5">
                {loc.expiringCount} expiring
              </span>
            )}
            {loc.count === 0 && (
              <span className="text-xs text-ga-text-secondary/50 italic">empty</span>
            )}
          </Link>
        ))}

        {noLocCount > 0 && (
          <Link
            to="/inventory"
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-ga-bg-hover transition-colors"
          >
            <div className="w-1.5 h-8 rounded-full bg-gray-500 flex-shrink-0" />
            <span className="text-base">📍</span>
            <span className="text-sm text-ga-text-secondary flex-1">No Location</span>
            <span className="text-xs bg-yellow-500/20 text-yellow-400 rounded px-1.5 py-0.5">
              {noLocCount} items need location
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}
