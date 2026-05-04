/**
 * MyFeedbackSection — user-side list of their own feedback.
 *
 * Captured 2026-05-04 from the customer-feedback design pass; extended
 * the same day with admin badges, pin support, and 24h archive sweep.
 *
 * Closes the loop: user submits via 💬 button → admin sees on Telegram
 * + Admin Hub → admin attaches a cute badge + (optionally) reply →
 * shows up here under the original submission. Without this,
 * submissions feel like a void; users stop submitting.
 *
 * Mounted in the User Hub's My feedback tab. Each row shows: kind,
 * admin badge (when set; replaces the dry status pill in priority),
 * submitted-at, message excerpt, pin indicator, and the admin reply
 * inline when present. 24h after a thread goes resolved/wont_fix the
 * row archives by default — toggle "Show archived" to see them again.
 *
 * Auto-hidden when the user has zero feedback rows (avoids dead
 * real estate for new users) — pass `emptyVariant="inline"` to render
 * an explainer instead (User Hub uses this).
 */
import { useState } from 'react';
import { useMyFeedback } from '@/api/queries/useFeedback';
import BadgeChip from '@/components/feedback/BadgeChip';
import FeedbackThread from '@/components/feedback/FeedbackThread';
import { cn } from '@/utils/cn';
import type { FeedbackEntry, FeedbackStatus } from '@/types/api';

const STATUS_FALLBACK: Record<FeedbackStatus, { label: string; cls: string; hint: string }> = {
  new: {
    label: 'New',
    cls: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
    hint: 'Admin hasn’t reviewed this yet.',
  },
  triaged: {
    label: 'In review',
    cls: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
    hint: 'Admin has read it and is working through it.',
  },
  resolved: {
    label: 'Resolved',
    cls: 'bg-green-500/10 text-green-700 border-green-500/30',
    hint: 'Admin marked this resolved — see their reply below.',
  },
  wont_fix: {
    label: 'Won’t fix',
    cls: 'bg-gray-500/10 text-gray-700 border-gray-500/30',
    hint: 'Admin decided not to act on this. Reason in the reply if any.',
  },
};

const KIND_LABEL: Record<string, string> = {
  bug: '🐛 Bug',
  feature: '💡 Feature',
  cap_request: '📈 Cap',
  general: '💬 General',
};


