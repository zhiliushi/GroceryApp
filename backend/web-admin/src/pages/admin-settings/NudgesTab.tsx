import { useEffect, useState } from 'react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { useFeatureFlags } from '@/api/queries/useFeatureFlags';
import { useUpdateFeatureFlags } from '@/api/mutations/useFeatureFlagMutations';
import type { FeatureFlags, NudgeThresholds } from '@/types/api';
import { cn } from '@/utils/cn';

const DEFAULT_THRESHOLDS: NudgeThresholds = { expiry: 5, price: 10, volume: 20 };

/**
 * Admin UI for the Progressive Nudges system.
 *
 * - Toggle `progressive_nudges` on/off (wraps the same flag the FeatureFlagsTab exposes).
 * - Configure `nudge_thresholds` — counts at which expiry / price / volume nudges trigger.
 *
 * Nudges are consumed by `useNudges` on the client, which reads thresholds via the
 * public `/api/features/public` endpoint (no admin required).
 */
export default function NudgesTab() {
  const { data: flags, isLoading } = useFeatureFlags();
  const updateMutation = useUpdateFeatureFlags();

  const [thresholds, setThresholds] = useState<NudgeThresholds>(DEFAULT_THRESHOLDS);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (flags?.nudge_thresholds) setThresholds(flags.nudge_thresholds);
  }, [flags]);

  if (isLoading) return <LoadingSpinner text="Loading nudge settings…" />;
  if (!flags) return null;

  const progressiveOn = flags.progressive_nudges !== false;

  function edit(key: keyof NudgeThresholds, raw: string) {
    const n = Math.max(0, Math.min(10_000, parseInt(raw, 10) || 0));
    setThresholds((t) => ({ ...t, [key]: n }));
    setDirty(true);
  }

  function saveThresholds() {
    if (!dirty) return;
    updateMutation.mutate(
      { nudge_thresholds: thresholds } as Partial<FeatureFlags>,
      {
        onSuccess: () => setDirty(false),
      },
    );
  }

  function resetThresholds() {
    setThresholds(flags?.nudge_thresholds ?? DEFAULT_THRESHOLDS);
    setDirty(false);
  }

  function toggleProgressive() {
    updateMutation.mutate({
      progressive_nudges: !progressiveOn,
    } as Partial<FeatureFlags>);
  }

  return (
    <div className="space-y-4">
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={toggleProgressive}
            disabled={updateMutation.isPending}
            className={cn(
              'relative w-11 h-6 rounded-full transition-colors flex-shrink-0 mt-0.5',
              progressiveOn ? 'bg-ga-accent' : 'bg-ga-bg-hover',
            )}
            aria-pressed={progressiveOn}
          >
            <span
              className={cn(
                'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform',
                progressiveOn && 'translate-x-5',
              )}
            />
          </button>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-ga-text-primary">Progressive nudges</h3>
            <p className="text-xs text-ga-text-secondary mt-0.5">
              Show contextual banners (expiry / price / volume) once users hit the thresholds
              below. Dashboard-only; users can dismiss per-nudge.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-ga-text-primary">Thresholds</h3>
        <p className="text-xs text-ga-text-secondary mb-4">
          Minimum number of purchases before each nudge appears.
        </p>

        <div className="space-y-3">
          <Row
            label="Expiry nudge"
            help="Prompt to add expiry dates"
            value={thresholds.expiry}
            onChange={(v) => edit('expiry', v)}
          />
          <Row
            label="Price nudge"
            help="Prompt to record prices — gated by financial_tracking flag"
            value={thresholds.price}
            onChange={(v) => edit('price', v)}
          />
          <Row
            label="Volume nudge"
            help="Prompt to track quantity / unit"
            value={thresholds.volume}
            onChange={(v) => edit('volume', v)}
          />
        </div>

        <div className="flex gap-2 mt-4 pt-4 border-t border-ga-border">
          <button
            type="button"
            onClick={saveThresholds}
            disabled={!dirty || updateMutation.isPending}
            className={cn(
              'px-4 py-2 rounded text-sm',
              dirty && !updateMutation.isPending
                ? 'bg-ga-accent text-white'
                : 'bg-ga-bg-hover text-ga-text-secondary cursor-not-allowed',
            )}
          >
            {updateMutation.isPending ? 'Saving…' : 'Save thresholds'}
          </button>
          {dirty && (
            <button
              type="button"
              onClick={resetThresholds}
              className="px-4 py-2 rounded text-sm border border-ga-border text-ga-text-secondary hover:bg-ga-bg-hover"
            >
              Discard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: number;
  onChange: (raw: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="text-sm text-ga-text-primary">{label}</div>
        <div className="text-xs text-ga-text-secondary">{help}</div>
      </div>
      <input
        type="number"
        min={0}
        max={10_000}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-20 px-2 py-1 rounded border border-ga-border bg-ga-bg-primary text-ga-text-primary text-sm text-right"
      />
    </div>
  );
}
