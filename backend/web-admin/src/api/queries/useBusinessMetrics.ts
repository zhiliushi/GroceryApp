import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import type { BusinessMetrics, RevenueEntry } from '@/types/api';

export function useBusinessMetrics(refresh = false) {
  return useQuery({
    queryKey: [...qk.businessMetrics.all, { refresh }] as const,
    queryFn: () =>
      apiClient
        .get<BusinessMetrics>(API.BUSINESS_METRICS, { params: { refresh } })
        .then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export function useRevenueEntries() {
  return useQuery({
    queryKey: qk.businessMetrics.revenue,
    queryFn: () =>
      apiClient
        .get<{ entries: RevenueEntry[] }>(API.BUSINESS_METRICS_REVENUE)
        .then((r) => r.data.entries),
    staleTime: 60_000,
  });
}

interface AddRevenueArgs {
  date: string;
  source: string;
  amount_usd?: number;
  amount_myr?: number;
  note?: string;
}

export function useAddRevenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: AddRevenueArgs) =>
      apiClient
        .post<{ entry: RevenueEntry }>(API.BUSINESS_METRICS_REVENUE, args)
        .then((r) => r.data.entry),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.businessMetrics.all });
      qc.invalidateQueries({ queryKey: qk.businessMetrics.revenue });
    },
  });
}

export function useDeleteRevenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(API.BUSINESS_METRICS_REVENUE_DELETE(id)).then(() => id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.businessMetrics.all });
      qc.invalidateQueries({ queryKey: qk.businessMetrics.revenue });
    },
  });
}
