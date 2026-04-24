import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';

export function useDismissInsight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient
        .post<{ success: boolean; id: string }>(API.INSIGHT_DISMISS(id))
        .then((r) => r.data),
    onSuccess: () => {
      toast.success('Dismissed');
      qc.invalidateQueries({ queryKey: ['insights'] });
    },
    onError: () => toast.error('Failed to dismiss'),
  });
}
