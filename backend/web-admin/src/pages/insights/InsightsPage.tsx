import { Link } from 'react-router-dom';
import { useInsights } from '@/api/queries/useInsights';
import { useDismissInsight } from '@/api/mutations/useInsightMutations';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import Breadcrumbs from '@/components/shared/Breadcrumbs';
import { cn } from '@/utils/cn';
import type { Insight } from '@/types/api';

/**
 * Full insights view — drill-down from dashboard InsightsCard.
 * Renders rich milestone content: top purchased, waste breakdown, spending,
 * shopping frequency, avoid list.
 */
export default function InsightsPage() {
  const { data, isLoading, error } = useInsights();
  const dismiss = useDismissInsight();

  if (isLoading) return <LoadingSpinner text="Loading insights…" />;
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
          Could not load insights: {(error as Error).message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Insights' }]} />
      <PageHeader title="Insights" icon="✨" />

      {!data || data.count === 0 ? (
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-12 text-center">
          <div className="text-5xl mb-3">📊</div>
          <h3 className="text-base font-semibold text-ga-text-primary">No insights yet</h3>
          <p className="text-sm text-ga-text-secondary mt-1">
            Insights appear as you hit milestones (50, 100, 500, 1000 purchases).
          </p>
        </div>
      ) : (
        data.insights.map((i) => (
          <InsightCard key={i.id} insight={i} onDismiss={() => dismiss.mutate(i.id)} />
        ))
      )}
    </div>
  );
}

function InsightCard({ insight, onDismiss }: { insight: Insight; onDismiss: () => void }) {
  const isMilestone = insight.kind === 'milestone';

  return (
    <article
      className={cn(
        'rounded-lg border p-5 space-y-4',
        isMilestone
          ? 'bg-gradient-to-br from-ga-accent/10 to-purple-500/10 border-ga-accent/30'
          : 'bg-ga-bg-card border-ga-border',
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          {isMilestone && (
            <div className="text-xs uppercase tracking-wider text-ga-accent font-semibold">
              ✨ Milestone{insight.milestone ? ` · ${insight.milestone} purchases` : ''}
            </div>
          )}
          <h3 className="text-lg font-semibold text-ga-text-primary mt-1">{insight.title}</h3>
          {insight.description && (
            <p className="text-sm text-ga-text-secondary mt-1">{insight.description}</p>
          )}
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          title="Dismiss"
          className="text-xs text-ga-text-secondary hover:text-ga-text-primary px-2"
        >
          ✕
        </button>
      </header>

      {isMilestone && <MilestoneDetails insight={insight} />}

      {insight.created_at && (
        <div className="text-xs text-ga-text-secondary">
          Generated {new Date(insight.created_at).toLocaleString()}
        </div>
      )}
    </article>
  );
}

function MilestoneDetails({ insight }: { insight: Insight }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {insight.top_purchased && insight.top_purchased.length > 0 && (
        <Section title="Top purchased">
          <ul className="space-y-1">
            {insight.top_purchased.slice(0, 5).map((t) => (
              <li key={t.name_norm} className="flex items-center justify-between text-sm">
                <Link to={`/catalog/${t.name_norm}`} className="hover:underline text-ga-text-primary">
                  {t.name}
                </Link>
                <span className="text-ga-text-secondary">{t.count}×</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {insight.waste_breakdown && insight.waste_breakdown.length > 0 && (
        <Section title="Thrown most">
          <ul className="space-y-1">
            {insight.waste_breakdown.slice(0, 5).map((w) => (
              <li key={w.name_norm} className="flex items-center justify-between text-sm">
                <Link to={`/catalog/${w.name_norm}`} className="hover:underline text-ga-text-primary">
                  {w.name}
                </Link>
                <span className="text-red-500">
                  {w.count}× · {w.value.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {insight.spending && (
        <Section title="Spending">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <Stat label="💵 Cash" value={insight.spending.cash.toFixed(2)} />
            <Stat label="💳 Card" value={insight.spending.card.toFixed(2)} />
            <Stat label="Total" value={insight.spending.total.toFixed(2)} emphasize />
          </div>
        </Section>
      )}

      {insight.shopping_frequency &&
        (insight.shopping_frequency.avg_days_between !== null ||
          insight.shopping_frequency.peak_day !== null) && (
          <Section title="Shopping pattern">
            <div className="text-sm text-ga-text-primary space-y-1">
              {insight.shopping_frequency.avg_days_between !== null && (
                <div>
                  ~{insight.shopping_frequency.avg_days_between} days between shops
                </div>
              )}
              {insight.shopping_frequency.peak_day && (
                <div>Peak day: {insight.shopping_frequency.peak_day}</div>
              )}
            </div>
          </Section>
        )}

      {insight.avoid_list && insight.avoid_list.length > 0 && (
        <Section title="Avoid list (high waste)" fullWidth>
          <ul className="space-y-1">
            {insight.avoid_list.slice(0, 5).map((a) => (
              <li
                key={a.name_norm}
                className="flex items-center justify-between text-sm"
              >
                <Link
                  to={`/catalog/${a.name_norm}`}
                  className="hover:underline text-ga-text-primary"
                >
                  {a.name}
                </Link>
                <span className="text-orange-500">
                  {Math.round(a.waste_rate * 100)}% thrown ({a.thrown}/{a.total})
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
  fullWidth,
}: {
  title: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={cn('bg-ga-bg-card/60 border border-ga-border rounded p-3', fullWidth && 'md:col-span-2')}>
      <h4 className="text-xs uppercase tracking-wider text-ga-text-secondary font-semibold mb-2">
        {title}
      </h4>
      {children}
    </div>
  );
}

function Stat({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div>
      <div className="text-xs text-ga-text-secondary">{label}</div>
      <div
        className={cn(
          'font-semibold',
          emphasize ? 'text-ga-accent' : 'text-ga-text-primary',
        )}
      >
        {value}
      </div>
    </div>
  );
}
