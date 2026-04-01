import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
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
