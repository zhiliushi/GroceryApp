import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import type { HouseholdResponse } from '@/types/api';

export function useHousehold() {
  return useQuery({
    queryKey: qk.household,
    queryFn: () =>
      apiClient.get<HouseholdResponse>(API.HOUSEHOLD_MY).then((r) => r.data),
    staleTime: 60_000,
  });
}
