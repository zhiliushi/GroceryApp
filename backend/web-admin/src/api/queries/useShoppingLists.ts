import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import type { ShoppingListsResponse, ShoppingListDetailResponse } from '@/types/api';

export function useShoppingLists() {
  return useQuery({
    queryKey: qk.shoppingLists.all,
    queryFn: () =>
      apiClient.get<ShoppingListsResponse>(API.SHOPPING_LISTS).then((r) => r.data),
  });
}

export function useShoppingListDetail(uid: string | undefined, id: string | undefined) {
  return useQuery({
    queryKey: qk.shoppingLists.detail(uid!, id!),
    queryFn: () =>
      apiClient.get<ShoppingListDetailResponse>(API.SHOPPING_LIST(uid!, id!)).then((r) => r.data),
    enabled: !!uid && !!id,
  });
}
