import { useState, useMemo, useCallback } from 'react';
import { useContributed } from '@/api/queries/useContributed';
import {
  useApproveContributed,
  useRejectContributed,
  useDeleteContributed,
  useBulkDeleteContributed,
} from '@/api/mutations/useContributedMutations';
import { useSelection } from '@/hooks/useSelection';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useRejectModal } from '@/hooks/useRejectModal';
import DataTable, { type Column } from '@/components/shared/DataTable';
import PageHeader from '@/components/shared/PageHeader';
import SearchBar from '@/components/shared/SearchBar';
import StatusBadge from '@/components/shared/StatusBadge';
import ImagePreview from '@/components/shared/ImagePreview';
import BulkActionBar from '@/components/shared/BulkActionBar';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import RejectReasonModal from './RejectReasonModal';
import { formatRelativeDate, formatDateTime, truncateUid } from '@/utils/format';
import { isPending, isReviewed, PAGE_LIMIT } from '@/utils/constants';
import { cn } from '@/utils/cn';
import type { ContributedProduct } from '@/types/api';

const STATUS_TABS = [
  { key: '', label: 'All', countKey: 'total' as const },
  { key: 'pending_review', label: 'Pending', countKey: 'pending_review' as const },
  { key: 'approved', label: 'Approved', countKey: 'approved' as const },
  { key: 'rejected', label: 'Rejected', countKey: 'rejected' as const },
];

const BADGE_STYLES: Record<string, string> = {
  total: 'bg-gray-600',
  pending_review: 'bg-yellow-500 text-black',
  approved: 'bg-green-600',
  rejected: 'bg-red-600',
};

