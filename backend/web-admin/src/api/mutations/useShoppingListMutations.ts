import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import type {
  AddShoppingListItemPayload,
  AddShoppingListPricePayload,
  ShoppingList,
  ShoppingListItem,
  ShoppingListPrice,
} from '@/types/api';

// ─── Lists ────────────────────────────────────────────────────────────────

export function useCreateShoppingList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiClient.post<ShoppingList>(API.MY_SHOPPING_LISTS, { name }).then((r) => r.data),
    onSuccess: () => {
      toast.success('List created');
      qc.invalidateQueries({ queryKey: qk.shoppingLists.mine });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || 'Failed to create list');
    },
  });
}

export function useRenameShoppingList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, name }: { listId: string; name: string }) =>
      apiClient.patch<ShoppingList>(API.MY_SHOPPING_LIST(listId), { name }).then((r) => r.data),
    onSuccess: (_, { listId }) => {
      qc.invalidateQueries({ queryKey: qk.shoppingLists.mine });
      qc.invalidateQueries({ queryKey: qk.shoppingLists.mineDetail(listId) });
    },
    onError: () => toast.error('Failed to rename list'),
  });
}

export function useDeleteShoppingList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (listId: string) =>
      apiClient.delete(API.MY_SHOPPING_LIST(listId)).then(() => undefined),
    onSuccess: () => {
      toast.success('List deleted');
      qc.invalidateQueries({ queryKey: qk.shoppingLists.mine });
    },
    onError: () => toast.error('Failed to delete list'),
  });
}

// ─── Items ────────────────────────────────────────────────────────────────

export function useAddShoppingListItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      listId,
      payload,
    }: {
      listId: string;
      payload: AddShoppingListItemPayload;
    }) =>
      apiClient
        .post<ShoppingListItem>(API.MY_SHOPPING_LIST_ITEMS(listId), payload)
        .then((r) => r.data),
    onSuccess: (_, { listId }) => {
      qc.invalidateQueries({ queryKey: qk.shoppingLists.mineDetail(listId) });
      qc.invalidateQueries({ queryKey: qk.shoppingLists.mine });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || 'Failed to add item');
    },
  });
}

export function useUpdateShoppingListItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      listId,
      itemId,
      payload,
    }: {
      listId: string;
      itemId: string;
      payload: Partial<AddShoppingListItemPayload>;
    }) =>
      apiClient
        .patch<ShoppingListItem>(API.MY_SHOPPING_LIST_ITEM(listId, itemId), payload)
        .then((r) => r.data),
    onSuccess: (_, { listId }) => {
      qc.invalidateQueries({ queryKey: qk.shoppingLists.mineDetail(listId) });
    },
    onError: () => toast.error('Failed to update item'),
  });
}

export function useDeleteShoppingListItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, itemId }: { listId: string; itemId: string }) =>
      apiClient.delete(API.MY_SHOPPING_LIST_ITEM(listId, itemId)).then(() => undefined),
    onSuccess: (_, { listId }) => {
      qc.invalidateQueries({ queryKey: qk.shoppingLists.mineDetail(listId) });
      qc.invalidateQueries({ queryKey: qk.shoppingLists.mine });
    },
    onError: () => toast.error('Failed to remove item'),
  });
}

// ─── Price comparison entries ─────────────────────────────────────────────

export function useAddShoppingListPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      listId,
      itemId,
      payload,
    }: {
      listId: string;
      itemId: string;
      payload: AddShoppingListPricePayload;
    }) =>
      apiClient
        .post<ShoppingListPrice>(API.MY_SHOPPING_LIST_ITEM_PRICES(listId, itemId), payload)
        .then((r) => r.data),
    onSuccess: (_, { listId }) => {
      qc.invalidateQueries({ queryKey: qk.shoppingLists.mineDetail(listId) });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || 'Failed to add price');
    },
  });
}

export function useDeleteShoppingListPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      listId,
      itemId,
      priceId,
    }: {
      listId: string;
      itemId: string;
      priceId: string;
    }) =>
      apiClient
        .delete(API.MY_SHOPPING_LIST_ITEM_PRICE(listId, itemId, priceId))
        .then(() => undefined),
    onSuccess: (_, { listId }) => {
      qc.invalidateQueries({ queryKey: qk.shoppingLists.mineDetail(listId) });
    },
    onError: () => toast.error('Failed to remove price'),
  });
}
