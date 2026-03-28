import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useUser } from '@/api/queries/useUsers';
import { useInventory } from '@/api/queries/useInventory';
import { useShoppingLists } from '@/api/queries/useShoppingLists';
import DataTable, { type Column } from '@/components/shared/DataTable';
import StatusBadge from '@/components/shared/StatusBadge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import { formatDate, formatRelativeDate, formatCurrency, formatExpiry, truncateUid } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { InventoryItem } from '@/types/api';

type Tab = 'inventory' | 'shopping-lists';

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    return name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return '?';
}

function UserInventoryTab({ uid }: { uid: string }) {
  const { data, isLoading } = useInventory();

  const items = useMemo(
    () => (data?.items ?? []).filter((item) => item.user_id === uid),
    [data, uid],
  );

  const columns: Column<InventoryItem>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        render: (item) => (
          <Link
            to={`/inventory/${item.user_id}/${item.id}`}
            className="text-ga-accent hover:underline font-medium text-sm"
          >
            {item.name}
          </Link>
        ),
      },
      {
        key: 'brand',
        header: 'Brand',
        render: (item) => (
          <span className="text-ga-text-secondary text-sm">{item.brand || '—'}</span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        headerClassName: 'text-center',
        className: 'text-center',
        render: (item) => <StatusBadge status={item.status} />,
      },
      {
        key: 'location',
        header: 'Location',
        render: (item) => (
          <span className="text-ga-text-secondary text-sm capitalize">
            {item.storage_location || item.location || '—'}
          </span>
        ),
      },
      {
        key: 'quantity',
        header: 'Qty',
        render: (item) => (
          <span className="text-sm">
            {item.quantity ?? '—'}{item.unit ? ` ${item.unit}` : ''}
          </span>
        ),
      },
      {
        key: 'expiry',
        header: 'Expiry',
        render: (item) => {
          const exp = formatExpiry(item.expiryDate ?? item.expiry_date);
          return <span className={cn('text-xs', exp.className)}>{exp.text}</span>;
        },
      },
      {
        key: 'price',
        header: 'Price',
        render: (item) => (
          <span className="text-sm">{formatCurrency(item.price)}</span>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      data={items}
      columns={columns}
      isLoading={isLoading}
      emptyMessage="No inventory items"
      emptyIcon="📦"
      getKey={(item) => item.id}
    />
  );
}

function UserShoppingListsTab({ uid }: { uid: string }) {
  const { data, isLoading } = useShoppingLists();

  const lists = useMemo(
    () => (data?.lists ?? []).filter((list) => list.user_id === uid),
    [data, uid],
  );

  if (isLoading) return <LoadingSpinner text="Loading shopping lists..." />;

  if (lists.length === 0) {
    return (
      <div className="bg-ga-bg-card border border-ga-border rounded-lg">
        <EmptyState icon="🛒" title="No shopping lists" />
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {lists.map((list) => (
        <Link
          key={list.id}
          to={`/shopping-lists/${list.user_id}/${list.id}`}
          className="bg-ga-bg-card border border-ga-border rounded-lg p-4 hover:bg-ga-bg-hover transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-ga-text-primary truncate">
              {list.name}
            </h3>
            {list.isCompleted && (
              <StatusBadge status="approved" className="!text-[10px]" />
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-ga-text-secondary">
            <span>
              {list.item_count != null ? `${list.item_count} item(s)` : '—'}
            </span>
            <span>{formatRelativeDate(list.created_at ?? list.createdDate)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function UserDetailPage() {
  const { uid } = useParams<{ uid: string }>();
  const { data: user, isLoading } = useUser(uid);
  const [activeTab, setActiveTab] = useState<Tab>('inventory');

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingSpinner text="Loading user..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <EmptyState icon="👤" title="User not found" />
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'inventory', label: 'Inventory', icon: '📦' },
    { key: 'shopping-lists', label: 'Shopping Lists', icon: '🛒' },
  ];

  return (
    <div className="p-6">
      {/* Back link */}
      <Link
        to="/users"
        className="text-sm text-ga-text-secondary hover:text-ga-accent transition-colors mb-4 inline-block"
      >
        &larr; Back to Users
      </Link>

      {/* User info card */}
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-ga-accent/20 text-ga-accent flex items-center justify-center text-lg font-bold shrink-0">
            {getInitials(user.displayName, user.email)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-semibold text-ga-text-primary truncate">
                {user.displayName || 'Unnamed User'}
              </h1>
              <StatusBadge status={user.role} />
            </div>
            <p className="text-sm text-ga-text-secondary mb-3">{user.email || '—'}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-ga-text-secondary block">UID</span>
                <code className="text-ga-text-primary font-mono" title={user.uid}>
                  {truncateUid(user.uid, 16)}
                </code>
              </div>
              <div>
                <span className="text-ga-text-secondary block">Tier</span>
                <span className="text-ga-text-primary capitalize">{user.tier || '—'}</span>
              </div>
              <div>
                <span className="text-ga-text-secondary block">Created</span>
                <span className="text-ga-text-primary">{formatDate(user.createdAt)}</span>
              </div>
              <div>
                <span className="text-ga-text-secondary block">Last Active</span>
                <span className="text-ga-text-primary">{formatRelativeDate(user.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-ga-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.key
                ? 'border-ga-accent text-ga-accent'
                : 'border-transparent text-ga-text-secondary hover:text-ga-text-primary',
            )}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'inventory' && <UserInventoryTab uid={uid!} />}
      {activeTab === 'shopping-lists' && <UserShoppingListsTab uid={uid!} />}
    </div>
  );
}
