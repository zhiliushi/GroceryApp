import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import type { ReceiptScanResult, ReceiptConfirmRequest, ReceiptConfirmResponse, OcrConfig, ProviderTestResult } from '@/types/api';

export function useScanReceipt() {
  return useMutation({
    mutationFn: async (file: File): Promise<ReceiptScanResult> => {
      const formData = new FormData();
      formData.append('image', file);
      const resp = await apiClient.post<ReceiptScanResult>(API.RECEIPT_SCAN, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30_000,
      });
      return resp.data;
    },
  });
}

export function useConfirmReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: ReceiptConfirmRequest): Promise<ReceiptConfirmResponse> => {
      const resp = await apiClient.post<ReceiptConfirmResponse>(API.RECEIPT_CONFIRM, body);
      return resp.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['price-records'] });
      qc.invalidateQueries({ queryKey: ['shopping-lists'] });
      qc.invalidateQueries({ queryKey: qk.ocr.history });
    },
  });
}

export function useTestOcrProvider() {
  return useMutation({
    mutationFn: async (providerKey: string): Promise<ProviderTestResult> => {
      const resp = await apiClient.post<ProviderTestResult>(
        API.CONFIG_OCR_TEST(providerKey),
        {},
        { timeout: 45_000 },
      );
      return resp.data;
    },
  });
}

export function useUpdateOcrConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: Partial<OcrConfig>) => {
      const resp = await apiClient.put(API.CONFIG_OCR, config);
      return resp.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.ocr.config });
    },
  });
}
