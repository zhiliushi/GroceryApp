import { useEffect, useState } from 'react';
import { useMe } from '@/api/queries/useMe';
import { useLocations } from '@/api/queries/useLocations';
import { useUpdateGroceryPreferences } from '@/api/mutations/useShoppingListMutations';

/**
 * Settings card for v3 shopping-list preferences:
 *  - default_grocery_storage  — where checkout-confirmed items land
 *  - record_purchase_patterns — opt-in for substitution analytics
 */
export default function GrocerySection() {
  const { data: user } = useMe();
  const { locations } = useLocations();
  const updateMutation = useUpdateGroceryPreferences();

  const [storage, setStorage] = useState<string>(
    (user as unknown as { default_grocery_storage?: string })?.default_grocery_storage ||
      '_unsorted',
  );
  const [analytics, setAnalytics] = useState<boolean>(
    (user as unknown as { record_purchase_patterns?: boolean })?.record_purchase_patterns ||
      false,
  );

  useEffect(() => {
    const u = user as unknown as {
      default_grocery_storage?: string;
      record_purchase_patterns?: boolean;
    };
    if (u?.default_grocery_storage) setStorage(u.default_grocery_storage);
    if (typeof u?.record_purchase_patterns === 'boolean') {
      setAnalytics(u.record_purchase_patterns);
    }
  }, [user]);

  function handleStorageChange(v: string) {
    setStorage(v);
    updateMutation.mutate({ default_grocery_storage: v });
  }

  function handleAnalyticsChange(v: boolean) {
    setAnalytics(v);
    updateMutation.mutate({ record_purchase_patterns: v });
  }

  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5">
      <h2 className="text-sm font-semibold text-ga-text-primary mb-1">Shopping list</h2>
      <p className="text-xs text-ga-text-secondary mb-4">
        Where confirmed checkout items land, and whether to track which
        alternatives you actually pick. (Beta — subject to change.)
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-ga-text-secondary mb-1">
            Default storage on checkout
          </label>
          <select
            value={storage}
            onChange={(e) => handleStorageChange(e.target.value)}
            className="w-full max-w-sm px-3 py-2 bg-ga-bg-primary border border-ga-border rounded-md text-sm text-ga-text-primary focus:outline-none focus:border-ga-accent"
          >
            <option value="_unsorted">🏠 Home / Unsorted (sort later)</option>
            {locations.map((loc) => (
              <option key={loc.key} value={loc.key}>
                {loc.icon || '📦'} {loc.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-ga-text-secondary mt-1">
            All confirmed items land here. You can re-distribute to specific
            storage locations from the Storage page afterward.
          </p>
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={analytics}
              onChange={(e) => handleAnalyticsChange(e.target.checked)}
              className="accent-ga-accent"
            />
            <span className="text-sm text-ga-text-primary">
              Record purchase patterns
            </span>
          </label>
          <p className="text-xs text-ga-text-secondary mt-1 ml-6">
            When enabled, the app records which brand/store you actually picked
            from your shopping-list alternatives so it can later show "your
            most-bought brand" per item. Disabled by default — your existing
            inventory data is unaffected either way.
          </p>
        </div>
      </div>
    </div>
  );
}
