import { cn } from '@/utils/cn';
import type { CatalogOverviewCurrentLocation } from '@/types/api';

interface Props {
  locations: CatalogOverviewCurrentLocation[];
  baseUnitLabel?: string;
  /** Per-location quick-actions. When provided, renders Use… / Move buttons
   *  on each card. Use case: catalog overview page, where the user wants to
   *  act on a specific spot's stock without leaving the page.
   *
   *  Use… opens a quantity-picker modal scoped to the most-urgent batch in
   *  that location (the existing MarkUsedModal handles slider + spinner +
   *  partial qty). The eventId param is the most_urgent_event_id of the
   *  location, which the parent uses to fetch the event for the modal. */
  onUseAtLocation?: (location: string, eventId: string | null) => void;
  onMoveAtLocation?: (location: string, eventId: string | null) => void;
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
}: Props) {
  if (locations.length === 0) {
    return (
      <p className="text-xs text-ga-text-secondary italic">
        Nothing currently active. Buy more to see where you have it.
      </p>
    );
  }

  // Prefer per-location base_unit_label so we say "eggs" / "ml" honestly.
  // Fall back to prop only when the location entries don't carry one.
  const headlineUnit = locations[0]?.base_unit_label || baseUnitLabel;
  const totalBaseUnits = locations.reduce((sum, l) => sum + l.active_base_units, 0);

  return (
    <div className="space-y-2">
      <p className="text-xs text-ga-text-secondary">
        {formatNum(totalBaseUnits)} {headlineUnit}
        {totalBaseUnits === 1 ? '' : 's'} across{' '}
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
          const locUnit = loc.base_unit_label || baseUnitLabel;
          const packLabel = loc.mixed_pack_sizes
            ? 'mixed pack sizes'
            : loc.pack_sizes[0] && loc.pack_sizes[0] > 1
              ? `${loc.pack_sizes[0]} ${locUnit}${loc.pack_sizes[0] === 1 ? '' : 's'}/pack`
              : null;
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
              {/* Headline: base-units count + label, NOT the event-qty count
                  ("4 units" was misleading when 4 packs × 6 eggs = 24 eggs). */}
              <div className="flex items-baseline justify-between">
                <div className="text-sm text-ga-text-primary font-medium">
                  📍 {loc.location}
                </div>
                <div className="text-sm text-ga-text-primary tabular-nums">
                  {formatNum(loc.active_base_units)} {locUnit}
                  {loc.active_base_units === 1 ? '' : 's'}
                </div>
              </div>
              <div className="text-[10px] text-ga-text-secondary mt-0.5 flex items-center justify-between gap-2 flex-wrap">
                <span>
                  {loc.active_event_count} batch
                  {loc.active_event_count === 1 ? '' : 'es'}
                  {packLabel && <span className="ml-1">· {packLabel}</span>}
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
                      onClick={() => onUseAtLocation(loc.location, loc.most_urgent_event_id)}
                      disabled={!loc.most_urgent_event_id}
                      title="Pick how many to mark as used"
                      className={cn(
                        'flex-1 px-2 py-1 text-[11px] rounded border transition',
                        loc.most_urgent_event_id
                          ? 'border-ga-accent/40 bg-ga-accent/10 text-ga-accent hover:bg-ga-accent/20'
                          : 'border-ga-border text-ga-text-secondary opacity-50 cursor-not-allowed',
                      )}
                    >
                      ✓ Use…
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

/** Whole numbers without trailing zeros, otherwise one decimal. Avoids
 *  showing "4.0 eggs" when "4 eggs" is what the user wants to read. */
function formatNum(n: number): string {
  if (n === Math.floor(n)) return String(Math.round(n));
  return n.toFixed(1);
}
