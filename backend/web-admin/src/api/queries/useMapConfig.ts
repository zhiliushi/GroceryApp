import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import type { ManualStore, MapConfig } from '@/types/api';

export function useMapConfig() {
  return useQuery({
    queryKey: ['map-config'],
    queryFn: () => apiClient.get<MapConfig>(API.CONFIG_MAP).then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });
}

export function useManualStores() {
  return useQuery({
    queryKey: ['stores'],
    queryFn: () =>
      apiClient.get<{ stores: ManualStore[] }>(API.STORES).then((r) => r.data.stores),
    staleTime: 5 * 60 * 1000,
  });
}
