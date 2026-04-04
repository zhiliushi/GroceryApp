import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRecipes, useRecipeSuggestions } from '@/api/queries/useRecipes';
import { useDeleteRecipe } from '@/api/mutations/useRecipeMutations';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import RecipeCard from '@/components/meals/RecipeCard';
import CookConfirmModal from '@/components/meals/CookConfirmModal';
import type { RecipeMatchResult } from '@/types/api';

export default function MealsPage() {
  const { data: recipesData, isLoading: recipesLoading } = useRecipes();
  const { data: suggestionsData, isLoading: suggestionsLoading } = useRecipeSuggestions();
  const deleteMutation = useDeleteRecipe();
  const dialog = useConfirmDialog();
  const [cookingRecipe, setCookingRecipe] = useState<RecipeMatchResult | null>(null);

  const recipes = recipesData?.recipes ?? [];
  const recipeCount = recipesData?.count ?? 0;
  const recipeLimit = recipesData?.limit ?? 15;
  const suggestions = suggestionsData?.suggestions ?? [];
  const atLimit = recipeCount >= recipeLimit;

  if (recipesLoading) return <LoadingSpinner text="Loading meals..." />;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <PageHeader title="Meals" icon="🍳" />
        <div className="flex items-center gap-2">
          {!atLimit && (
            <>
              <Link to="/meals/new"
                className="bg-ga-accent hover:bg-ga-accent/90 text-white text-sm font-medium rounded-lg px-4 py-2">
                + Add Recipe
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ============================================================
          COOK THESE NOW — waste prevention section
          Only shows recipes that match ≥50% ingredients from expiring inventory
          ============================================================ */}
      <div className="mb-6">
        <h2 className="text-sm font-bold text-orange-400 uppercase tracking-wide mb-3 flex items-center gap-2">
          🔥 Cook These Now
        </h2>

        {suggestionsLoading ? (
          <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4 text-sm text-ga-text-secondary animate-pulse">
            Matching recipes to your inventory...
          </div>
        ) : suggestions.length > 0 ? (
          <div className="space-y-3">
            {suggestions.map((s) => (
              <RecipeCard
                key={s.id}
                recipe={s}
                onCook={() => setCookingRecipe(s)}
                showMatchDetails
              />
            ))}
          </div>
        ) : recipes.length === 0 ? (
          <div className="bg-ga-bg-card border border-ga-border rounded-lg p-6 text-center">
            <div className="text-3xl mb-2">🍳</div>
            <p className="text-sm text-ga-text-primary font-medium">Add your first recipe to get meal suggestions!</p>
            <p className="text-xs text-ga-text-secondary mt-1">We'll match your recipes to expiring inventory items.</p>
            <Link to="/meals/new" className="inline-block mt-3 text-sm text-ga-accent hover:underline">
              + Add Recipe
            </Link>
          </div>
        ) : (
          <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4 text-center">
            <p className="text-sm text-ga-text-secondary">No recipe matches right now.</p>
            <p className="text-xs text-ga-text-secondary mt-0.5">Your items are all fresh, or try adding recipes with common ingredients.</p>
          </div>
        )}
      </div>

      {/* ============================================================
          MY RECIPES — user's recipe collection
          ============================================================ */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-ga-text-primary">
            My Recipes ({recipeCount}/{recipeLimit})
          </h2>
          {atLimit && (
            <span className="text-xs text-yellow-400">Limit reached — upgrade for more</span>
          )}
        </div>

        {recipes.length === 0 ? (
          <div className="bg-ga-bg-card border border-ga-border rounded-lg p-8 text-center">
            <div className="text-3xl mb-2">📝</div>
            <p className="text-sm text-ga-text-secondary">No recipes yet.</p>
            <Link to="/meals/new" className="text-sm text-ga-accent hover:underline mt-2 inline-block">
              Add your first recipe
            </Link>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.map((recipe) => (
              <div key={recipe.id} className="bg-ga-bg-card border border-ga-border rounded-lg p-3 hover:bg-ga-bg-hover transition-colors">
                <Link to={`/meals/${recipe.id}/edit`} className="block">
                  <h3 className="text-sm font-medium text-ga-text-primary">{recipe.name}</h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-ga-text-secondary">
                    {recipe.prep_time_min > 0 && <span>⏱ {recipe.prep_time_min}min</span>}
                    {recipe.servings > 0 && <span>🍽 {recipe.servings}</span>}
                    <span>📋 {recipe.ingredients.length} ingredients</span>
                  </div>
                  {recipe.description && (
                    <p className="text-xs text-ga-text-secondary mt-1 line-clamp-2">{recipe.description}</p>
                  )}
                </Link>
                <div className="flex items-center gap-2 mt-2">
                  <Link to={`/meals/${recipe.id}/edit`} className="text-xs text-ga-accent hover:underline">Edit</Link>
                  <button onClick={() => dialog.confirm({
                    title: 'Delete Recipe',
                    message: `Delete "${recipe.name}"?`,
                    variant: 'danger',
                    onConfirm: () => deleteMutation.mutate(recipe.id),
                  })} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============================================================
          AI CHEF — future placeholder
          ============================================================ */}
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-6 text-center opacity-60">
        <div className="text-3xl mb-2">🤖</div>
        <h3 className="text-sm font-medium text-ga-text-primary">AI Chef (Coming Soon)</h3>
        <p className="text-xs text-ga-text-secondary mt-1">
          Get personalized meal plans based on your inventory, preferences, and budget.
        </p>
      </div>

      {/* Modals */}
      {cookingRecipe && (
        <CookConfirmModal
          recipe={cookingRecipe}
          onClose={() => setCookingRecipe(null)}
          onCooked={() => setCookingRecipe(null)}
        />
      )}
      <ConfirmDialog state={dialog.state} onCancel={dialog.close} />
    </div>
  );
}
