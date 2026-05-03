import { useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useFeatureFlags } from '@/api/queries/useFeatureFlags';

/**
 * Resolve homemaker sub-feature access for the current user.
 *
 * Two layers must both be true:
 *   1. The per-user gate `user.homemaker_enabled` (set by admin)
 *   2. The global feature flag (`homemaker_versioning` / `homemaker_social`)
 *
 * Returns booleans for each sub-feature so callers can do:
 *   const { versioning, social } = useHomemaker();
 *   if (versioning) {  ... show revision history panel ... }
 *
 * `enabled` is the user-side gate alone — useful for marketing copy
 * ("you have homemaker") even if a particular sub-feature flag is OFF
 * during rollout.
 */
export function useHomemaker() {
  const user = useAuthStore((s) => s.user);
  const { data: flags } = useFeatureFlags();

  return useMemo(() => {
    const enabled = !!user?.homemaker_enabled;
    const flagVersioning = !!flags?.homemaker_versioning;
    const flagSocial = !!flags?.homemaker_social;
    return {
      enabled,
      versioning: enabled && flagVersioning,
      social: enabled && flagSocial,
    };
  }, [user?.homemaker_enabled, flags?.homemaker_versioning, flags?.homemaker_social]);
}
