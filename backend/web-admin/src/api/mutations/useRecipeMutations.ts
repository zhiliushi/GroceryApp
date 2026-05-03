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

/**
 * Restore a recipe to a prior revision. Backend snapshots the current
 * state first (so the restore is itself undoable). Invalidates both the
 * recipe list and the revision list because both change.
 */
export function useRestoreRecipeRevision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, revisionId }: { id: string; revisionId: string }) =>
      apiClient.post(API.MEALS_RECIPE_REVISION_RESTORE(id, revisionId)).then((r) => r.data),
    onSuccess: (_data, { id }) => {
      toast.success('Recipe restored from revision');
      qc.invalidateQueries({ queryKey: ['recipes'] });
      qc.invalidateQueries({ queryKey: ['recipes', id, 'revisions'] });
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to restore revision'),
  });
}

// === H3 — per-ingredient social layer (homemaker.social) ===

/** Toggle the calling user's star on a recipe ingredient. Idempotent flip. */
export function useToggleIngredientStar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ recipeId, idx }: { recipeId: string; idx: number }) =>
      apiClient.post(API.MEALS_INGREDIENT_STAR(recipeId, idx)).then((r) => r.data),
    onSuccess: (_data, { recipeId }) => {
      qc.invalidateQueries({ queryKey: ['recipes'] });
      qc.invalidateQueries({ queryKey: ['recipes', recipeId] });
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to update star'),
  });
}

/** Pin or unpin an ingredient. */
export function useSetIngredientPin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ recipeId, idx, pinned }: { recipeId: string; idx: number; pinned: boolean }) =>
      apiClient
        .post(API.MEALS_INGREDIENT_PIN(recipeId, idx), { pinned })
        .then((r) => r.data),
    onSuccess: (_data, { recipeId, pinned }) => {
      toast.success(pinned ? 'Ingredient pinned' : 'Ingredient unpinned');
      qc.invalidateQueries({ queryKey: ['recipes'] });
      qc.invalidateQueries({ queryKey: ['recipes', recipeId] });
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to update pin'),
  });
}

/** Append a comment to an ingredient. Text capped server-side at 500 chars. */
export function useAddIngredientComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ recipeId, idx, text }: { recipeId: string; idx: number; text: string }) =>
      apiClient
        .post(API.MEALS_INGREDIENT_COMMENT(recipeId, idx), { text })
        .then((r) => r.data),
    onSuccess: (_data, { recipeId }) => {
      qc.invalidateQueries({ queryKey: ['recipes'] });
      qc.invalidateQueries({ queryKey: ['recipes', recipeId] });
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to add comment'),
  });
}

/** Delete a comment. Server enforces author-or-recipe-owner. */
export function useDeleteIngredientComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      recipeId,
      idx,
      commentId,
    }: {
      recipeId: string;
      idx: number;
      commentId: string;
    }) =>
      apiClient
        .delete(API.MEALS_INGREDIENT_COMMENT_ITEM(recipeId, idx, commentId))
        .then((r) => r.data),
    onSuccess: (_data, { recipeId }) => {
      qc.invalidateQueries({ queryKey: ['recipes'] });
      qc.invalidateQueries({ queryKey: ['recipes', recipeId] });
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to delete comment'),
  });
}
