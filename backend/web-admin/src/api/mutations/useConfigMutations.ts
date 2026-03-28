import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { toast } from 'sonner';
import type { VisibilityConfig, TiersConfig } from '@/types/api';

export function useUpdateVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: VisibilityConfig) =>
      apiClient.put(API.CONFIG_VISIBILITY, config).then((r) => r.data),
    onSuccess: () => {
      toast.success('Visibility config saved');
      qc.invalidateQueries({ queryKey: ['config'] });
    },
    onError: () => toast.error('Failed to save visibility config'),
  });
}

export function useUpdateTiers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: TiersConfig) =>
      apiClient.put(API.CONFIG_TIERS, config).then((r) => r.data),
    onSuccess: () => {
      toast.success('Tier config saved');
      qc.invalidateQueries({ queryKey: ['config'] });
    },
    onError: () => toast.error('Failed to save tier config'),
  });
}
