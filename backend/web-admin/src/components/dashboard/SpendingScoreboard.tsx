import { Link } from 'react-router-dom';
import { useSpendingSummary } from '@/api/queries/useWaste';
import { useFeatureFlags } from '@/api/queries/useFeatureFlags';
import { formatCurrencyWithSymbol } from '@/utils/format';
import { cn } from '@/utils/cn';

/**
 * Spending scoreboard — three-column "how am I doing?" view at the top of
 * the dashboard. This is the question Malaysian housewives ask first when
 * they open a grocery app: did I overspend this week, and is this month
 * tracking better than last month.
 *
 * All amounts are in the user's `currency_preference` (MYR for Shahir);
 * the backend converts at read-time via fx rates and returns
 * `display_currency` on the response. We render the symbol with
 * formatCurrencyWithSymbol — so MYR shows as "RM 87.40", not "87.40".
 *
 * The month-vs-last-month delta is the only number that earns its inches
 * here: an absolute number is hard to interpret (is RM 104 a lot?), but
 * "↑ 12% vs last month" gives the user a verdict at a glance.
 */
export default function SpendingScoreboard() {
  const { data: flags } = useFeatureFlags();
  const week = useSpendingSummary('week');
  const month = useSpendingSummary('month');
  const lastMonth = useSpendingSummary('last_month');

  if (flags && flags.financial_tracking === false) return null;

  const currency = month.data?.display_currency || 'SGD';
  const monthTotal = month.data?.grand_total ?? 0;
  const lastMonthTotal = lastMonth.data?.grand_total ?? 0;
  const delta = computeDelta(monthTotal, lastMonthTotal);

  const loading = week.isLoading || month.isLoading || lastMonth.isLoading;

  return (
    <Link
      to="/spending"
      className="block bg-ga-bg-card border border-ga-border rounded-lg p-4 hover:border-ga-accent/50 transition-colors"
    >
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold text-ga-text-primary">Your spending</h3>
        <span className="text-[11px] text-ga-text-secondary">tap for details →</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Column
          label="This week"
          hint="last 7 days"
          amount={week.data?.grand_total}
          currency={currency}
          loading={loading}
        />
        <Column
          label="This month"
          hint="from the 1st"
          amount={month.data?.grand_total}
          currency={currency}
          loading={loading}
          highlight
          footer={
            delta && (
              <span
                className={cn(
                  'text-[11px] font-medium',
                  delta.direction === 'up'
                    ? 'text-orange-400'
                    : delta.direction === 'down'
                    ? 'text-green-500'
                    : 'text-ga-text-secondary',
                )}
              >
                {delta.direction === 'up' ? '↑' : delta.direction === 'down' ? '↓' : '·'}{' '}
                {delta.label}
              </span>
            )
          }
        />
        <Column
          label="Last month"
          hint="full month"
          amount={lastMonth.data?.grand_total}
          currency={currency}
          loading={loading}
          dim
        />
      </div>

      {month.data?.untracked_count ? (
        <p className="mt-3 text-[11px] text-ga-text-secondary">
          {month.data.untracked_count} purchase{month.data.untracked_count === 1 ? '' : 's'}{' '}
          this month had no price recorded — add prices to keep this accurate.
        </p>
      ) : null}
    </Link>
  );
}

function Column({
  label,
  hint,
  amount,
  currency,
  loading,
  highlight,
  dim,
  footer,
}: {
  label: string;
  hint: string;
  amount: number | undefined;
  currency: string;
  loading: boolean;
  highlight?: boolean;
  dim?: boolean;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-md p-2.5 flex flex-col',
        highlight && 'bg-ga-accent/5 border border-ga-accent/20',
        dim && 'opacity-80',
      )}
    >
      <div className="text-[11px] text-ga-text-secondary leading-tight">{label}</div>
      <div className="text-[10px] text-ga-text-secondary leading-tight">{hint}</div>
      <div
        className={cn(
          'mt-1 font-bold tabular-nums',
          highlight ? 'text-ga-text-primary text-xl' : 'text-ga-text-primary text-base',
        )}
      >
        {loading ? '…' : formatCurrencyWithSymbol(amount ?? 0, currency)}
      </div>
      {footer ? <div className="mt-1">{footer}</div> : null}
    </div>
  );
}

interface Delta {
  direction: 'up' | 'down' | 'flat';
  label: string;
}

function computeDelta(current: number, prior: number): Delta | null {
  if (prior <= 0 && current <= 0) return null;
  if (prior <= 0) return { direction: 'up', label: 'first month tracked' };
  const diff = current - prior;
  const pct = (diff / prior) * 100;
  if (Math.abs(pct) < 1) return { direction: 'flat', label: 'about the same' };
  const sign = pct > 0 ? 'up' : 'down';
  return { direction: sign, label: `${Math.abs(pct).toFixed(0)}% vs last month` };
}
