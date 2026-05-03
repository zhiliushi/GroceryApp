import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import {
  useAddIngredientComment,
  useDeleteIngredientComment,
  useSetIngredientPin,
  useToggleIngredientStar,
} from '@/api/mutations/useRecipeMutations';
import { formatRelativeDate } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { RecipeIngredient } from '@/types/api';

/**
 * H3 social layer — per-ingredient star, pin, comments.
 *
 * Renders inline below the ingredient name+quantity row in the recipe edit
 * form. Visible only when `useHomemaker().social` is true (parent caller
 * gates the mount). Read-only when no recipeId yet (create flow).
 *
 * v1 scope:
 *   - Star is binary (you starred / you didn't). Total = count of distinct uids.
 *   - Pin is a flag — pinned ingredients render at top (sort handled in parent).
 *   - Comments are a flat thread; author or recipe owner can delete.
 *   - Cross-user / household scope deferred (own recipes only for now).
 */
export default function IngredientSocialRow({
  recipeId,
  idx,
  ingredient,
}: {
  recipeId: string;
  idx: number;
  ingredient: RecipeIngredient;
}) {
  const me = useAuthStore((s) => s.user);
  const myUid = me?.uid || '';
  const isRecipeOwner = true; // v1: own recipes only — actor IS owner

  const stars = ingredient.stars ?? [];
  const comments = ingredient.comments ?? [];
  const pinned = !!ingredient.pin_by;
  const iStarred = stars.includes(myUid);

  const [commentDraft, setCommentDraft] = useState('');
  const [threadOpen, setThreadOpen] = useState(false);

  const star = useToggleIngredientStar();
  const pin = useSetIngredientPin();
  const addComment = useAddIngredientComment();
  const delComment = useDeleteIngredientComment();

  const busy =
    star.isPending || pin.isPending || addComment.isPending || delComment.isPending;

  const handleAddComment = () => {
    const text = commentDraft.trim();
    if (!text) return;
    addComment.mutate(
      { recipeId, idx, text },
      { onSuccess: () => setCommentDraft('') },
    );
  };

  return (
    <div className="mt-1 pl-3 border-l-2 border-purple-500/30">
      <div className="flex items-center gap-3 text-[11px] text-ga-text-secondary">
        <button
          type="button"
          onClick={() => star.mutate({ recipeId, idx })}
          disabled={busy}
          className={cn(
            'flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-ga-bg-hover transition-colors',
            iStarred && 'text-yellow-400',
          )}
          title={iStarred ? 'Remove your star' : 'Star this ingredient'}
        >
          <span>{iStarred ? '★' : '☆'}</span>
          <span className="tabular-nums">{stars.length}</span>
        </button>

        <button
          type="button"
          onClick={() => pin.mutate({ recipeId, idx, pinned: !pinned })}
          disabled={busy}
          className={cn(
            'px-1.5 py-0.5 rounded hover:bg-ga-bg-hover transition-colors',
            pinned && 'text-purple-400',
          )}
          title={pinned ? 'Unpin' : 'Pin to top'}
        >
          {pinned ? '📌 pinned' : '📌'}
        </button>

        <button
          type="button"
          onClick={() => setThreadOpen((v) => !v)}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-ga-bg-hover transition-colors"
          aria-expanded={threadOpen}
        >
          <span>💬</span>
          <span className="tabular-nums">{comments.length}</span>
          <span className={cn('transition-transform text-[9px]', threadOpen && 'rotate-90')}>
            ▸
          </span>
        </button>
      </div>

      {threadOpen && (
        <div className="mt-1.5 space-y-1.5">
          {comments.length === 0 && (
            <p className="text-[11px] text-ga-text-secondary italic">
              No comments yet.
            </p>
          )}
          {comments.map((c) => {
            const canDelete = c.by_uid === myUid || isRecipeOwner;
            return (
              <div
                key={c.id}
                className="flex items-baseline justify-between gap-2 text-[11px]"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-ga-text-primary font-medium">
                    {c.by_name}
                  </span>
                  <span className="text-ga-text-secondary ml-1.5">
                    {formatRelativeDate(c.created_at)}
                  </span>
                  <p className="text-ga-text-primary break-words">{c.text}</p>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() =>
                      delComment.mutate({ recipeId, idx, commentId: c.id })
                    }
                    disabled={busy}
                    className="text-ga-text-secondary hover:text-red-400 flex-shrink-0"
                    title="Delete comment"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddComment();
                }
              }}
              placeholder="Add a note…"
              maxLength={500}
              disabled={addComment.isPending}
              className="flex-1 bg-ga-bg-hover border border-ga-border rounded px-2 py-1 text-[11px] text-ga-text-primary placeholder:text-ga-text-secondary"
            />
            <button
              type="button"
              onClick={handleAddComment}
              disabled={!commentDraft.trim() || addComment.isPending}
              className="px-2 py-1 text-[10px] rounded bg-purple-600/30 text-purple-300 hover:bg-purple-600/50 disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
