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

export function useDeleteCatalogEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nameNorm, force }: { nameNorm: string; force?: boolean }) =>
      apiClient
        .delete<{ success: boolean; name_norm: string }>(API.CATALOG_ENTRY(nameNorm), {
          params: { force: force ? true : undefined },
        })
        .then((r) => r.data),
    onSuccess: () => {
      toast.success('Catalog entry deleted');
      invalidateCatalog(qc);
    },
    onError: (error: unknown) => {
      const msg = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || 'Failed to delete catalog entry');
    },
  });
}
