import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import type {
  ShoppingListsResponse,
  ShoppingListDetailResponse,
} from '@/types/api';

// ─── Admin cross-user view (legacy) ───────────────────────────────────────

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

// ─── v2 user-side (uid implicit from auth) ────────────────────────────────

export function useMyShoppingLists() {
  return useQuery({
    queryKey: qk.shoppingLists.mine,
    queryFn: () =>
      apiClient.get<ShoppingListsResponse>(API.MY_SHOPPING_LISTS).then((r) => r.data),
  });
}

export function useMyShoppingListDetail(id: string | undefined) {
  return useQuery({
    queryKey: qk.shoppingLists.mineDetail(id!),
    queryFn: () =>
      apiClient.get<ShoppingListDetailResponse>(API.MY_SHOPPING_LIST(id!)).then((r) => r.data),
    enabled: !!id,
  });
}
