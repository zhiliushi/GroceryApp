import { Link } from 'react-router-dom';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { useHealthScore } from '@/api/queries/useWaste';
import { gradeColor, gradeTextColor } from '@/utils/healthScore';
import { cn } from '@/utils/cn';

/**
 * Dashboard hero: inventory health bar.
 *
 * Reads /api/waste/health-score (5min cache). Colour band + breakdown +
 * drilldown link. See docs/HEALTH_SCORE.md.
 */
export default function HealthBar({ drillToPath = '/health-score' }: { drillToPath?: string }) {
  const { data, isLoading, error } = useHealthScore();

  if (isLoading) {
    return (
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5 animate-pulse">
        <LoadingSpinner text="Computing health score…" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
        Could not compute health score.
      </div>
    );
  }

  const { score, grade, components } = data;
  const barColor = gradeColor(grade);
  const textColor = gradeTextColor(grade);
  const activeTotal =
    components.active_healthy +
    components.active_expiring_7d +
    components.active_expiring_3d +
    components.active_expired +
    components.active_untracked;

  const label = grade === 'green' ? 'Healthy' : grade === 'yellow' ? 'Needs attention' : 'Urgent';

  // Sibling layout (not nested <a>): header+bar is one Link, stat grid is its own region
  // with per-stat Links drilling to specific HealthScorePage tabs.
  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5 hover:border-ga-accent/50 transition-colors">
      <Link to={drillToPath} className="block">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold text-ga-text-primary">Inventory Health</h3>
            <p className={cn('text-xs', textColor)}>{label} · tap for details →</p>
          </div>
          <div className={cn('text-3xl font-bold', textColor)}>{score}</div>
        </div>

        <div className="w-full h-3 bg-ga-bg-hover rounded-full overflow-hidden">
          <div
            className={cn('h-full transition-all duration-500', barColor)}
            style={{ width: `${Math.max(4, Math.min(100, score))}%` }}
          />
        </div>
      </Link>

      <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
        <Stat label="Healthy" value={components.active_healthy} tone="ok" tab="" />
        <Stat label="Expiring 7d" value={components.active_expiring_7d} tone="warn" tab="expiring" />
        <Stat label="Expiring 3d" value={components.active_expiring_3d} tone="urgent" tab="expiring" />
        <Stat label="Expired" value={components.active_expired} tone="expired" tab="expired" />
        <Stat label="Untracked" value={components.active_untracked} tone="neutral" tab="untracked" />
      </div>

      <div className="mt-2 text-xs text-ga-text-secondary">
        {activeTotal} active · {components.thrown_this_month} thrown this month ·{' '}
        {components.used_this_month} used
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  tab,
}: {
  label: string;
  value: number;
  tone: string;
  tab: string;
}) {
  const toneClass =
    tone === 'ok'
      ? 'text-green-600'
      : tone === 'warn'
      ? 'text-yellow-600'
      : tone === 'urgent'
      ? 'text-orange-600'
      : tone === 'expired'
      ? 'text-red-600'
      : 'text-ga-text-secondary';

  const inner = (
    <>
      <span className={cn('font-semibold', toneClass)}>{value}</span>
      <span className="text-ga-text-secondary">{label}</span>
    </>
  );

  if (tab && value > 0) {
    return (
      <Link
        to={`/health-score?tab=${tab}`}
        className="flex flex-col items-center rounded hover:bg-ga-bg-hover transition-colors py-1"
      >
        {inner}
      </Link>
    );
  }
  return <div className="flex flex-col items-center py-1">{inner}</div>;
}
