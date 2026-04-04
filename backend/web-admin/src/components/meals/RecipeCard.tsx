import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';
import type { RecipeMatchResult, IngredientMatch } from '@/types/api';

interface RecipeCardProps {
  recipe: RecipeMatchResult;
  onCook?: () => void;
  showMatchDetails?: boolean;
}

export default function RecipeCard({ recipe, onCook, showMatchDetails = true }: RecipeCardProps) {
  const allMatched = recipe.matched_count === recipe.total_ingredients;
  const hasExpiring = recipe.expiring_match_count > 0;
  const matchPct = Math.round(recipe.match_score * 100);

  return (
    <div className={cn(
      'bg-ga-bg-card border rounded-lg p-4 transition-colors',
      hasExpiring ? 'border-orange-500/30' : 'border-ga-border',
    )}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <Link to={`/meals/${recipe.id}/edit`} className="text-sm font-medium text-ga-text-primary hover:text-ga-accent">
            {recipe.name}
          </Link>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-ga-text-secondary">
            {recipe.prep_time_min > 0 && <span>{recipe.prep_time_min} min</span>}
            {recipe.servings > 0 && <span>{recipe.servings} servings</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {allMatched && hasExpiring && (
            <span className="text-[10px] bg-orange-500/20 text-orange-400 rounded-full px-2 py-0.5 font-bold">🔥 Perfect match!</span>
          )}
          <span className={cn(
            'text-[10px] rounded-full px-2 py-0.5 font-bold',
            matchPct === 100 ? 'bg-green-500/20 text-green-400' : 'bg-ga-bg-hover text-ga-text-secondary',
          )}>
            {recipe.matched_count}/{recipe.total_ingredients}
          </span>
        </div>
      </div>

      {/* Ingredient match details */}
      {showMatchDetails && (
        <div className="space-y-0.5 mb-3">
          {recipe.ingredient_matches.map((ing: IngredientMatch, i: number) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span>{ing.matched ? '✅' : '❌'}</span>
              <span className={cn('flex-1', ing.matched ? 'text-ga-text-primary' : 'text-ga-text-secondary/50')}>
                {ing.name}
                {ing.quantity != null && ` (${ing.quantity}${ing.unit ? ' ' + ing.unit : ''})`}
              </span>
              {ing.matched && ing.expiring && (
                <span className="text-[10px] text-orange-400">⚠️ {ing.expiry_text}</span>
              )}
              {ing.matched && !ing.expiring && ing.inventory_location && (
                <span className="text-[10px] text-ga-text-secondary">{ing.inventory_location}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Missing ingredients */}
      {recipe.missing_ingredients.length > 0 && (
        <p className="text-[10px] text-ga-text-secondary mb-2">
          Missing: {recipe.missing_ingredients.join(', ')}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {onCook && recipe.matched_count > 0 && (
          <button onClick={onCook}
            className={cn(
              'text-xs font-medium rounded-lg px-3 py-1.5 transition-colors',
              allMatched
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-ga-accent/20 hover:bg-ga-accent/30 text-ga-accent',
            )}>
            {allMatched ? '🍳 Cook & Mark All Used' : 'Cook with what you have'}
          </button>
        )}
        <Link to={`/meals/${recipe.id}/edit`} className="text-xs text-ga-text-secondary hover:text-ga-text-primary">
          Edit
        </Link>
      </div>
    </div>
  );
}
