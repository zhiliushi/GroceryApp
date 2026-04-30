import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import type { CatalogOverview } from '@/types/api';

export function useCatalogOverview(nameNorm: string | undefined) {
  return useQuery({
    queryKey: ['catalog-overview', nameNorm ?? ''],
    queryFn: () =>
      apiClient
        .get<CatalogOverview>(API.CATALOG_OVERVIEW(nameNorm!))
        .then((r) => r.data),
    enabled: !!nameNorm,
    staleTime: 30_000,
  });
}
