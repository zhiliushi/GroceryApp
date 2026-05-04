import { useState } from 'react';
import { useRecipeRevisions } from '@/api/queries/useRecipes';
import { useRestoreRecipeRevision } from '@/api/mutations/useRecipeMutations';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import BetaBadge from '@/components/shared/BetaBadge';
import { formatCurrencyWithSymbol, formatRelativeDate } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { RecipeRevision } from '@/types/api';

interface Props {
  open: boolean;
  recipeId: string;
  recipeName: string;
  onClose: () => void;
}

/**
 * Recipe revision history (homemaker.versioning).
 * Backend caps revisions at 7; oldest rotates silently when an 8th edit
 * lands. List shows newest first; restore creates a new revision from
 * the current state before applying the snapshot.
 */
export default function RecipeHistoryModal({ open, recipeId, recipeName, onClose }: Props) {
  const { data, isLoading, error } = useRecipeRevisions(recipeId, open);
  const restoreMutation = useRestoreRecipeRevision();
  const dialog = useConfirmDialog();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  useBodyScrollLock(open);

  if (!open) return null;

  const revisions = data?.revisions ?? [];

  function handleRestore(rev: RecipeRevision) {
    dialog.confirm({
      title: 'Restore this version?',
      message:
        'Your current ingredients will be auto-snapshotted before restoring, so this is undoable.',
      onConfirm: () => {
        restoreMutation.mutate(
          { id: recipeId, revisionId: rev.id },
          { onSuccess: () => onClose() },
        );
      },
    });
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:pt-[8vh]"
        onClick={onClose}
      >
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        <div
          className="relative bg-ga-bg-card border border-ga-border rounded-xl shadow-2xl max-w-2xl w-full max-h-[calc(100vh-2rem)] sm:max-h-[85vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-5 py-4 border-b border-ga-border flex-shrink-0">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-ga-text-primary flex items-center gap-2">
                History — {recipeName}
                <BetaBadge size="sm" tone="purple" title="Homemaker revision history — beta. The 7-version cap and rotation behaviour may change as we tune the model." />
              </h3>
              <span className="text-[10px] text-ga-text-secondary">
                Max 7 versions · oldest rotates
              </span>
            </div>
            <p className="text-xs text-ga-text-secondary mt-1">
              Each ingredient edit creates a revision. Click Restore to roll back.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {isLoading && <LoadingSpinner text="Loading revisions…" />}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                Failed to load history: {(error as Error).message}
              </div>
            )}
            {!isLoading && !error && revisions.length === 0 && (
              <div className="text-center text-sm text-ga-text-secondary py-8">
                No revisions yet — edit the ingredient list to create one.
              </div>
            )}
            {!isLoading && revisions.length > 0 && (
              <ul className="space-y-2">
                {revisions.map((rev, idx) => {
                  const isExpanded = !!expanded[rev.id];
                  const ingredientCount = rev.snapshot_ingredients.length;
                  return (
                    <li
                      key={rev.id}
                      className="bg-ga-bg-app border border-ga-border rounded-lg"
                    >
                      <div
                        className="flex items-center justify-between gap-3 px-3 py-2 cursor-pointer hover:bg-ga-bg-hover/40"
                        onClick={() =>
                          setExpanded((p) => ({ ...p, [rev.id]: !isExpanded }))
                        }
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-ga-text-primary font-medium">
                            v{revisions.length - idx} · {ingredientCount} ingredients
                            {rev.snapshot_finance && rev.snapshot_finance.total_cost != null && (
                              <span className="ml-2 text-xs text-ga-text-secondary tabular-nums">
                                · {formatCurrencyWithSymbol(
                                  rev.snapshot_finance.total_cost,
                                  rev.snapshot_finance.currency,
                                )}
                                {rev.snapshot_finance.total_is_partial && (
                                  <span className="ml-0.5 text-[10px]">
                                    ({rev.snapshot_finance.priced_count}/
                                    {rev.snapshot_finance.total_count})
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-ga-text-secondary">
                            {formatRelativeDate(rev.edited_at)}
                            {rev.note ? ` · ${rev.note}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestore(rev);
                          }}
                          disabled={restoreMutation.isPending}
                          className="px-3 py-1 text-xs rounded border border-ga-accent/50 text-ga-accent hover:bg-ga-accent/10 disabled:opacity-50"
                        >
                          {restoreMutation.isPending ? 'Restoring…' : 'Restore'}
                        </button>
                        <span className={cn(
                          'text-[11px] text-ga-text-secondary transition-transform',
                          isExpanded && 'rotate-90',
                        )}>
                          ▸
                        </span>
                      </div>
                      {isExpanded && (
                        <div className="border-t border-ga-border px-3 py-2 space-y-1">
                          {rev.snapshot_ingredients.map((ing, i) => (
                            <div
                              key={i}
                              className="flex items-baseline justify-between text-xs"
                            >
                              <span className="text-ga-text-primary truncate">
                                {ing.name || '(unnamed)'}
                              </span>
                              <span className="text-ga-text-secondary tabular-nums ml-3 flex-shrink-0">
                                {ing.quantity ?? ''}
                                {ing.unit ? ` ${ing.unit}` : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="px-5 py-3 border-t border-ga-border flex justify-end gap-2 flex-shrink-0">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover"
            >
              Close
            </button>
          </div>
        </div>
      </div>
      <ConfirmDialog state={dialog.state} onCancel={dialog.close} />
    </>
  );
}
