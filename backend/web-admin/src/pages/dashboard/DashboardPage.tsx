import { Link } from 'react-router-dom';
import { useDashboard, useRecentInventory } from '@/api/queries/useDashboard';
import { useMe } from '@/api/queries/useMe';
import PageHeader from '@/components/shared/PageHeader';
import StatsCard from '@/components/shared/StatsCard';
import StatusBadge from '@/components/shared/StatusBadge';
import ExpiringSoonList from '@/components/inventory/ExpiringSoonList';
import LocationSummary from '@/components/inventory/LocationSummary';
import ScanReceiptButton from '@/components/receipt/ScanReceiptButton';
import ScanBarcodeButton from '@/components/barcode/ScanBarcodeButton';
import { truncateUid } from '@/utils/format';

export default function DashboardPage() {
  const { data: me } = useMe();
  const { data: stats, isLoading: statsLoading } = useDashboard();
  const { data: inventory } = useRecentInventory(200); // fetch more for grouping

  const today = new Date().toLocaleDateString('en-MY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const allItems = inventory?.items ?? [];
  const hasItems = allItems.length > 0;

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

      {/* Main content */}
      {!hasItems ? (
        /* Empty inventory hero */
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-12 text-center mb-6">
          <div className="text-5xl mb-4">📦</div>
          <h2 className="text-xl font-semibold text-ga-text-primary mb-2">Your inventory is empty</h2>
          <p className="text-ga-text-secondary mb-6">Start by scanning a barcode or receipt to add your first items.</p>
          <div className="flex gap-3 justify-center">
            <ScanBarcodeButton />
            <ScanReceiptButton destination="inventory" pageKey="dashboard" />
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4 mb-6">
          {/* Expiring Soon — 2/3 width */}
          <div className="lg:col-span-2">
            <ExpiringSoonList items={allItems} />
          </div>

          {/* Location Summary — 1/3 width */}
          <div>
            <LocationSummary items={allItems} />
          </div>
        </div>
      )}

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
          {hasItems && (
            <div className="pt-1 flex gap-2">
              <ScanBarcodeButton />
              <ScanReceiptButton destination="inventory" pageKey="dashboard" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
