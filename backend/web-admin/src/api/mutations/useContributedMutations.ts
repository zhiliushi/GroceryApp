import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { toast } from 'sonner';

export function useApproveContributed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (barcode: string) =>
      apiClient.post(API.CONTRIBUTED_APPROVE(barcode)).then((r) => r.data),
    onSuccess: (data) => {
      toast.success(data.message || 'Product approved');
      qc.invalidateQueries({ queryKey: ['contributed'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => toast.error('Failed to approve product'),
  });
}

export function useRejectContributed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ barcode, reason }: { barcode: string; reason: string }) =>
      apiClient
        .post(`${API.CONTRIBUTED_REJECT(barcode)}?reason=${encodeURIComponent(reason)}`)
        .then((r) => r.data),
    onSuccess: (data) => {
      toast.success(data.message || 'Product rejected');
      qc.invalidateQueries({ queryKey: ['contributed'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => toast.error('Failed to reject product'),
  });
}

export function useDeleteContributed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (barcode: string) =>
      apiClient.delete(API.CONTRIBUTED_DELETE(barcode)).then((r) => r.data),
    onSuccess: () => {
      toast.success('Product deleted');
      qc.invalidateQueries({ queryKey: ['contributed'] });
    },
    onError: () => toast.error('Failed to delete product'),
  });
}

export function useBulkDeleteContributed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (barcodes: string[]) =>
      apiClient.post(API.CONTRIBUTED_BATCH_DELETE, { barcodes }).then((r) => r.data),
    onSuccess: (data) => {
      toast.success(`Deleted ${data.deleted} product(s)`);
      qc.invalidateQueries({ queryKey: ['contributed'] });
    },
    onError: () => toast.error('Failed to delete products'),
  });
}
