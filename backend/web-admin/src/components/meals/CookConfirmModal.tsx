import { useState, useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import type { RecipeMatchResult } from '@/types/api';

interface CookConfirmModalProps {
  recipe: RecipeMatchResult;
  onClose: () => void;
  onCooked: () => void;
}

export default function CookConfirmModal({ recipe, onClose, onCooked }: CookConfirmModalProps) {
  const user = useAuthStore((s) => s.user);

  const matchedIngredients = useMemo(
    () => recipe.ingredient_matches.filter((i) => i.matched),
    [recipe],
  );

  const [checked, setChecked] = useState<Set<number>>(
    () => new Set(matchedIngredients.map((_, i) => i)),
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

    let consumed = 0;
    for (const idx of checked) {
      const ing = matchedIngredients[idx];
      if (!ing.inventory_item_id) continue;

      try {
        // Use the barcode-based consume if barcode exists, otherwise update directly
        // For now we use the item's inventory data
        const { apiClient } = await import('@/api/client');
        await apiClient.put(`/api/admin/inventory/${ing.inventory_user_id}/${ing.inventory_item_id}`, {
          quantity: Math.max(0, (ing.inventory_quantity ?? 1) - (ing.quantity ?? 1)),
          ...(((ing.inventory_quantity ?? 1) - (ing.quantity ?? 1)) <= 0
            ? { status: 'consumed', consumed_date: Date.now(), reason: 'used_up' }
            : {}),
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
          <p className="text-xs text-ga-text-secondary">
            Check the ingredients you'll use. Unchecked items won't be consumed from inventory.
          </p>

          {matchedIngredients.map((ing, i) => (
            <label key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-ga-bg-hover cursor-pointer">
              <input type="checkbox" checked={checked.has(i)} onChange={() => toggleCheck(i)}
                className="accent-ga-accent rounded" />
              <div className="flex-1">
                <span className="text-sm text-ga-text-primary">{ing.name}</span>
                {ing.quantity != null && (
                  <span className="text-xs text-ga-text-secondary ml-1">
                    ({ing.quantity}{ing.unit ? ' ' + ing.unit : ''})
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-xs text-ga-text-secondary">
                  {ing.inventory_quantity ?? '?'} in {ing.inventory_location || 'inventory'}
                </span>
                {ing.expiring && (
                  <span className="block text-[10px] text-orange-400">{ing.expiry_text}</span>
                )}
              </div>
            </label>
          ))}

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
