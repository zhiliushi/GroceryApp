/**
 * FeedbackThread — chronological multi-turn thread view.
 *
 * Used by both:
 *   - <AdminHubPage /> FeedbackCard (scope='admin')
 *   - <MyFeedbackSection /> row when expanded (scope='mine')
 *
 * Each side reads + writes through different endpoints under the hood
 * (gate enforcement) but renders the same chronological list +
 * reply box.
 *
 * Empty / legacy behaviour:
 *   - When the doc has no real subcollection messages but has a v1
 *     `admin_response` field set, the backend synthesizes a single
 *     virtual admin message at read time (`virtual: true`). The UI
 *     renders it identically; the only difference is the
 *     "(legacy single reply)" hint underneath. Edit / delete are
 *     disabled on virtual rows (would need to be materialized first).
 *   - When neither, the empty state explains how to get started:
 *       admin scope → "No replies yet. Type below to send the first one."
 *       user scope  → "No replies yet. Admin will reply here."
 *
 * Re-opens closed threads: when a user posts a reply on a thread
 * whose `status` is resolved/wont_fix, the backend bumps the status
 * back to triaged. The thread becomes visible on admin's Inbox tab
 * again. The badge / pin / summary stay untouched.
 *
 * Edit / delete (Sprint-2 tail):
 *   - Edit: each side may edit their own author kind. Admin can edit
 *     admin messages; user can edit user messages. Stamps `edited_at`
 *     and the bubble shows "(edited)".
 *   - Delete: soft-delete (row stays in chronological order, text
 *     blanked, "(deleted)" placeholder rendered). Author can delete
 *     own; admin can delete ANY (moderation override). The placeholder
 *     copy reflects who deleted via `deleted_by`.
 */
import { useState } from 'react';
import {
  useDeleteThreadMessage,
  useEditThreadMessage,
  useFeedbackThread,
  usePostThreadMessage,
} from '@/api/queries/useFeedback';
import { cn } from '@/utils/cn';
import type { FeedbackMessage } from '@/types/api';


function formatRelative(iso?: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const minutes = Math.floor((now - then) / 60_000);
  if (Number.isNaN(minutes) || minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString();
}


export default function FeedbackThread({
  feedbackId,
  scope,
}: {
  feedbackId: string;
  /** Which endpoint set + cache key to use. */
  scope: 'mine' | 'admin';
}) {
  const { data, isLoading } = useFeedbackThread(feedbackId, scope);
  const postMut = usePostThreadMessage(scope);
  const editMut = useEditThreadMessage(scope);
  const deleteMut = useDeleteThreadMessage(scope);
  const [draft, setDraft] = useState('');

  const messages = data?.messages ?? [];

  const handleSend = () => {
    const text = draft.trim();
    if (!text || postMut.isPending) return;
    postMut.mutate(
      { id: feedbackId, text },
      {
        onSuccess: () => {
          setDraft('');
        },
      },
    );
  };

  return (
    <div className="space-y-2">
      {/* Messages list */}
      {isLoading ? (
        <div className="text-[11px] text-ga-text-secondary italic py-2">Loading thread…</div>
      ) : messages.length === 0 ? (
        <div className="text-[11px] text-ga-text-secondary italic py-2">
          {scope === 'admin'
            ? 'No replies yet. Type below to send the first one.'
            : 'No replies yet. Admin will reply here.'}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              viewerScope={scope}
              onEdit={(text) =>
                editMut.mutate({ feedbackId, msgId: msg.id, text })
              }
              onDelete={() =>
                deleteMut.mutate({ feedbackId, msgId: msg.id })
              }
              busy={editMut.isPending || deleteMut.isPending}
            />
          ))}
        </ul>
      )}

      {/* Reply box */}
      <div className="space-y-1.5 pt-1">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder={
            scope === 'admin'
              ? 'Reply to the user. Stamps responded_at and starts the 24h archive timer.'
              : 'Reply to admin. Re-opens the thread if it was marked resolved.'
          }
          className="w-full bg-ga-bg-primary border border-ga-border rounded-md px-3 py-2 text-xs text-ga-text-primary focus:outline-none focus:border-ga-accent"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSend}
            disabled={postMut.isPending || !draft.trim()}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded',
              postMut.isPending || !draft.trim()
                ? 'bg-ga-bg-hover text-ga-text-secondary cursor-not-allowed'
                : 'bg-ga-accent text-white hover:opacity-90',
            )}
          >
            {postMut.isPending ? 'Sending…' : 'Send reply'}
          </button>
          <span className="ml-auto text-[10px] text-ga-text-secondary tabular-nums">
            {draft.length} / 2000
          </span>
        </div>
      </div>
    </div>
  );
}


