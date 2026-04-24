import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';

export function usePromoteToGlobal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ barcode, canonical_name }: { barcode: string; canonical_name: string }) =>
      apiClient
        .post<{ barcode: string; canonical_name: string }>(API.ADMIN_CATALOG_PROMOTE, {
          barcode,
          canonical_name,
        })
        .then((r) => r.data),
    onSuccess: () => {
      toast.success('Promoted to global catalog');
      qc.invalidateQueries({ queryKey: ['catalog-analysis'] });
    },
    onError: () => toast.error('Failed to promote'),
  });
}

export function useFlagSpam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ barcode, reason }: { barcode: string; reason?: string }) =>
      apiClient
        .post<{ barcode: string; flagged: boolean }>(API.ADMIN_CATALOG_FLAG_SPAM, {
          barcode,
          reason: reason || '',
        })
        .then((r) => r.data),
    onSuccess: () => {
      toast.success('Flagged as spam');
      qc.invalidateQueries({ queryKey: ['catalog-analysis'] });
    },
    onError: () => toast.error('Failed to flag spam'),
  });
}