export default function ContributedPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const selection = useSelection<ContributedProduct>((p) => p.barcode);
  const dialog = useConfirmDialog();
  const rejectModal = useRejectModal();

  // Fetch first page to get total, then usePagination manages the rest.
  // We use a local page state as the source of truth for the query,
  // since usePagination(total) needs data to know total.
  const [queryPage, setQueryPage] = useState(0);

  const { data, isLoading } = useContributed({
    search,
    status: statusFilter,
    page: queryPage,
  });

  const approveMutation = useApproveContributed();
  const rejectMutation = useRejectContributed();
  const deleteMutation = useDeleteContributed();
  const bulkDeleteMutation = useBulkDeleteContributed();

  const counts = data?.counts;
  const total = data?.total ?? 0;

  // Derive pagination display from total (showing text, hasNext/hasPrev)
  const hasNext = useMemo(() => (queryPage + 1) * PAGE_LIMIT < total, [queryPage, total]);
  const hasPrev = queryPage > 0;
  const showing = useMemo(() => {
    if (total === 0) return '';
    const start = queryPage * PAGE_LIMIT + 1;
    const end = Math.min(start + PAGE_LIMIT - 1, total);
    return `Showing ${start}–${end} of ${total}`;
  }, [queryPage, total]);

  // Destructure stable callbacks (defined with useCallback(fn, []) in their hooks)
  const clearSelection = selection.clear;

  const handleSearch = useCallback(
    (v: string) => {
      setSearch(v);
      setQueryPage(0);
      clearSelection();
    },
    [clearSelection],
  );

  const handleStatusFilter = useCallback(
    (status: string) => {
      setStatusFilter(status);
      setQueryPage(0);
      clearSelection();
    },
    [clearSelection],
  );

  const handleBulkApprove = async () => {
    const barcodes = Array.from(selection.selectedKeys);
    for (const bc of barcodes) {
      await approveMutation.mutateAsync(bc);
    }
    selection.clear();
  };

  const handleBulkReject = (reason: string) => {
    const barcodes = Array.from(selection.selectedKeys);
    Promise.all(
      barcodes.map((bc) => rejectMutation.mutateAsync({ barcode: bc, reason })),
    ).then(() => selection.clear());
  };

  const handleBulkDelete = () => {
    const barcodes = Array.from(selection.selectedKeys);
    bulkDeleteMutation.mutate(barcodes, { onSuccess: () => selection.clear() });
  };

  const columns: Column<ContributedProduct>[] = useMemo(
    () => [
      {
        key: 'image',
        header: '',
        render: (p) => <ImagePreview src={p.image_url} size={36} />,
        className: 'w-[50px]',
      },
      {
        key: 'barcode',
        header: 'Barcode',
        render: (p) => <code className="text-xs font-mono">{p.barcode}</code>,
      },
      {
        key: 'name',
        header: 'Name',
        render: (p) => <span className="font-medium">{p.product_name || '—'}</span>,
      },
      {
        key: 'brand',
        header: 'Brand',
        render: (p) => <span className="text-ga-text-secondary">{p.brands || '—'}</span>,
      },
      {
        key: 'category',
        header: 'Category',
        render: (p) => <span className="text-ga-text-secondary">{p.categories || '—'}</span>,
      },
      {
        key: 'contributor',
        header: 'Contributor',
        render: (p) => (
          <span className="text-xs text-ga-text-secondary font-mono" title={p.contributed_by || ''}>
            {truncateUid(p.contributed_by)}
          </span>
        ),
      },
      {
        key: 'submitted',
        header: 'Submitted',
        render: (p) => (
          <span className="text-xs text-ga-text-secondary">{formatRelativeDate(p.contributed_at)}</span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        headerClassName: 'text-center',
        className: 'text-center',
        render: (p) => <StatusBadge status={p.status} />,
      },
      {
        key: 'actions',
        header: 'Actions',
        headerClassName: 'text-right',
        className: 'text-right whitespace-nowrap',
        render: (p) => (
          <div className="flex items-center justify-end gap-1">
            {isPending(p.status) && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    approveMutation.mutate(p.barcode);
                  }}
                  disabled={approveMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white text-xs rounded px-2 py-1 transition-colors disabled:opacity-50"
                >
                  ✓
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    rejectModal.open({
                      title: `Reject "${p.product_name || p.barcode}"`,
                      onSubmit: (reason) =>
                        rejectMutation.mutate({ barcode: p.barcode, reason }),
                    });
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs rounded px-2 py-1 transition-colors"
                >
                  ✗
                </button>
              </>
            )}
            {isReviewed(p.status) && (
              <span className="text-xs text-ga-text-secondary">
                {truncateUid(p.reviewed_by)} {formatDateTime(p.reviewed_at)}
                {p.rejection_reason && (
                  <span className="text-red-400 block">{p.rejection_reason}</span>
                )}
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                dialog.confirm({
                  title: 'Delete Product',
                  message: `Delete "${p.product_name || p.barcode}"?`,
                  variant: 'danger',
                  onConfirm: () => deleteMutation.mutate(p.barcode),
                });
              }}
              className="text-red-400 hover:text-red-300 text-xs ml-1"
            >
              🗑
            </button>
          </div>
        ),
      },
    ],
    [approveMutation, rejectMutation, deleteMutation, rejectModal, dialog],
  );

  return (
    <div className="p-6">
      <PageHeader title="Contributed Products" icon="📥" count={counts?.total} />

      {/* Status Tabs */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleStatusFilter(tab.key)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md transition-colors inline-flex items-center gap-1.5',
              statusFilter === tab.key
                ? 'bg-ga-accent text-white'
                : 'border border-ga-border text-ga-text-secondary hover:bg-ga-bg-hover',
            )}
          >
            {tab.label}
            {counts && (
              <span
                className={cn(
                  'text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center font-medium',
                  statusFilter === tab.key ? 'bg-white/20' : BADGE_STYLES[tab.countKey],
                )}
              >
                {counts[tab.countKey]}
              </span>
            )}
          </button>
        ))}
      </div>

      <SearchBar
        value={search}
        onChange={handleSearch}
        placeholder="Search by barcode, product name, or brand..."
        className="mb-3"
      />

      {selection.count > 0 && (
        <BulkActionBar count={selection.count} className="mb-3">
          <button
            onClick={handleBulkApprove}
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md px-3 py-1.5 transition-colors"
          >
            ✓ Approve
          </button>
          <button
            onClick={() =>
              rejectModal.open({
                title: `Reject ${selection.count} product(s)`,
                onSubmit: handleBulkReject,
              })
            }
            className="bg-yellow-500 hover:bg-yellow-600 text-black text-sm font-medium rounded-md px-3 py-1.5 transition-colors"
          >
            ✗ Reject
          </button>
          <button
            onClick={() =>
              dialog.confirm({
                title: 'Delete Selected',
                message: `Delete ${selection.count} product(s)? This cannot be undone.`,
                variant: 'danger',
                onConfirm: handleBulkDelete,
              })
            }
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md px-3 py-1.5 transition-colors"
          >
            🗑 Delete
          </button>
        </BulkActionBar>
      )}

      <DataTable
        data={data?.records ?? []}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No contributed products found"
        emptyIcon="📥"
        selectable
        selectedKeys={selection.selectedKeys}
        getKey={(p) => p.barcode}
        onToggle={selection.toggle}
        onToggleAll={() => selection.toggleAll(data?.records ?? [])}
        isAllSelected={selection.isAllSelected(data?.records ?? [])}
        pagination={{
          showing,
          hasNext,
          hasPrev,
          nextPage: () => { setQueryPage((p) => p + 1); selection.clear(); },
          prevPage: () => { setQueryPage((p) => Math.max(0, p - 1)); selection.clear(); },
        }}
      />

      <RejectReasonModal state={rejectModal.state} onClose={rejectModal.close} />
      <ConfirmDialog state={dialog.state} onCancel={dialog.close} />
    </div>
  );
}
