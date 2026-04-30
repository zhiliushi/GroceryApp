import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import type { CatalogCounterDiagnostics } from '@/types/api';

export function useCatalogCounterDiagnostics(userId?: string) {
  return useQuery({
    queryKey: qk.catalogCounterDiagnostics(userId),
    queryFn: () =>
      apiClient
        .get<CatalogCounterDiagnostics>(API.ADMIN_DIAGNOSTIC_CATALOG_COUNTERS, {
          params: userId ? { user_id: userId } : undefined,
        })
        .then((r) => r.data),
    staleTime: 30_000,
  });
}
