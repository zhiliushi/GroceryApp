import { Link } from 'react-router-dom';
import type { CatalogOverviewTimelineEntry } from '@/types/api';
import { cn } from '@/utils/cn';

interface Props {
  timeline: CatalogOverviewTimelineEntry[];
}

const ACTION_LABEL: Record<string, string> = {
  purchased: '📦 Purchased',
  moved: '↪ Moved',
  split_used: '✓ Split used',
  split_thrown: '🗑 Split thrown',
  split_given: '🤝 Split given',
};

export default function MovementTimeline({ timeline }: Props) {
  if (timeline.length === 0) {
    return <p className="text-xs text-ga-text-secondary italic">No movement yet.</p>;
  }

  // Show newest first for the timeline view (the API sorts oldest-first)
  const ordered = [...timeline].reverse();

  return (
    <div className="space-y-1.5">
      {ordered.map((t) => (
        <div
          key={t.event_id}
          className="flex items-center gap-3 text-xs py-1.5 border-b border-ga-border/30 last:border-0"
        >
          <div className="text-ga-text-secondary tabular-nums w-20 flex-shrink-0">
            {t.date ? new Date(t.date).toLocaleDateString() : '—'}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-ga-text-primary">
              {ACTION_LABEL[t.action] ?? t.action}
            </span>
            {t.quantity != null && (
              <span className="text-ga-text-secondary ml-1">× {t.quantity}</span>
            )}
            {t.location && (
              <span className="text-ga-text-secondary ml-2">📍 {t.location}</span>
            )}
            {t.status && t.status !== 'active' && (
              <span
                className={cn(
                  'ml-2 px-1.5 py-0.5 rounded-full text-[10px]',
                  t.status === 'thrown' ? 'bg-red-500/20 text-red-400' :
                  t.status === 'used' ? 'bg-green-500/20 text-green-400' :
                  'bg-ga-bg-hover text-ga-text-secondary',
                )}
              >
                {t.status}
              </span>
            )}
          </div>
          <Link
            to={`/my-items/${t.event_id}`}
            className="text-ga-accent hover:underline flex-shrink-0"
          >
            View →
          </Link>
        </div>
      ))}
    </div>
  );
}
