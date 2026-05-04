/**
 * AdminHubPage — dedicated admin surface for the closed-loop feedback flow.
 *
 * Captured 2026-05-04 from the customer-feedback v2 design pass. Up to
 * this point admin triage lived as one tab inside Admin Settings
 * (`<FeedbackTab />`). That tab grew enough new responsibilities
 * (cute badges, replies, pin, archive sweep) to deserve its own page —
 * and to mirror the user-side User Hub structurally so admin knows
 * exactly which surface the user is reading.
 *
 * Three tabs:
 *   📨 Inbox     — active threads (everything not auto-archived).
 *                   Admin's working queue. Sorted newest first.
 *   📌 Pinned    — threads admin marked "keep visible" (bypass 24h sweep).
 *                   The "wall" of valuable feedback worth surfacing
 *                   permanently.
 *   📂 Archived  — auto-archived (resolved/wont_fix > 24h). Read-mostly;
 *                   admin can un-archive by editing back to triaged or
 *                   by pinning.
 *
 * Per-row UI (FeedbackCard):
 *   - <BadgePicker /> — six cute badges; click to set/toggle.
 *   - Reply textarea + Send button — sets admin_response (stamps
 *     responded_at; the 24h archive timer starts here).
 *   - 📌 Pin / Unpin toggle.
 *   - Status setter (new / triaged / resolved / wont_fix) — drives
 *     archival eligibility independent of the badge.
 *   - Admin notes (private, not visible to user).
 *
 * Wraps `useAdminFeedback` + `useUpdateFeedback` from
 * `api/queries/useFeedback.ts`. Cache invalidation flips both the
 * admin list AND the user's `feedback/mine` so a refresh on the user
 * side picks up the new badge / reply / pin without a manual refetch.
 *
 * Deep-link support: `/admin-hub?id=<feedback_id>` scrolls the matching
 * row into view + highlights it for 3s. Used by the Telegram
 * notification link from `notification_service.notify_admin_feedback`.
 *
 * Sidebar entry: 🛡️ Admin Hub (admin section, alongside Admin Settings).
 * The legacy FeedbackTab in Admin Settings remains for backward compat
 * but is now the read-only / lightweight view; AdminHubPage is the
 * primary triage surface.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAdminFeedback, useUpdateFeedback } from '@/api/queries/useFeedback';
import BadgeChip from '@/components/feedback/BadgeChip';
import BadgePicker from '@/components/feedback/BadgePicker';
import FeedbackStatsCard from '@/components/feedback/FeedbackStatsCard';
import FeedbackThread from '@/components/feedback/FeedbackThread';
import { cn } from '@/utils/cn';
import type { FeedbackEntry, FeedbackStatus } from '@/types/api';

type TabKey = 'inbox' | 'pinned' | 'archived';

const TABS: Array<{ key: TabKey; label: string; hint: string }> = [
  { key: 'inbox', label: '📨 Inbox', hint: 'Active threads. Default working queue.' },
  { key: 'pinned', label: '📌 Pinned', hint: 'Threads admin pinned to bypass auto-archive.' },
  { key: 'archived', label: '📂 Archived', hint: 'Auto-archived (resolved/wont_fix > 24h).' },
];

const STATUS_OPTIONS: FeedbackStatus[] = ['new', 'triaged', 'resolved', 'wont_fix'];

const KIND_LABEL: Record<string, string> = {
  bug: '🐛 Bug',
  feature: '💡 Feature',
  cap_request: '📈 Cap',
  general: '💬 General',
};


function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}


export default function AdminHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkId = searchParams.get('id');
  const [tab, setTab] = useState<TabKey>('inbox');
  const [filterKind, setFilterKind] = useState<string>('');

  // Tab → query params. Inbox = active rows, Pinned = pinned only
  // (across all archive states), Archived = the archived bucket.
  const queryParams = useMemo(() => {
    const base: { archive_view?: 'active' | 'archived' | 'all'; pinned_only?: boolean; kind?: string } = {};
    if (tab === 'inbox') base.archive_view = 'active';
    else if (tab === 'pinned') {
      base.archive_view = 'all';
      base.pinned_only = true;
    } else if (tab === 'archived') base.archive_view = 'archived';
    if (filterKind) base.kind = filterKind;
    return base;
  }, [tab, filterKind]);

  const { data, isLoading, isFetching } = useAdminFeedback(queryParams);
  const items = data?.items ?? [];

  // Deep-link from Telegram / Admin Settings link. After the list lands,
  // scroll into view + highlight. Consumed once so refresh doesn't re-fire.
  const rowRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    if (!deepLinkId || !data) return;
    // Search current bucket first; if not here, hop to inbox + retry on next pass.
    const node = rowRefs.current.get(deepLinkId);
    if (!node) {
      // Not in this tab — escalate to inbox so the row is present.
      if (tab !== 'inbox') setTab('inbox');
      return;
    }
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(deepLinkId);
    const next = new URLSearchParams(searchParams);
    next.delete('id');
    setSearchParams(next, { replace: true });
    const t = window.setTimeout(() => setHighlightId(null), 3000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkId, data, tab]);

  return (
    <div className="px-4 md:px-6 py-6 max-w-5xl mx-auto space-y-4">
      <header className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-ga-text-primary">🛡️ Admin Hub</h1>
          <p className="text-sm text-ga-text-secondary mt-1">
            Triage user feedback. Attach a cute badge to communicate where each thread
            stands; replies and badges show up on the user&apos;s My feedback list.
            Resolved threads auto-archive after 24h unless pinned.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-ga-text-secondary">
          {isFetching && <span>refreshing…</span>}
        </div>
      </header>

      {/* Stats dashboard — corpus-wide aggregates, independent of the
          active tab. Reads the `stats` blob already on the response. */}
      {data?.stats && <FeedbackStatsCard stats={data.stats} />}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-ga-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            title={t.hint}
            className={cn(
              'px-3 py-2 text-sm border-b-2 -mb-px transition-colors',
              tab === t.key
                ? 'border-ga-accent text-ga-text-primary font-semibold'
                : 'border-transparent text-ga-text-secondary hover:text-ga-text-primary',
            )}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 pb-1">
          <label className="text-[11px] text-ga-text-secondary">Kind</label>
          <select
            value={filterKind}
            onChange={(e) => setFilterKind(e.target.value)}
            className="text-xs px-2 py-1 bg-ga-bg-primary border border-ga-border rounded text-ga-text-primary"
          >
            <option value="">all</option>
            <option value="bug">bug</option>
            <option value="feature">feature</option>
            <option value="cap_request">cap_request</option>
            <option value="general">general</option>
          </select>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-sm text-ga-text-secondary italic py-10 text-center">Loading…</div>
      ) : items.length === 0 ? (
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-8 text-center">
          <p className="text-sm text-ga-text-secondary">
            {tab === 'inbox'
              ? 'Inbox is empty. New feedback will land here.'
              : tab === 'pinned'
              ? 'No pinned threads. Pin a valuable thread from the Inbox to keep it on the wall.'
              : 'No archived threads yet.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((entry) => (
            <li
              key={entry.id}
              ref={(el) => {
                if (el) rowRefs.current.set(entry.id, el);
                else rowRefs.current.delete(entry.id);
              }}
            >
              <FeedbackCard entry={entry} highlighted={highlightId === entry.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


function FeedbackCard({
  entry,
  highlighted,
}: {
  entry: FeedbackEntry;
  highlighted: boolean;
}) {
  const updateMut = useUpdateFeedback();
  const [notesDraft, setNotesDraft] = useState(entry.admin_notes ?? '');
  const [editingNotes, setEditingNotes] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState(entry.summary ?? '');
  const [editingSummary, setEditingSummary] = useState(false);

  // Keep the drafts in sync if the underlying entry is replaced by a
  // refetch (e.g. another admin tab updated the same row).
  useEffect(() => {
    setNotesDraft(entry.admin_notes ?? '');
  }, [entry.admin_notes]);
  useEffect(() => {
    setSummaryDraft(entry.summary ?? '');
  }, [entry.summary]);

  const submit = (
    payload: Parameters<typeof updateMut.mutate>[0]['payload'],
    successMsg: string,
  ) => {
    updateMut.mutate(
      { id: entry.id, payload },
      {
        onSuccess: () => toast.success(successMsg),
      },
    );
  };

  const handleSaveNotes = () => {
    submit({ admin_notes: notesDraft }, 'Admin notes saved (not visible to user).');
    setEditingNotes(false);
  };

  const handleSaveSummary = () => {
    const trimmed = summaryDraft.trim();
    submit(
      { summary: trimmed },
      trimmed ? 'Summary saved — user will see it above the thread.' : 'Summary cleared.',
    );
    setEditingSummary(false);
  };

  return (
    <div
      className={cn(
        'bg-ga-bg-card border rounded-lg p-4 space-y-3 transition-colors',
        entry.pinned ? 'border-purple-500/40 bg-purple-500/5' : 'border-ga-border',
        highlighted && 'ring-2 ring-ga-accent ring-offset-2 ring-offset-ga-bg-primary',
      )}
    >
      {/* Top: kind, status, pin, badge, timestamps */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-2 flex-wrap min-w-0">
          <span className="text-xs font-medium text-ga-text-primary">
            {KIND_LABEL[entry.kind] ?? entry.kind}
          </span>
          <span className="text-[10px] text-ga-text-secondary">·</span>
          <span className="text-[10px] text-ga-text-secondary font-mono">{entry.source}</span>
          <span className="text-[10px] text-ga-text-secondary">·</span>
          <span className="text-[10px] text-ga-text-secondary truncate" title={entry.user_id}>
            {entry.user_email || entry.user_id?.slice(0, 12) + '…'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {entry.admin_badge && <BadgeChip badge={entry.admin_badge} size="sm" />}
          <span className="text-[10px] uppercase tracking-wider border rounded-full px-2 py-0.5 font-medium border-ga-border text-ga-text-secondary">
            {entry.status}
          </span>
          {entry.pinned && (
            <span
              className="text-[10px] text-purple-700 border border-purple-500/40 bg-purple-500/10 rounded-full px-2 py-0.5"
              title="Pinned — bypasses 24h archive sweep."
            >
              📌 pinned
            </span>
          )}
        </div>
      </div>

      {/* User message */}
      <div className="text-sm text-ga-text-primary whitespace-pre-wrap break-words bg-ga-bg-primary/30 rounded-md px-3 py-2 border border-ga-border">
        {entry.message}
      </div>

      {/* Summary card (admin → user-visible TL;DR shown above the thread) */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-ga-text-secondary mb-1.5 font-medium">
          Summary card (visible to user as a header above the thread)
        </div>
        {editingSummary ? (
          <div className="space-y-1.5">
            <textarea
              autoFocus
              value={summaryDraft}
              onChange={(e) => setSummaryDraft(e.target.value)}
              rows={2}
              maxLength={280}
              placeholder={`One-line takeaway. e.g. "Shipped in v0.7 — see What's new" or "Tracked — duplicate of #abc".`}
              className="w-full bg-ga-bg-primary border border-ga-border rounded-md px-3 py-2 text-xs text-ga-text-primary focus:outline-none focus:border-ga-accent"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveSummary}
                disabled={updateMut.isPending}
                className="px-2 py-0.5 text-xs font-medium rounded bg-ga-accent text-white hover:opacity-90"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingSummary(false);
                  setSummaryDraft(entry.summary ?? '');
                }}
                className="px-2 py-0.5 text-xs border border-ga-border rounded text-ga-text-secondary hover:bg-ga-bg-hover"
              >
                Cancel
              </button>
              <span className="ml-auto text-[10px] text-ga-text-secondary tabular-nums">
                {summaryDraft.length} / 280
              </span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingSummary(true)}
            className={cn(
              'w-full text-left text-xs italic transition-colors rounded-md px-3 py-2 border',
              entry.summary
                ? 'bg-ga-accent/10 border-ga-accent/40 text-ga-text-primary not-italic font-medium hover:bg-ga-accent/15'
                : 'border-dashed border-ga-border text-ga-text-secondary hover:bg-ga-bg-hover',
            )}
          >
            {entry.summary
              ? `📌 ${entry.summary}`
              : '📌 (click to add a one-line summary the user will see)'}
          </button>
        )}
      </div>

      {/* Optional context blob */}
      {entry.context && Object.keys(entry.context).length > 0 && (
        <details className="text-[11px]">
          <summary className="text-ga-text-secondary cursor-pointer hover:text-ga-text-primary">
            Context ({Object.keys(entry.context).length} keys)
          </summary>
          <pre className="text-[10px] text-ga-text-secondary mt-1 bg-ga-bg-primary/40 rounded p-2 overflow-x-auto">
            {JSON.stringify(entry.context, null, 2)}
          </pre>
        </details>
      )}

      {/* Badge picker */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-ga-text-secondary mb-1.5 font-medium">
          Badge (visible to user)
        </div>
        <BadgePicker
          current={entry.admin_badge ?? null}
          disabled={updateMut.isPending}
          onPick={(next) =>
            submit(
              { admin_badge: next ?? '' },
              next ? `Badge set: ${next}` : 'Badge cleared.',
            )
          }
        />
      </div>

      {/* Thread (multi-turn). Replaces the single admin_response box.
          Admin replies here flow through /api/admin/feedback/{id}/messages,
          which mirrors the latest text into admin_response so legacy
          surfaces still work. The 24h archive timer reads responded_at,
          which the message endpoint stamps. */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-ga-text-secondary mb-1.5 font-medium flex items-center justify-between gap-2">
          <span>Conversation (visible to user)</span>
          {entry.responded_at && (
            <span className="normal-case tracking-normal text-ga-text-secondary/70">
              last reply {fmtDate(entry.responded_at)}
            </span>
          )}
        </div>
        <FeedbackThread feedbackId={entry.id} scope="admin" />
      </div>

      {/* Action row: pin + status */}
      <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-ga-border">
        <button
          type="button"
          onClick={() =>
            submit(
              { pinned: !entry.pinned },
              entry.pinned ? 'Unpinned.' : 'Pinned — bypasses 24h archive.',
            )
          }
          disabled={updateMut.isPending}
          className={cn(
            'text-xs px-2.5 py-1 rounded border font-medium',
            entry.pinned
              ? 'border-purple-500/40 bg-purple-500/10 text-purple-700 hover:bg-purple-500/20'
              : 'border-ga-border text-ga-text-secondary hover:bg-ga-bg-hover',
          )}
          title={
            entry.pinned
              ? 'Unpin — thread becomes eligible for the 24h auto-archive again.'
              : 'Pin — keeps the thread visible to the user past the 24h archive window.'
          }
        >
          {entry.pinned ? '📌 Unpin' : '📌 Pin'}
        </button>

        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-ga-text-secondary uppercase tracking-wider">
            Status
          </label>
          <select
            value={entry.status}
            disabled={updateMut.isPending}
            onChange={(e) =>
              submit(
                { status: e.target.value as FeedbackStatus },
                `Status → ${e.target.value}`,
              )
            }
            className="text-xs px-2 py-1 bg-ga-bg-primary border border-ga-border rounded text-ga-text-primary"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <span className="ml-auto text-[10px] text-ga-text-secondary">
          submitted {fmtDate(entry.created_at)}
        </span>
      </div>

      {/* Admin notes (private) */}
      <div className="pt-2 border-t border-ga-border">
        <div className="text-[10px] uppercase tracking-wider text-ga-text-secondary mb-1 font-medium">
          Admin notes (private — not shown to user)
        </div>
        {editingNotes ? (
          <div className="space-y-1.5">
            <textarea
              autoFocus
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={2}
              maxLength={2000}
              className="w-full text-xs px-2 py-1.5 bg-ga-bg-primary border border-ga-border rounded-md text-ga-text-primary"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={updateMut.isPending}
                className="px-2 py-0.5 text-xs font-medium rounded bg-ga-accent text-white hover:opacity-90"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingNotes(false);
                  setNotesDraft(entry.admin_notes ?? '');
                }}
                className="px-2 py-0.5 text-xs border border-ga-border rounded text-ga-text-secondary hover:bg-ga-bg-hover"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingNotes(true)}
            className="text-xs text-ga-text-secondary italic hover:text-ga-text-primary text-left w-full"
          >
            {entry.admin_notes
              ? `📝 ${entry.admin_notes}`
              : '📝 (click to add private admin notes)'}
          </button>
        )}
      </div>
    </div>
  );
}
