import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import type { RecipesResponse, SuggestionsResponse } from '@/types/api';

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
