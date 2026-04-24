import { useState } from 'react';
import { useWasteSummary } from '@/api/queries/useWaste';
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

export default function WastePage() {
  const [period, setPeriod] = useState<Period>('month');
  const { data, isLoading } = useWasteSummary(period);

  return (
    <div className="p-6 space-y-4">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Waste' }]} />
      <PageHeader title="Waste breakdown" icon="🗑️" />

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
        <LoadingSpinner text="Loading waste summary…" />
      ) : !data ? null : (
        <>
          <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs text-ga-text-secondary">Thrown this {period}</div>
                <div className="text-3xl font-bold text-red-500">{data.thrown_count}</div>
              </div>
              <div>
                <div className="text-xs text-ga-text-secondary">Total value</div>
                <div className="text-lg font-semibold text-ga-text-primary">{data.thrown_value.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {data.top_wasted.length > 0 && (
            <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5">
              <h3 className="text-sm font-semibold text-ga-text-primary mb-3">Top wasted items</h3>
              <ul className="space-y-2">
                {data.top_wasted.map((item) => (
                  <li
                    key={item.catalog_name_norm}
                    className="flex items-center justify-between text-sm py-2 border-b border-ga-border/40 last:border-0"
                  >
                    <span className="text-ga-text-primary">{item.display_name}</span>
                    <span className="text-ga-text-secondary">
                      {item.count}× · {item.total_value.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
