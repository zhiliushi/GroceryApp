import { useState, useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useChangePurchaseStatus } from '@/api/mutations/usePurchaseMutations';
import { toast } from 'sonner';
import type { RecipeMatchResult, IngredientMatch } from '@/types/api';

interface CookConfirmModalProps {
  recipe: RecipeMatchResult;
  onClose: () => void;
  onCooked: () => void;
}

/**
 * Sub-portion units — when a recipe specifies one of these, the recipe is
 * almost certainly asking for a fraction of a larger package (1 tsp soy
 * sauce from a bottle, 30g cheddar from a block, etc.). The cook flow
 * pre-unchecks these rows so confirming doesn't accidentally consume the
 * whole inventory event. User can re-check after reviewing.
 *
 * Captured 2026-05-04 from the Mira walkthrough (soy sauce trap).
 */
const SUB_PORTION_UNITS = new Set([
  'tsp', 'teaspoon', 'teaspoons',
  'tbsp', 'tablespoon', 'tablespoons',
  'ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres',
  'g', 'gram', 'grams',
  'pinch', 'pinches', 'dash', 'dashes', 'drop', 'drops',
  'slice', 'slices', 'clove', 'cloves', 'sprig', 'sprigs', 'leaf', 'leaves',
]);

/**
 * True when the recipe→inventory linkage looks unsafe to consume in full.
 * A "small unit" (tsp, ml, g, slice, …) typically indicates the recipe
 * wants a portion of a larger inventory event; auto-consuming the whole
 * thing would wipe out a bottle / block / packet.
 */
function isSubPortionMismatch(ing: IngredientMatch): boolean {
  if (!ing.matched) return false;
  const u = (ing.unit || '').trim().toLowerCase();
  if (!u) return false;
  if (!SUB_PORTION_UNITS.has(u)) return false;
  // A sub-portion ingredient against a >1 inventory event is fine — we
  // can split. The trap is when the inventory event is a single unit
  // (one bottle / one block / one packet) and the recipe wants a slice.
  const stockQty = ing.inventory_quantity ?? null;
  if (stockQty === null) return true;
  return stockQty <= 1;
}

