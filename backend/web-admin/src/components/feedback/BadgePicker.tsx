/**
 * BadgePicker — admin-side clickable grid of the 6 cute badges.
 *
 * Used inside <AdminHubPage /> per-row to attach / change / clear the
 * admin_badge on a feedback entry. Selecting the current badge clears
 * it (toggle). Renders the same emoji + label sequence as
 * <BadgeChip />, kept in sync via BADGE_KEYS + BADGE_CONFIG so the
 * user sees exactly what admin clicked.
 *
 * The picker is intentionally lightweight: no modal, no confirmation —
 * one click to set, click-again to clear. Mutation state is owned by
 * the parent (so multiple rows can mutate independently and the parent
 * controls cache invalidation).
 */
import { cn } from '@/utils/cn';
import { BADGE_CONFIG, BADGE_KEYS } from './BadgeChip';
import type { FeedbackBadge } from '@/types/api';

export default function BadgePicker({
  current,
  onPick,
  disabled = false,
}: {
  current?: FeedbackBadge | null;
  /** Pass null when admin re-clicks the active badge to clear it. */
  onPick: (next: FeedbackBadge | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {BADGE_KEYS.map((key) => {
        const cfg = BADGE_CONFIG[key];
        const isActive = current === key;
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => onPick(isActive ? null : key)}
            title={cfg.hint}
            className={cn(
              'text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border font-medium transition-colors',
              isActive
                ? cfg.cls + ' ring-2 ring-offset-1 ring-offset-ga-bg-card ring-ga-accent'
                : 'bg-ga-bg-primary text-ga-text-secondary border-ga-border hover:bg-ga-bg-hover',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            <span aria-hidden="true">{cfg.emoji}</span>
            <span>{cfg.label}</span>
          </button>
        );
      })}
      {current && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onPick(null)}
          className="text-[10px] text-ga-text-secondary hover:text-ga-text-primary underline underline-offset-2 ml-1"
          title="Clear the badge — falls back to the internal status pill in the user view."
        >
          clear
        </button>
      )}
    </div>
  );
}
