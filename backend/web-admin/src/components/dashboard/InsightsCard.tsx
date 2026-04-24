import { Link } from 'react-router-dom';
import { useInsights } from '@/api/queries/useInsights';
import { useDismissInsight } from '@/api/mutations/useInsightMutations';

/**
 * Shown when the user has a pending insight (e.g. milestone hit).
 * Auto-hides when there are none.
 */
export default function InsightsCard() {
  const { data } = useInsights();
  const dismiss = useDismissInsight();

  if (!data || data.count === 0) return null;

  const top = data.insights[0];

  return (
    <div className="bg-gradient-to-br from-ga-accent/20 to-purple-500/20 border border-ga-accent/40 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wider text-ga-accent font-semibold">
            ✨ Insight ready
            {top.milestone ? ` · Milestone ${top.milestone}` : ''}
          </div>
          <div className="text-sm font-semibold text-ga-text-primary mt-1">{top.title}</div>
          {top.description && (
            <div className="text-xs text-ga-text-secondary mt-1">{top.description}</div>
          )}
        </div>
        <button
          onClick={() => dismiss.mutate(top.id)}
          className="text-xs text-ga-text-secondary hover:text-ga-text-primary"
          title="Dismiss"
        >
          ✕
        </button>
      </div>
      {data.count > 1 && (
        <Link
          to="/insights"
          className="text-xs text-ga-accent hover:underline mt-2 inline-block"
        >
          View all {data.count} insights →
        </Link>
      )}
    </div>
  );
}
