import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { toast } from 'sonner';
import type { Recipe, RecipeScanResult } from '@/types/api';

export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Recipe>) =>
      apiClient.post(API.MEALS_RECIPES, data).then((r) => r.data),
    onSuccess: () => { toast.success('Recipe saved!'); qc.invalidateQueries({ queryKey: ['recipes'] }); },
    onError: (e) => toast.error(e.message || 'Failed to save recipe'),
  });
}

export function useUpdateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Recipe> }) =>
      apiClient.put(API.MEALS_RECIPE(id), data).then((r) => r.data),
    onSuccess: () => { toast.success('Recipe updated'); qc.invalidateQueries({ queryKey: ['recipes'] }); },
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(API.MEALS_RECIPE(id)).then((r) => r.data),
    onSuccess: () => { toast.success('Recipe deleted'); qc.invalidateQueries({ queryKey: ['recipes'] }); },
  });
}

export function useScanRecipeImage() {
  return useMutation({
    mutationFn: async (file: File): Promise<RecipeScanResult> => {
      const formData = new FormData();
      formData.append('image', file);
      const resp = await apiClient.post<RecipeScanResult>(API.MEALS_SCAN_RECIPE, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30_000,
      });
      return resp.data;
    },
  });
}
