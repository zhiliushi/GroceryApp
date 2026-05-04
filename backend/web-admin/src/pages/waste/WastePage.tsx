import { useState } from 'react';
import { useWasteSummary } from '@/api/queries/useWaste';
import PageHeader from '@/components/shared/PageHeader';
import Breadcrumbs from '@/components/shared/Breadcrumbs';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import WasteScoreboard from '@/components/dashboard/WasteScoreboard';
import { cn } from '@/utils/cn';

type Period = 'week' | 'month' | 'year' | 'all';
const PERIODS: Array<{ key: Period; label: string; hint: string }> = [
  { key: 'week', label: 'Week', hint: 'Last 7 days (rolling).' },
  { key: 'month', label: 'Month', hint: 'From the 1st of this month to today.' },
  { key: 'year', label: 'Year', hint: 'From January 1 to today.' },
  { key: 'all', label: 'All time', hint: 'Everything you have thrown since you started.' },
];

export default function WastePage() {
  const [period, setPeriod] = useState<Period>('month');
  const { data, isLoading } = useWasteSummary(period);
  const activeHint = PERIODS.find((p) => p.key === period)?.hint ?? '';

  return (
    <div className="p-6 space-y-4">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Waste' }]} />
      <PageHeader title="Waste breakdown" icon="🗑️" />

      <details className="bg-ga-bg-card border border-ga-border rounded-lg group">
        <summary className="cursor-pointer list-none px-4 py-2 text-xs text-ga-text-secondary flex items-center justify-between hover:bg-ga-bg-hover/40 rounded-lg">
          <span>ⓘ What does this page show?</span>
          <span className="text-[10px] group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="px-4 pb-3 pt-1 text-xs text-ga-text-secondary space-y-1.5 border-t border-ga-border">
          <p>
            <span className="text-ga-text-primary font-medium">What counts as waste:</span>{' '}
            only items you marked <em>Thrown</em> with a reason of <em>expired</em> or
            <em> unexpected event</em> (e.g. spoiled, damaged). Items given away or fully used up are not waste.
          </p>
          <p>
            <span className="text-ga-text-primary font-medium">The three cards above</span>{' '}
            show <em>this week / this month / last month</em> at a glance. Tap any card to
            see its top thrown items.
          </p>
          <p>
            <span className="text-ga-text-primary font-medium">The buttons below</span>{' '}
            zoom into a single window — pick the range you want to study.
          </p>
          <p>
            <span className="text-ga-text-primary font-medium">"Top wasted items"</span>{' '}
            is sorted by money lost, not how often. Two RM 12 items thrown matter more than
            ten RM 0.50 items.
          </p>
        </div>
      </details>

      {/* Top scoreboard — week / month / last_month at a glance, before
          drilling into a single-period view below. Symmetric with the
          home dashboard's WasteScoreboard. */}
      <WasteScoreboard hideSeeAllLink />

      <div className="pt-2 border-t border-ga-border" />

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
              <h3 className="text-sm font-semibold text-ga-text-primary">Top wasted items</h3>
              <p className="text-[11px] text-ga-text-secondary mb-3">
                Sorted by money lost. Number after × is units thrown.
              </p>
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
