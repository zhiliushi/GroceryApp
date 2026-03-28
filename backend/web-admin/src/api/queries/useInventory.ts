import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import type { InventoryResponse, InventoryItem, InventoryFilters } from '@/types/api';

export function useInventory(filters?: InventoryFilters) {
  return useQuery({
    queryKey: qk.inventory.all(filters),
    queryFn: () =>
      apiClient
        .get<InventoryResponse>(API.INVENTORY, {
          params: {
            limit: 200,
            offset: 0,
            status: filters?.status || undefined,
            location: filters?.location || undefined,
            needs_review: filters?.needs_review ?? undefined,
          },
        })
        .then((r) => r.data),
  });
}

export function useInventoryItem(uid: string | undefined, id: string | undefined) {
  return useQuery({
    queryKey: qk.inventory.detail(uid!, id!),
    queryFn: () =>
      apiClient
        .get<InventoryItem>(API.INVENTORY_ITEM(uid!, id!))
        .then((r) => r.data),
    enabled: !!uid && !!id,
  });
}
