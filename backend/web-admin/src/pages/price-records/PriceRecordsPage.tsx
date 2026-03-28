import { useState, useMemo, useCallback } from 'react';
import { usePriceRecords } from '@/api/queries/usePriceRecords';
import {
  useDeletePriceRecord,
  useBulkDeletePriceRecords,
} from '@/api/mutations/usePriceRecordMutations';
import { useSelection } from '@/hooks/useSelection';
import { usePagination } from '@/hooks/usePagination';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import DataTable, { type Column } from '@/components/shared/DataTable';
import PageHeader from '@/components/shared/PageHeader';
import SearchBar from '@/components/shared/SearchBar';
import BulkActionBar from '@/components/shared/BulkActionBar';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { formatRelativeDate, formatCurrency, truncateUid } from '@/utils/format';
import type { PriceRecord } from '@/types/api';

export default function PriceRecordsPage() {
  const [search, setSearch] = useState('');
  const selection = useSelection<PriceRecord>((r) => `${r.user_id}:${r.id}`);
  const dialog = useConfirmDialog();

  // Need a first pass to get total, then pagination uses it
  const { data } = usePriceRecords({ search, page: 0 });
  const total = data?.total ?? 0;
  const pg = usePagination(total);

  // Actual paginated query
  const { data: pageData, isLoading: pageLoading } = usePriceRecords({
    search,
    page: pg.page,
  });

  const records = pageData?.records ?? [];

  const deleteMutation = useDeletePriceRecord();
  const bulkDeleteMutation = useBulkDeletePriceRecords();

  const handleSearch = useCallback(
    (v: string) => {
      setSearch(v);
      pg.reset();
      selection.clear();
    },
    [pg, selection],
  );

  const handleBulkDelete = () => {
    const recs = Array.from(selection.selectedKeys).map((key) => {
      const [user_id, record_id] = key.split(':');
      return { user_id, record_id };
    });
    bulkDeleteMutation.mutate(recs, { onSuccess: () => selection.clear() });
  };

  const columns: Column<PriceRecord>[] = useMemo(
    () => [
      {
        key: 'barcode',
        header: 'Barcode',
        render: (r) => <code className="text-xs font-mono">{r.barcode}</code>,
      },
      {
        key: 'product',
        header: 'Product',
        render: (r) => (
          <span className="font-medium text-ga-text-primary text-sm">
            {r.product_name || '—'}
          </span>
        ),
      },
      {
        key: 'price',
        header: 'Price (RM)',
        render: (r) => (
          <span className="text-sm">{formatCurrency(r.price)}</span>
        ),
      },
      {
        key: 'store',
        header: 'Store',
        render: (r) => (
          <span className="text-ga-text-secondary text-sm">{r.store_name || '—'}</span>
        ),
      },
      {
        key: 'location',
        header: 'Location',
        render: (r) => (
          <span className="text-ga-text-secondary text-sm truncate max-w-[180px] block">
            {r.location_address || '—'}
          </span>
        ),
      },
      {
        key: 'user',
        header: 'User',
        render: (r) => (
          <span className="text-xs text-ga-text-secondary font-mono" title={r.user_id}>
            {truncateUid(r.user_id)}
          </span>
        ),
      },
      {
        key: 'date',
        header: 'Date',
        render: (r) => (
          <span className="text-xs text-ga-text-secondary">
            {formatRelativeDate(r.created_at)}
          </span>
        ),
      },
      {
        key: 'actions',
        header: '',
        headerClassName: 'text-right',
        className: 'text-right',
        render: (r) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              dialog.confirm({
                title: 'Delete Price Record',
                message: `Delete price record for "${r.product_name || r.barcode}"?`,
                variant: 'danger',
                onConfirm: () => deleteMutation.mutate({ uid: r.user_id, id: r.id }),
              });
            }}
            className="text-red-400 hover:text-red-300 text-xs transition-colors"
          >
            Delete
          </button>
        ),
      },
    ],
    [dialog, deleteMutation],
  );

  return (
    <div className="p-6">
      <PageHeader title="Price Records" icon="💰" count={total} />

      <SearchBar
        value={search}
        onChange={handleSearch}
        placeholder="Search by barcode, product name, or store..."
        className="mb-3"
      />

      {selection.count > 0 && (
        <BulkActionBar count={selection.count} className="mb-3">
          <button
            onClick={() =>
              dialog.confirm({
                title: 'Delete Selected',
                message: `Delete ${selection.count} price record(s)? This cannot be undone.`,
                variant: 'danger',
                onConfirm: handleBulkDelete,
              })
            }
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md px-3 py-1.5 transition-colors"
          >
            Delete Selected
          </button>
        </BulkActionBar>
      )}

      <DataTable
        data={records}
        columns={columns}
        isLoading={pageLoading}
        emptyMessage="No price records found"
        emptyIcon="💰"
        selectable
        selectedKeys={selection.selectedKeys}
        getKey={(r) => `${r.user_id}:${r.id}`}
        onToggle={selection.toggle}
        onToggleAll={() => selection.toggleAll(records)}
        isAllSelected={selection.isAllSelected(records)}
        pagination={{
          showing: pg.showing,
          hasNext: pg.hasNext,
          hasPrev: pg.hasPrev,
          nextPage: () => { pg.nextPage(); selection.clear(); },
          prevPage: () => { pg.prevPage(); selection.clear(); },
        }}
      />

      <ConfirmDialog state={dialog.state} onCancel={dialog.close} />
    </div>
  );
}
