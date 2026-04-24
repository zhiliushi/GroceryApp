import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import type { SearchResults } from '@/types/api';

const DEBOUNCE_MS = 250;
const MIN_LEN = 2;

/**
 * Debounced federated search for the GlobalSearchBar (Cmd+K).
 *
 * - Skips the network call for queries under MIN_LEN chars.
 * - Debounces input by DEBOUNCE_MS to avoid a request per keystroke.
 * - 60s staleTime so re-opening the bar after a few seconds hits cache.
 */
export function useGlobalSearch(input: string) {
  const [debounced, setDebounced] = useState(input);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(input), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [input]);

  const q = debounced.trim();
  const enabled = q.length >= MIN_LEN;

  return useQuery<SearchResults>({
    queryKey: ['global-search', q],
    queryFn: () =>
      apiClient.get<SearchResults>(API.SEARCH, { params: { q } }).then((r) => r.data),
    enabled,
    staleTime: 60_000,
  });
}
