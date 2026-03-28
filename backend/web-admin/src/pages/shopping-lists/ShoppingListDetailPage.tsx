import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useShoppingListDetail } from '@/api/queries/useShoppingLists';
import DataTable, { type Column } from '@/components/shared/DataTable';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { formatDate, truncateUid } from '@/utils/format';
import type { ShoppingListItem } from '@/types/api';
import { cn } from '@/utils/cn';

export default function ShoppingListDetailPage() {
  const { uid, listId } = useParams<{ uid: string; listId: string }>();
  const { data, isLoading } = useShoppingListDetail(uid!, listId!);

  const columns: Column<ShoppingListItem>[] = useMemo(
    () => [
      {
        key: 'checked',
        header: '',
        className: 'w-8 text-center',
        render: (item) => (
          <span className={item.isPurchased ? 'text-green-400' : 'text-gray-600'}>
            {item.isPurchased ? '✓' : '○'}
          </span>
        ),
      },
      {
        key: 'name',
        header: 'Name',
        render: (item) => (
          <span
            className={cn(
              'font-medium',
              item.isPurchased
                ? 'line-through text-ga-text-secondary/50'
                : 'text-ga-text-primary',
            )}
          >
            {item.itemName}
          </span>
        ),
      },
      {
        key: 'qty',
        header: 'Qty',
        render: (item) => (
          <span className="text-ga-text-secondary">{item.quantity ?? '—'}</span>
        ),
      },
      {
        key: 'unit',
        header: 'Unit',
        render: (item) => (
          <span className="text-ga-text-secondary">{item.unitId || '—'}</span>
        ),
      },
      {
        key: 'category',
        header: 'Category',
        render: (item) =>
          item.categoryId ? (
            <span className="inline-block bg-ga-accent/20 text-ga-accent text-xs font-medium rounded px-2 py-0.5">
              {item.categoryId}
            </span>
          ) : (
            <span className="text-ga-text-secondary">—</span>
          ),
      },
    ],
    [],
  );

  if (isLoading) return <LoadingSpinner text="Loading list..." />;
  if (!data) return <div className="p-6 text-ga-text-secondary">Shopping list not found.</div>;

  const list = data.list;
  const items = data.items;

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link to="/shopping-lists" className="text-ga-accent hover:underline text-sm">
          ← Shopping Lists
        </Link>
        <span className="text-ga-text-secondary text-sm mx-2">/</span>
        <span className="text-ga-text-primary text-sm">{list.name}</span>
      </div>

      {/* Info card */}
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4 mb-4">
        <div className="flex items-center gap-6">
          <div>
            <span className="block text-xs font-medium text-ga-text-secondary mb-0.5">Name</span>
            <span className="text-sm font-semibold text-ga-text-primary">{list.name}</span>
          </div>
          <div>
            <span className="block text-xs font-medium text-ga-text-secondary mb-0.5">Owner</span>
            <code className="text-xs font-mono text-ga-text-secondary">
              {truncateUid(list.user_id)}
            </code>
          </div>
          <div>
            <span className="block text-xs font-medium text-ga-text-secondary mb-0.5">Created</span>
            <span className="text-sm text-ga-text-secondary">
              {formatDate(list.created_at ?? list.createdDate)}
            </span>
          </div>
          <div>
            <span className="block text-xs font-medium text-ga-text-secondary mb-0.5">Items</span>
            <span className="text-sm text-ga-text-primary">{items.length}</span>
          </div>
        </div>
      </div>

      <DataTable
        data={items}
        columns={columns}
        isLoading={false}
        emptyMessage="No items in this list"
        emptyIcon="📝"
        getKey={(item) => item.id}
      />
    </div>
  );
}
