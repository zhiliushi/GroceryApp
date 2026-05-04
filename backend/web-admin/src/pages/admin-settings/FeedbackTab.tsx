import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { toast } from 'sonner';
import { cn } from '@/utils/cn';

/**
 * Admin feedback browse + triage tab.
 *
 * Sources we surface here:
 *   - 'web'                   — general feedback form (future)
 *   - 'cap_hit_primary'       — auto-prompt fired when user hits 15-primary cap
 *   - 'cap_hit_alternative'   — auto-prompt fired when user hits 3-alt cap
 *   - 'rpi_voice' / 'rpi_text'— future raspberry-pi capture path
 *
 * Per the v3 design discussion (Shahir, 2026-05-04): cap-hit feedback is
 * the input signal for cap revisits. This tab is where admin reads it.
 */

type FeedbackStatus = 'new' | 'triaged' | 'resolved' | 'wont_fix';
type FeedbackKind = 'cap_request' | 'bug' | 'feature' | 'general';

interface FeedbackEntry {
  id: string;
  user_id: string;
  user_email?: string | null;
  kind: FeedbackKind;
  source: string;
  message: string;
  context: Record<string, unknown>;
  status: FeedbackStatus;
  admin_notes?: string | null;
  created_at: string;
  updated_at: string;
}

interface FeedbackListResponse {
  items: FeedbackEntry[];
  count: number;
  stats: {
    total: number;
    by_status: Record<string, number>;
    by_kind: Record<string, number>;
  };
}

const STATUS_OPTIONS: FeedbackStatus[] = ['new', 'triaged', 'resolved', 'wont_fix'];
const KIND_OPTIONS: ('' | FeedbackKind)[] = ['', 'cap_request', 'bug', 'feature', 'general'];

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function statusColor(s: FeedbackStatus): string {
  switch (s) {
    case 'new':
      return 'bg-amber-500/15 text-amber-300';
    case 'triaged':
      return 'bg-blue-500/15 text-blue-300';
    case 'resolved':
      return 'bg-green-500/15 text-green-400';
    case 'wont_fix':
      return 'bg-ga-text-secondary/20 text-ga-text-secondary';
  }
}

