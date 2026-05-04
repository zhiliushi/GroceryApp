/**
 * BetaBadge — consistent "this feature is in beta" chip used wherever a
 * Preppers or Homemaker (or future early-access) surface appears.
 *
 * Captured 2026-05-04 from a marketing-readiness pass: every gated
 * feature that's still being shaped should visibly tell the user
 * "this is beta — expect breakage, expect change, your feedback shapes
 * it." Lowers expectations + earns trust + invites feedback.
 *
 * Usage:
 *   <BetaBadge />                       // default size, beside a heading
 *   <BetaBadge size="sm" />             // compact, inline with copy
 *   <BetaBadge label="Early access" />  // override label when "beta" is wrong
 *   <BetaBadge tone="purple" />         // homemaker-tinted; default is amber
 *
 * Color tokens:
 *   amber  — generic beta (Preppers, Plan & shop second wave)
 *   purple — homemaker family of features
 *   orange — closed-beta access notes
 *
 * The badge does not link or toggle. It's signage only.
 */
import { cn } from '@/utils/cn';

interface Props {
  /** Display copy. Defaults to "Beta". */
  label?: string;
  /** Visual size. */
  size?: 'sm' | 'md';
  /** Color family. */
  tone?: 'amber' | 'purple' | 'orange';
  /** Optional tooltip (renders as native title=). */
  title?: string;
  className?: string;
}

const TONE_CLS = {
  amber: 'bg-amber-500/20 text-amber-700 border-amber-500/40',
  purple: 'bg-purple-500/20 text-purple-700 border-purple-500/40',
  orange: 'bg-orange-500/20 text-orange-700 border-orange-500/40',
};

const SIZE_CLS = {
  sm: 'text-[9px] px-1.5 py-0 leading-[14px]',
  md: 'text-[10px] px-2 py-0.5 leading-[16px]',
};

export default function BetaBadge({
  label = 'Beta',
  size = 'md',
  tone = 'amber',
  title,
  className,
}: Props) {
  return (
    <span
      title={title || `${label} — this feature is in beta. Expect rough edges; tell admin if anything breaks.`}
      className={cn(
        'inline-flex items-center font-medium uppercase tracking-wider border rounded-full align-middle',
        TONE_CLS[tone],
        SIZE_CLS[size],
        className,
      )}
      aria-label={`${label} feature`}
    >
      {label}
    </span>
  );
}
