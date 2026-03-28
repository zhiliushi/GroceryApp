import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { toast } from 'sonner';

export function useDeletePriceRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, id }: { uid: string; id: string }) =>
      apiClient.delete(API.PRICE_RECORD_DELETE(uid, id)).then((r) => r.data),
    onSuccess: () => {
      toast.success('Price record deleted');
      qc.invalidateQueries({ queryKey: ['price-records'] });
    },
    onError: () => toast.error('Failed to delete price record'),
  });
}

export function useBulkDeletePriceRecords() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (records: { user_id: string; record_id: string }[]) =>
      apiClient.post(API.PRICE_RECORDS_BATCH_DELETE, { records }).then((r) => r.data),
    onSuccess: (data) => {
      toast.success(`Deleted ${data.deleted} price record(s)`);
      qc.invalidateQueries({ queryKey: ['price-records'] });
    },
    onError: () => toast.error('Failed to delete price records'),
  });
}
