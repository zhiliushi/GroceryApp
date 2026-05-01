import { Link } from 'react-router-dom';
import { useHealthScore } from '@/api/queries/useWaste';

/**
 * One-line inventory glance — replaces the "Inventory Health 73" score.
 *
 * The score-out-of-100 was abstract and didn't drive action ("what does
 * 73 mean? should I worry at 60? at 40?"). Real Malaysian-housewife
 * feedback was that the number sounded like a diagnostic readout, not
 * something to do.
 *
 * This component renders the same data the score is built from, but as
 * plain-language counts the user can act on directly:
 *   "26 items in stock · 3 expiring soon · 3 already expired"
 *
 * The numbers themselves drill into the same HealthScorePage tabs, so
 * power users keep their detailed view; everyone else sees an honest
 * sentence.
 */
export default function InventoryGlance() {
  const { data, isLoading } = useHealthScore();

  if (isLoading || !data) {
    return (
      <div className="text-xs text-ga-text-secondary">Counting your stock…</div>
    );
  }

  const c = data.components;
  const inStock = c.active_healthy + c.active_expiring_7d + c.active_expiring_3d + c.active_untracked;
  const expiringSoon = c.active_expiring_3d;
  const expiringWeek = c.active_expiring_7d;
  const expired = c.active_expired;

  return (
    <div className="text-xs text-ga-text-secondary flex flex-wrap items-center gap-x-2 gap-y-1">
      <Pill to="/my-items" label={`${inStock} items in stock`} tone="neutral" />
      {expiringSoon > 0 && (
        <Pill
          to="/health-score?tab=expiring"
          label={`${expiringSoon} expiring in 3 days`}
          tone="urgent"
        />
      )}
      {expiringSoon === 0 && expiringWeek > 0 && (
        <Pill
          to="/health-score?tab=expiring"
          label={`${expiringWeek} expiring this week`}
          tone="warn"
        />
      )}
      {expired > 0 && (
        <Pill
          to="/health-score?tab=expired"
          label={`${expired} already expired`}
          tone="bad"
        />
      )}
      {expiringSoon === 0 && expiringWeek === 0 && expired === 0 && inStock > 0 && (
        <span className="text-green-500">· all fresh</span>
      )}
    </div>
  );
}

function Pill({
  to,
  label,
  tone,
}: {
  to: string;
  label: string;
  tone: 'neutral' | 'warn' | 'urgent' | 'bad';
}) {
  const cls =
    tone === 'bad'
      ? 'text-red-400 hover:bg-red-500/10'
      : tone === 'urgent'
      ? 'text-orange-400 hover:bg-orange-500/10'
      : tone === 'warn'
      ? 'text-yellow-400 hover:bg-yellow-500/10'
      : 'text-ga-text-secondary hover:bg-ga-bg-hover';
  return (
    <Link to={to} className={`px-2 py-0.5 rounded ${cls}`}>
      {label}
    </Link>
  );
}