export default function CookConfirmModal({ recipe, onClose, onCooked }: CookConfirmModalProps) {
  const user = useAuthStore((s) => s.user);
  const changeStatus = useChangePurchaseStatus();

  const matchedIngredients = useMemo(
    () => recipe.ingredient_matches.filter((i) => i.matched),
    [recipe],
  );

  // Default-checked = safe-to-consume rows only. Sub-portion mismatches
  // (1 tsp recipe vs 1 bottle inventory) start unchecked so confirming
  // doesn't wipe out a bottle. Toggle copy near the buttons explains why.
  const [checked, setChecked] = useState<Set<number>>(
    () => new Set(
      matchedIngredients
        .map((ing, i) => ({ ing, i }))
        .filter(({ ing }) => !isSubPortionMismatch(ing))
        .map(({ i }) => i),
    ),
  );
  const skippedSubPortionCount = useMemo(
    () => matchedIngredients.filter(isSubPortionMismatch).length,
    [matchedIngredients],
  );
  const [cooking, setCooking] = useState(false);

  const toggleCheck = (i: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const handleCook = async () => {
    if (!user?.uid || checked.size === 0) return;
    setCooking(true);

    // Mark each checked ingredient's matched purchase event as used. We use
    // the new-model status endpoint (POST /api/purchases/{id}/status) which
    // handles partial-quantity splits server-side: pass `quantity` to use a
    // portion, omit it to consume the whole event.
    let consumed = 0;
    for (const idx of checked) {
      const ing = matchedIngredients[idx];
      if (!ing.inventory_item_id) continue;

      const ingQty = ing.quantity ?? undefined;
      const stockQty = ing.inventory_quantity ?? undefined;
      const isPartial =
        ingQty !== undefined && stockQty !== undefined && ingQty < stockQty;

      try {
        await changeStatus.mutateAsync({
          id: ing.inventory_item_id,
          data: {
            status: 'used',
            reason: 'used_up',
            ...(isPartial && ingQty !== undefined ? { quantity: ingQty } : {}),
          },
          silent: true,
        });
        consumed++;
      } catch (e) {
        console.warn(`Failed to consume ${ing.name}:`, e);
      }
    }

    setCooking(false);
    if (consumed > 0) {
      toast.success(`Cooked ${recipe.name}! Marked ${consumed} ingredient${consumed > 1 ? 's' : ''} as used.`);
      onCooked();
    } else {
      toast.error('Failed to update inventory');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-ga-bg-card border border-ga-border rounded-xl w-full max-w-md shadow-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ga-border">
          <h2 className="text-lg font-semibold text-ga-text-primary">🍳 Cook {recipe.name}</h2>
          <button onClick={onClose} className="text-ga-text-secondary hover:text-ga-text-primary text-xl">&times;</button>
        </div>

        <div className="p-6 space-y-3">
          <p className="text-xs text-ga-text-secondary leading-snug">
            Each checked row deducts from your inventory:{' '}
            <span className="text-ga-text-primary">recipe needs</span> ↔{' '}
            <span className="text-ga-text-primary">you have</span>. Uncheck
            anything you&apos;re saving for later.
          </p>

          {skippedSubPortionCount > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-[11px] text-amber-700 leading-snug">
              <span className="font-medium">⚠ {skippedSubPortionCount} ingredient{skippedSubPortionCount === 1 ? '' : 's'} pre-unchecked.</span>{' '}
              The recipe asks for a small portion (e.g. 1 tsp from a 1-bottle
              event) — confirming would consume the whole event from your
              inventory. Re-check only if you really finished the bottle.
            </div>
          )}

          {matchedIngredients.map((ing, i) => {
            const subPortion = isSubPortionMismatch(ing);
            return (
            <label
              key={i}
              className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-ga-bg-hover cursor-pointer"
            >
              <input
                type="checkbox"
                checked={checked.has(i)}
                onChange={() => toggleCheck(i)}
                className="accent-ga-accent rounded mt-0.5"
                title={
                  subPortion
                    ? 'Pre-unchecked: recipe wants a small portion from a single-unit inventory event. Re-check only if you used it all.'
                    : 'Checked: this ingredient will be deducted from your inventory when you confirm.'
                }
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-ga-text-primary truncate">{ing.name}</div>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[11px]">
                  <span className="text-ga-text-secondary">
                    Recipe:{' '}
                    <span className="text-ga-text-primary">
                      {ing.quantity ?? '?'}
                      {ing.unit ? ` ${ing.unit}` : ''}
                    </span>
                  </span>
                  <span className="text-ga-text-secondary">↔</span>
                  <span className="text-ga-text-secondary">
                    You have:{' '}
                    <span className="text-ga-text-primary">
                      {ing.inventory_quantity ?? '?'}
                    </span>{' '}
                    in {ing.inventory_location || 'inventory'}
                  </span>
                  {ing.expiring && (
                    <span className="text-orange-500">⚠ {ing.expiry_text}</span>
                  )}
                </div>
                {subPortion && (
                  <div className="text-[10px] text-amber-700 leading-snug mt-0.5">
                    Sub-portion mismatch — confirming would consume the
                    whole inventory event.
                  </div>
                )}
              </div>
            </label>
          );
          })}

          {recipe.missing_ingredients.length > 0 && (
            <div className="text-xs text-ga-text-secondary bg-ga-bg-hover rounded-lg p-3">
              Not available: {recipe.missing_ingredients.join(', ')}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={handleCook} disabled={checked.size === 0 || cooking}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2.5">
              {cooking ? 'Cooking...' : `Confirm — Use ${checked.size} ingredient${checked.size !== 1 ? 's' : ''}`}
            </button>
            <button onClick={onClose} className="border border-ga-border text-ga-text-secondary text-sm rounded-lg px-4 py-2.5">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
