import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import type { PurchaseEvent, PurchaseListResponse, PurchaseStatus } from '@/types/api';

export interface PurchasesFilters {
  status?: PurchaseStatus;
  location?: string;
  catalog_name_norm?: string;
  limit?: number;
}

export function usePurchases(filters?: PurchasesFilters) {
  return useQuery({
    queryKey: qk.purchases.all({
      status: filters?.status,
      location: filters?.location,
      catalog_name_norm: filters?.catalog_name_norm,
    }),
    queryFn: () =>
      apiClient
        .get<PurchaseListResponse>(API.PURCHASES, {
          params: {
            status: filters?.status,
            location: filters?.location,
            catalog_name_norm: filters?.catalog_name_norm,
            limit: filters?.limit ?? 100,
          },
        })
        .then((r) => r.data),
    staleTime: 30_000,
  });
}

/**
 * Cursor-paginated purchases listing. Use on list pages that may render
 * hundreds of events (MyItemsPage, StoragePage). Pair with InfiniteScrollSentinel.
 */
export function usePurchasesInfinite(filters?: PurchasesFilters) {
  const pageSize = filters?.limit ?? 50;
  return useInfiniteQuery<PurchaseListResponse>({
    queryKey: [
      ...qk.purchases.all({
        status: filters?.status,
        location: filters?.location,
        catalog_name_norm: filters?.catalog_name_norm,
      }),
      'infinite',
      pageSize,
    ],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiClient
        .get<PurchaseListResponse>(API.PURCHASES, {
          params: {
            status: filters?.status,
            location: filters?.location,
            catalog_name_norm: filters?.catalog_name_norm,
            limit: pageSize,
            cursor: pageParam || undefined,
          },
        })
        .then((r) => r.data),
    getNextPageParam: (last) => last.next_cursor || undefined,
    staleTime: 30_000,
  });
}

export function usePurchase(eventId: string | undefined) {
  return useQuery({
    queryKey: qk.purchases.detail(eventId!),
    queryFn: () =>
      apiClient.get<PurchaseEvent>(API.PURCHASE(eventId!)).then((r) => r.data),
    enabled: !!eventId,
  });
}
