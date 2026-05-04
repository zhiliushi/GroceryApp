import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import type { CatalogEntry } from '@/types/api';

function invalidateCatalog(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['catalog'] });
  qc.invalidateQueries({ queryKey: ['purchases'] });
}

export function useUpdateCatalogEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      nameNorm,
      data,
    }: {
      nameNorm: string;
      data: {
        display_name?: string;
        barcode?: string | null;
        default_location?: string;
        default_category?: string;
        unit_type?: 'count' | 'volume' | 'weight' | 'container' | null;
      };
    }) =>
      apiClient.patch<CatalogEntry>(API.CATALOG_ENTRY(nameNorm), data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Catalog entry updated');
      invalidateCatalog(qc);
    },
    onError: (error: unknown) => {
      const msg = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || 'Failed to update catalog entry');
    },
  });
}

export function useMergeCatalogEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ srcNameNorm, targetNameNorm }: { srcNameNorm: string; targetNameNorm: string }) =>
      apiClient
        .post<CatalogEntry>(API.CATALOG_MERGE(srcNameNorm), { target_name_norm: targetNameNorm })
        .then((r) => r.data),
    onSuccess: () => {
      toast.success('Catalog entries merged');
      invalidateCatalog(qc);
    },
    onError: () => toast.error('Failed to merge catalog entries'),
  });
}

/**
 * v3 catalog delete response — cascades to shopping-list refs.
 * `cascade=false` only happens on the legacy `?force=true` path.
 */
export interface CatalogDeleteResult {
  success: boolean;
  name_norm: string;
  cascade?: boolean;
  force?: boolean;
  // Cascade fields (present when cascade=true)
  dry_run?: boolean;
  deleted?: boolean;
  global_revert_to_name?: string | null;
  primaries_repointed?: number;
  primaries_deleted?: number;
  alternatives_repointed?: number;
  alternatives_deleted?: number;
}

export function useDeleteCatalogEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nameNorm, force }: { nameNorm: string; force?: boolean }) =>
      apiClient
        .delete<CatalogDeleteResult>(API.CATALOG_ENTRY(nameNorm), {
          params: { force: force ? true : undefined },
        })
        .then((r) => r.data),
    onSuccess: (data) => {
      // Tailor toast to cascade outcome
      const parts: string[] = ['Catalog entry deleted'];
      const repointed =
        (data.primaries_repointed || 0) + (data.alternatives_repointed || 0);
      const cascadeDeleted =
        (data.primaries_deleted || 0) + (data.alternatives_deleted || 0);
      if (repointed > 0) {
        parts.push(
          `${repointed} shopping-list ref${repointed === 1 ? '' : 's'} reverted to global name`,
        );
      }
      if (cascadeDeleted > 0) {
        parts.push(
          `${cascadeDeleted} shopping-list ref${cascadeDeleted === 1 ? '' : 's'} removed`,
        );
      }
      toast.success(parts.join(' · '));
      invalidateCatalog(qc);
      // Shopping list also changed — invalidate its caches
      qc.invalidateQueries({ queryKey: ['shopping-lists'] });
    },
    onError: (error: unknown) => {
      const msg = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || 'Failed to delete catalog entry');
    },
  });
}

/** Preview the cascade without deleting. Returns what WOULD happen. */
export function usePreviewDeleteCatalogEntry() {
  return useMutation({
    mutationFn: (nameNorm: string) =>
      apiClient
        .delete<CatalogDeleteResult>(API.CATALOG_ENTRY(nameNorm), {
          params: { preview: true },
        })
        .then((r) => r.data),
  });
}
