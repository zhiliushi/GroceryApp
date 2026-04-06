import { useState, useCallback, useRef } from 'react';
import type { OverpassNode } from '@/types/api';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * Fetch supermarkets from Overpass API (OpenStreetMap) within map bounds.
 * Debounced — only fires after 500ms of no new calls.
 * Caches results per bounds to avoid re-fetching.
 */
export function useOverpassStores() {
  const [stores, setStores] = useState<OverpassNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const cacheRef = useRef<Map<string, OverpassNode[]>>(new Map());

  const fetchStores = useCallback((bounds: Bounds) => {
    // Debounce
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      const key = `${bounds.south.toFixed(3)},${bounds.west.toFixed(3)},${bounds.north.toFixed(3)},${bounds.east.toFixed(3)}`;

      // Check cache
      if (cacheRef.current.has(key)) {
        setStores(cacheRef.current.get(key)!);
        return;
      }

      setLoading(true);
      setError(null);

      const query = `[out:json][timeout:10];(node["shop"="supermarket"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});node["shop"="convenience"](${bounds.south},${bounds.west},${bounds.north},${bounds.east}););out body;`;

      try {
        const resp = await fetch(OVERPASS_URL, {
          method: 'POST',
          body: `data=${encodeURIComponent(query)}`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        if (!resp.ok) throw new Error(`Overpass API error: ${resp.status}`);

        const data = await resp.json();
        const nodes: OverpassNode[] = (data.elements || []).filter(
          (el: OverpassNode) => el.lat && el.lon && el.tags?.name,
        );

        // Limit to prevent map overload
        const limited = nodes.slice(0, 500);
        cacheRef.current.set(key, limited);
        setStores(limited);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch stores');
      } finally {
        setLoading(false);
      }
    }, 500);
  }, []);

  return { stores, loading, error, fetchStores };
}
