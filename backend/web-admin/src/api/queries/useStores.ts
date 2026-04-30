import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import type { StoreCatalogEntry, StoreQuotaStatus } from '@/types/api';

const STORES_KEY = ['stores'] as const;
const STORES_SEARCH_KEY = (q: string) => ['stores', 'search', q] as const;
const STORES_QUOTA_KEY = ['stores', 'quota'] as const;

export function useStores() {
  return useQuery({
    queryKey: STORES_KEY,
    queryFn: () =>
      apiClient
        .get<{ stores: StoreCatalogEntry[] }>(API.STORES_LIST)
        .then((r) => r.data.stores),
    staleTime: 60_000,
  });
}

export function useStoreSearch(query: string) {
  return useQuery({
    queryKey: STORES_SEARCH_KEY(query),
    queryFn: () =>
      apiClient
        .get<{ matches: StoreCatalogEntry[] }>(API.STORES_SEARCH, {
          params: { q: query, limit: 8 },
        })
        .then((r) => r.data.matches),
    enabled: true,
    staleTime: 10_000,
  });
}

export function useStoreQuota() {
  return useQuery({
    queryKey: STORES_QUOTA_KEY,
    queryFn: () =>
      apiClient.get<StoreQuotaStatus>(API.STORES_QUOTA).then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useCreateStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiClient
        .post<StoreCatalogEntry>(API.STORES_LIST, { name })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: STORES_KEY });
      qc.invalidateQueries({ queryKey: STORES_QUOTA_KEY });
    },
  });
}
