import { useRecipeCost } from '@/api/queries/useRecipes';
import { formatCurrencyWithSymbol, formatRelativeDate } from '@/utils/format';
import { cn } from '@/utils/cn';

/**
 * F1 base recipe finance — per-ingredient last-paid prices + total estimate.
 * Available to ALL users. Renders in edit mode of RecipeFormPage; in create
 * mode the recipe has no id yet so we don't render at all.
 *
 * Lines fall into four states:
 *   priced       — catalog link + `last_paid` from buy history → show the price
 *   no_history   — catalog link but user never bought it → "no purchase yet"
 *   common_only  — matched to common-ingredients reference (no priced product) → "common: egg"
 *   unlinked     — free text only → "free text"
 *
 * The card stays compact so it doesn't dominate the recipe form. Homemaker
 * (later) can replace this with a richer per-version snapshot view that
 * does the weight × unit_price math.
 */
export default function RecipeCostCard({ recipeId }: { recipeId: string | undefined }) {
  const { data, isLoading, error } = useRecipeCost(recipeId, !!recipeId);

  if (!recipeId) return null;
  if (isLoading) {
    return (
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4 text-xs text-ga-text-secondary animate-pulse">
        Loading cost estimate…
      </div>
    );
  }
  if (error || !data) return null;

  const lines = data.lines;
  if (lines.length === 0) return null;

  const totalLabel =
    data.total_cost == null
      ? 'No price history yet'
      : data.total_is_partial
      ? `≈ ${formatCurrencyWithSymbol(data.total_cost, data.currency)} (${data.priced_count} of ${data.total_count} priced)`
      : `${formatCurrencyWithSymbol(data.total_cost, data.currency)}`;

  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4 space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-ga-text-primary">
          💰 Estimated cost
        </h3>
        <span
          className={cn(
            'text-sm tabular-nums',
            data.total_cost == null ? 'text-ga-text-secondary' : 'text-ga-text-primary font-medium',
          )}
        >
          {totalLabel}
        </span>
      </div>

      <ul className="space-y-1">
        {lines.map((line, i) => {
          const linkedToCatalog = !!line.catalog_name_norm;
          const linkedToCommon = !!line.common_name_norm;
          const priced = line.last_paid != null;
          return (
            <li
              key={i}
              className="flex items-baseline justify-between text-xs gap-3"
            >
              <span className="text-ga-text-primary truncate">
                {line.name || '(unnamed)'}
              </span>
              <span className="flex items-baseline gap-1.5 flex-shrink-0">
                {priced ? (
                  <>
                    <span className="text-ga-text-primary tabular-nums">
                      {formatCurrencyWithSymbol(line.last_paid as number, data.currency)}
                    </span>
                    {line.date_bought && (
                      <span className="text-[10px] text-ga-text-secondary">
                        {formatRelativeDate(line.date_bought)}
                      </span>
                    )}
                  </>
                ) : linkedToCatalog ? (
                  <span
                    className="text-[10px] text-ga-text-secondary italic"
                    title="Linked to your catalog, but you haven't logged a purchase price yet."
                  >no purchase yet</span>
                ) : linkedToCommon ? (
                  <span
                    className="text-[10px] text-ga-text-secondary italic"
                    title="Matched to the shared common-ingredients list (no priced product). Add to your catalog to start tracking your own price."
                  >
                    common: {line.common_name_norm}
                  </span>
                ) : (
                  <span
                    className="text-[10px] text-ga-text-secondary italic"
                    title="Couldn't match this name to anything. Edit the ingredient to use one from your catalog or the common list."
                  >free text</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="text-[10px] text-ga-text-secondary pt-1 border-t border-ga-border/40">
        {data.disclaimer}
      </p>
    </div>
  );
}
