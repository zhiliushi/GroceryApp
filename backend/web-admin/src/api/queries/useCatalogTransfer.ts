import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import type {
  DuplicatePair,
  SimilarCatalogMatch,
  TransferExecuteResult,
  TransferLogEntry,
  TransferPreview,
} from '@/types/api';

const CAT_KEY = ['catalog'] as const;
const TRANSFER_LOG_KEY = ['catalog-transfer-log'] as const;

function invalidateCatalog(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: CAT_KEY });
  qc.invalidateQueries({ queryKey: ['catalog-overview'] });
  qc.invalidateQueries({ queryKey: ['purchases'] });
  qc.invalidateQueries({ queryKey: TRANSFER_LOG_KEY });
}

export function useCatalogSimilar(query: string, exclude?: string) {
  return useQuery({
    queryKey: ['catalog-similar', query, exclude ?? ''],
    queryFn: () =>
      apiClient
        .get<{ matches: SimilarCatalogMatch[] }>(API.CATALOG_SIMILAR, {
          params: { q: query, limit: 3, exclude },
        })
        .then((r) => r.data.matches),
    enabled: query.trim().length >= 2,
    staleTime: 10_000,
  });
}

export function useCatalogDuplicates() {
  return useQuery({
    queryKey: ['catalog-duplicates'],
    queryFn: () =>
      apiClient
        .get<{ pairs: DuplicatePair[] }>(API.CATALOG_DUPLICATES)
        .then((r) => r.data.pairs),
    staleTime: 60_000,
  });
}

export function useTransferPreview() {
  return useMutation({
    mutationFn: ({ src, dst }: { src: string; dst: string }) =>
      apiClient
        .post<TransferPreview>(API.CATALOG_TRANSFER_PREVIEW, { src, dst })
        .then((r) => r.data),
  });
}

export function useTransferExecute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ src, dst }: { src: string; dst: string }) =>
      apiClient
        .post<TransferExecuteResult>(API.CATALOG_TRANSFER_EXECUTE, { src, dst, confirm: true })
        .then((r) => r.data),
    onSuccess: (data) => {
      toast.success(`Moved ${data.transferred_event_count} event${data.transferred_event_count === 1 ? '' : 's'} — undo within 7 days from Settings`);
      invalidateCatalog(qc);
    },
    onError: (error: unknown) => {
      const msg = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || 'Transfer failed');
    },
  });
}

export function useTransferReverse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (transferId: string) =>
      apiClient
        .post(API.CATALOG_TRANSFER_REVERSE(transferId))
        .then((r) => r.data),
    onSuccess: () => {
      toast.success('Transfer reversed');
      invalidateCatalog(qc);
    },
    onError: (error: unknown) => {
      const msg = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || 'Reversal failed');
    },
  });
}

export function useTransferLog(limit = 20) {
  return useQuery({
    queryKey: [...TRANSFER_LOG_KEY, limit],
    queryFn: () =>
      apiClient
        .get<{ transfers: TransferLogEntry[] }>(API.CATALOG_TRANSFER_LOG, { params: { limit } })
        .then((r) => r.data.transfers),
    staleTime: 30_000,
  });
}
