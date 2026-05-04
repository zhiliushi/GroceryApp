import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import type {
  CommonIngredientsResponse,
  RecipeCostEstimate,
  RecipesResponse,
  RevisionsListResponse,
  SuggestionsResponse,
} from '@/types/api';

export function useRecipes() {
  return useQuery({
    queryKey: ['recipes'],
    queryFn: () => apiClient.get<RecipesResponse>(API.MEALS_RECIPES).then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useRecipeSuggestions() {
  return useQuery({
    queryKey: ['recipes', 'suggestions'],
    queryFn: () => apiClient.get<SuggestionsResponse>(API.MEALS_SUGGESTIONS).then((r) => r.data),
    staleTime: 60_000,
  });
}

/**
 * Recipe revision history (homemaker.versioning). Returns revisions newest
 * first. Backend 403's when the user lacks homemaker access — `enabled`
 * caller-side prevents wasting that round-trip.
 */
export function useRecipeRevisions(recipeId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['recipes', recipeId, 'revisions'],
    queryFn: () =>
      apiClient
        .get<RevisionsListResponse>(API.MEALS_RECIPE_REVISIONS(recipeId!))
        .then((r) => r.data),
    enabled: enabled && !!recipeId,
    staleTime: 30_000,
  });
}

/**
 * F1 base recipe-cost estimate — per-ingredient last-paid pricing from
 * the user's purchase history. Available to ALL users; not homemaker-gated.
 *
 * `enabled` skips the round-trip when the recipe id isn't ready yet
 * (during the create flow before the server has assigned an id).
 */
export function useRecipeCost(recipeId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['recipes', recipeId, 'cost'],
    queryFn: () =>
      apiClient
        .get<RecipeCostEstimate>(API.MEALS_RECIPE_COST(recipeId!))
        .then((r) => r.data),
    enabled: enabled && !!recipeId,
    staleTime: 60_000,
  });
}

/**
 * Curated common-ingredients catalog (~134 entries). Fetched once per
 * session and cached aggressively — backend exposes a flat read of the
 * top-level Firestore collection. Powers the IngredientAutocomplete
 * dropdown alongside the user's personal catalog.
 */
export function useCommonIngredients(enabled = true) {
  return useQuery({
    queryKey: ['meals', 'common-ingredients'],
    queryFn: () =>
      apiClient
        .get<CommonIngredientsResponse>(API.MEALS_COMMON_INGREDIENTS)
        .then((r) => r.data),
    enabled,
    staleTime: 30 * 60_000, // 30 min — seed is curated, rarely changes
    gcTime: 60 * 60_000,
  });
}
