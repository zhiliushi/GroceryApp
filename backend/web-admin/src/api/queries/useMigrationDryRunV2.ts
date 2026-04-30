import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import type { MigrationDryRunReport, MigrationDryRunAllUsers } from '@/types/api';

export function useMigrationDryRunV2User(userId?: string, enabled = true) {
  return useQuery({
    queryKey: qk.migrationDryRunV2({ uid: userId }),
    queryFn: () =>
      apiClient
        .get<MigrationDryRunReport>(API.ADMIN_MIGRATION_DRY_RUN_V2, {
          params: userId ? { user_id: userId } : undefined,
        })
        .then((r) => r.data),
    enabled,
    staleTime: 30_000,
  });
}

export function useMigrationDryRunV2AllUsers(enabled = false) {
  return useQuery({
    queryKey: qk.migrationDryRunV2({ allUsers: true }),
    queryFn: () =>
      apiClient
        .get<MigrationDryRunAllUsers>(API.ADMIN_MIGRATION_DRY_RUN_V2, {
          params: { all_users: true },
        })
        .then((r) => r.data),
    enabled,
    staleTime: 30_000,
  });
}