export default function MyFeedbackSection({
  emptyVariant = 'hide',
}: {
  /**
   * 'hide' (default) — auto-hide when the user has zero submissions.
   * 'inline' — render an empty-state card instead (User Hub tab).
   */
  emptyVariant?: 'hide' | 'inline';
} = {}) {
  const [showArchived, setShowArchived] = useState(false);
  const { data, isLoading } = useMyFeedback(showArchived ? 'archived' : 'active');
  // Cheap second query so we know whether to show the "Show archived" toggle.
  const { data: archivedCount } = useMyFeedback('archived');
  const items = data?.items ?? [];
  const archivedTotal = archivedCount?.count ?? 0;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (isLoading) return null;

  // Empty-state branch: no active rows AND no archived rows.
  if (items.length === 0 && archivedTotal === 0) {
    if (emptyVariant === 'inline') {
      return (
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5 text-sm text-ga-text-secondary">
          <p>
            You haven&apos;t sent any feedback yet. Tap the floating{' '}
            <span aria-hidden="true">💬</span> button in the corner of any page
            to send a bug report, feature request, or general thought to admin.
            Replies will appear here.
          </p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5 space-y-3">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-ga-text-primary">
          💬 My feedback {showArchived && <span className="text-ga-text-secondary">· archived</span>}
        </h2>
        <div className="flex items-center gap-3 text-[11px] text-ga-text-secondary">
          <span>
            {items.length} {showArchived ? 'archived' : 'active'}
          </span>
          {archivedTotal > 0 && (
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="text-ga-accent hover:underline"
            >
              {showArchived ? '↩ Show active' : `▸ Show archived (${archivedTotal})`}
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-ga-text-secondary leading-snug">
        Where each one stands. When admin replies, the response shows up below
        your message. Threads marked resolved or parked auto-archive 24 hours
        after admin&apos;s last reply — admin can pin valuable threads to keep
        them visible permanently.
      </p>

      {items.length === 0 ? (
        <p className="text-xs text-ga-text-secondary italic py-3">
          {showArchived
            ? 'Nothing here.'
            : 'Active inbox is empty. Toggle "Show archived" to see past threads.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((entry) => (
            <li key={entry.id}>
              <FeedbackRow
                entry={entry}
                expanded={!!expanded[entry.id]}
                onToggle={() =>
                  setExpanded((prev) => ({ ...prev, [entry.id]: !prev[entry.id] }))
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


function FeedbackRow({
  entry,
  expanded,
  onToggle,
}: {
  entry: FeedbackEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const kindLabel = KIND_LABEL[entry.kind] ?? entry.kind;
  const submittedAgo = formatRelative(entry.created_at);
  const hasReply = !!entry.admin_response;
  const hasBadge = !!entry.admin_badge;
  const isPinned = !!entry.pinned;
  const hasSummary = !!entry.summary;
  const previewLen = 90;
  const needsTruncate = entry.message.length > previewLen;
  const preview = needsTruncate ? entry.message.slice(0, previewLen) + '…' : entry.message;
  // When admin set a badge, it takes priority over the internal status
  // chip (badges are user-friendlier). Status pill still shows when
  // there's no badge yet.
  const status = STATUS_FALLBACK[entry.status] ?? STATUS_FALLBACK.new;

  return (
    <div
      className={cn(
        'border rounded-md overflow-hidden',
        isPinned ? 'border-purple-500/40 bg-purple-500/5' : 'border-ga-border',
      )}
    >
      {hasSummary && (
        <div
          className="px-3 py-2 bg-ga-accent/10 border-b border-ga-accent/30 text-xs text-ga-text-primary font-medium leading-snug"
          title="Admin's summary of where this thread stands."
        >
          <span aria-hidden="true">📌</span> {entry.summary}
        </div>
      )}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-3 py-2 hover:bg-ga-bg-hover/40"
      >
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <div className="flex items-baseline gap-2 flex-wrap min-w-0">
            <span className="text-xs font-medium text-ga-text-secondary flex-shrink-0">
              {kindLabel}
            </span>
            {isPinned && (
              <span
                className="text-[10px] text-purple-700"
                title="Admin pinned this thread — it bypasses the 24h archive sweep."
              >
                📌 pinned
              </span>
            )}
          </div>
          {hasBadge && entry.admin_badge ? (
            <BadgeChip badge={entry.admin_badge} size="sm" />
          ) : (
            <span
              className={cn(
                'text-[10px] uppercase tracking-wider border rounded-full px-2 py-0.5 font-medium',
                status.cls,
              )}
              title={status.hint}
            >
              {status.label}
            </span>
          )}
        </div>
        <div className="text-xs text-ga-text-primary leading-snug">
          {expanded || !needsTruncate ? entry.message : preview}
        </div>
        <div className="flex items-center gap-3 mt-1 text-[10px] text-ga-text-secondary flex-wrap">
          <span>{submittedAgo}</span>
          {hasReply && (
            <span className="text-ga-accent">
              ✉ admin replied
              {entry.responded_at ? ` · ${formatRelative(entry.responded_at)}` : ''}
            </span>
          )}
          {needsTruncate && (
            <span className="ml-auto text-ga-text-secondary">
              {expanded ? '▾ hide' : '▸ show full'}
            </span>
          )}
        </div>
      </button>

      {/* Thread (multi-turn). Shown when the row is expanded OR when
          there's already at least one admin reply (legacy
          admin_response or any messages on the subcollection). The
          thread component owns its own loading state + reply box;
          the user can reply here and it re-opens the thread on
          admin's queue if it was closed. */}
      {(expanded || hasReply) && (
        <div className="px-3 py-2 bg-ga-accent/5 border-t border-ga-border">
          <FeedbackThread feedbackId={entry.id} scope="mine" />
        </div>
      )}
    </div>
  );
}


function formatRelative(iso: string): string {
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
