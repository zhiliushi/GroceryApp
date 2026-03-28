import { useState, useMemo, useCallback } from 'react';
import { PAGE_LIMIT } from '@/utils/constants';

export interface UsePaginationReturn {
  page: number;
  offset: number;
  limit: number;
  setPage: (p: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  hasNext: boolean;
  hasPrev: boolean;
  showing: string;
  reset: () => void;
}

export function usePagination(total: number, limit = PAGE_LIMIT): UsePaginationReturn {
  const [page, setPage] = useState(0);
  const offset = page * limit;

  const hasNext = offset + limit < total;
  const hasPrev = page > 0;

  const nextPage = useCallback(() => { if (hasNext) setPage((p) => p + 1); }, [hasNext]);
  const prevPage = useCallback(() => { if (hasPrev) setPage((p) => p - 1); }, [hasPrev]);
  const reset = useCallback(() => setPage(0), []);

  const showing = useMemo(() => {
    if (total === 0) return '';
    const start = offset + 1;
    const end = Math.min(offset + limit, total);
    return `Showing ${start}–${end} of ${total}`;
  }, [offset, limit, total]);

  return { page, offset, limit, setPage, nextPage, prevPage, hasNext, hasPrev, showing, reset };
}
