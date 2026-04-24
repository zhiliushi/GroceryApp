import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSpendingSummary } from '@/api/queries/useWaste';
import { useFeatureFlags } from '@/api/queries/useFeatureFlags';
import PageHeader from '@/components/shared/PageHeader';
import Breadcrumbs from '@/components/shared/Breadcrumbs';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { cn } from '@/utils/cn';

type Period = 'week' | 'month' | 'year' | 'all';
const PERIODS: Array<{ key: Period; label: string }> = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'all', label: 'All time' },
];

export default function SpendingPage() {
  const [period, setPeriod] = useState<Period>('month');
  const { data, isLoading } = useSpendingSummary(period);
  const { data: flags } = useFeatureFlags();

  return (
    <div className="p-6 space-y-4">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Spending' }]} />
      <PageHeader title="Spending breakdown" icon="💳" />

      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={cn(
              'px-3 py-1 text-sm rounded',
              period === p.key ? 'bg-ga-accent text-white' : 'bg-ga-bg-hover text-ga-text-secondary',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSpinner text="Loading spending summary…" />
      ) : !data ? null : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5">
            <div className="text-xs text-ga-text-secondary">💵 Cash</div>
            <div className="text-2xl font-bold text-ga-text-primary">{data.cash_total.toFixed(2)}</div>
          </div>
          <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5">
            <div className="text-xs text-ga-text-secondary">💳 Card</div>
            <div className="text-2xl font-bold text-ga-text-primary">{data.card_total.toFixed(2)}</div>
          </div>
          <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5">
            <div className="text-xs text-ga-text-secondary">Grand total</div>
            <div className="text-2xl font-bold text-ga-accent">{data.grand_total.toFixed(2)}</div>
            {data.untracked_count > 0 && (
              <div className="text-xs text-ga-text-secondary mt-1">
                {data.untracked_count} items without a recorded price
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
