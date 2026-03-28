import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useShoppingLists } from '@/api/queries/useShoppingLists';
import DataTable, { type Column } from '@/components/shared/DataTable';
import PageHeader from '@/components/shared/PageHeader';
import { formatDate, truncateUid } from '@/utils/format';
import type { ShoppingList } from '@/types/api';

export default function ShoppingListsPage() {
  const { data, isLoading } = useShoppingLists();

  const columns: Column<ShoppingList>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        render: (list) => <span className="font-medium text-ga-text-primary">{list.name}</span>,
      },
      {
        key: 'owner',
        header: 'Owner',
        render: (list) => (
          <code className="text-xs font-mono text-ga-text-secondary">
            {truncateUid(list.user_id)}
          </code>
        ),
      },
      {
        key: 'created',
        header: 'Created',
        render: (list) => (
          <span className="text-ga-text-secondary text-xs">
            {formatDate(list.created_at ?? list.createdDate)}
          </span>
        ),
      },
      {
        key: 'items',
        header: 'Items',
        headerClassName: 'text-center',
        className: 'text-center',
        render: (list) => (
          <span className="inline-block bg-ga-accent/20 text-ga-accent text-xs font-medium rounded-full px-2 py-0.5 min-w-[24px] text-center">
            {list.item_count ?? 0}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        headerClassName: 'text-right',
        className: 'text-right',
        render: (list) => (
          <Link
            to={`/shopping-lists/${list.user_id}/${list.id}`}
            className="text-ga-accent hover:underline text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            View
          </Link>
        ),
      },
    ],
    [],
  );

  return (
    <div className="p-6">
      <PageHeader title="Shopping Lists" icon="🛒" count={data?.count} />

      <DataTable
        data={data?.lists ?? []}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No shopping lists found"
        emptyIcon="🛒"
        getKey={(list) => `${list.user_id}-${list.id}`}
      />
    </div>
  );
}
