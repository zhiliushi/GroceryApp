import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import type { RecipesResponse, RevisionsListResponse, SuggestionsResponse } from '@/types/api';

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