export default function FeedbackTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkId = searchParams.get('id');

  const [filterKind, setFilterKind] = useState<'' | FeedbackKind>('');
  const [filterStatus, setFilterStatus] = useState<'' | FeedbackStatus>('');
  const [filterUser, setFilterUser] = useState('');
  const [data, setData] = useState<FeedbackListResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingNotesFor, setEditingNotesFor] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

  // P1.5 deep-link from Telegram. After list loads, scroll the matching
  // row into view + temporarily highlight it. Param is consumed once so
  // a refresh doesn't keep re-scrolling.
  const rowRefs = useRef<Map<string, HTMLLIElement | null>>(new Map());
  const [highlightId, setHighlightId] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    try {
      const params: Record<string, string> = {};
      if (filterKind) params.kind = filterKind;
      if (filterStatus) params.status = filterStatus;
      if (filterUser.trim()) params.user_id = filterUser.trim();
      const r = await apiClient.get<FeedbackListResponse>(API.ADMIN_FEEDBACK, { params });
      setData(r.data);
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || 'Failed to load feedback');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After data lands, if there's an `?id=` deep-link, scroll-into-view +
  // highlight. Highlight clears after 3s. URL param is consumed (tab
  // param stays so the tab navigation isn't broken on refresh).
  useEffect(() => {
    if (!deepLinkId || !data) return;
    const node = rowRefs.current.get(deepLinkId);
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(deepLinkId);
    // Consume the id param so refresh doesn't re-trigger
    const next = new URLSearchParams(searchParams);
    next.delete('id');
    setSearchParams(next, { replace: true });
    const t = window.setTimeout(() => setHighlightId(null), 3000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkId, data]);

  async function setStatus(id: string, status: FeedbackStatus) {
    try {
      await apiClient.patch(API.ADMIN_FEEDBACK_ITEM(id), { status });
      toast.success('Status updated');
      await load();
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || 'Failed to update status');
    }
  }

  async function saveNotes(id: string) {
    try {
      await apiClient.patch(API.ADMIN_FEEDBACK_ITEM(id), { admin_notes: notesDraft });
      toast.success('Notes saved');
      setEditingNotesFor(null);
      setNotesDraft('');
      await load();
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || 'Failed to save notes');
    }
  }

  const items = data?.items ?? [];
  const stats = data?.stats;

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Stats card */}
      {stats && (
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
          <div className="flex items-center gap-6 flex-wrap text-sm">
            <div>
              <span className="text-ga-text-secondary">Total: </span>
              <span className="text-ga-text-primary font-semibold">{stats.total}</span>
            </div>
            <div>
              <span className="text-ga-text-secondary">By status: </span>
              {Object.entries(stats.by_status).map(([k, v]) => (
                <span key={k} className="ml-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${statusColor(k as FeedbackStatus)}`}>
                    {k}
                  </span>{' '}
                  <span className="text-ga-text-primary tabular-nums">{v}</span>
                </span>
              ))}
            </div>
            <div>
              <span className="text-ga-text-secondary">By kind: </span>
              {Object.entries(stats.by_kind).map(([k, v]) => (
                <span key={k} className="ml-2 text-ga-text-primary">
                  {k}=<span className="tabular-nums">{v}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <label className="block text-xs text-ga-text-secondary mb-1">Kind</label>
            <select
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value as '' | FeedbackKind)}
              className="px-2 py-1.5 bg-ga-bg-primary border border-ga-border rounded-md text-sm text-ga-text-primary"
            >
              {KIND_OPTIONS.map((k) => (
                <option key={k || '__all'} value={k}>
                  {k || 'All kinds'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-ga-text-secondary mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as '' | FeedbackStatus)}
              className="px-2 py-1.5 bg-ga-bg-primary border border-ga-border rounded-md text-sm text-ga-text-primary"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-ga-text-secondary mb-1">User ID</label>
            <input
              type="text"
              placeholder="filter by user_id (optional)"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="w-full px-2 py-1.5 bg-ga-bg-primary border border-ga-border rounded-md text-sm text-ga-text-primary"
            />
          </div>
          <button
            onClick={load}
            disabled={busy}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-ga-accent text-white hover:bg-ga-accent-hover disabled:opacity-50"
          >
            {busy ? '…' : 'Apply filters'}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
        <div className="text-xs text-ga-text-secondary mb-2">
          {data ? `${data.count} entr${data.count === 1 ? 'y' : 'ies'}` : 'Loading…'}
        </div>
        {items.length === 0 && !busy && (
          <div className="text-sm text-ga-text-secondary italic py-6 text-center">
            No feedback matching these filters.
          </div>
        )}
        {items.length > 0 && (
          <ul className="divide-y divide-ga-border">
            {items.map((f) => (
              <li
                key={f.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(f.id, el);
                  else rowRefs.current.delete(f.id);
                }}
                className={cn(
                  'py-3 transition-colors',
                  highlightId === f.id && 'ring-2 ring-ga-accent rounded-md bg-ga-accent/5 px-2 -mx-2',
                )}
              >
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex flex-col gap-1 min-w-[180px]">
                    <span className={`text-xs px-1.5 py-0.5 rounded inline-block w-fit ${statusColor(f.status)}`}>
                      {f.status}
                    </span>
                    <span className="text-xs text-ga-text-primary">{f.kind}</span>
                    <span className="text-[10px] text-ga-text-secondary font-mono">
                      {f.source}
                    </span>
                    <span className="text-[10px] text-ga-text-secondary">
                      {fmtDate(f.created_at)}
                    </span>
                    <span className="text-[10px] text-ga-text-secondary truncate" title={f.user_id}>
                      {f.user_email || f.user_id?.slice(0, 12) + '…'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-[280px]">
                    <div className="text-sm text-ga-text-primary whitespace-pre-wrap break-words">
                      {f.message}
                    </div>
                    {f.context && Object.keys(f.context).length > 0 && (
                      <details className="mt-1">
                        <summary className="text-[10px] text-ga-text-secondary cursor-pointer hover:text-ga-text-primary">
                          context
                        </summary>
                        <pre className="text-[10px] text-ga-text-secondary mt-1 bg-ga-bg-primary/40 rounded p-2 overflow-x-auto">
                          {JSON.stringify(f.context, null, 2)}
                        </pre>
                      </details>
                    )}
                    {/* Admin notes */}
                    {editingNotesFor === f.id ? (
                      <div className="mt-2 space-y-1">
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
                            onClick={() => saveNotes(f.id)}
                            className="px-2 py-1 text-xs font-medium rounded bg-ga-accent text-white hover:bg-ga-accent-hover"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingNotesFor(null);
                              setNotesDraft('');
                            }}
                            className="px-2 py-1 text-xs border border-ga-border rounded text-ga-text-primary hover:bg-ga-bg-hover"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => {
                          setEditingNotesFor(f.id);
                          setNotesDraft(f.admin_notes || '');
                        }}
                        className="mt-1 text-xs text-ga-text-secondary italic cursor-pointer hover:text-ga-text-primary"
                        title="Click to edit admin notes"
                      >
                        {f.admin_notes
                          ? `📝 ${f.admin_notes}`
                          : '📝 (click to add admin notes)'}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 min-w-[120px]">
                    <label className="text-[10px] text-ga-text-secondary">Set status</label>
                    <select
                      value={f.status}
                      onChange={(e) => setStatus(f.id, e.target.value as FeedbackStatus)}
                      className="px-2 py-1 bg-ga-bg-primary border border-ga-border rounded text-xs text-ga-text-primary"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
