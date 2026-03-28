import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useNeedsReview } from '@/api/queries/useNeedsReview';
import DataTable, { type Column } from '@/components/shared/DataTable';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { formatExpiry, formatCurrency, truncateUid } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { InventoryItem } from '@/types/api';

export default function NeedsReviewPage() {
  const { data, isLoading } = useNeedsReview();

  const items = data?.items ?? [];

  const columns: Column<InventoryItem>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        render: (item) => (
          <span className="font-medium text-ga-text-primary">{item.name}</span>
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
      {
        key: 'owner',
        header: 'Owner',
        render: (item) => (
          <span className="text-xs text-ga-text-secondary font-mono" title={item.user_id}>
            {truncateUid(item.user_id)}
          </span>
        ),
      },
      {
        key: 'actions',
        header: '',
        headerClassName: 'text-right',
        className: 'text-right',
        render: (item) => (
          <Link
            to={`/inventory/${item.user_id}/${item.id}`}
            className="text-xs px-2.5 py-1 rounded bg-ga-accent hover:bg-ga-accent-hover text-white transition-colors"
          >
            Review
          </Link>
        ),
      },
    ],
    [],
  );

  if (!isLoading && items.length === 0) {
    return (
      <div className="p-6">
        <PageHeader title="Needs Review" icon="🔍" count={0} />
        <div className="bg-ga-bg-card border border-ga-border rounded-lg">
          <EmptyState
            icon="✅"
            title="All clear! No items need review."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader title="Needs Review" icon="🔍" count={data?.count} />

      <DataTable
        data={items}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No items need review"
        emptyIcon="✅"
        getKey={(item) => `${item.user_id}-${item.id}`}
      />
    </div>
  );
}
