import { Link } from 'react-router-dom';
import { useDashboard, useRecentInventory } from '@/api/queries/useDashboard';
import { useMe } from '@/api/queries/useMe';
import PageHeader from '@/components/shared/PageHeader';
import StatsCard from '@/components/shared/StatsCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatDate, formatExpiry, truncateUid } from '@/utils/format';

export default function DashboardPage() {
  const { data: me } = useMe();
  const { data: stats, isLoading: statsLoading } = useDashboard();
  const { data: inventory, isLoading: invLoading } = useRecentInventory(10);

  const today = new Date().toLocaleDateString('en-MY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="p-6">
      <PageHeader title="Dashboard" subtitle={today} />

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

      {/* Stats Row */}
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

      {/* Two-column section */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-ga-bg-card border border-ga-border rounded-lg">
          <div className="px-4 py-3 border-b border-ga-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ga-text-primary">Recent Activity</h2>
            <Link to="/inventory" className="text-xs text-ga-accent hover:underline">
              View All →
            </Link>
          </div>
          <div className="overflow-x-auto">
            {invLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-ga-accent mx-auto" />
              </div>
            ) : !inventory?.items?.length ? (
              <div className="p-8 text-center text-ga-text-secondary text-sm">No recent items</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ga-border">
                    <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ga-text-secondary">Item</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ga-text-secondary">Status</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ga-text-secondary">Expiry</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ga-text-secondary">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.items.map((item, i) => {
                    const expiry = formatExpiry(item.expiryDate || item.expiry_date);
                    return (
                      <tr key={i} className="border-b border-ga-border/50 hover:bg-ga-bg-hover transition-colors">
                        <td className="px-4 py-2.5">
                          <span className="font-medium">{item.name}</span>
                          {item.brand && <span className="text-ga-text-secondary ml-2">{item.brand}</span>}
                        </td>
                        <td className="px-4 py-2.5"><StatusBadge status={item.status} /></td>
                        <td className="px-4 py-2.5"><span className={expiry.className}>{expiry.text}</span></td>
                        <td className="px-4 py-2.5 text-ga-text-secondary">{formatDate(item.addedDate)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-ga-text-primary mb-4">Quick Actions</h2>
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
            <Link to="/foodbanks" className="block text-sm text-ga-accent hover:underline">Manage Foodbanks →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
