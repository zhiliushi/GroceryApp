import { useState } from 'react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { useFeatureFlags } from '@/api/queries/useFeatureFlags';
import { useUpdateFeatureFlags } from '@/api/mutations/useFeatureFlagMutations';
import type { FeatureFlags } from '@/types/api';
import { cn } from '@/utils/cn';

interface FlagGroup {
  title: string;
  description: string;
  flags: Array<{ key: keyof FeatureFlags; label: string; description: string; dependsOn?: keyof FeatureFlags }>;
}

const GROUPS: FlagGroup[] = [
  {
    title: 'OCR & Smart Camera',
    description: 'Hidden by default in the refactor — toggle on for admin testing or re-rollout.',
    flags: [
      { key: 'ocr_enabled', label: 'OCR Master Switch', description: 'Global kill-switch — children disabled when off.' },
      { key: 'receipt_scan', label: 'Receipt Scanning', description: 'Upload receipt images for parsed items.', dependsOn: 'ocr_enabled' },
      { key: 'smart_camera', label: 'Smart Camera (Product Label)', description: 'Product-label OCR.', dependsOn: 'ocr_enabled' },
      { key: 'recipe_ocr', label: 'Recipe OCR', description: 'Scan recipe images for ingredients.', dependsOn: 'ocr_enabled' },
      { key: 'shelf_audit', label: 'Shelf Audit', description: 'Bulk shelf-image scanning.', dependsOn: 'ocr_enabled' },
    ],
  },
  {
    title: 'User-Facing Features',
    description: 'Product features visible to end users.',
    flags: [
      { key: 'progressive_nudges', label: 'Progressive Nudges', description: 'Show expiry/price/volume nudges after item thresholds.' },
      { key: 'financial_tracking', label: 'Financial Tracking', description: 'Cash vs card spending breakdown.' },
      { key: 'insights', label: 'Insights', description: 'Milestone-driven AI insights (50/100/500/1000).' },
      { key: 'nl_expiry_parser', label: 'Natural-Language Expiry', description: '"tomorrow" / "next week" parsing.' },
    ],
  },
  {
    title: 'Background Jobs',
    description: 'Scheduler behaviours — changes take effect on next job run.',
    flags: [
      { key: 'barcode_country_autodetect', label: 'Country Auto-detect', description: 'Fill country_code from GS1 barcode prefix.' },
      { key: 'catalog_cleanup', label: 'Catalog Cleanup', description: 'Weekly delete of stale no-barcode unused entries.' },
      { key: 'reminder_scan', label: 'Reminder Scan', description: 'Daily 7/14/21-day nudge scan.' },
      { key: 'milestone_analytics', label: 'Milestone Analytics', description: 'Hourly milestone insight trigger.' },
    ],
  },
  {
    title: 'Migration & Legacy',
    description: 'Flip these after running the data migration.',
    flags: [
      {
        key: 'legacy_endpoints_use_new_model',
        label: 'Serve legacy endpoints from new model',
        description: 'After migrating to catalog_entries + purchases, turn this on so the old mobile app keeps working via the compat shim.',
      },
    ],
  },
];

