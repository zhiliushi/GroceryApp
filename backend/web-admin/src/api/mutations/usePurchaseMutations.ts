import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import type {
  PurchaseCreateRequest,
  PurchaseEvent,
  PurchaseStatusUpdateRequest,
  PurchaseUpdateRequest,
} from '@/types/api';

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['purchases'] });
  qc.invalidateQueries({ queryKey: ['catalog'] });
  qc.invalidateQueries({ queryKey: ['waste'] });
  qc.invalidateQueries({ queryKey: ['reminders'] });
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
      const msg = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || 'Failed to add purchase');
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

export function useConsumeByCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ catalog_name_norm, quantity }: { catalog_name_norm: string; quantity?: number }) =>
      apiClient
        .post<{ consumed: string[]; remaining_active: number; message: string }>(
          API.PURCHASE_CONSUME,
          { catalog_name_norm, quantity: quantity ?? 1 },
        )
        .then((r) => r.data),
    onSuccess: (res) => {
      toast.success(res.message);
      invalidateAll(qc);
    },
    onError: () => toast.error('Failed to consume'),
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
