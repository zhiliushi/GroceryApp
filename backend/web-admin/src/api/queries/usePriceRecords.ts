import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import { PAGE_LIMIT } from '@/utils/constants';
import type { PriceRecordsResponse } from '@/types/api';

export function usePriceRecords(params: { search?: string; page?: number }) {
  return useQuery({
    queryKey: qk.priceRecords.all(params),
    queryFn: () =>
      apiClient
        .get<PriceRecordsResponse>(API.PRICE_RECORDS, {
          params: {
            limit: PAGE_LIMIT,
            offset: (params.page || 0) * PAGE_LIMIT,
            search: params.search || undefined,
          },
        })
        .then((r) => r.data),
    placeholderData: keepPreviousData,
  });
}
