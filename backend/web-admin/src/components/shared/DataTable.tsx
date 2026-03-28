import { type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';
import Pagination from './Pagination';

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  isLoading: boolean;
  emptyMessage?: string;
  emptyIcon?: string;

  // Selection
  selectable?: boolean;
  selectedKeys?: Set<string>;
  getKey?: (item: T) => string;
  onToggle?: (item: T) => void;
  onToggleAll?: (items: T[]) => void;
  isAllSelected?: boolean;

  // Pagination
  pagination?: {
    showing: string;
    hasNext: boolean;
    hasPrev: boolean;
    nextPage: () => void;
    prevPage: () => void;
  };

  // Row click
  onRowClick?: (item: T) => void;
}

export default function DataTable<T>({
  data,
  columns,
  isLoading,
  emptyMessage = 'No data found',
  emptyIcon,
  selectable,
  selectedKeys,
  getKey,
  onToggle,
  onToggleAll,
  isAllSelected,
  pagination,
  onRowClick,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="bg-ga-bg-card border border-ga-border rounded-lg">
        <LoadingSpinner text="Loading..." />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-ga-bg-card border border-ga-border rounded-lg">
        <EmptyState icon={emptyIcon} title={emptyMessage} />
      </div>
    );
  }

  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ga-border">
              {selectable && (
                <th className="w-10 px-3 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected ?? false}
                    onChange={() => onToggleAll?.(data)}
                    className="rounded border-ga-border accent-ga-accent"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ga-text-secondary',
                    col.headerClassName,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, idx) => {
              const key = getKey ? getKey(item) : String(idx);
              const isSelected = selectedKeys?.has(key) ?? false;
              return (
                <tr
                  key={key}
                  onClick={() => onRowClick?.(item)}
                  className={cn(
                    'border-b border-ga-border/50 transition-colors',
                    isSelected ? 'bg-ga-accent/10 border-l-2 border-l-ga-accent' : 'hover:bg-ga-bg-hover',
                    onRowClick && 'cursor-pointer',
                  )}
                >
                  {selectable && (
                    <td className="w-10 px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggle?.(item)}
                        className="rounded border-ga-border accent-ga-accent"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-3 py-2.5', col.className)}>
                      {col.render(item)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pagination && (
        <Pagination
          showing={pagination.showing}
          hasNext={pagination.hasNext}
          hasPrev={pagination.hasPrev}
          onNext={pagination.nextPage}
          onPrev={pagination.prevPage}
        />
      )}
    </div>
  );
}
