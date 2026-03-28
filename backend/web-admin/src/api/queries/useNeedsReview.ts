import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import type { InventoryResponse } from '@/types/api';

export function useNeedsReview() {
  return useQuery({
    queryKey: qk.needsReview,
    queryFn: () =>
      apiClient
        .get<InventoryResponse>(API.NEEDS_REVIEW, { params: { limit: 50 } })
        .then((r) => r.data),
  });
}
