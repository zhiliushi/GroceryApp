import { Link } from 'react-router-dom';
import { useDashboard } from '@/api/queries/useDashboard';
import { useMe } from '@/api/queries/useMe';
import PageHeader from '@/components/shared/PageHeader';
import StatsCard from '@/components/shared/StatsCard';
import StatusBadge from '@/components/shared/StatusBadge';
import HealthBar from '@/components/waste/HealthBar';
import NudgeBanner from '@/components/nudge/NudgeBanner';
import ProgressiveNudge from '@/components/nudge/ProgressiveNudge';
import WasteSummaryCard from '@/components/dashboard/WasteSummaryCard';
import SpendingCard from '@/components/dashboard/SpendingCard';
import InsightsCard from '@/components/dashboard/InsightsCard';
import FrequentlyBoughtCard from '@/components/dashboard/FrequentlyBoughtCard';
import { useAuthStore } from '@/stores/authStore';
import { truncateUid } from '@/utils/format';

/**
 * Dashboard — refactored waste-prevention hero view.
 *
 * Add Item / Scan controls live in AppLayout (StickyAddButton + FloatingScanButton).
 */
export default function DashboardPage() {
  const { data: me } = useMe();
  const { data: stats, isLoading: statsLoading } = useDashboard();
  const isAdmin = useAuthStore((s) => s.isAdmin);

  const today = new Date().toLocaleDateString('en-MY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="p-6">
      <PageHeader title="Dashboard" subtitle={today} />

      {/* Nudge + insight stack */}
      <div className="mb-4 space-y-3">
        <ProgressiveNudge />
        <NudgeBanner />
        <InsightsCard />
      </div>

      <div className="mb-4">
        <HealthBar />
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <WasteSummaryCard />
        <SpendingCard />
        <FrequentlyBoughtCard />
      </div>

      {/* User Info */}
      {me && me.authenticated && (
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4 mb-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-ga-accent/20 text-ga-accent flex items-center justify-center font-bold text-lg">
            {(me.display_name || me.email || '?')[0].toUpperCase()}
          </div>
          <div>
            <div className="font-medium text-ga-text-primary">{me.display_name || 'User'}</div>
            <div className="text-sm text-ga-text-secondary">{me.email}</div>
          </div>
          <StatusBadge status={me.role} className="ml-2" />
          <div className="ml-auto text-xs text-ga-text-secondary font-mono">
            UID: {truncateUid(me.uid)}
          </div>
        </div>
      )}

      {/* Admin-only stats + quick actions */}
      {isAdmin && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <StatsCard icon="👥" label="Users" value={stats?.total_users} loading={statsLoading} />
            <StatsCard icon="📦" label="Items" value={stats?.total_items} loading={statsLoading} />
            <StatsCard icon="✅" label="Active" value={stats?.active_items} loading={statsLoading} />
            <StatsCard
              icon="⚠️" label="Expired" value={stats?.expired_items} loading={statsLoading}
              accentColor={(stats?.expired_items ?? 0) > 0 ? 'red' : 'green'}
            />
            <StatsCard
              icon="🔍" label="Review" value={stats?.needs_review_count} loading={statsLoading}
              accentColor={(stats?.needs_review_count ?? 0) > 0 ? 'yellow' : 'green'}
            />
            <StatsCard icon="📍" label="Foodbanks" value={stats?.total_foodbanks} loading={statsLoading} />
          </div>

          <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-ga-text-primary mb-4">Admin Quick Actions</h2>
            <div className="space-y-2">
              <Link to="/users" className="block text-sm text-ga-accent hover:underline">Manage Users →</Link>
              <Link to="/needs-review" className="block text-sm text-ga-accent hover:underline">
                Review Items →
                {(stats?.needs_review_count ?? 0) > 0 && (
                  <span className="ml-2 bg-yellow-500 text-black text-xs rounded-full px-1.5 py-0.5">
                    {stats!.needs_review_count}
                  </span>
                )}
              </Link>
              <Link to="/contributed-products" className="block text-sm text-ga-accent hover:underline">
                Contributed Products →
                {(stats?.contributed_pending ?? 0) > 0 && (
                  <span className="ml-2 bg-yellow-500 text-black text-xs rounded-full px-1.5 py-0.5">
                    {stats!.contributed_pending}
                  </span>
                )}
              </Link>
              <Link to="/products" className="block text-sm text-ga-accent hover:underline">Product Database →</Link>
              <Link to="/admin/catalog-analysis" className="block text-sm text-ga-accent hover:underline">Catalog Analysis →</Link>
              <Link to="/foodbanks" className="block text-sm text-ga-accent hover:underline">Manage Foodbanks →</Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
