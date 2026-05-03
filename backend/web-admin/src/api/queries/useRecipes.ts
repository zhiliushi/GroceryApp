import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import type { RecipeCostEstimate, RecipesResponse, SuggestionsResponse } from '@/types/api';

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
