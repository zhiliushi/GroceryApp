import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import type {
  MigrationV2RunDetail,
  MigrationV2RunSummary,
} from '@/types/api';

export function useMigrationAuditLog() {
  return useQuery({
    queryKey: qk.migrationAuditLog,
    queryFn: () =>
      apiClient
        .get<{ runs: MigrationV2RunSummary[] }>(API.ADMIN_MIGRATION_AUDIT_LOG)
        .then((r) => r.data.runs),
    staleTime: 30_000,
  });
}

export function useMigrationAuditLogDetail(runId?: string) {
  return useQuery({
    queryKey: qk.migrationAuditLogDetail(runId ?? ''),
    queryFn: () =>
      apiClient
        .get<MigrationV2RunDetail>(API.ADMIN_MIGRATION_AUDIT_LOG_DETAIL(runId!))
        .then((r) => r.data),
    enabled: !!runId,
    staleTime: 30_000,
  });
}

export function useRunMigrationV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient
        .post<MigrationV2RunDetail>(API.ADMIN_MIGRATION_RUN_V2, { confirm: true })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.migrationAuditLog });
    },
  });
}
