import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { useAuthStore } from '@/stores/authStore';
import type { ItemOverview } from '@/types/api';

export function useItemOverview(barcode: string | undefined) {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['item-overview', barcode],
    queryFn: () =>
      apiClient
        .get<ItemOverview>(API.ITEM_OVERVIEW(barcode!), { params: { user_id: user?.uid } })
        .then((r) => r.data),
    enabled: !!barcode && !!user?.uid,
    staleTime: 60_000,
  });
}
