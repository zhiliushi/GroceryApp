import { Link } from 'react-router-dom';
import { useNudges } from '@/hooks/useNudges';
import { useFeatureFlags } from '@/api/queries/useFeatureFlags';
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/utils/cn';

/**
 * Threshold-based progressive nudge banner (thresholds from nudge_thresholds flag).
 * Distinct from NudgeBanner which surfaces per-item 7/14/21-day reminders.
 */
export default function ProgressiveNudge() {
  const { data: flags } = useFeatureFlags();
  const nudge = useNudges();
  const dismissNudge = useUiStore((s) => s.dismissNudge);

  // Defensive gate: useNudges also checks this flag, but if the flag flips off
  // while a candidate is cached in memory, this belt-and-suspenders guard keeps
  // the banner hidden immediately.
  if (flags?.progressive_nudges === false) return null;
  if (!nudge) return null;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm',
        nudge.severity === 'hot'
          ? 'bg-orange-500/10 border-orange-500/30 text-orange-700'
          : nudge.severity === 'tip'
          ? 'bg-ga-accent/10 border-ga-accent/30 text-ga-text-primary'
          : 'bg-blue-500/10 border-blue-500/30 text-blue-700',
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium">{nudge.title}</div>
        <div className="text-xs opacity-90 mt-0.5">{nudge.description}</div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {nudge.cta && (
          <Link
            to={nudge.cta.to}
            className="px-2 py-1 text-xs bg-ga-bg-card rounded hover:bg-ga-bg-hover whitespace-nowrap"
          >
            {nudge.cta.label} →
          </Link>
        )}
        <button
          onClick={() => dismissNudge(nudge.key)}
          aria-label="Dismiss"
          className="text-xs opacity-70 hover:opacity-100 px-1"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
