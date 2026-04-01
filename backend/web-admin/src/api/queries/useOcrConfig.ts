import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import type { OcrConfig, OcrRequirements, ScanLogEntry, ScanStats } from '@/types/api';

export function useOcrConfig() {
  return useQuery({
    queryKey: qk.ocr.config,
    queryFn: () => apiClient.get<OcrConfig>(API.CONFIG_OCR).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useOcrRequirements() {
  return useQuery({
    queryKey: ['ocr', 'requirements'],
    queryFn: () => apiClient.get<OcrRequirements>(API.CONFIG_OCR_REQUIREMENTS).then((r) => r.data),
    staleTime: 60 * 1000, // refetch every minute
  });
}

interface AdminScansResponse {
  count: number;
  scans: ScanLogEntry[];
  stats: ScanStats;
}

export function useAdminReceiptScans(limit = 50) {
  return useQuery({
    queryKey: qk.ocr.scans({ limit }),
    queryFn: () =>
      apiClient
        .get<AdminScansResponse>(API.ADMIN_RECEIPT_SCANS, { params: { limit } })
        .then((r) => r.data),
  });
}

interface AdminErrorsResponse {
  count: number;
  errors: ScanLogEntry[];
}

export function useAdminReceiptErrors(limit = 20) {
  return useQuery({
    queryKey: qk.ocr.errors,
    queryFn: () =>
      apiClient
        .get<AdminErrorsResponse>(API.ADMIN_RECEIPT_ERRORS, { params: { limit } })
        .then((r) => r.data),
  });
}

export function useReceiptHistory() {
  return useQuery({
    queryKey: qk.ocr.history,
    queryFn: () =>
      apiClient
        .get<{ count: number; scans: ScanLogEntry[] }>(API.RECEIPT_HISTORY)
        .then((r) => r.data),
  });
}
