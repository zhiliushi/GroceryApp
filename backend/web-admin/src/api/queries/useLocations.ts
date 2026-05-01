import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import { usePurchases } from '@/api/queries/usePurchases';
import type { LocationItem, LocationsResponse } from '@/types/api';

/** Hardcoded fallback while locations load from API */
const DEFAULT_LOCATIONS: LocationItem[] = [
  { key: 'fridge', name: 'Fridge', icon: '🧊', color: '#3B82F6', sort: 0 },
  { key: 'freezer', name: 'Freezer', icon: '❄️', color: '#06B6D4', sort: 1 },
  { key: 'pantry', name: 'Pantry', icon: '🏠', color: '#F59E0B', sort: 2 },
];

export function useLocations() {
  const query = useQuery({
    queryKey: qk.locations,
    queryFn: () =>
      apiClient.get<LocationsResponse>(API.CONFIG_LOCATIONS).then((r) => r.data.locations),
    staleTime: 5 * 60 * 1000,
  });

  // Always return a usable list (fallback while loading)
  const locations = query.data ?? DEFAULT_LOCATIONS;

  const locationMap = new Map(locations.map((l) => [l.key, l]));

  const getLocation = (key: string | null | undefined): LocationItem | undefined =>
    key ? locationMap.get(key) : undefined;

  return {
    ...query,
    locations,
    locationMap,
    getLocation,
  };
}

/**
 * LOCATION_TOUCHPOINT — return distinct location strings the user has
 * actually used on their purchases, sorted by most-recent first.
 *
 * Validation-stage move: locations are now free-text (registered list
 * is just suggestions). The QuickAddModal datalist combines
 * `useLocations()` (registered) + this hook's output (recently-used
 * by the user) so suggestions match actual usage patterns.
 *
 * Hook for later: a dedicated `/api/locations/recent` endpoint with
 * server-side aggregation. For now, derive client-side from the
 * existing active-purchases query (cache-shared).
 */
export function useRecentLocations(limit = 200): string[] {
  const { data } = usePurchases({ status: 'active', limit });

  return useMemo(() => {
    const items = data?.items ?? [];
    const seen = new Map<string, number>();
    items.forEach((ev, idx) => {
      const loc = (ev.location || '').trim();
      if (!loc) return;
      // Most-recent-first: events come from API in date_bought desc order.
      // Lower idx = more recent. Keep the lowest idx per distinct value.
      if (!seen.has(loc) || idx < (seen.get(loc) ?? Infinity)) {
        seen.set(loc, idx);
      }
    });
    return Array.from(seen.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([loc]) => loc);
  }, [data]);
}
