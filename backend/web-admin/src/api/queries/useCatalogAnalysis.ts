import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import type { CatalogAnalysis } from '@/types/api';

export function useCatalogAnalysis(refresh = false) {
  return useQuery({
    queryKey: qk.catalogAnalysis,
    queryFn: () =>
      apiClient
        .get<CatalogAnalysis>(API.ADMIN_CATALOG_ANALYSIS, {
          params: { refresh },
        })
        .then((r) => r.data),
    staleTime: 60 * 60_000, // 1 hour (scheduler refreshes weekly)
  });
}
