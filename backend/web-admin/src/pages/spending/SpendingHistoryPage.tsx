import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFinancialSummary } from '@/api/queries/useWaste';
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

export default function SpendingHistoryPage() {
  const [period, setPeriod] = useState<Period>('month');
  const { data: flags } = useFeatureFlags();
  const { data, isLoading, error } = useFinancialSummary(period);

  // Feature flag off (backend returns 404) — show an explainer instead of a broken page
  if (flags && flags.financial_tracking === false) {
    return (
      <div className="p-6 space-y-4">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', to: '/dashboard' },
            { label: 'Spending', to: '/spending' },
            { label: 'History' },
          ]}
        />
        <PageHeader title="Spending history" icon="💳" />
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-sm text-yellow-600">
          Financial tracking is turned off. Ask an admin to enable the{' '}
          <code>financial_tracking</code> flag in Admin Settings → Feature Flags.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'Spending', to: '/spending' },
          { label: 'History' },
        ]}
      />
      <PageHeader
        title="Spending history"
        icon="💳"
        subtitle="Per-item spent vs wasted"
      />

      <div className="flex gap-2 flex-wrap">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriod(p.key)}
            className={cn(
              'px-3 py-1 text-sm rounded',
              period === p.key
                ? 'bg-ga-accent text-white'
                : 'bg-ga-bg-hover text-ga-text-secondary',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSpinner text="Computing spent-vs-wasted…" />
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400">
          Failed to load financial summary.
        </div>
      ) : !data ? null : (
        <>
          {/* Hero summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Hero
              label="Total spent"
              value={data.grand_total_spent}
              prefix="RM"
              tone="neutral"
            />
            <Hero
              label="Wasted"
              value={data.grand_total_wasted}
              prefix="RM"
              tone="bad"
              subtitle={
                data.grand_total_spent > 0
                  ? `${(data.grand_waste_pct * 100).toFixed(1)}% of spend`
                  : undefined
              }
            />
            <Hero
              label="Kept"
              value={data.grand_total_spent - data.grand_total_wasted}
              prefix="RM"
              tone="good"
              subtitle={
                data.grand_total_spent > 0
                  ? `${((1 - data.grand_waste_pct) * 100).toFixed(1)}% of spend`
                  : undefined
              }
            />
          </div>

          {/* Table */}
          {data.rows.length === 0 ? (
            <p className="text-sm text-ga-text-secondary py-8 text-center">
              No purchases recorded in this period.
            </p>
          ) : (
            <div className="bg-ga-bg-card border border-ga-border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ga-border text-left text-xs text-ga-text-secondary">
                    <th className="px-4 py-2 font-medium">Item</th>
                    <th className="px-2 py-2 font-medium text-right">Times bought</th>
                    <th className="px-2 py-2 font-medium text-right">Spent</th>
                    <th className="px-2 py-2 font-medium text-right">Wasted</th>
                    <th className="px-4 py-2 font-medium text-right">Waste %</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => {
                    const wasteHigh = row.waste_value_pct >= 0.2 || row.waste_pct >= 0.2;
                    return (
                      <tr
                        key={row.catalog_name_norm}
                        className={cn(
                          'border-b border-ga-border/50 last:border-b-0',
                          wasteHigh && 'bg-red-500/5',
                        )}
                      >
                        <td className="px-4 py-2">
                          <Link
                            to={`/catalog/${encodeURIComponent(row.catalog_name_norm)}`}
                            className="text-ga-text-primary hover:text-ga-accent hover:underline"
                          >
                            {row.display_name}
                          </Link>
                        </td>
                        <td className="px-2 py-2 text-right text-ga-text-secondary">
                          {row.total_purchases}
                        </td>
                        <td className="px-2 py-2 text-right text-ga-text-primary">
                          RM {row.total_spent.toFixed(2)}
                        </td>
                        <td
                          className={cn(
                            'px-2 py-2 text-right',
                            row.thrown_value > 0 ? 'text-red-400 font-medium' : 'text-ga-text-secondary',
                          )}
                        >
                          {row.thrown_value > 0 ? `RM ${row.thrown_value.toFixed(2)}` : '—'}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-2 text-right text-xs',
                            wasteHigh ? 'text-red-400 font-semibold' : 'text-ga-text-secondary',
                          )}
                        >
                          {row.waste_pct > 0
                            ? `${(row.waste_pct * 100).toFixed(0)}%`
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Hero({
  label,
  value,
  prefix,
  tone,
  subtitle,
}: {
  label: string;
  value: number;
  prefix: string;
  tone: 'neutral' | 'good' | 'bad';
  subtitle?: string;
}) {
  const toneClass =
    tone === 'bad' ? 'text-red-400' : tone === 'good' ? 'text-green-500' : 'text-ga-text-primary';
  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5">
      <div className="text-xs text-ga-text-secondary">{label}</div>
      <div className={cn('text-2xl font-bold', toneClass)}>
        {prefix} {value.toFixed(2)}
      </div>
      {subtitle && (
        <div className="text-xs text-ga-text-secondary mt-1">{subtitle}</div>
      )}
    </div>
  );
}
