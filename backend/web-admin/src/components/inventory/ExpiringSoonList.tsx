import { Link } from 'react-router-dom';
import { formatExpiry } from '@/utils/format';
import { useLocations } from '@/api/queries/useLocations';
import type { InventoryItem } from '@/types/api';

interface ExpiringSoonListProps {
  items: InventoryItem[];
  limit?: number;
}

export default function ExpiringSoonList({ items, limit = 5 }: ExpiringSoonListProps) {
  const { getLocation } = useLocations();

  // Filter to active + has expiry + expiring within 7 days (or already expired)
  const now = Date.now();
  const urgent = items
    .filter((item) => {
      if (item.status !== 'active') return false;
      const exp = item.expiryDate ?? item.expiry_date;
      if (!exp) return false;
      const ms = exp > 1e12 ? exp : exp * 1000;
      return ms - now < 7 * 24 * 60 * 60 * 1000;
    })
    .sort((a, b) => {
      const aExp = (a.expiryDate ?? a.expiry_date ?? 0);
      const bExp = (b.expiryDate ?? b.expiry_date ?? 0);
      const aMs = aExp > 1e12 ? aExp : aExp * 1000;
      const bMs = bExp > 1e12 ? bExp : bExp * 1000;
      return aMs - bMs;
    })
    .slice(0, limit);

  const expiredActive = items.filter((i) => {
    if (i.status !== 'active') return false;
    const exp = i.expiryDate ?? i.expiry_date;
    if (!exp) return false;
    const ms = exp > 1e12 ? exp : exp * 1000;
    return ms < now;
  });

  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-ga-border">
        <h3 className="text-sm font-semibold text-ga-text-primary flex items-center gap-2">
          {urgent.length > 0 ? '⚠️' : '✅'} Expiring Soon
          {urgent.length > 0 && (
            <span className="bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
              {urgent.length}
            </span>
          )}
        </h3>
        <Link to="/inventory" className="text-xs text-ga-accent hover:underline">View All →</Link>
      </div>

      {/* Expired alert */}
      {expiredActive.length > 0 && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2">
          <Link to="/inventory" className="text-xs text-red-400 font-medium hover:underline">
            🔴 {expiredActive.length} item{expiredActive.length > 1 ? 's' : ''} past expiry date — handle now
          </Link>
        </div>
      )}

      {urgent.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-green-400">
          All items are fresh!
        </div>
      ) : (
        <div className="divide-y divide-ga-border/30">
          {urgent.map((item) => {
            const exp = formatExpiry(item.expiryDate ?? item.expiry_date);
            const loc = getLocation(item.location || item.storage_location);
            return (
              <Link
                key={`${item.user_id}-${item.id}`}
                to={`/inventory/${item.user_id}/${item.id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-ga-bg-hover transition-colors"
              >
                <span className={exp.className.includes('red') ? 'text-red-400' : 'text-orange-400'}>
                  {exp.className.includes('red') ? '🔴' : '⚠️'}
                </span>
                <span className="text-sm text-ga-text-primary font-medium flex-1 truncate">{item.name}</span>
                {loc && <span className="text-xs text-ga-text-secondary">{loc.icon} {loc.name}</span>}
                <span className={`text-xs font-medium ${exp.className}`}>{exp.text}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
