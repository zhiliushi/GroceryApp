import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import { useAuthStore } from '@/stores/authStore';
import type { FeatureFlags, FeatureFlagsResponse } from '@/types/api';

/**
 * Feature flags for UI gating.
 *
 * Admin users → /api/admin/features (full set, used by FeatureFlagsTab).
 * Non-admin users → /api/features/public (subset of safe-to-expose flags).
 *
 * Cached 60s client-side (backend also caches 60s, so worst case 2min propagation).
 */
export function useFeatureFlags() {
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const path = isAdmin ? API.ADMIN_FEATURES : API.PUBLIC_FEATURES;
  return useQuery<FeatureFlags>({
    queryKey: [...qk.featureFlags, { admin: isAdmin }],
    queryFn: () =>
      apiClient.get<FeatureFlagsResponse>(path).then((r) => r.data.flags),
    staleTime: 60_000,
    retry: 1,
  });
}
