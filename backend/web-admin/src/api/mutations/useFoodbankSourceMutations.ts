import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { toast } from 'sonner';

export function useFetchSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post(API.FOODBANK_SOURCE_FETCH(id)).then((r) => r.data),
    onSuccess: () => {
      toast.success('Source fetch triggered');
      qc.invalidateQueries({ queryKey: ['foodbank-sources'] });
    },
    onError: () => toast.error('Failed to fetch source'),
  });
}

export function useResetSourceCooldown() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post(API.FOODBANK_SOURCE_RESET(id)).then((r) => r.data),
    onSuccess: () => {
      toast.success('Source cooldown reset');
      qc.invalidateQueries({ queryKey: ['foodbank-sources'] });
    },
    onError: () => toast.error('Failed to reset source cooldown'),
  });
}

export function useToggleSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post(API.FOODBANK_SOURCE_TOGGLE(id)).then((r) => r.data),
    onSuccess: () => {
      toast.success('Source toggled');
      qc.invalidateQueries({ queryKey: ['foodbank-sources'] });
    },
    onError: () => toast.error('Failed to toggle source'),
  });
}