function MessageBubble({
  msg,
  viewerScope,
  onEdit,
  onDelete,
  busy,
}: {
  msg: FeedbackMessage;
  viewerScope: 'mine' | 'admin';
  onEdit: (text: string) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const isAdmin = msg.author === 'admin';
  const isViewerMessage =
    (viewerScope === 'admin' && isAdmin) || (viewerScope === 'mine' && !isAdmin);

  // Edit affordance: only the author kind can edit (user→user msg,
  // admin→admin msg). Virtual + deleted messages are off-limits.
  // Admin scope cannot edit user messages — moderation = delete.
  const canEdit =
    !msg.virtual &&
    !msg.deleted &&
    ((viewerScope === 'admin' && isAdmin) || (viewerScope === 'mine' && !isAdmin));

  // Delete affordance:
  //   - User scope: only on user-authored messages they own.
  //   - Admin scope: on ANY non-virtual non-deleted message
  //     (moderation override on user messages).
  const canDelete =
    !msg.virtual &&
    !msg.deleted &&
    (viewerScope === 'admin' || !isAdmin);

  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(msg.text);

  if (msg.deleted) {
    // Soft-deleted placeholder. We keep the row + bubble shape so
    // chronology is intact. Copy depends on who deleted.
    const deletedCopy =
      msg.deleted_by === 'admin' && !isAdmin
        ? '(deleted by admin)'
        : '(deleted)';
    return (
      <li className={cn('flex', isViewerMessage ? 'justify-end' : 'justify-start')}>
        <div className="max-w-[85%] rounded-lg px-3 py-2 text-xs leading-snug border border-dashed border-ga-border text-ga-text-secondary italic">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              {isAdmin ? 'Admin' : 'You'}
            </span>
            <span className="text-[10px]">{formatRelative(msg.created_at)}</span>
            <span className="text-[10px]">{deletedCopy}</span>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className={cn('flex', isViewerMessage ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-xs leading-snug',
          isAdmin
            ? 'bg-ga-accent/10 border border-ga-accent/30 text-ga-text-primary'
            : 'bg-ga-bg-primary border border-ga-border text-ga-text-primary',
        )}
      >
        <div className="flex items-baseline gap-2 mb-0.5">
          <span
            className={cn(
              'text-[10px] font-semibold uppercase tracking-wider',
              isAdmin ? 'text-ga-accent' : 'text-ga-text-secondary',
            )}
          >
            {isAdmin ? 'Admin' : 'You'}
          </span>
          <span className="text-[10px] text-ga-text-secondary">
            {formatRelative(msg.created_at)}
          </span>
          {msg.edited_at && !editing && (
            <span
              className="text-[10px] text-ga-text-secondary italic"
              title={`edited ${formatRelative(msg.edited_at)}`}
            >
              (edited)
            </span>
          )}
          {msg.virtual && (
            <span
              className="text-[10px] text-ga-text-secondary italic"
              title="Synthesized from the legacy single-reply field. The next admin message will materialize this as a real thread row."
            >
              (legacy single reply)
            </span>
          )}
        </div>

        {editing ? (
          <div className="space-y-1.5">
            <textarea
              autoFocus
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              rows={3}
              maxLength={2000}
              className="w-full bg-ga-bg-primary border border-ga-border rounded-md px-2 py-1 text-xs text-ga-text-primary focus:outline-none focus:border-ga-accent"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy || !editDraft.trim() || editDraft.trim() === msg.text}
                onClick={() => {
                  const trimmed = editDraft.trim();
                  if (!trimmed || trimmed === msg.text) return;
                  onEdit(trimmed);
                  setEditing(false);
                }}
                className={cn(
                  'px-2 py-0.5 text-[11px] font-medium rounded',
                  busy || !editDraft.trim() || editDraft.trim() === msg.text
                    ? 'bg-ga-bg-hover text-ga-text-secondary cursor-not-allowed'
                    : 'bg-ga-accent text-white hover:opacity-90',
                )}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setEditDraft(msg.text);
                }}
                className="px-2 py-0.5 text-[11px] border border-ga-border rounded text-ga-text-secondary hover:bg-ga-bg-hover"
              >
                Cancel
              </button>
              <span className="ml-auto text-[10px] text-ga-text-secondary tabular-nums">
                {editDraft.length} / 2000
              </span>
            </div>
          </div>
        ) : (
          <>
            <p className="whitespace-pre-wrap break-words">{msg.text}</p>
            {(canEdit || canDelete) && (
              <div className="flex items-center gap-2 mt-1">
                {canEdit && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditDraft(msg.text);
                      setEditing(true);
                    }}
                    className="text-[10px] text-ga-text-secondary hover:text-ga-text-primary underline underline-offset-2"
                  >
                    edit
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      // Cheap inline confirm — the action is reversible
                      // server-side only via re-creation, so a single
                      // confirm guards against fat-finger deletes
                      // without nagging.
                      const ok = window.confirm(
                        viewerScope === 'admin' && !isAdmin
                          ? 'Delete this user message? It will show as "(deleted by admin)" to the user.'
                          : 'Delete this message? It will show as "(deleted)" in the thread.',
                      );
                      if (ok) onDelete();
                    }}
                    className="text-[10px] text-ga-text-secondary hover:text-red-400 underline underline-offset-2"
                  >
                    delete
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </li>
  );
}
