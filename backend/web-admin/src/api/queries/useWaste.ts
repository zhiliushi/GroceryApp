import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import type { FinancialSummary, HealthScore, SpendingSummary, WasteSummary } from '@/types/api';

export function useWasteSummary(period: 'week' | 'month' | 'year' | 'all' = 'month') {
  return useQuery({
    queryKey: qk.waste.summary(period),
    queryFn: () =>
      apiClient
        .get<WasteSummary>(API.WASTE_SUMMARY, { params: { period } })
        .then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export function useSpendingSummary(period: 'week' | 'month' | 'year' | 'all' = 'month') {
  return useQuery({
    queryKey: qk.waste.spending(period),
    queryFn: () =>
      apiClient
        .get<SpendingSummary>(API.WASTE_SPENDING, { params: { period } })
        .then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

export function useFinancialSummary(period: 'week' | 'month' | 'year' | 'all' = 'month') {
  return useQuery({
    queryKey: qk.waste.financial(period),
    queryFn: () =>
      apiClient
        .get<FinancialSummary>(API.WASTE_FINANCIAL_SUMMARY, { params: { period } })
        .then((r) => r.data),
    staleTime: 5 * 60_000,
    // 404 when financial_tracking flag is off — swallow to let UI render gracefully
    retry: (failureCount, err) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) return false;
      return failureCount < 3;
    },
  });
}

export function useHealthScore() {
  return useQuery({
    queryKey: qk.waste.health,
    queryFn: () =>
      apiClient.get<HealthScore>(API.WASTE_HEALTH_SCORE).then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}
