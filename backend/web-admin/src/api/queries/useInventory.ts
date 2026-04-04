import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import { useAuthStore } from '@/stores/authStore';
import type { InventoryResponse, InventoryItem, InventoryFilters } from '@/types/api';

/**
 * Inventory query — household-aware for regular users, admin endpoint for admins.
 *
 * Regular users: GET /api/inventory/my (own + household members' items)
 * Admins: GET /api/admin/inventory (all users)
 */
export function useInventory(filters?: InventoryFilters) {
  const isAdmin = useAuthStore((s) => s.isAdmin);

  return useQuery({
    queryKey: qk.inventory.all(filters),
    queryFn: () => {
      if (isAdmin) {
        // Admin: cross-all-users endpoint
        return apiClient
          .get<InventoryResponse>(API.INVENTORY, {
            params: {
              limit: 200,
              offset: 0,
              status: filters?.status || undefined,
              location: filters?.location || undefined,
              needs_review: filters?.needs_review ?? undefined,
            },
          })
          .then((r) => r.data);
      }
      // Regular user: household-aware endpoint
      return apiClient
        .get<InventoryResponse>(API.MY_INVENTORY)
        .then((r) => r.data);
    },
    staleTime: 60_000,
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
