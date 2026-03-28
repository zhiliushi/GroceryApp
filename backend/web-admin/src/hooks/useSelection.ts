import { useState, useCallback } from 'react';

export interface UseSelectionReturn<T> {
  selectedKeys: Set<string>;
  isSelected: (item: T) => boolean;
  toggle: (item: T) => void;
  toggleAll: (items: T[]) => void;
  clear: () => void;
  count: number;
  isAllSelected: (items: T[]) => boolean;
}

export function useSelection<T>(getKey: (item: T) => string): UseSelectionReturn<T> {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const isSelected = useCallback(
    (item: T) => selectedKeys.has(getKey(item)),
    [selectedKeys, getKey],
  );

  const toggle = useCallback(
    (item: T) => {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        const key = getKey(item);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    [getKey],
  );

  const toggleAll = useCallback(
    (items: T[]) => {
      setSelectedKeys((prev) => {
        const allKeys = items.map(getKey);
        const allSelected = allKeys.every((k) => prev.has(k));
        if (allSelected) return new Set();
        return new Set(allKeys);
      });
    },
    [getKey],
  );

  const clear = useCallback(() => setSelectedKeys(new Set()), []);

  const isAllSelected = useCallback(
    (items: T[]) => items.length > 0 && items.every((item) => selectedKeys.has(getKey(item))),
    [selectedKeys, getKey],
  );

  return { selectedKeys, isSelected, toggle, toggleAll, clear, count: selectedKeys.size, isAllSelected };
}
