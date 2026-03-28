import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import type { PublicConfig, VisibilityConfig, TiersConfig, ExchangeRates } from '@/types/api';

export function usePublicConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => apiClient.get<PublicConfig>(API.CONFIG_PUBLIC).then((r) => r.data),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useVisibilityConfig() {
  return useQuery({
    queryKey: ['config', 'visibility'],
    queryFn: () => apiClient.get<VisibilityConfig>(API.CONFIG_VISIBILITY).then((r) => r.data),
  });
}

export function useTiersConfig() {
  return useQuery({
    queryKey: ['config', 'tiers'],
    queryFn: () => apiClient.get<TiersConfig>(API.CONFIG_TIERS).then((r) => r.data),
  });
}

export function useExchangeRates() {
  return useQuery({
    queryKey: ['exchange-rates'],
    queryFn: () => apiClient.get<ExchangeRates>(API.EXCHANGE_RATES).then((r) => r.data),
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}
