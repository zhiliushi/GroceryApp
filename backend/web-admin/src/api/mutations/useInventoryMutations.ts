import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { toast } from 'sonner';

export function useUpdateInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, id, data }: { uid: string; id: string; data: Record<string, unknown> }) =>
      apiClient.put(API.INVENTORY_ITEM(uid, id), data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Inventory item updated');
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: () => toast.error('Failed to update inventory item'),
  });
}
