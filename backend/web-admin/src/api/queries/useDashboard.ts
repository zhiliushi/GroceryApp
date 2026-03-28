import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import type { DashboardStats, InventoryResponse } from '@/types/api';

export function useDashboard() {
  return useQuery({
    queryKey: qk.dashboard,
    queryFn: () => apiClient.get<DashboardStats>(API.DASHBOARD).then((r) => r.data),
  });
}

export function useRecentInventory(limit = 10) {
  return useQuery({
    queryKey: ['inventory', { limit }],
    queryFn: () =>
      apiClient
        .get<InventoryResponse>(API.INVENTORY, { params: { limit } })
        .then((r) => r.data),
  });
}
