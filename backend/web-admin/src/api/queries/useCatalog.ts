import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import type {
  CatalogEntry,
  CatalogListResponse,
} from '@/types/api';

export function useCatalog(params?: { q?: string; sort_by?: string; limit?: number }) {
  return useQuery({
    queryKey: qk.catalog.all({ q: params?.q, sort_by: params?.sort_by }),
    queryFn: () =>
      apiClient
        .get<CatalogListResponse>(API.CATALOG, {
          params: {
            q: params?.q || undefined,
            sort_by: params?.sort_by || undefined,
            limit: params?.limit ?? 100,
          },
        })
        .then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

/**
 * Cursor-paginated catalog listing. Use on pages that may render 500+ entries
 * (CatalogListPage, GlobalSearchBar). Pair with an IntersectionObserver
 * sentinel that calls `fetchNextPage` when the user scrolls near the bottom.
 */
export function useCatalogInfinite(params?: {
  q?: string;
  sort_by?: string;
  limit?: number;
}) {
  const pageSize = params?.limit ?? 50;
  return useInfiniteQuery<CatalogListResponse>({
    queryKey: [...qk.catalog.all({ q: params?.q, sort_by: params?.sort_by }), 'infinite', pageSize],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiClient
        .get<CatalogListResponse>(API.CATALOG, {
          params: {
            q: params?.q || undefined,
            sort_by: params?.sort_by || undefined,
            limit: pageSize,
            cursor: pageParam || undefined,
          },
        })
        .then((r) => r.data),
    getNextPageParam: (last) => last.next_cursor || undefined,
    staleTime: 5 * 60_000,
  });
}

export function useCatalogEntry(nameNorm: string | undefined) {
  return useQuery({
    queryKey: qk.catalog.detail(nameNorm!),
    queryFn: () =>
      apiClient.get<CatalogEntry>(API.CATALOG_ENTRY(nameNorm!)).then((r) => r.data),
    enabled: !!nameNorm,
  });
}

export function useCatalogByBarcode(barcode: string | undefined) {
  return useQuery({
    queryKey: qk.catalog.byBarcode(barcode!),
    queryFn: () =>
      apiClient
        .get<{ entry: CatalogEntry | null }>(API.CATALOG_BARCODE_LOOKUP(barcode!))
        .then((r) => r.data.entry),
    enabled: !!barcode,
  });
}
