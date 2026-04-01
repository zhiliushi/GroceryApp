import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
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
