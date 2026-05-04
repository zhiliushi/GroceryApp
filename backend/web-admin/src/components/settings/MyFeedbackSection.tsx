/**
 * MyFeedbackSection — user-side list of their own feedback.
 *
 * Captured 2026-05-04 from the customer-feedback design pass. Closes
 * the loop: the user submits via the floating 💬 button → admin reads
 * on Telegram → admin replies via the admin UI → that reply shows up
 * here under their original submission. Without this, submissions
 * feel like a void; users stop submitting.
 *
 * Mounted in SettingsPage between MergeNudgeWidget and SecuritySection.
 *
 * Each row shows: kind, status, when submitted, message excerpt, and
 * — when admin has responded — the reply rendered below the user's
 * own message. Status pills tell the user where the item stands.
 *
 * Auto-hidden when the user has zero feedback rows (avoids dead
 * real estate for new users).
 */
import { useState } from 'react';
import { useMyFeedback } from '@/api/queries/useFeedback';
import { cn } from '@/utils/cn';
import type { FeedbackEntry, FeedbackStatus } from '@/types/api';

const STATUS_CFG: Record<FeedbackStatus, { label: string; cls: string; hint: string }> = {
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
   * 'hide' (default) — auto-hide when the user has zero submissions; used
   * where space is precious. 'inline' — render an empty-state card instead
   * (used inside the User Hub's My feedback tab).
   */
  emptyVariant?: 'hide' | 'inline';
} = {}) {
  const { data, isLoading } = useMyFeedback();
  const items = data?.items ?? [];
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (isLoading) return null;
  if (items.length === 0) {
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
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-ga-text-primary">
          💬 My feedback
        </h2>
        <span className="text-[11px] text-ga-text-secondary">
          {items.length} submission{items.length === 1 ? '' : 's'}
        </span>
      </div>
      <p className="text-xs text-ga-text-secondary leading-snug">
        Where each one stands. When admin replies, the response shows
        up below your original message.
      </p>

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
  const status = STATUS_CFG[entry.status] ?? STATUS_CFG.new;
  const kindLabel = KIND_LABEL[entry.kind] ?? entry.kind;
  const submittedAgo = formatRelative(entry.created_at);
  const hasReply = !!entry.admin_response;
  const previewLen = 90;
  const needsTruncate = entry.message.length > previewLen;
  const preview = needsTruncate ? entry.message.slice(0, previewLen) + '…' : entry.message;

  return (
    <div className="border border-ga-border rounded-md overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-3 py-2 hover:bg-ga-bg-hover/40"
      >
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <span className="text-xs font-medium text-ga-text-secondary">
            {kindLabel}
          </span>
          <span
            className={cn(
              'text-[10px] uppercase tracking-wider border rounded-full px-2 py-0.5 font-medium',
              status.cls,
            )}
            title={status.hint}
          >
            {status.label}
          </span>
        </div>
        <div className="text-xs text-ga-text-primary leading-snug">
          {expanded || !needsTruncate ? entry.message : preview}
        </div>
        <div className="flex items-center gap-3 mt-1 text-[10px] text-ga-text-secondary">
          <span>{submittedAgo}</span>
          {hasReply && (
            <span className="text-ga-accent">
              ✉ admin replied{entry.responded_at ? ` · ${formatRelative(entry.responded_at)}` : ''}
            </span>
          )}
          {needsTruncate && (
            <span className="ml-auto text-ga-text-secondary">
              {expanded ? '▾ hide' : '▸ show full'}
            </span>
          )}
        </div>
      </button>

      {hasReply && (
        <div className="px-3 py-2 bg-ga-accent/5 border-t border-ga-border text-xs leading-snug">
          <div className="text-[10px] uppercase tracking-wider text-ga-accent mb-1 font-medium">
            Admin response
          </div>
          <p className="text-ga-text-primary whitespace-pre-wrap">
            {entry.admin_response}
          </p>
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
