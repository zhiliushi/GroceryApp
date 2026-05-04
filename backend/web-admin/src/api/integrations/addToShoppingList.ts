import { toast } from 'sonner';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import { queryClient } from '@/api/queryClient';
import type {
  ShoppingList,
  ShoppingListItem,
  ShoppingListsResponse,
} from '@/types/api';

/**
 * Cross-page integration hook: add an entry to a user shopping list from
 * anywhere in the app (Catalog detail, My Items, Recipes, Dashboard,
 * receipt scan side-door, etc.).
 *
 * Two surfaces, both backed by the same logic:
 *
 *   1. **`addItemToShoppingList(payload)`** — async function. `await` it
 *      to know the result. Use this from React handlers, async flows,
 *      or anywhere you need to react to success/failure. Returns the
 *      created item; throws on failure.
 *
 *   2. **`window.dispatchEvent(new CustomEvent('grocery:add-to-shopping-list',
 *      { detail: payload }))`** — fire-and-forget. Use from non-React
 *      contexts or when you don't need to await. Toasts on success/error.
 *
 * Both invalidate the relevant React Query caches so any open shopping
 * list view auto-refreshes.
 *
 * The target list resolution rules (in order):
 *   1. If `payload.listId` is provided, use it directly.
 *   2. If `payload.listId` is `'active'` (or omitted), pick the user's
 *      most-recently-updated list. If no list exists, create one named
 *      "My Shopping List".
 *
 * The 15-primary cap is enforced server-side; on 409 we re-throw so the
 * caller can decide what to do (the existing CapHitPrompt is wired via
 * the `useShoppingListMutations` hook, NOT this helper — direct callers
 * should toast the error themselves or surface a custom UI).
 */

export interface AddToShoppingListPayload {
  /** Specific list id, or 'active' (default) to pick most-recent / auto-create. */
  listId?: string | 'active';
  /** Required. Display name of the item. */
  item_name: string;
  /** Optional structured fields — same shape as POST /api/shopping-lists/{id}/items. */
  quantity?: number;
  unit?: string;
  weight_value?: number;
  weight_unit?: 'g' | 'kg' | 'oz' | 'lb';
  volume_value?: number;
  volume_unit?: 'ml' | 'l' | 'fl_oz' | 'cup';
  notes?: string;
  barcode?: string;
  /** If you've already resolved a catalog match, pass its name_norm to skip
   *  the catalog-quota fallback. */
  source_catalog_name_norm?: string;
  /** Audit-trail tag for analytics: 'cross_page' is the default for this
   *  helper. Frontend uses 'manual' / 'catalog' / 'scan' / 'receipt' /
   *  'cross_page' — backend accepts free-form. */
  source?: string;
}

const DEFAULT_LIST_NAME = 'My Shopping List';

async function resolveActiveListId(): Promise<string> {
  const resp = await apiClient.get<ShoppingListsResponse>(API.MY_SHOPPING_LISTS);
  const lists = resp.data.lists ?? [];
  if (lists.length > 0) {
    // Most-recently-updated wins. Falls back to created_at when updated_at
    // is missing on legacy docs.
    const sorted = [...lists].sort((a, b) => {
      const at = (a.updated_at || a.created_at || '') as string;
      const bt = (b.updated_at || b.created_at || '') as string;
      return bt.localeCompare(at);
    });
    return sorted[0].id;
  }
  // No list exists — create the default.
  const created = await apiClient
    .post<ShoppingList>(API.MY_SHOPPING_LISTS, { name: DEFAULT_LIST_NAME })
    .then((r) => r.data);
  return created.id;
}

/**
 * Programmatic surface — `await` for the result.
 *
 * @example
 *   import { addItemToShoppingList } from '@/api/integrations/addToShoppingList';
 *   await addItemToShoppingList({ item_name: 'Eggs', quantity: 12, source: 'catalog' });
 */
export async function addItemToShoppingList(
  payload: AddToShoppingListPayload,
): Promise<ShoppingListItem> {
  if (!payload.item_name || !payload.item_name.trim()) {
    throw new Error('item_name is required');
  }

  const targetListId =
    payload.listId && payload.listId !== 'active'
      ? payload.listId
      : await resolveActiveListId();

  const { listId: _listId, ...itemFields } = payload;
  const body = {
    ...itemFields,
    source: itemFields.source ?? 'cross_page',
  };

  const created = await apiClient
    .post<ShoppingListItem>(API.MY_SHOPPING_LIST_ITEMS(targetListId), body)
    .then((r) => r.data);

  // Invalidate the shopping-list caches so the page (if open) refreshes.
  queryClient.invalidateQueries({ queryKey: qk.shoppingLists.mine });
  queryClient.invalidateQueries({ queryKey: qk.shoppingLists.mineDetail(targetListId) });

  return created;
}

/**
 * Window-event surface — fire-and-forget. Listens at module-load time
 * (registered once below). Other code dispatches:
 *
 *   window.dispatchEvent(
 *     new CustomEvent('grocery:add-to-shopping-list', {
 *       detail: { item_name: 'Eggs', quantity: 12 }
 *     }),
 *   );
 *
 * Surfaces success/error via toasts. To know the result programmatically,
 * use `addItemToShoppingList` directly instead.
 */
export const ADD_TO_SHOPPING_LIST_EVENT = 'grocery:add-to-shopping-list' as const;

let _listenerRegistered = false;

export function registerShoppingListIntegrationListener(): void {
  if (_listenerRegistered) return;
  _listenerRegistered = true;
  window.addEventListener(ADD_TO_SHOPPING_LIST_EVENT, async (e: Event) => {
    const detail = (e as CustomEvent<AddToShoppingListPayload>).detail;
    if (!detail || !detail.item_name) {
      console.warn('[grocery:add-to-shopping-list] missing item_name in detail');
      return;
    }
    try {
      await addItemToShoppingList(detail);
      toast.success(`Added "${detail.item_name}" to shopping list`);
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail;
      toast.error(msg || `Failed to add "${detail.item_name}" to shopping list`);
    }
  });
}
