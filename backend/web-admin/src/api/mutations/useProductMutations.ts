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
