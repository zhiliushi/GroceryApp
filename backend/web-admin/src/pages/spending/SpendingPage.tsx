import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSpendingSummary } from '@/api/queries/useWaste';
import { useFeatureFlags } from '@/api/queries/useFeatureFlags';
import PageHeader from '@/components/shared/PageHeader';
import Breadcrumbs from '@/components/shared/Breadcrumbs';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { cn } from '@/utils/cn';

type Period = 'week' | 'month' | 'year' | 'all';
const PERIODS: Array<{ key: Period; label: string; hint: string }> = [
  { key: 'week', label: 'Week', hint: 'Last 7 days (rolling).' },
  { key: 'month', label: 'Month', hint: 'From the 1st of this month to today.' },
  { key: 'year', label: 'Year', hint: 'From January 1 to today.' },
  { key: 'all', label: 'All time', hint: 'Everything you have bought since you started.' },
];

export default function SpendingPage() {
  const [period, setPeriod] = useState<Period>('month');
  const { data, isLoading } = useSpendingSummary(period);
  const { data: flags } = useFeatureFlags();
  const activeHint = PERIODS.find((p) => p.key === period)?.hint ?? '';

  return (
    <div className="p-6 space-y-4">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Spending' }]} />
      <PageHeader title="Spending breakdown" icon="💳" />

      <details className="bg-ga-bg-card border border-ga-border rounded-lg group">
        <summary className="cursor-pointer list-none px-4 py-2 text-xs text-ga-text-secondary flex items-center justify-between hover:bg-ga-bg-hover/40 rounded-lg">
          <span>ⓘ What does this page show?</span>
          <span className="text-[10px] group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="px-4 pb-3 pt-1 text-xs text-ga-text-secondary space-y-1.5 border-t border-ga-border">
          <p>
            <span className="text-ga-text-primary font-medium">Cash vs Card:</span>{' '}
            <em>Cash</em> is anything paid as cash; <em>Card</em> covers debit, credit and
            e-wallet (Touch &apos;n Go, GrabPay, etc.). Both columns are converted to your
            preferred currency.
          </p>
          <p>
            <span className="text-ga-text-primary font-medium">Grand total</span>{' '}
            is everything you bought in the period — Cash + Card + any payment method
            you didn&apos;t tag. It can be larger than Cash + Card alone if some purchases
            had a price but no payment method.
          </p>
          <p>
            <span className="text-ga-text-primary font-medium">Items without a recorded price</span>{' '}
            don&apos;t go into any total. Open the item and add the receipt amount to see it
            counted.
          </p>
          <p>
            <span className="text-ga-text-primary font-medium">Detailed history</span>{' '}
            below breaks the same window down per item, with a "wasted %" column so you
            can spot the items eating your money.
          </p>
        </div>
      </details>

      <div>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              title={p.hint}
              className={cn(
                'px-3 py-1 text-sm rounded',
                period === p.key ? 'bg-ga-accent text-white' : 'bg-ga-bg-hover text-ga-text-secondary',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-ga-text-secondary mt-1.5" aria-live="polite">
          {activeHint}
        </p>
      </div>

      {isLoading ? (
        <LoadingSpinner text="Loading spending summary…" />
      ) : !data ? null : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5">
            <div className="text-xs text-ga-text-secondary" title="Purchases tagged as cash payment">💵 Cash</div>
            <div className="text-2xl font-bold text-ga-text-primary">{data.cash_total.toFixed(2)}</div>
          </div>
          <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5">
            <div className="text-xs text-ga-text-secondary" title="Debit, credit, or e-wallet">💳 Card</div>
            <div className="text-2xl font-bold text-ga-text-primary">{data.card_total.toFixed(2)}</div>
          </div>
          <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5">
            <div className="text-xs text-ga-text-secondary" title="Cash + Card + any other payment method">Grand total</div>
            <div className="text-2xl font-bold text-ga-accent">{data.grand_total.toFixed(2)}</div>
            {data.untracked_count > 0 && (
              <div className="text-xs text-ga-text-secondary mt-1" title="These purchases have no price yet, so they aren't counted in any total. Open the item to fill it in.">
                {data.untracked_count} item{data.untracked_count === 1 ? '' : 's'} without a recorded price
              </div>
            )}
          </div>
        </div>
      )}

      {flags?.financial_tracking !== false && (
        <Link
          to="/spending/history"
          className="block bg-ga-bg-card border border-ga-border rounded-lg p-4 hover:border-ga-accent/50 transition-colors"
        >
          <div className="text-sm font-semibold text-ga-text-primary">
            Detailed history — per-item spent vs wasted →
          </div>
          <div className="text-xs text-ga-text-secondary mt-1">
            See which items you spend most on, and how much of that money ends up in the bin.
          </div>
        </Link>
      )}
    </div>
  );
}
