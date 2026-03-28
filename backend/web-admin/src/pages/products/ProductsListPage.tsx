import { useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProducts } from '@/api/queries/useProducts';
import { useDeleteProduct } from '@/api/mutations/useProductMutations';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import DataTable, { type Column } from '@/components/shared/DataTable';
import PageHeader from '@/components/shared/PageHeader';
import SearchBar from '@/components/shared/SearchBar';
import StatusBadge from '@/components/shared/StatusBadge';
import ImagePreview from '@/components/shared/ImagePreview';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { formatRelativeDate, truncateText } from '@/utils/format';
import type { Product } from '@/types/api';

export default function ProductsListPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useProducts(search);
  const deleteMutation = useDeleteProduct();
  const dialog = useConfirmDialog();
  const navigate = useNavigate();

  const handleSearch = useCallback((v: string) => setSearch(v), []);

  const columns: Column<Product>[] = useMemo(
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
        key: 'categories',
        header: 'Categories',
        render: (p) => (
          <span className="text-ga-text-secondary">{truncateText(p.categories, 40)}</span>
        ),
      },
      {
        key: 'source',
        header: 'Source',
        render: (p) => <StatusBadge status={p.source} />,
        headerClassName: 'text-center',
        className: 'text-center',
      },
      {
        key: 'cached',
        header: 'Cached',
        render: (p) => (
          <span className="text-xs text-ga-text-secondary">{formatRelativeDate(p.cached_at)}</span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        headerClassName: 'text-right',
        className: 'text-right',
        render: (p) => (
          <div className="flex items-center justify-end gap-1">
            <Link
              to={`/products/${p.barcode}/edit`}
              className="text-ga-accent hover:underline text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              Edit
            </Link>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dialog.confirm({
                  title: 'Delete Product',
                  message: `Delete "${p.product_name || p.barcode}"? This cannot be undone.`,
                  variant: 'danger',
                  onConfirm: () => deleteMutation.mutate(p.barcode),
                });
              }}
              className="text-red-400 hover:text-red-300 text-xs ml-2"
            >
              Delete
            </button>
          </div>
        ),
      },
    ],
    [dialog, deleteMutation],
  );

  return (
    <div className="p-6">
      <PageHeader
        title="Products"
        icon="🏷️"
        count={data?.count}
        action={
          <Link
            to="/products/new"
            className="bg-ga-accent hover:bg-ga-accent-hover text-white text-sm font-medium rounded-md px-3 py-1.5 transition-colors"
          >
            + Add Product
          </Link>
        }
      />
      <SearchBar
        value={search}
        onChange={handleSearch}
        placeholder="Search by barcode, name, or brand..."
        className="mb-4"
      />
      <DataTable
        data={data?.products ?? []}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No products found"
        emptyIcon="📦"
        getKey={(p) => p.barcode}
        onRowClick={(p) => navigate(`/products/${p.barcode}/edit`)}
      />
      <ConfirmDialog state={dialog.state} onCancel={dialog.close} />
    </div>
  );
}
