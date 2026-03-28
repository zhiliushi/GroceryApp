import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import { PAGE_LIMIT } from '@/utils/constants';
import type { ContributedResponse } from '@/types/api';

export function useContributed(params: { search?: string; status?: string; page?: number }) {
  return useQuery({
    queryKey: qk.contributed.all(params),
    queryFn: () =>
      apiClient
        .get<ContributedResponse>(API.CONTRIBUTED, {
          params: {
            limit: PAGE_LIMIT,
            offset: (params.page || 0) * PAGE_LIMIT,
            search: params.search || undefined,
            status: params.status || undefined,
          },
        })
        .then((r) => r.data),
    placeholderData: keepPreviousData,
  });
}
