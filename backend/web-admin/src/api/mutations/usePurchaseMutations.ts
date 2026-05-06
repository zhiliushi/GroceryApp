import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import type {
  PurchaseCreateRequest,
  PurchaseEvent,
  PurchaseMoveRequest,
  PurchaseStatusUpdateRequest,
  PurchaseUpdateRequest,
} from '@/types/api';

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['purchases'] });
  qc.invalidateQueries({ queryKey: ['catalog'] });
  qc.invalidateQueries({ queryKey: ['waste'] });
  qc.invalidateQueries({ queryKey: ['reminders'] });
}

/**
 * Quota-exceeded error shape (Phase C of catalog_evolution.md).
 * Thrown by the API when a user_custom catalog row would push past the cap.
 */
export interface QuotaExceededDetails {
  type: 'catalog_quota_exceeded';
  used: number;
  limit: number;
  eviction_candidates: Array<{
    name_norm: string;
    display_name: string;
    barcode: string | null;
    last_purchased_at: string | null;
    idle_expires_at: string | null;
    active_purchases: number;
    total_purchases: number;
  }>;
}

export function isQuotaExceededError(error: unknown): QuotaExceededDetails | null {
  const details = (error as { response?: { data?: { details?: unknown; detail?: string } } })?.response
    ?.data?.details as QuotaExceededDetails | undefined;
  if (details && details.type === 'catalog_quota_exceeded') return details;
  return null;
}

export function useCreatePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PurchaseCreateRequest) =>
      apiClient.post<PurchaseEvent>(API.PURCHASES, data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Added');
      invalidateAll(qc);
    },
    onError: (error: unknown) => {
      // Caller handles quota-exceeded interactively (shows picker). Skip the toast.
      if (isQuotaExceededError(error)) return;
      const msg = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || 'Failed to add purchase');
    },
  });
}

export interface MultiPackCreateRequest {
  name: string;
  pack_count: number;
  units_per_pack: number;
  price_per_pack?: number | null;
  currency?: string | null;
  barcode?: string | null;
  expiry_raw?: string | null;
  expiry_date?: string | null;
  location?: string | null;
  // UNIT_TYPE_TOUCHPOINT — canonical pack_label + base_unit per
  // `.claude/docs/unit-type-method.md`. base_unit_label is the legacy
  // alias kept for read-compat; new clients send the explicit fields.
  base_unit_label?: string | null;
  pack_label?: string | null;
  base_unit?: string | null;
  store_id?: string | null;
  // Single-mode parity (added 2026-06-05): bulk now accepts the same
  // optional fields single-mode does. Backend route passes them to
  // create_multi_pack which forwards to each generated event.
  category?: string | null;
  payment_method?: string | null;
  state?: string | null;
  country?: string | null;
}

export interface MultiPackCreateResponse {
  parent_id: string;
  created_count: number;
  events: PurchaseEvent[];
}

export function useCreateMultiPack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MultiPackCreateRequest) =>
      apiClient
        .post<MultiPackCreateResponse>(API.PURCHASES_MULTI_PACK, data)
        .then((r) => r.data),
    onSuccess: (data) => {
      toast.success(`Added ${data.created_count} packs`);
      invalidateAll(qc);
    },
    onError: (error: unknown) => {
      if (isQuotaExceededError(error)) return;
      const msg = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || 'Failed to add multi-pack');
    },
  });
}

export function useUpdatePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PurchaseUpdateRequest }) =>
      apiClient.patch<PurchaseEvent>(API.PURCHASE(id), data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Updated');
      invalidateAll(qc);
    },
    onError: () => toast.error('Failed to update'),
  });
}

/**
 * Restore a terminal-status event back to active. The 7-day Undo toast
 * handles in-session mistakes; this is for older mis-clicks and disaster
 * recovery (the "Use 1 wiped my eggs" incident).
 */
export function useRestoreEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<PurchaseEvent>(API.PURCHASE_RESTORE(id)).then((r) => r.data),
    onSuccess: () => {
      toast.success('Restored to active');
      invalidateAll(qc);
    },
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail || 'Restore failed');
    },
  });
}

export function useChangePurchaseStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: {
      id: string;
      data: PurchaseStatusUpdateRequest;
      // `silent`: caller (e.g. useUndoableAction) already showed a toast — skip the default.
      silent?: boolean;
    }) =>
      apiClient.post<PurchaseEvent>(API.PURCHASE_STATUS(id), data).then((r) => r.data),
    onSuccess: (event, vars) => {
      if (!vars.silent) {
        const label =
          event.status === 'used'
            ? 'Marked as used'
            : event.status === 'thrown'
            ? 'Marked as thrown'
            : 'Given away';
        toast.success(label);
      }
      invalidateAll(qc);
    },
    onError: () => toast.error('Failed to change status'),
  });
}

export function useMovePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: {
      id: string;
      data: PurchaseMoveRequest;
      silent?: boolean;
    }) =>
      apiClient.post<PurchaseEvent>(API.PURCHASE_MOVE(id), data).then((r) => r.data),
    onSuccess: (_event, vars) => {
      if (!vars.silent) toast.success('Moved');
      invalidateAll(qc);
    },
    onError: () => toast.error('Failed to move'),
  });
}

export function useConsumeByCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      catalog_name_norm,
      quantity,
      location,
    }: {
      catalog_name_norm: string;
      quantity?: number;
      /** Restrict FIFO consume to one location — powers per-location Use 1
       *  on the catalog overview page. Optional; omit for cross-location. */
      location?: string;
    }) =>
      apiClient
        .post<{ consumed: string[]; remaining_active: number; message: string }>(
          API.PURCHASE_CONSUME,
          {
            catalog_name_norm,
            quantity: quantity ?? 1,
            ...(location ? { location } : {}),
          },
        )
        .then((r) => r.data),
    onSuccess: (res) => {
      toast.success(res.message);
      invalidateAll(qc);
    },
    onError: (error: unknown) => {
      // Surface the actual server error so we can debug. Generic "Failed to
      // consume" hid the real reason during the post-deploy investigation.
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      const msg = (error as Error)?.message;
      toast.error(`Use failed: ${detail || msg || 'unknown error'}`);
    },
  });
}

export function useDeletePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, silent }: { id: string; silent?: boolean }) =>
      apiClient
        .delete<{ success: boolean; id: string }>(API.PURCHASE(id))
        .then((r) => ({ ...r.data, silent })),
    onSuccess: (res) => {
      if (!res.silent) toast.success('Deleted');
      invalidateAll(qc);
    },
    onError: () => toast.error('Failed to delete'),
  });
}
