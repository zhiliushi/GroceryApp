import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import type { FeatureFlags } from '@/types/api';

/**
 * Update one or more feature flags. Server invalidates its 60s cache immediately.
 */
export function useUpdateFeatureFlags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: Partial<FeatureFlags>) =>
      apiClient
        .patch<{ success: boolean; flags: FeatureFlags }>(API.ADMIN_FEATURES, updates)
        .then((r) => r.data),
    onSuccess: (res) => {
      toast.success('Feature flags updated');
      qc.setQueryData(['feature-flags'], res.flags);
      qc.invalidateQueries({ queryKey: ['feature-flags'] });
    },
    onError: (error: unknown) => {
      const msg = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || 'Failed to update flags');
    },
  });
}
