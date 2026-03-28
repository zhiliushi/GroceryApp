import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useInventory } from '@/api/queries/useInventory';
import { usePagination } from '@/hooks/usePagination';
import DataTable, { type Column } from '@/components/shared/DataTable';
import PageHeader from '@/components/shared/PageHeader';
import FilterBar from '@/components/shared/FilterBar';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatExpiry, formatCurrency, truncateUid } from '@/utils/format';
import { ITEM_STATUSES, STORAGE_LOCATIONS } from '@/utils/constants';
import type { InventoryItem, InventoryFilters } from '@/types/api';

export default function InventoryListPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [needsReview, setNeedsReview] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<InventoryFilters>({});

  const { data, isLoading } = useInventory(appliedFilters);
  const pagination = usePagination(data?.count ?? 0);

  const applyFilters = () => {
    const filters: InventoryFilters = {};
    if (statusFilter) filters.status = statusFilter;
    if (locationFilter) filters.location = locationFilter;
    if (needsReview) filters.needs_review = true;
    setAppliedFilters(filters);
    pagination.reset();
  };

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    ...ITEM_STATUSES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })),
  ];

  const locationOptions = [
    { value: '', label: 'All Locations' },
    ...STORAGE_LOCATIONS.map((l) => ({ value: l, label: l.charAt(0).toUpperCase() + l.slice(1) })),
  ];

  const paginatedItems = useMemo(() => {
    const items = data?.items ?? [];
    return items.slice(pagination.offset, pagination.offset + pagination.limit);
  }, [data, pagination.offset, pagination.limit]);

  const columns: Column<InventoryItem>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        render: (item) => <span className="font-medium text-ga-text-primary">{item.name}</span>,
      },
      {
        key: 'brand',
        header: 'Brand',
        render: (item) => <span className="text-ga-text-secondary">{item.brand || '—'}</span>,
      },
      {
        key: 'status',
        header: 'Status',
        render: (item) => <StatusBadge status={item.status} />,
        headerClassName: 'text-center',
        className: 'text-center',
      },
      {
        key: 'location',
        header: 'Location',
        render: (item) => (
          <span className="text-ga-text-secondary capitalize">
            {item.storage_location || item.location || '—'}
          </span>
        ),
      },
      {
        key: 'qty',
        header: 'Qty',
        render: (item) => (
          <span className="text-ga-text-secondary">
            {item.quantity != null ? `${item.quantity} ${item.unit || ''}`.trim() : '—'}
          </span>
        ),
      },
      {
        key: 'expiry',
        header: 'Expiry',
        render: (item) => {
          const exp = formatExpiry(item.expiryDate ?? item.expiry_date);
          return <span className={exp.className}>{exp.text}</span>;
        },
      },
      {
        key: 'price',
        header: 'Price',
        render: (item) => (
          <span className="text-ga-text-secondary">{formatCurrency(item.price)}</span>
        ),
      },
      {
        key: 'owner',
        header: 'Owner',
        render: (item) => (
          <code className="text-xs font-mono text-ga-text-secondary">
            {truncateUid(item.user_id)}
          </code>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        headerClassName: 'text-right',
        className: 'text-right',
        render: (item) => (
          <Link
            to={`/inventory/${item.user_id}/${item.id}`}
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
      <PageHeader title="Inventory" icon="📦" count={data?.count} />

      <FilterBar onApply={applyFilters} className="mb-4">
        <FilterBar.Dropdown
          label="Status"
          value={statusFilter}
          options={statusOptions}
          onChange={setStatusFilter}
        />
        <FilterBar.Dropdown
          label="Location"
          value={locationFilter}
          options={locationOptions}
          onChange={setLocationFilter}
        />
        <FilterBar.Checkbox
          label="Needs Review"
          checked={needsReview}
          onChange={setNeedsReview}
        />
      </FilterBar>

      <DataTable
        data={paginatedItems}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No inventory items found"
        emptyIcon="📦"
        getKey={(item) => `${item.user_id}-${item.id}`}
        pagination={{
          showing: pagination.showing,
          hasNext: pagination.hasNext,
          hasPrev: pagination.hasPrev,
          nextPage: pagination.nextPage,
          prevPage: pagination.prevPage,
        }}
      />
    </div>
  );
}
