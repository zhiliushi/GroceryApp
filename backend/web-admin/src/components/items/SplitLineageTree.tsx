import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';
import type {
  CatalogOverviewLineageEvent,
  CatalogOverviewLineageNode,
} from '@/types/api';

interface Props {
  lineage: CatalogOverviewLineageNode[];
}

const STATUS_COLOR: Record<string, string> = {
  active: 'text-green-400',
  used: 'text-ga-accent',
  thrown: 'text-red-400',
  given: 'text-orange-400',
  transferred: 'text-orange-400',
};

export default function SplitLineageTree({ lineage }: Props) {
  if (lineage.length === 0) {
    return <p className="text-xs text-ga-text-secondary italic">No lineage yet.</p>;
  }
  return (
    <div className="space-y-3">
      {lineage.map((parent) => (
        <div key={parent.id} className="border-l-2 border-ga-border pl-3">
          <LineageRow ev={parent} isParent />
          {parent.children.length > 0 && (
            <div className="mt-1 space-y-1 ml-4 border-l border-ga-border/50 pl-3">
              {parent.children.map((child) => (
                <LineageRow key={child.id} ev={child} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function LineageRow({
  ev,
  isParent,
}: {
  ev: CatalogOverviewLineageEvent;
  isParent?: boolean;
}) {
  const status = ev.status || 'unknown';
  return (
    <Link
      to={`/my-items/${ev.id}`}
      className="flex items-center gap-2 text-xs py-1 hover:bg-ga-bg-hover/50 rounded px-2 -mx-2"
    >
      {isParent ? (
        <span className="text-[10px] text-ga-text-secondary uppercase tracking-wide w-12 flex-shrink-0">
          parent
        </span>
      ) : (
        <span className="text-[10px] text-ga-text-secondary w-12 flex-shrink-0">↳ split</span>
      )}
      <span className="text-ga-text-secondary tabular-nums w-20 flex-shrink-0">
        {ev.date_bought ? new Date(ev.date_bought).toLocaleDateString() : '—'}
      </span>
      <span className={cn('font-medium flex-shrink-0', STATUS_COLOR[status] || 'text-ga-text-primary')}>
        {status}
      </span>
      {ev.quantity != null && (
        <span className="text-ga-text-secondary">× {ev.quantity}</span>
      )}
      {ev.consumed_reason && (
        <span className="text-ga-text-secondary">({ev.consumed_reason})</span>
      )}
      {ev.location && (
        <span className="text-ga-text-secondary ml-auto">📍 {ev.location}</span>
      )}
    </Link>
  );
}
