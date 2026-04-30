import { cn } from '@/utils/cn';
import type { CatalogOverviewCurrentLocation } from '@/types/api';

interface Props {
  locations: CatalogOverviewCurrentLocation[];
  baseUnitLabel?: string;
}

/**
 * Active inventory grouped by location — answers "where do I have this now?".
 *
 * Phase E expansion (post-deploy feedback): the old My Items list rendered
 * each event as a row, so a single item ("Eggs") at multiple locations
 * looked like duplicates. This component is the consolidated answer:
 * one card with each location's qty + soonest expiry.
 */
export default function CurrentLocations({
  locations,
  baseUnitLabel = 'unit',
}: Props) {
  if (locations.length === 0) {
    return (
      <p className="text-xs text-ga-text-secondary italic">
        Nothing currently active. Buy more to see where you have it.
      </p>
    );
  }

  const totalQty = locations.reduce((sum, l) => sum + l.active_qty, 0);

  return (
    <div className="space-y-2">
      <p className="text-xs text-ga-text-secondary">
        {totalQty.toFixed(totalQty % 1 === 0 ? 0 : 1)} {baseUnitLabel}
        {totalQty === 1 ? '' : 's'} across{' '}
        <strong className="text-ga-text-primary">{locations.length}</strong>{' '}
        location{locations.length === 1 ? '' : 's'}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {locations.map((loc) => {
          const expiry = loc.soonest_expiry ? new Date(loc.soonest_expiry) : null;
          const daysToExpiry = expiry
            ? Math.round((expiry.getTime() - Date.now()) / 86400000)
            : null;
          const tone =
            daysToExpiry == null
              ? 'gray'
              : daysToExpiry < 0
                ? 'red'
                : daysToExpiry <= 3
                  ? 'orange'
                  : daysToExpiry <= 7
                    ? 'yellow'
                    : 'green';
          return (
            <div
              key={loc.location}
              className={cn(
                'bg-ga-bg-card border rounded p-3',
                tone === 'red' && 'border-red-500/40',
                tone === 'orange' && 'border-orange-500/40',
                tone === 'yellow' && 'border-yellow-500/40',
                tone === 'green' && 'border-green-500/40',
                tone === 'gray' && 'border-ga-border',
              )}
            >
              <div className="flex items-baseline justify-between">
                <div className="text-sm text-ga-text-primary font-medium">
                  📍 {loc.location}
                </div>
                <div className="text-sm text-ga-text-primary tabular-nums">
                  {loc.active_qty.toFixed(loc.active_qty % 1 === 0 ? 0 : 1)} {baseUnitLabel}
                  {loc.active_qty === 1 ? '' : 's'}
                </div>
              </div>
              <div className="text-[10px] text-ga-text-secondary mt-0.5 flex items-center justify-between">
                <span>
                  {loc.active_event_count} batch
                  {loc.active_event_count === 1 ? '' : 'es'}
                </span>
                {expiry ? (
                  <span
                    className={cn(
                      'tabular-nums',
                      tone === 'red' && 'text-red-400',
                      tone === 'orange' && 'text-orange-400',
                      tone === 'yellow' && 'text-yellow-400',
                      tone === 'green' && 'text-green-400',
                    )}
                  >
                    {daysToExpiry != null && daysToExpiry < 0
                      ? `expired ${Math.abs(daysToExpiry)}d ago`
                      : daysToExpiry === 0
                        ? 'expires today'
                        : `expires in ${daysToExpiry}d`}
                  </span>
                ) : (
                  <span>no expiry</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
