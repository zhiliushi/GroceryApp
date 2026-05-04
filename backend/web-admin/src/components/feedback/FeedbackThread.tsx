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
 *     "(legacy single reply)" hint underneath.
 *   - When neither, the empty state explains how to get started:
 *       admin scope → "No replies yet. Type below to send the first one."
 *       user scope  → "No replies yet. Admin will reply here."
 *
 * Re-opens closed threads: when a user posts a reply on a thread
 * whose `status` is resolved/wont_fix, the backend bumps the status
 * back to triaged. The thread becomes visible on admin's Inbox tab
 * again. The badge / pin / summary stay untouched.
 */
import { useState } from 'react';
import { useFeedbackThread, usePostThreadMessage } from '@/api/queries/useFeedback';
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
            <MessageBubble key={msg.id} msg={msg} viewerScope={scope} />
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
}: {
  msg: FeedbackMessage;
  viewerScope: 'mine' | 'admin';
}) {
  const isAdmin = msg.author === 'admin';
  // Right-align the viewer's own messages (admin sees admin replies on
  // the right; user sees user replies on the right). Standard chat
  // convention.
  const isViewerMessage =
    (viewerScope === 'admin' && isAdmin) || (viewerScope === 'mine' && !isAdmin);

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
          {msg.virtual && (
            <span
              className="text-[10px] text-ga-text-secondary italic"
              title="Synthesized from the legacy single-reply field. The next admin message will materialize this as a real thread row."
            >
              (legacy single reply)
            </span>
          )}
        </div>
        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
      </div>
    </li>
  );
}
