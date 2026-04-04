import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import type { LabelScanResult, ExpiryScanResult, ShelfAuditResult } from '@/types/api';

export function useScanProductLabel() {
  return useMutation({
    mutationFn: async (file: File): Promise<LabelScanResult> => {
      const formData = new FormData();
      formData.append('image', file);
      const resp = await apiClient.post<LabelScanResult>(API.SCAN_PRODUCT_LABEL, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 35_000,
      });
      return resp.data;
    },
  });
}

export function useScanExpiryDate() {
  return useMutation({
    mutationFn: async (file: File): Promise<ExpiryScanResult> => {
      const formData = new FormData();
      formData.append('image', file);
      const resp = await apiClient.post<ExpiryScanResult>(API.SCAN_EXPIRY_DATE, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 35_000,
      });
      return resp.data;
    },
  });
}

export function useScanShelfAudit() {
  return useMutation({
    mutationFn: async (file: File): Promise<ShelfAuditResult> => {
      const formData = new FormData();
      formData.append('image', file);
      const resp = await apiClient.post<ShelfAuditResult>(API.SCAN_SHELF_AUDIT, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 35_000,
      });
      return resp.data;
    },
  });
}
