import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import type { Insight } from '@/types/api';

interface InsightsListResponse {
  count: number;
  insights: Insight[];
}

export function useInsights() {
  return useQuery({
    queryKey: qk.insights.all,
    queryFn: () =>
      apiClient.get<InsightsListResponse>(API.INSIGHTS).then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export function useInsight(id: string | undefined) {
  return useQuery({
    queryKey: qk.insights.detail(id!),
    queryFn: () => apiClient.get<Insight>(API.INSIGHT(id!)).then((r) => r.data),
    enabled: !!id,
  });
}
