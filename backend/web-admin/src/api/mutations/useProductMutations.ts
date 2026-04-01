import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { toast } from 'sonner';
import type { Product } from '@/types/api';

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.post(API.PRODUCTS, data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Product created');
      qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => toast.error('Failed to create product'),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ barcode, data }: { barcode: string; data: Record<string, unknown> }) =>
      apiClient.put(API.PRODUCT(barcode), data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Product updated');
      qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => toast.error('Failed to update product'),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (barcode: string) =>
      apiClient.delete(API.PRODUCT(barcode)).then((r) => r.data),
    onSuccess: () => {
      toast.success('Product deleted');
      qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => toast.error('Failed to delete product'),
  });
}

export function useLookupBarcode() {
  return useMutation({
    mutationFn: (barcode: string) =>
      apiClient.get<Product>(API.PRODUCT_LOOKUP(barcode)).then((r) => r.data),
    onError: () => toast.error('Product not found on Open Food Facts'),
  });
}

export function useRecheckOFF() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (barcode: string) =>
      apiClient.post(API.PRODUCT_RECHECK(barcode)).then((r) => r.data),
    onSuccess: (data) => {
      if (data.found) {
        toast.success('Found on Open Food Facts!');
      } else {
        toast.info(data.message || 'Still not found on OFF');
      }
      qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => toast.error('Failed to check Open Food Facts'),
  });
}

export function useSubmitDispute() {
  return useMutation({
    mutationFn: (data: {
      barcode: string;
      type: string;
      current_value: string;
      suggested_value: string;
      notes: string;
      submitted_by: string;
    }) => apiClient.post(API.DISPUTE_SUBMIT, data).then((r) => r.data),
    onSuccess: (data) => {
      toast.success(data.message || 'Dispute submitted');
    },
    onError: () => toast.error('Failed to submit dispute'),
  });
}

export function useResolveDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: string; note?: string }) =>
      apiClient.put(API.DISPUTE_RESOLVE(id), { action, resolution_note: note }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Dispute resolved');
      qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => toast.error('Failed to resolve dispute'),
  });
}
