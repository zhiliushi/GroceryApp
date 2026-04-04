import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { toast } from 'sonner';
import type { BarcodeProduct, BarcodeContributeRequest } from '@/types/api';

export function useScanBarcode() {
  return useMutation({
    mutationFn: async (barcode: string): Promise<BarcodeProduct> => {
      const resp = await apiClient.post<BarcodeProduct>('/api/barcode/scan', {
        barcode,
      }, { timeout: 10_000 });
      return resp.data;
    },
  });
}

export function useContributeProduct() {
  return useMutation({
    mutationFn: async (data: BarcodeContributeRequest) => {
      const resp = await apiClient.post('/api/barcode/contribute', data);
      return resp.data;
    },
  });
}

export function useUseOneItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ barcode, userId, quantity }: { barcode: string; userId: string; quantity?: number }) => {
      const resp = await apiClient.post(API.BARCODE_USE_ONE(barcode), {
        user_id: userId,
        quantity: quantity ?? 1,
      });
      return resp.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Item used');
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to mark as used');
    },
  });
}
