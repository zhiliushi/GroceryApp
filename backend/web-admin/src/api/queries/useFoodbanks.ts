import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import type { Foodbank, FoodbanksResponse, FoodbankSourcesResponse } from '@/types/api';

export function useFoodbanks(country?: string) {
  return useQuery({
    queryKey: qk.foodbanks.all(country),
    queryFn: () =>
      apiClient
        .get<FoodbanksResponse>(API.FOODBANKS, { params: country ? { country } : undefined })
        .then((r) => r.data),
  });
}

export function useFoodbank(id: string | undefined) {
  return useQuery({
    queryKey: qk.foodbanks.detail(id!),
    queryFn: () => apiClient.get<Foodbank>(API.FOODBANK(id!)).then((r) => r.data),
    enabled: !!id,
  });
}

export function useFoodbankSources() {
  return useQuery({
    queryKey: qk.foodbanks.sources,
    queryFn: () => apiClient.get<FoodbankSourcesResponse>(API.FOODBANK_SOURCES).then((r) => r.data),
  });
}
