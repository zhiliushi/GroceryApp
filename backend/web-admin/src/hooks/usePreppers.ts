import { useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useFeatureFlags } from '@/api/queries/useFeatureFlags';

/**
 * Resolve preppers feature access for the current user.
 *
 * Two layers must both be true (mirrors useHomemaker):
 *   1. Per-user gate `user.preppers_enabled` (admin-toggled; default TRUE
 *      during beta, defaults to FALSE when billing lights up).
 *   2. Global feature flag `preppers_enabled` (kill-switch).
 *
 * Beta posture: per-user toggle defaults TRUE so anyone can try it; only
 * the global flag gates the rollout while we shake out bugs.
 *
 *   const { enabled } = usePreppers();
 *   if (enabled) { ...show /preppers nav... }
 */
export function usePreppers() {
  const user = useAuthStore((s) => s.user);
  const { data: flags } = useFeatureFlags();

  return useMemo(() => {
    const userEnabled = !!user?.preppers_enabled;
    const flagEnabled = !!flags?.preppers_enabled;
    return {
      enabled: userEnabled && flagEnabled,
      userEnabled,
      flagEnabled,
    };
  }, [user?.preppers_enabled, flags?.preppers_enabled]);
}
