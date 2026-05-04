/**
 * FeedbackStatsCard — admin-only at-a-glance counters for the
 * feedback corpus.
 *
 * Mounted at the top of <AdminHubPage />. Reads the `stats` blob
 * already returned by GET /api/admin/feedback (no extra query).
 *
 * What it surfaces (closed-beta priorities):
 *   1. Total — corpus size.
 *   2. Unresponded — admin's queue: how many threads are waiting for
 *      a reply. The number that should drive admin's action today.
 *   3. Active vs Archived — split between the user-visible bucket
 *      and the auto-archived bucket.
 *   4. Pinned — threads admin keeps on the wall.
 *   5. Median time to first reply — lifecycle health metric.
 *
 * Plus two compact rows: by-kind (bug/feature/cap_request/general)
 * and by-badge (with the same emoji set BadgeChip uses).
 */
import { BADGE_CONFIG } from './BadgeChip';
import type { FeedbackBadge, FeedbackStats } from '@/types/api';

const KIND_LABEL: Record<string, string> = {
  bug: '🐛 Bug',
  feature: '💡 Feature',
  cap_request: '📈 Cap',
  general: '💬 General',
};

const KIND_ORDER = ['bug', 'feature', 'cap_request', 'general'];


function fmtHours(h: number | null | undefined): string {
  if (h == null) return '—';
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 24) return `${h.toFixed(1)} hr`;
  return `${(h / 24).toFixed(1)} d`;
}


export default function FeedbackStatsCard({ stats }: { stats: FeedbackStats }) {
  const byKind = stats.by_kind ?? {};
  const byBadge = stats.by_badge ?? {};

  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4 space-y-3">
      {/* Headline counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Counter label="Total" value={stats.total} />
        <Counter
          label="Unresponded"
          value={stats.unresponded ?? 0}
          tone={stats.unresponded && stats.unresponded > 0 ? 'amber' : 'neutral'}
          hint="Threads with no admin reply yet — the working queue."
        />
        <Counter
          label="Active"
          value={stats.active ?? 0}
          hint="Visible to users (not auto-archived)."
        />
        <Counter
          label="Archived"
          value={stats.archived ?? 0}
          hint="Auto-archived (resolved/wont_fix > 24h)."
        />
        <Counter
          label="Pinned"
          value={stats.pinned ?? 0}
          tone={stats.pinned && stats.pinned > 0 ? 'purple' : 'neutral'}
          hint="Admin marked these to bypass the 24h archive."
        />
        <Counter
          label="Median 1st reply"
          value={fmtHours(stats.median_first_reply_hours)}
          hint="Median time from user submission to first admin reply, across replied threads."
        />
      </div>

      {/* By kind */}
      {Object.keys(byKind).length > 0 && (
        <div className="flex items-center gap-3 flex-wrap text-[11px] pt-2 border-t border-ga-border">
          <span className="uppercase tracking-wider text-ga-text-secondary font-medium">
            By kind
          </span>
          {KIND_ORDER.filter((k) => byKind[k] > 0).map((k) => (
            <span key={k} className="text-ga-text-primary">
              <span className="text-ga-text-secondary">{KIND_LABEL[k] ?? k}:</span>{' '}
              <span className="tabular-nums font-medium">{byKind[k]}</span>
            </span>
          ))}
        </div>
      )}

      {/* By badge */}
      {Object.keys(byBadge).length > 0 && (
        <div className="flex items-center gap-3 flex-wrap text-[11px]">
          <span className="uppercase tracking-wider text-ga-text-secondary font-medium">
            By badge
          </span>
          {(Object.keys(BADGE_CONFIG) as FeedbackBadge[]).map((key) => {
            const n = byBadge[key];
            if (!n) return null;
            const cfg = BADGE_CONFIG[key];
            return (
              <span key={key} className="text-ga-text-primary">
                <span aria-hidden="true">{cfg.emoji}</span>{' '}
                <span className="text-ga-text-secondary">{cfg.label}:</span>{' '}
                <span className="tabular-nums font-medium">{n}</span>
              </span>
            );
          })}
          {byBadge.none > 0 && (
            <span className="text-ga-text-secondary">
              no badge: <span className="tabular-nums font-medium text-ga-text-primary">{byBadge.none}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}


function Counter({
  label,
  value,
  tone = 'neutral',
  hint,
}: {
  label: string;
  value: number | string;
  tone?: 'neutral' | 'amber' | 'purple';
  hint?: string;
}) {
  const valueColor =
    tone === 'amber'
      ? 'text-amber-700'
      : tone === 'purple'
      ? 'text-purple-700'
      : 'text-ga-text-primary';
  return (
    <div title={hint} className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-wider text-ga-text-secondary font-medium">
        {label}
      </div>
      <div className={`text-xl font-bold tabular-nums ${valueColor}`}>{value}</div>
    </div>
  );
}