export default function FeatureFlagsTab() {
  const { data: flags, isLoading, error } = useFeatureFlags();
  const updateMutation = useUpdateFeatureFlags();
  const [pending, setPending] = useState<Partial<FeatureFlags>>({});

  if (isLoading) return <LoadingSpinner text="Loading flags..." />;
  if (error)
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
        Failed to load flags: {(error as Error).message}
      </div>
    );
  if (!flags) return null;

  const hasChanges = Object.keys(pending).length > 0;

  function toggle(key: keyof FeatureFlags) {
    const current = flags?.[key];
    const nextInPending = pending[key];
    const value = nextInPending === undefined ? current : nextInPending;
    const newValue = !value;
    // If toggled back to original, drop from pending
    if (newValue === current) {
      const { [key]: _removed, ...rest } = pending;
      void _removed;
      setPending(rest);
    } else {
      setPending({ ...pending, [key]: newValue });
    }
  }

  function effectiveValue(key: keyof FeatureFlags): boolean {
    if (pending[key] !== undefined) return !!pending[key];
    return !!flags?.[key];
  }

  function isDisabledByDep(dep: keyof FeatureFlags | undefined): boolean {
    if (!dep) return false;
    return !effectiveValue(dep);
  }

  function save() {
    if (!hasChanges) return;
    updateMutation.mutate(pending, {
      onSuccess: () => setPending({}),
    });
  }

  function reset() {
    setPending({});
  }

  return (
    <div className="space-y-6">
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-ga-text-primary mb-1">Feature Flags</h3>
        <p className="text-xs text-ga-text-secondary mb-4">
          Flags propagate within 60s via the backend cache. OCR off = routes return 404.
        </p>
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={!hasChanges || updateMutation.isPending}
            className={cn(
              'px-4 py-2 rounded text-sm',
              hasChanges && !updateMutation.isPending
                ? 'bg-ga-accent text-white'
                : 'bg-ga-bg-hover text-ga-text-secondary cursor-not-allowed',
            )}
          >
            {updateMutation.isPending ? 'Saving…' : `Save ${Object.keys(pending).length} change(s)`}
          </button>
          {hasChanges && (
            <button onClick={reset} className="px-4 py-2 rounded text-sm border border-ga-border text-ga-text-secondary hover:bg-ga-bg-hover">
              Discard
            </button>
          )}
        </div>
      </div>

      {GROUPS.map((group) => (
        <div key={group.title} className="bg-ga-bg-card border border-ga-border rounded-lg p-5">
          <h4 className="text-sm font-semibold text-ga-text-primary">{group.title}</h4>
          <p className="text-xs text-ga-text-secondary mb-3">{group.description}</p>
          <div className="space-y-2">
            {group.flags.map((f) => {
              const on = effectiveValue(f.key);
              const disabledByDep = isDisabledByDep(f.dependsOn);
              const isDirty = pending[f.key] !== undefined;
              return (
                <div
                  key={f.key as string}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded border',
                    isDirty ? 'border-ga-accent bg-ga-accent/5' : 'border-ga-border/50',
                    disabledByDep && 'opacity-50',
                  )}
                >
                  <button
                    onClick={() => toggle(f.key)}
                    disabled={disabledByDep}
                    className={cn(
                      'relative w-10 h-6 rounded-full transition-colors flex-shrink-0 mt-0.5',
                      on ? 'bg-ga-accent' : 'bg-ga-bg-hover',
                      disabledByDep && 'cursor-not-allowed',
                    )}
                    aria-pressed={on}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform',
                        on && 'translate-x-4',
                      )}
                    />
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-ga-text-primary font-medium">{f.label}</span>
                      {isDirty && <span className="text-xs text-ga-accent">(unsaved)</span>}
                      {f.dependsOn && (
                        <span className="text-xs text-ga-text-secondary">· depends on {f.dependsOn as string}</span>
                      )}
                    </div>
                    <p className="text-xs text-ga-text-secondary">{f.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5">
        <h4 className="text-sm font-semibold text-ga-text-primary mb-2">Nudge Thresholds</h4>
        <p className="text-xs text-ga-text-secondary mb-2">
          Minimum number of items before each nudge is shown. Edit them from the{' '}
          <strong>Nudges</strong> tab.
        </p>
        <div className="text-xs text-ga-text-secondary grid grid-cols-3 gap-2">
          <Threshold label="Expiry" value={flags.nudge_thresholds?.expiry} />
          <Threshold label="Price" value={flags.nudge_thresholds?.price} />
          <Threshold label="Volume" value={flags.nudge_thresholds?.volume} />
        </div>
      </div>
    </div>
  );
}

function Threshold({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="bg-ga-bg-hover rounded p-2">
      <div className="text-[10px] uppercase tracking-wider text-ga-text-secondary">{label}</div>
      <div className="text-sm font-semibold text-ga-text-primary">{value ?? '—'}</div>
    </div>
  );
}
