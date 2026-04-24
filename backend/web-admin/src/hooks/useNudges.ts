import { useMemo } from 'react';
import { useCatalog } from '@/api/queries/useCatalog';
import { usePurchases } from '@/api/queries/usePurchases';
import { useFeatureFlags } from '@/api/queries/useFeatureFlags';
import { useUiStore } from '@/stores/uiStore';

export type ThresholdNudgeKey =
  | 'welcome'
  | 'nudge_expiry'
  | 'nudge_price'
  | 'nudge_volume'
  | 'insight_ready';

export interface ThresholdNudge {
  key: ThresholdNudgeKey;
  title: string;
  description: string;
  cta?: { label: string; to: string };
  severity: 'info' | 'tip' | 'hot';
}

/**
 * Progressive threshold nudges — driven by total_purchases + field completeness.
 *
 * Flag: `progressive_nudges` (on by default). When off, always returns null.
 * Thresholds (from feature flags.nudge_thresholds):
 *   - welcome:       total_purchases == 0
 *   - nudge_expiry:  total_purchases >= 5  AND no active purchase has expiry_date
 *   - nudge_price:   total_purchases >= 10 AND no purchase has price
 *   - nudge_volume:  total_purchases >= 20 AND no purchase has quantity > 1
 *
 * Dismissed nudges are persisted in uiStore.
 */
export function useNudges(): ThresholdNudge | null {
  const { data: flags } = useFeatureFlags();
  const { data: catalog } = useCatalog({ sort_by: 'total_purchases', limit: 500 });
  const { data: purchases } = usePurchases({ status: 'active', limit: 200 });
  const dismissed = useUiStore((s) => s.dismissedNudges);

  return useMemo(() => {
    if (flags?.progressive_nudges === false) return null;
    if (!catalog || !purchases) return null;

    const totalBought = catalog.items.reduce((sum, e) => sum + (e.total_purchases || 0), 0);
    const thresholds = (flags?.nudge_thresholds as Record<string, number> | undefined) || {
      expiry: 5,
      price: 10,
      volume: 20,
    };

    const candidates: ThresholdNudge[] = [];

    if (totalBought === 0) {
      candidates.push({
        key: 'welcome',
        title: 'Welcome to GroceryApp',
        description: 'Start by adding your first item — scan a barcode or type a name.',
        cta: { label: 'Add first item', to: '/my-items' },
        severity: 'info',
      });
    }

    if (totalBought >= thresholds.expiry) {
      const anyExpiry = purchases.items.some((e) => !!e.expiry_date);
      if (!anyExpiry) {
        candidates.push({
          key: 'nudge_expiry',
          title: 'Add expiry dates to prevent waste',
          description: `You have ${totalBought} items but none have expiry dates. Tap to start tracking.`,
          cta: { label: 'Add expiry', to: '/my-items' },
          severity: 'tip',
        });
      }
    }

    if (totalBought >= thresholds.price && flags?.financial_tracking !== false) {
      const anyPrice = purchases.items.some((e) => e.price !== null && e.price !== undefined);
      if (!anyPrice) {
        candidates.push({
          key: 'nudge_price',
          title: 'Track prices to see spending insights',
          description: 'Adding prices unlocks cash/card breakdown + monthly spending trends.',
          cta: { label: 'Set prices', to: '/my-items' },
          severity: 'tip',
        });
      }
    }

    if (totalBought >= thresholds.volume) {
      const anyVolume = purchases.items.some((e) => (e.quantity ?? 1) > 1 || !!e.unit);
      if (!anyVolume) {
        candidates.push({
          key: 'nudge_volume',
          title: 'Track volumes for finer stats',
          description: 'Recording quantity (e.g. 2 bottles) helps gauge household consumption.',
          severity: 'tip',
        });
      }
    }

    // First non-dismissed candidate wins — they're declared in priority order
    return candidates.find((c) => !dismissed.includes(c.key)) || null;
  }, [flags, catalog, purchases, dismissed]);
}
