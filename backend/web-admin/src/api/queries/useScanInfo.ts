import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import { useAuthStore } from '@/stores/authStore';
import type { ScanInfo } from '@/types/api';

/**
 * Unified scan-result query for the new catalog+purchases model.
 * Returns catalog match, global product, user history, suggested actions.
 */
export function useScanInfo(barcode: string | undefined) {
  const uid = useAuthStore((s) => s.user?.uid);
  return useQuery({
    queryKey: qk.scanInfo(barcode!),
    queryFn: () =>
      apiClient
        .get<ScanInfo>(API.BARCODE_SCAN_INFO(barcode!), {
          params: { user_id: uid || '' },
        })
        .then((r) => r.data),
    enabled: !!barcode,
    staleTime: 30_000,
  });
}
