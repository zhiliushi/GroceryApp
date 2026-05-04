/**
 * BadgeChip — admin-set "cute" badge surfaced to the user in My feedback.
 *
 * Distinct from the internal `status` enum (which gates archival + admin
 * filtering). Badges are friendlier user-facing labels admin attaches
 * to communicate where a thread stands without needing to type a full
 * reply. Latest set value wins — full threading is deferred.
 *
 * Six badges, each with a tone:
 *   👀 Noted          — "Got it, looking at it"           neutral
 *   🔧 We're on it    — "Working on it now"               accent
 *   💬 Need more info — "Tell us more"                    amber
 *   ✅ Resolved       — "Fixed/done"                      green
 *   🚀 Shipped        — "This shipped — see What's new"   purple
 *   🌱 Parked         — "Won't fix yet, kept on the wall" neutral-cool
 *
 * Used in:
 *   - <MyFeedbackSection /> on User Hub (read-only display)
 *   - <BadgePicker /> on Admin Hub (clickable to set)
 *   - <FeedbackTab /> legacy admin-settings tab (read-only display)
 */
import { cn } from '@/utils/cn';
import type { FeedbackBadge } from '@/types/api';

export interface BadgeConfig {
  emoji: string;
  label: string;
  /** What the user reads when they hover or read aloud. */
  hint: string;
  /** Tailwind classes for the chip background + text. */
  cls: string;
}

export const BADGE_CONFIG: Record<FeedbackBadge, BadgeConfig> = {
  noted: {
    emoji: '👀',
    label: 'Noted',
    hint: 'Admin saw your message and is looking at it.',
    cls: 'bg-ga-bg-hover text-ga-text-primary border-ga-border',
  },
  on_it: {
    emoji: '🔧',
    label: "We're on it",
    hint: 'Admin is actively working on this.',
    cls: 'bg-ga-accent/10 text-ga-accent border-ga-accent/40',
  },
  need_info: {
    emoji: '💬',
    label: 'Need more info',
    hint: 'Admin needs more detail from you to act.',
    cls: 'bg-amber-500/10 text-amber-700 border-amber-500/40',
  },
  resolved: {
    emoji: '✅',
    label: 'Resolved',
    hint: 'Admin marked this resolved. The thread will archive in 24 hours unless pinned.',
    cls: 'bg-green-500/10 text-green-700 border-green-500/40',
  },
  shipped: {
    emoji: '🚀',
    label: 'Shipped',
    hint: 'A change related to this feedback shipped. Check What’s new for details.',
    cls: 'bg-purple-500/10 text-purple-700 border-purple-500/40',
  },
  parked: {
    emoji: '🌱',
    label: 'Parked',
    hint: "Won't be fixed yet but the thread is kept on the wall for later.",
    cls: 'bg-gray-500/10 text-gray-700 border-gray-500/40',
  },
};

/** Ordered list of all valid badges. Used by <BadgePicker /> to render
 *  the option grid in a consistent sequence. */
export const BADGE_KEYS: FeedbackBadge[] = [
  'noted',
  'on_it',
  'need_info',
  'resolved',
  'shipped',
  'parked',
];


export default function BadgeChip({
  badge,
  size = 'md',
  className,
}: {
  badge: FeedbackBadge;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const cfg = BADGE_CONFIG[badge];
  if (!cfg) return null;
  return (
    <span
      title={cfg.hint}
      className={cn(
        'inline-flex items-center gap-1 font-medium border rounded-full',
        size === 'sm'
          ? 'text-[10px] px-1.5 py-0 leading-[16px]'
          : 'text-[11px] px-2 py-0.5 leading-[18px]',
        cfg.cls,
        className,
      )}
    >
      <span aria-hidden="true">{cfg.emoji}</span>
      <span>{cfg.label}</span>
    </span>
  );
}
