import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFinancialSummary } from '@/api/queries/useWaste';
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

export default function SpendingHistoryPage() {
  const [period, setPeriod] = useState<Period>('month');
  const { data: flags } = useFeatureFlags();
  const { data, isLoading, error } = useFinancialSummary(period);
  const activeHint = PERIODS.find((p) => p.key === period)?.hint ?? '';

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

      <details className="bg-ga-bg-card border border-ga-border rounded-lg group">
        <summary className="cursor-pointer list-none px-4 py-2 text-xs text-ga-text-secondary flex items-center justify-between hover:bg-ga-bg-hover/40 rounded-lg">
          <span>ⓘ What does this page show?</span>
          <span className="text-[10px] group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="px-4 pb-3 pt-1 text-xs text-ga-text-secondary space-y-1.5 border-t border-ga-border">
          <p>
            <span className="text-ga-text-primary font-medium">Total spent</span>{' '}
            is the sum of every purchase price you logged in the period.
            <span className="text-ga-text-primary font-medium"> Wasted</span> is the
            money tied to items you marked Thrown with reason <em>expired</em> or
            <em> unexpected event</em>. <span className="text-ga-text-primary font-medium">Kept</span> is
            Spent − Wasted (money on items you used, gave away or still have).
          </p>
          <p>
            <span className="text-ga-text-primary font-medium">Waste % column</span>{' '}
            is units thrown ÷ units bought (e.g. threw 2 of a 12-pack = 17%). Rows
            tinted red mean either the units or the money tied to that item is 20%+
            waste — these are the items worth buying less of, or buying smaller.
          </p>
          <p>
            <span className="text-ga-text-primary font-medium">Times bought</span>{' '}
            counts units, not shopping trips. A 12-pack adds 12 to the count.
          </p>
          <p>
            <span className="text-ga-text-primary font-medium">Tap an item name</span>{' '}
            to open its catalog page — full history, expiry trends, and the option
            to delete the entry.
          </p>
        </div>
      </details>

      <div>
        <div className="flex gap-2 flex-wrap">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              title={p.hint}
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
        <p className="text-[11px] text-ga-text-secondary mt-1.5" aria-live="polite">
          {activeHint}
        </p>
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
              labelHint="Sum of every purchase price you logged in this period."
              value={data.grand_total_spent}
              prefix="RM"
              tone="neutral"
            />
            <Hero
              label="Wasted"
              labelHint="Money tied to items thrown for expired or unexpected reasons. Gifts and used-up items are not counted as waste."
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
              labelHint="Spent minus Wasted — money on items you used, gave away, or still have."
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
                    <th className="px-4 py-2 font-medium" title="Tap to open the catalog page for full history">Item</th>
                    <th className="px-2 py-2 font-medium text-right" title="Units bought, not number of shopping trips. A 12-pack adds 12.">Times bought</th>
                    <th className="px-2 py-2 font-medium text-right" title="Total spent on this item in the period, in RM.">Spent</th>
                    <th className="px-2 py-2 font-medium text-right" title="Money you lost — items thrown for expired or unexpected reasons.">Wasted</th>
                    <th className="px-4 py-2 font-medium text-right" title="Units thrown ÷ units bought. Rows over 20% are tinted red.">Waste %</th>
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
  labelHint,
  value,
  prefix,
  tone,
  subtitle,
}: {
  label: string;
  labelHint?: string;
  value: number;
  prefix: string;
  tone: 'neutral' | 'good' | 'bad';
  subtitle?: string;
}) {
  const toneClass =
    tone === 'bad' ? 'text-red-400' : tone === 'good' ? 'text-green-500' : 'text-ga-text-primary';
  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5">
      <div className="text-xs text-ga-text-secondary" title={labelHint}>{label}</div>
      <div className={cn('text-2xl font-bold', toneClass)}>
        {prefix} {value.toFixed(2)}
      </div>
      {subtitle && (
        <div className="text-xs text-ga-text-secondary mt-1">{subtitle}</div>
      )}
    </div>
  );
}
