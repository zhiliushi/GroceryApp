import { Link } from 'react-router-dom';
import { useFeatureFlags } from '@/api/queries/useFeatureFlags';
import SpendingPeriodCard from './SpendingPeriodCard';

/**
 * Spending scoreboard — three independent period cards (this week,
 * this month, last month) the user can expand individually.
 *
 * Earlier design used one card with three columns. Real feedback was
 * that it felt cramped and the per-period breakdown wasn't surfaceable
 * — there was no place to show the items behind the number. Splitting
 * each period into its own card lets each one own its own "tap to see
 * what made up this number" reveal.
 *
 * The three cards line up horizontally on desktop, stack on mobile.
 * "This month" is the highlighted card — it's the figure she watches
 * most closely.
 *
 * All amounts are in the user's `currency_preference` (MYR for Shahir);
 * the backend converts at read-time and returns `display_currency` on
 * each response.
 */
export default function SpendingScoreboard() {
  const { data: flags } = useFeatureFlags();
  if (flags && flags.financial_tracking === false) return null;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-semibold text-ga-text-primary">Your spending</h3>
        <Link to="/spending" className="text-xs text-ga-accent hover:underline">
          See all →
        </Link>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <SpendingPeriodCard period="week" label="This week" hint="last 7 days" />
        <SpendingPeriodCard
          period="month"
          label="This month"
          hint="from the 1st"
          highlight
        />
        <SpendingPeriodCard period="last_month" label="Last month" hint="full month" />
      </div>
    </section>
  );
}
