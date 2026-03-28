import { useMemo } from 'react';
import { usePublicConfig } from '@/api/queries/useConfig';
import { useAuthStore } from '@/stores/authStore';

const TIER_RANK: Record<string, number> = {
  free: 0,
  plus: 1,
  pro: 2,
  admin: 3,
};

function getUserTierRank(tier: string, role: string): number {
  if (role === 'admin') return TIER_RANK.admin;
  return TIER_RANK[tier] ?? 0;
}

export function useVisibility() {
  const { data: config, isLoading } = usePublicConfig();
  const user = useAuthStore((s) => s.user);
  const isAdmin = useAuthStore((s) => s.isAdmin);

  const userRank = useMemo(() => {
    if (!user) return 0;
    return getUserTierRank(user.tier || 'free', user.role);
  }, [user]);

  const canAccessPage = useMemo(() => {
    return (pageKey: string): boolean => {
      if (isAdmin) return true; // Admin bypasses all tier checks
      if (!config) return true; // Config not loaded yet — allow (fail open)
      const page = config.visibility.pages[pageKey];
      if (!page) return true; // Page not in config — allow
      if (!page.enabled) return false;
      if (page.alwaysFree) return true;
      const requiredRank = TIER_RANK[page.minTier as string] ?? 0;
      return userRank >= requiredRank;
    };
  }, [config, isAdmin, userRank]);

  const canAccessSection = useMemo(() => {
    return (pageKey: string, sectionKey: string): boolean => {
      if (isAdmin) return true;
      if (!config) return true;
      const page = config.visibility.pages[pageKey];
      if (!page?.enabled) return false;
      const section = page.sections?.[sectionKey];
      if (!section) return true; // Section not in config — allow
      if (!section.enabled) return false;
      const requiredRank = TIER_RANK[section.minTier as string] ?? 0;
      return userRank >= requiredRank;
    };
  }, [config, isAdmin, userRank]);

  const canUseTool = useMemo(() => {
    return (toolKey: string): boolean => {
      if (!user) return false;
      if (isAdmin) return true;
      const tier = user.tier || 'free';
      if (tier === 'pro') return true; // Full Fridge = all tools
      if (tier === 'plus') {
        // Smart Cart = check selected_tools
        return (user.selected_tools || []).includes(toolKey);
      }
      return false; // Basic Basket = no tools
    };
  }, [user, isAdmin]);

  return {
    canAccessPage,
    canAccessSection,
    canUseTool,
    config,
    isLoading,
    userTier: user?.tier || 'free',
    isAdmin,
  };
}
