/**
 * RecipePrepModal — "Plan & shop" flow for a recipe.
 *
 * Captured 2026-05-04 from the Mira walkthrough as a "hook feature":
 * users want a plan-ahead path that's distinct from the "Cook now" path
 * (existing CookConfirmModal which deducts immediately).
 *
 * Three user moments this modal serves:
 *   1. Plan-to-cook  — Sunday afternoon, browse a recipe she wants for
 *      Wednesday → see what's available and what's missing.
 *   2. Update inventory — Wednesday she opens the modal, realises she
 *      already used the bok choy → mark it used → row re-categorises
 *      to "Need to buy" with the checkbox pre-checked.
 *   3. Bulk add to shopping list — one tap to add N missing/short
 *      ingredients to her shopping list, scoped to a chosen list.
 *
 * Distinct from CookConfirmModal:
 *   - CookConfirmModal      = "I'm cooking right now, deduct from inventory"
 *   - RecipePrepModal (this) = "I plan to cook, what do I need to buy?"
 *
 * Both buttons live on the recipe card. Users pick by intent.
 *
 * Inventory updates inside the modal use full-event consumption (not
 * partial). Mira can drop into MyItemsPage detail for fancier partial
 * actions; this modal favours speed.
 *
 * Shopping-list integration: per-row payload is built once on submit and
 * fanned out as parallel calls to `addItemToShoppingList`. A 409 cap-hit
 * surfaces as a single error toast — partial successes still increment
 * the list. Not transactional; this is a convenience flow, not a
 * promise of atomicity.
 */
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { addItemToShoppingList } from '@/api/integrations/addToShoppingList';
import { useMyShoppingLists } from '@/api/queries/useShoppingLists';
import { useChangePurchaseStatus } from '@/api/mutations/usePurchaseMutations';
import { cn } from '@/utils/cn';
import type { IngredientMatch, RecipeMatchResult } from '@/types/api';

interface Props {
  recipe: RecipeMatchResult;
  onClose: () => void;
}

/**
 * Per-ingredient row state. Tracks both the original match snapshot AND
 * any in-flight inventory action so the row re-categorises after a
 * "Mark used" / "Mark thrown" without waiting on a recipe-match refetch.
 */
interface RowState {
  ingredient: IngredientMatch;
  /** Locally overrides the original `matched` flag. Set to false when the
   *  user marks the inventory event used/thrown/given inside this modal. */
  matchedOverride: boolean | null;
  /** True when this row's "add to shopping list" checkbox is checked.
   *  Default: true for need-to-buy rows, false for available rows. */
  selected: boolean;
  /** Disabled while a status mutation is in flight. */
  pending: boolean;
}

function buildInitialRows(recipe: RecipeMatchResult): RowState[] {
  // matched ingredients (have/low) come from ingredient_matches
  // missing ingredients are name-only; synthesise an IngredientMatch shape
  const rows: RowState[] = [];
  for (const m of recipe.ingredient_matches) {
    rows.push({
      ingredient: m,
      matchedOverride: null,
      selected: false, // will recompute below
      pending: false,
    });
  }
  for (const missing of recipe.missing_ingredients) {
    // Skip if already represented in ingredient_matches with matched=false
    // (defensive — backend should only put missing names that aren't in matches).
    if (rows.some((r) => r.ingredient.name === missing && !r.ingredient.matched)) {
      continue;
    }
    rows.push({
      ingredient: {
        name: missing,
        quantity: null,
        unit: null,
        matched: false,
      },
      matchedOverride: null,
      selected: true,
      pending: false,
    });
  }
  // Recompute initial `selected`: true for need-to-buy (not matched, or
  // matched-but-short).
  for (const r of rows) {
    const need = isNeedToBuy(r);
    r.selected = need;
  }
  return rows;
}

/**
 * "Need to buy" = either matched=false (or override=false), or
 * recipe quantity > inventory quantity (we have some, need more).
 */
function isNeedToBuy(row: RowState): boolean {
  const matched = row.matchedOverride ?? row.ingredient.matched;
  if (!matched) return true;
  const reqQty = row.ingredient.quantity ?? null;
  const haveQty = row.ingredient.inventory_quantity ?? null;
  if (reqQty == null || haveQty == null) return false; // can't tell — assume have enough
  return reqQty > haveQty;
}

/** Quantity short on a "need to buy" matched row, for shopping-list payload. */
function shortAmount(row: RowState): number | undefined {
  const matched = row.matchedOverride ?? row.ingredient.matched;
  if (!matched) return row.ingredient.quantity ?? undefined;
  const reqQty = row.ingredient.quantity ?? null;
  const haveQty = row.ingredient.inventory_quantity ?? null;
  if (reqQty == null || haveQty == null) return undefined;
  return Math.max(0, reqQty - haveQty);
}

