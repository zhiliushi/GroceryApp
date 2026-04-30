import { cn } from '@/utils/cn';
import type { CatalogOverviewCurrentLocation } from '@/types/api';

interface Props {
  locations: CatalogOverviewCurrentLocation[];
  baseUnitLabel?: string;
  /** Per-location quick-actions. When provided, renders Use 1 / Move buttons
   *  on each card. Use case: catalog overview page, where the user wants to
   *  act on a specific spot's stock without leaving the page. */
  onUseAtLocation?: (location: string) => void;
  onMoveAtLocation?: (location: string, eventId: string | null) => void;
  /** Disable the Use button while a mutation is in flight. */
  useBusyLocation?: string | null;
}

/**
 * Active inventory grouped by location — answers "where do I have this now?".
 *
 * Phase E expansion (post-deploy feedback): the old My Items list rendered
 * each event as a row, so a single item ("Eggs") at multiple locations
 * looked like duplicates. This component is the consolidated answer:
 * one card with each location's qty + soonest expiry. Per-location actions
 * (Use 1 FIFO / Move) added so the user doesn't have to navigate away to
 * act on a specific spot.
 */
export default function CurrentLocations({
  locations,
  baseUnitLabel = 'unit',
  onUseAtLocation,
  onMoveAtLocation,
  useBusyLocation,
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
          const showActions = !!(onUseAtLocation || onMoveAtLocation);
          const useBusy = useBusyLocation === loc.location;
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

              {showActions && (
                <div className="flex gap-1.5 mt-2 pt-2 border-t border-ga-border/50">
                  {onUseAtLocation && (
                    <button
                      type="button"
                      onClick={() => onUseAtLocation(loc.location)}
                      disabled={useBusy}
                      title="Mark the oldest-expiry batch in this location as used (FIFO)"
                      className={cn(
                        'flex-1 px-2 py-1 text-[11px] rounded border transition',
                        useBusy
                          ? 'border-ga-border text-ga-text-secondary cursor-wait'
                          : 'border-ga-accent/40 bg-ga-accent/10 text-ga-accent hover:bg-ga-accent/20',
                      )}
                    >
                      {useBusy ? '…' : '✓ Use 1'}
                    </button>
                  )}
                  {onMoveAtLocation && (
                    <button
                      type="button"
                      onClick={() => onMoveAtLocation(loc.location, loc.most_urgent_event_id)}
                      disabled={!loc.most_urgent_event_id}
                      title={
                        loc.most_urgent_event_id
                          ? 'Move the most-urgent batch in this location'
                          : 'Nothing to move'
                      }
                      className="flex-1 px-2 py-1 text-[11px] rounded border border-ga-border text-ga-text-secondary hover:bg-ga-bg-hover disabled:opacity-50"
                    >
                      ↪ Move
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
