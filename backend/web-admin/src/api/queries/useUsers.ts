import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import type { UsersResponse, User } from '@/types/api';

export function useUsers() {
  return useQuery({
    queryKey: qk.users.all,
    queryFn: () =>
      apiClient.get<UsersResponse>(API.USERS).then((r) => r.data),
  });
}

export function useUser(uid: string | undefined) {
  return useQuery({
    queryKey: qk.users.detail(uid!),
    queryFn: () => apiClient.get<User>(API.USER(uid!)).then((r) => r.data),
    enabled: !!uid,
  });
}