export default function RecipePrepModal({ recipe, onClose }: Props) {
  const [rows, setRows] = useState<RowState[]>(() => buildInitialRows(recipe));
  const { data: listsData, isLoading: listsLoading } = useMyShoppingLists();
  const lists = listsData?.lists ?? [];
  const [chosenListId, setChosenListId] = useState<string | 'active'>('active');
  const [submitting, setSubmitting] = useState(false);
  const changeStatus = useChangePurchaseStatus();

  const available = useMemo(() => rows.filter((r) => !isNeedToBuy(r)), [rows]);
  const needToBuy = useMemo(() => rows.filter(isNeedToBuy), [rows]);
  const selectedCount = needToBuy.filter((r) => r.selected).length;

  function toggleSelected(idx: number) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r)));
  }

  /**
   * Inline inventory action: mark the matched event used/thrown/given.
   * Full-event consume only — partial flows live on MyItemsPage detail.
   * On success, the row's `matchedOverride` flips to false → it slides
   * into the "Need to buy" section, pre-checked.
   */
  function applyInventoryAction(idx: number, action: 'used' | 'thrown' | 'given_away') {
    const row = rows[idx];
    const eid = row.ingredient.inventory_item_id;
    if (!eid) return;
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, pending: true } : r)));
    const reason = action === 'thrown' ? 'expired' : action === 'given_away' ? 'gift' : 'used_up';
    const newStatus = action === 'given_away' ? 'thrown' : action; // give-away = thrown w/ gift reason
    changeStatus.mutate(
      { id: eid, data: { status: newStatus, reason }, silent: true },
      {
        onSuccess: () => {
          setRows((prev) =>
            prev.map((r, i) =>
              i === idx
                ? {
                    ...r,
                    matchedOverride: false,
                    selected: true, // pre-check the new need-to-buy row
                    pending: false,
                  }
                : r,
            ),
          );
          toast.success(`Updated ${row.ingredient.name}`);
        },
        onError: (err: unknown) => {
          setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, pending: false } : r)));
          const msg =
            (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
            'Failed to update inventory';
          toast.error(msg);
        },
      },
    );
  }

  /**
   * Bulk-add the selected need-to-buy rows to the chosen shopping list.
   * Parallel fan-out via the integration helper. Partial successes
   * survive — we toast a final summary.
   */
  async function submit() {
    const targets = rows.filter((r) => isNeedToBuy(r) && r.selected);
    if (targets.length === 0) return;
    setSubmitting(true);

    const results = await Promise.allSettled(
      targets.map((r) => {
        const qty = shortAmount(r);
        return addItemToShoppingList({
          listId: chosenListId === 'active' ? 'active' : chosenListId,
          item_name: r.ingredient.name,
          quantity: qty,
          unit: r.ingredient.unit ?? undefined,
          notes: `for: ${recipe.name}`,
          source: 'recipe_prep',
        });
      }),
    );

    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const fail = results.length - ok;
    setSubmitting(false);

    if (ok > 0 && fail === 0) {
      toast.success(`Added ${ok} item${ok === 1 ? '' : 's'} to your shopping list`);
      onClose();
    } else if (ok > 0 && fail > 0) {
      toast.warning(`Added ${ok}, ${fail} failed (list may be full)`);
    } else {
      toast.error('Failed to add to shopping list');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-ga-bg-card border border-ga-border rounded-xl w-full max-w-md shadow-2xl max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ga-border">
          <div>
            <h2 className="text-lg font-semibold text-ga-text-primary">📝 Plan & shop</h2>
            <p className="text-xs text-ga-text-secondary mt-0.5">{recipe.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-ga-text-secondary hover:text-ga-text-primary text-xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-xs text-ga-text-secondary leading-snug">
            Review what you have. Mark anything you&apos;ve already used, thrown, or
            given away — it&apos;ll move to the &quot;need to buy&quot; list. Then add
            missing items to your shopping list in one tap.
          </p>

          {/* Available section */}
          {available.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-green-600 mb-2">
                ✓ You have ({available.length})
              </h3>
              <ul className="space-y-2">
                {available.map((r) => {
                  const idx = rows.indexOf(r);
                  return (
                    <li
                      key={`have-${idx}`}
                      className={cn(
                        'border border-ga-border rounded-lg p-3',
                        r.pending && 'opacity-50',
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <div className="text-sm text-ga-text-primary truncate">
                          {r.ingredient.name}
                        </div>
                        <div className="text-[11px] text-ga-text-secondary flex-shrink-0">
                          {r.ingredient.inventory_quantity ?? '?'} in{' '}
                          {r.ingredient.inventory_location || 'inventory'}
                          {r.ingredient.expiring && (
                            <span className="ml-1 text-orange-500">
                              ⚠ {r.ingredient.expiry_text}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-[11px] text-ga-text-secondary mb-1.5">
                        Recipe needs:{' '}
                        <span className="text-ga-text-primary">
                          {r.ingredient.quantity ?? '?'}
                          {r.ingredient.unit ? ` ${r.ingredient.unit}` : ''}
                        </span>
                      </div>
                      {/* Inline inventory adjustments */}
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={r.pending}
                          onClick={() => applyInventoryAction(idx, 'used')}
                          title="Mark this inventory event as used. Row will move to 'need to buy'."
                          className="text-[11px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 disabled:opacity-50"
                        >
                          🍽 Used
                        </button>
                        <button
                          type="button"
                          disabled={r.pending}
                          onClick={() => applyInventoryAction(idx, 'thrown')}
                          title="Mark this inventory event as thrown (reason: expired). Counts as waste."
                          className="text-[11px] px-2 py-0.5 rounded bg-red-500/10 text-red-600 hover:bg-red-500/20 disabled:opacity-50"
                        >
                          🗑 Thrown
                        </button>
                        <button
                          type="button"
                          disabled={r.pending}
                          onClick={() => applyInventoryAction(idx, 'given_away')}
                          title="Mark this inventory event as given away. Doesn't count as waste."
                          className="text-[11px] px-2 py-0.5 rounded bg-ga-bg-hover text-ga-text-secondary hover:bg-ga-bg-card disabled:opacity-50"
                        >
                          🤝 Given
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Need to buy section */}
          {needToBuy.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-orange-600 mb-2">
                🛒 Need to buy ({needToBuy.length})
              </h3>
              <ul className="space-y-1.5">
                {needToBuy.map((r) => {
                  const idx = rows.indexOf(r);
                  const matchedNow = r.matchedOverride ?? r.ingredient.matched;
                  const haveQty = r.ingredient.inventory_quantity;
                  const need = shortAmount(r);
                  return (
                    <li key={`buy-${idx}`}>
                      <label className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-ga-bg-hover cursor-pointer">
                        <input
                          type="checkbox"
                          checked={r.selected}
                          onChange={() => toggleSelected(idx)}
                          className="accent-ga-accent rounded mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-ga-text-primary">{r.ingredient.name}</div>
                          <div className="text-[11px] text-ga-text-secondary">
                            {matchedNow && haveQty !== undefined ? (
                              <>
                                Have {haveQty}, need{' '}
                                <span className="text-ga-text-primary">
                                  {r.ingredient.quantity ?? '?'}
                                  {r.ingredient.unit ? ` ${r.ingredient.unit}` : ''}
                                </span>{' '}
                                — short {need ?? '?'}
                              </>
                            ) : (
                              <>
                                Need{' '}
                                <span className="text-ga-text-primary">
                                  {r.ingredient.quantity ?? '?'}
                                  {r.ingredient.unit ? ` ${r.ingredient.unit}` : ''}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* List picker + submit */}
          {needToBuy.length > 0 && (
            <div className="border-t border-ga-border pt-4 space-y-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-ga-text-secondary mb-1.5">
                  Add to which list?
                </label>
                {listsLoading ? (
                  <p className="text-xs text-ga-text-secondary">Loading lists…</p>
                ) : lists.length === 0 ? (
                  <div className="text-xs text-ga-text-secondary leading-snug">
                    You don&apos;t have a shopping list yet. Submitting will create one called{' '}
                    <span className="text-ga-text-primary">&quot;My Shopping List&quot;</span>.{' '}
                    <Link
                      to="/shopping-lists"
                      onClick={onClose}
                      className="text-ga-accent hover:underline"
                    >
                      Or create one first →
                    </Link>
                  </div>
                ) : (
                  <select
                    value={chosenListId}
                    onChange={(e) => setChosenListId(e.target.value)}
                    className="w-full px-3 py-2 bg-ga-bg-primary border border-ga-border rounded-md text-sm text-ga-text-primary focus:outline-none focus:border-ga-accent"
                  >
                    <option value="active">Most recent list (auto-pick)</option>
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.item_count ?? 0}/50)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <button
                type="button"
                onClick={submit}
                disabled={selectedCount === 0 || submitting}
                title="Add the checked items to the chosen shopping list. Each item carries a 'for: <recipe>' note."
                className={cn(
                  'w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  selectedCount === 0 || submitting
                    ? 'bg-ga-bg-hover text-ga-text-secondary cursor-not-allowed'
                    : 'bg-ga-accent text-white hover:opacity-90',
                )}
              >
                {submitting
                  ? 'Adding…'
                  : selectedCount === 0
                  ? 'Pick items first'
                  : `+ Add ${selectedCount} to shopping list`}
              </button>
            </div>
          )}

          {needToBuy.length === 0 && available.length > 0 && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-700 leading-snug">
              You have everything for this recipe! Ready to cook.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
