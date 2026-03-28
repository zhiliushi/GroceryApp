import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import type { AuthUser } from '@/types/api';

export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: () => apiClient.get<AuthUser>(API.ME).then((r) => r.data),
  });
}
