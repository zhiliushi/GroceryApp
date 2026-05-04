import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import type {
  CommonPreservesResponse,
  PrepBatch,
  PrepBatchStatus,
  PrepBatchesResponse,
  PrepEligibility,
  PrepHousehold,
  PrepRecipe,
  PrepRecipesResponse,
  PrepSupplyEstimate,
} from '@/types/api';

/**
 * Curated preserve templates (~25-30 entries). Fetched once per session
 * and cached. Backend returns 404 when the global preppers flag is OFF
 * or the user's per-user toggle is OFF — `enabled` lets callers gate
 * the query without a wasted round-trip.
 */
export function useCommonPreserves(enabled = true) {
  return useQuery({
    queryKey: ['preppers', 'common-preserves'],
    queryFn: () =>
      apiClient
        .get<CommonPreservesResponse>(API.PREPPERS_COMMON_PRESERVES)
        .then((r) => r.data),
    enabled,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });
}

export function usePrepRecipes(enabled = true) {
  return useQuery({
    queryKey: ['preppers', 'recipes'],
    queryFn: () =>
      apiClient
        .get<PrepRecipesResponse>(API.PREPPERS_RECIPES)
        .then((r) => r.data),
    enabled,
    staleTime: 30_000,
  });
}

/**
 * Default = active batches only. Pass status='all' for everything,
 * or 'consumed' / 'discarded' for slices.
 */
export function usePrepBatches(
  status: PrepBatchStatus | 'all' = 'active',
  enabled = true,
) {
  return useQuery({
    queryKey: ['preppers', 'batches', status],
    queryFn: () =>
      apiClient
        .get<PrepBatchesResponse>(API.PREPPERS_BATCHES, { params: { status } })
        .then((r) => r.data),
    enabled,
    staleTime: 15_000,
  });
}

export function useCreatePrepRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<PrepRecipe>) =>
      apiClient
        .post<{ success: boolean; recipe: PrepRecipe }>(API.PREPPERS_RECIPES, body)
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['preppers', 'recipes'] }),
  });
}

export function useUpdatePrepRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rid, body }: { rid: string; body: Partial<PrepRecipe> }) =>
      apiClient
        .put<{ success: boolean; recipe: PrepRecipe }>(API.PREPPERS_RECIPE(rid), body)
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['preppers', 'recipes'] }),
  });
}

export function useDeletePrepRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rid: string) =>
      apiClient.delete(API.PREPPERS_RECIPE(rid)).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['preppers', 'recipes'] }),
  });
}

export function useCreatePrepBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<PrepBatch> & { name: string; prep_type: string; ready_after_hours: number; shelf_life_days: number }) =>
      apiClient
        .post<{ success: boolean; batch: PrepBatch }>(API.PREPPERS_BATCHES, body)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['preppers', 'batches'] });
      qc.invalidateQueries({ queryKey: ['preppers', 'supply-estimate'] });
    },
  });
}

export function useSetPrepBatchStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      bid, status, notes,
    }: { bid: string; status: PrepBatchStatus; notes?: string }) =>
      apiClient
        .put<{ success: boolean; batch: PrepBatch }>(
          API.PREPPERS_BATCH_STATUS(bid),
          { status, notes },
        )
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['preppers', 'batches'] });
      qc.invalidateQueries({ queryKey: ['preppers', 'supply-estimate'] });
    },
  });
}

export function useDeletePrepBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bid: string) =>
      apiClient.delete(API.PREPPERS_BATCH(bid)).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['preppers', 'batches'] });
      qc.invalidateQueries({ queryKey: ['preppers', 'supply-estimate'] });
    },
  });
}

/**
 * Data-readiness score (informational during beta). Cached longer than
 * batches/recipes since it changes slowly (one new purchase moves the
 * needle by ~1/min_purchases).
 */
export function usePrepEligibility(enabled = true) {
  return useQuery({
    queryKey: ['preppers', 'eligibility'],
    queryFn: () =>
      apiClient
        .get<PrepEligibility>(API.PREPPERS_ELIGIBILITY)
        .then((r) => r.data),
    enabled,
    staleTime: 5 * 60_000, // 5 min
  });
}

/**
 * Household composition (adults / youth / elderly) — drives the supply
 * estimate. Stored on the user doc; one value per user.
 */
export function usePreppersHousehold(enabled = true) {
  return useQuery({
    queryKey: ['preppers', 'household'],
    queryFn: () =>
      apiClient.get<PrepHousehold>(API.PREPPERS_HOUSEHOLD).then((r) => r.data),
    enabled,
    staleTime: 60 * 60_000,
  });
}

export function useUpdatePreppersHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<PrepHousehold>) =>
      apiClient
        .put<{ success: boolean; household: PrepHousehold }>(
          API.PREPPERS_HOUSEHOLD,
          body,
        )
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['preppers', 'household'] });
      qc.invalidateQueries({ queryKey: ['preppers', 'supply-estimate'] });
    },
  });
}

/**
 * Days-of-supply projection. Refetched whenever batches or household
 * change (active batches list invalidates this via useCreatePrepBatch /
 * useSetPrepBatchStatus / useDeletePrepBatch onSuccess).
 */
export function usePreppersSupply(enabled = true) {
  return useQuery({
    queryKey: ['preppers', 'supply-estimate'],
    queryFn: () =>
      apiClient
        .get<PrepSupplyEstimate>(API.PREPPERS_SUPPLY_ESTIMATE)
        .then((r) => r.data),
    enabled,
    staleTime: 30_000,
  });
}
