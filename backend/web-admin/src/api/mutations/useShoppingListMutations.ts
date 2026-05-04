import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import type {
  AddShoppingListItemPayload,
  AddShoppingListPricePayload,
  CheckoutPayload,
  CheckoutResult,
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

/** Generic update — pass any subset of {name, notes}. */
export function useUpdateShoppingList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      listId,
      patch,
    }: {
      listId: string;
      patch: { name?: string; notes?: string };
    }) =>
      apiClient.patch<ShoppingList>(API.MY_SHOPPING_LIST(listId), patch).then((r) => r.data),
    onSuccess: (_, { listId }) => {
      qc.invalidateQueries({ queryKey: qk.shoppingLists.mine });
      qc.invalidateQueries({ queryKey: qk.shoppingLists.mineDetail(listId) });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || 'Failed to update list');
    },
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

/** Detect a quota error response and emit a `grocery:cap-hit` window event
 *  so the page can show the CapHitPrompt instead of a generic toast. */
function maybeFireCapHit(
  err: unknown,
  scope: 'primaries' | 'alternatives',
  context?: Record<string, unknown>,
): boolean {
  const response = (err as { response?: { status?: number; data?: { details?: { scope?: string; limit?: number } } } })?.response;
  const data = response?.data;
  const expectedScope =
    scope === 'primaries' ? 'shopping_list_primaries' : 'shopping_list_alternatives';
  if (response?.status === 409 && data?.details?.scope === expectedScope) {
    window.dispatchEvent(
      new CustomEvent('grocery:cap-hit', {
        detail: {
          cap_type: scope === 'primaries' ? 'primary' : 'alternative',
          cap_value: data.details.limit,
          context,
        },
      }),
    );
    return true;
  }
  return false;
}

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
    onError: (err: unknown, { listId }) => {
      if (maybeFireCapHit(err, 'primaries', { list_id: listId })) return;
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
    onError: (err: unknown, { listId, itemId }) => {
      if (maybeFireCapHit(err, 'alternatives', { list_id: listId, item_id: itemId })) return;
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

// ─── v3: Tick + Checkout + Promote ────────────────────────────────────────

/** Tick / untick an alternative. Idempotent. */
export function useTickAlternative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      listId,
      itemId,
      priceId,
      ticked,
    }: {
      listId: string;
      itemId: string;
      priceId: string;
      ticked: boolean;
    }) =>
      apiClient
        .patch<ShoppingListPrice>(
          API.MY_SHOPPING_LIST_ITEM_PRICE_TICK(listId, itemId, priceId),
          { ticked },
        )
        .then((r) => r.data),
    onSuccess: (_, { listId }) => {
      qc.invalidateQueries({ queryKey: qk.shoppingLists.mineDetail(listId) });
    },
    onError: () => toast.error('Failed to update tick'),
  });
}

/** "Use as alternative" helper — creates one alternative copying the
 *  primary's name + qty so the user can tick + buy without comparing. */
export function usePromoteToAlternative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, itemId }: { listId: string; itemId: string }) =>
      apiClient
        .post<ShoppingListPrice>(API.MY_SHOPPING_LIST_ITEM_PROMOTE(listId, itemId))
        .then((r) => r.data),
    onSuccess: (_, { listId }) => {
      qc.invalidateQueries({ queryKey: qk.shoppingLists.mineDetail(listId) });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || 'Failed to promote primary');
    },
  });
}

/** Confirm checkout — atomic batch commit of all ticked alternatives. */
export function useConfirmCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      listId,
      payload,
    }: {
      listId: string;
      payload: CheckoutPayload;
    }) =>
      apiClient
        .post<CheckoutResult>(API.MY_SHOPPING_LIST_CHECKOUT(listId), payload)
        .then((r) => r.data),
    onSuccess: (data, { listId }) => {
      qc.invalidateQueries({ queryKey: qk.shoppingLists.mine });
      qc.invalidateQueries({ queryKey: qk.shoppingLists.mineDetail(listId) });
      // Inventory + catalog change too — purchase events created
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['catalog'] });
      toast.success(
        `Checkout done — ${data.total_purchases} item${data.total_purchases === 1 ? '' : 's'} added.`,
      );
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || 'Checkout failed');
    },
  });
}

/** Update user grocery preferences (default storage + analytics opt-in). */
export function useUpdateGroceryPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      default_grocery_storage?: string;
      record_purchase_patterns?: boolean;
    }) =>
      apiClient.put(API.MY_GROCERY_PREFERENCES, payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.me });
      toast.success('Preferences saved');
    },
    onError: () => toast.error('Failed to save preferences'),
  });
}
