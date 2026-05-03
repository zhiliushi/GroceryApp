import { Link } from 'react-router-dom';
import WastePeriodCard from './WastePeriodCard';

/**
 * Waste scoreboard — symmetric mirror of SpendingScoreboard so the user
 * can compare "what I spent" vs "what I threw away" period-by-period
 * without context-switching layouts.
 *
 * Each period card is collapsed by default; expanding shows the top-5
 * most expensive thrown items in that window.
 */
export default function WasteScoreboard({ hideSeeAllLink = false }: { hideSeeAllLink?: boolean } = {}) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-semibold text-ga-text-primary">What you wasted</h3>
        {!hideSeeAllLink && (
          <Link to="/waste" className="text-xs text-ga-accent hover:underline">
            See all →
          </Link>
        )}
      </div>
      {/* Same mobile-featured layout as SpendingScoreboard (month at top
          full-width, week + last-month compact below). See SpendingScoreboard
          for layout reasoning. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1 sm:order-2">
          <WastePeriodCard
            period="month"
            label="This month"
            hint="from the 1st"
            highlight
          />
        </div>
        <div className="sm:order-1">
          <WastePeriodCard period="week" label="This week" hint="last 7 days" />
        </div>
        <div className="sm:order-3">
          <WastePeriodCard
            period="last_month"
            label="Last month"
            hint="full month"
          />
        </div>
      </div>
    </section>
  );
}
