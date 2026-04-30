import { useState } from 'react';
import {
  useMigrationAuditLog,
  useMigrationAuditLogDetail,
  useRunMigrationV2,
} from '@/api/queries/useMigrationV2';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import { cn } from '@/utils/cn';

const REQUIRED_CONFIRM_PHRASE = 'RUN MIGRATION';

export default function AdminMigrationPage() {
  const log = useMigrationAuditLog();
  const runMutation = useRunMigrationV2();

  const [exportDone, setExportDone] = useState(false);
  const [dryRunReviewed, setDryRunReviewed] = useState(false);
  const [emulatorRehearsal, setEmulatorRehearsal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>(undefined);
  const detail = useMigrationAuditLogDetail(selectedRunId);

  const allChecked = exportDone && dryRunReviewed && emulatorRehearsal;
  const confirmMatches = confirmText.trim() === REQUIRED_CONFIRM_PHRASE;
  const canFire = allChecked && confirmMatches && !runMutation.isPending;

  function fire() {
    if (!canFire) return;
    runMutation.mutate(undefined, {
      onSettled: () => {
        setShowConfirmModal(false);
        setConfirmText('');
        setExportDone(false);
        setDryRunReviewed(false);
        setEmulatorRehearsal(false);
      },
    });
  }

  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Migration v2 — Run" icon="⚙️" />

      <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-4 text-sm">
        <p className="text-red-400 font-medium">⚠ Production write — irreversible without restore</p>
        <p className="text-ga-text-secondary mt-1">
          This writes <code>schema_version=2</code> + new fields to every catalog row, purchase
          event, user doc, and creates a per-user "Unknown" store. Idempotent on re-run, but
          rollback requires Firestore import from a pre-run export.
        </p>
      </div>

      {/* Pre-flight checklist */}
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-medium text-ga-text-primary">Pre-flight checklist</h3>
        <Check
          checked={exportDone}
          onChange={setExportDone}
          label="Firestore export to GCS taken"
          hint="`gcloud firestore export gs://...` — this is your rollback artifact"
        />
        <Check
          checked={dryRunReviewed}
          onChange={setDryRunReviewed}
          label="Phase 0 dry-run reviewed (ambiguous_pct < 5%)"
          hint="Open the Migration Dry-Run page first; verify the all-users aggregate passes the threshold."
        />
        <Check
          checked={emulatorRehearsal}
          onChange={setEmulatorRehearsal}
          label="Emulator dress-rehearsal completed on prod data snapshot"
          hint="Restore the export to a local emulator, run migration, eyeball-diff a sample of 20 docs."
        />
      </div>

      {/* Fire control */}
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
        <button
          onClick={() => setShowConfirmModal(true)}
          disabled={!allChecked || runMutation.isPending}
          className={cn(
            'px-5 py-2 rounded text-white text-sm font-medium',
            !allChecked || runMutation.isPending
              ? 'bg-gray-500 cursor-not-allowed opacity-60'
              : 'bg-red-600 hover:bg-red-700',
          )}
        >
          {runMutation.isPending ? 'Migration running…' : 'Fire migration'}
        </button>
        {!allChecked && (
          <p className="mt-2 text-xs text-ga-text-secondary">
            Complete the checklist above to enable the button.
          </p>
        )}
      </div>

      {/* Last run result inline */}
      {runMutation.data && (
        <div className="bg-ga-bg-card border border-green-500/40 rounded-lg p-4">
          <h3 className="text-sm font-medium text-green-400">
            ✓ Migration complete — run_id: <span className="font-mono">{runMutation.data.run_id}</span>
          </h3>
          <RunSummaryStats run={runMutation.data} />
        </div>
      )}
      {runMutation.error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          Failed: {(runMutation.error as Error).message}
        </div>
      )}

      {/* Audit log history */}
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-ga-text-primary mb-3">Audit log (recent runs)</h3>
        {log.isLoading && <LoadingSpinner text="Loading…" />}
        {log.error && (
          <p className="text-red-400 text-sm">Failed: {(log.error as Error).message}</p>
        )}
        {log.data && log.data.length === 0 && (
          <p className="text-xs text-ga-text-secondary">No runs yet.</p>
        )}
        {log.data && log.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-ga-text-secondary">
                <tr>
                  <th className="text-left p-2">run_id</th>
                  <th className="text-left p-2">started</th>
                  <th className="text-left p-2">status</th>
                  <th className="text-right p-2">users</th>
                  <th className="text-right p-2">cat rows</th>
                  <th className="text-right p-2">events</th>
                  <th className="text-right p-2">errors</th>
                  <th className="text-left p-2">actions</th>
                </tr>
              </thead>
              <tbody>
                {log.data.map((r) => (
                  <tr key={r.run_id} className="border-t border-ga-border/50">
                    <td className="p-2 font-mono text-ga-text-primary">{r.run_id}</td>
                    <td className="p-2 text-ga-text-secondary">
                      {new Date(r.started_at).toLocaleString()}
                    </td>
                    <td
                      className={cn(
                        'p-2',
                        r.status === 'complete'
                          ? 'text-green-400'
                          : r.status === 'complete_with_errors'
                            ? 'text-orange-400'
                            : 'text-ga-text-secondary',
                      )}
                    >
                      {r.status}
                    </td>
                    <td className="p-2 text-right tabular-nums">{r.user_count}</td>
                    <td className="p-2 text-right tabular-nums">{r.catalog_rows_processed}</td>
                    <td className="p-2 text-right tabular-nums">{r.events_processed}</td>
                    <td
                      className={cn(
                        'p-2 text-right tabular-nums',
                        (r.errors?.length ?? 0) > 0 && 'text-red-400 font-medium',
                      )}
                    >
                      {r.errors?.length ?? 0}
                    </td>
                    <td className="p-2">
                      <button
                        onClick={() =>
                          setSelectedRunId(selectedRunId === r.run_id ? undefined : r.run_id)
                        }
                        className="text-ga-accent hover:underline"
                      >
                        {selectedRunId === r.run_id ? 'Hide' : 'Detail'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {detail.data && (
          <details open className="mt-4">
            <summary className="cursor-pointer text-sm text-ga-text-primary">
              Detail — {detail.data.run_id}
            </summary>
            <RunSummaryStats run={detail.data} />
            {detail.data.errors && detail.data.errors.length > 0 && (
              <div className="mt-3">
                <h4 className="text-xs text-red-400 font-medium mb-1">Errors</h4>
                <pre className="text-xs bg-ga-bg-card border border-red-500/30 rounded p-2 overflow-x-auto">
                  {JSON.stringify(detail.data.errors, null, 2)}
                </pre>
              </div>
            )}
            {detail.data.per_user && detail.data.per_user.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-ga-text-secondary">
                  Per-user stats ({detail.data.per_user.length})
                </summary>
                <pre className="text-xs bg-ga-bg-card border border-ga-border rounded p-2 mt-1 overflow-x-auto max-h-96">
                  {JSON.stringify(detail.data.per_user, null, 2)}
                </pre>
              </details>
            )}
          </details>
        )}
      </div>

      {/* Confirmation modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-ga-bg-card border border-red-500/40 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-red-400 mb-2">Confirm production migration</h3>
            <p className="text-sm text-ga-text-secondary mb-4">
              Type <strong className="font-mono text-ga-text-primary">{REQUIRED_CONFIRM_PHRASE}</strong>{' '}
              to fire the migration. This writes to every user's data.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={REQUIRED_CONFIRM_PHRASE}
              autoFocus
              className="w-full px-3 py-2 rounded bg-ga-bg-card border border-ga-border text-ga-text-primary font-mono text-sm"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmText('');
                }}
                className="px-3 py-1.5 rounded bg-ga-bg-card border border-ga-border text-ga-text-primary text-sm"
              >
                Cancel
              </button>
              <button
                onClick={fire}
                disabled={!canFire}
                className={cn(
                  'px-3 py-1.5 rounded text-white text-sm',
                  canFire
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-gray-500 cursor-not-allowed opacity-60',
                )}
              >
                Fire
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Check({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      <div className="flex-1">
        <div className="text-sm text-ga-text-primary">{label}</div>
        {hint && <div className="text-xs text-ga-text-secondary mt-0.5">{hint}</div>}
      </div>
    </label>
  );
}

function RunSummaryStats({
  run,
}: {
  run: import('@/types/api').MigrationV2RunSummary;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
      <Stat label="Users" value={run.user_count} />
      <Stat label="Catalog processed" value={run.catalog_rows_processed} />
      <Stat label="→ global_linked" value={run.catalog_rows_global_linked} tone="green" />
      <Stat label="→ user_custom" value={run.catalog_rows_user_custom} tone="amber" />
      <Stat label="Catalog skipped (already v2)" value={run.catalog_rows_skipped} />
      <Stat label="Events processed" value={run.events_processed} />
      <Stat label="Unit inferred" value={run.events_with_unit_label_inferred} tone="green" />
      <Stat label="Unit default" value={run.events_with_unit_label_default} tone="amber" />
      <Stat label="Events skipped (already v2)" value={run.events_skipped} />
      <Stat label="User docs updated" value={run.user_docs_updated} />
      <Stat label="Stores created" value={run.stores_created} />
      <Stat
        label="Errors"
        value={run.errors?.length ?? 0}
        tone={(run.errors?.length ?? 0) > 0 ? 'red' : 'green'}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'red' | 'amber' | 'green';
}) {
  const toneClass =
    tone === 'red'
      ? 'border-red-500/40 text-red-400'
      : tone === 'amber'
        ? 'border-orange-500/40 text-orange-400'
        : tone === 'green'
          ? 'border-green-500/40 text-green-400'
          : 'border-ga-border text-ga-text-primary';
  return (
    <div className={cn('bg-ga-bg-card border rounded p-2', toneClass)}>
      <div className="text-[10px] text-ga-text-secondary uppercase tracking-wide">{label}</div>
      <div className="text-lg font-semibold mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}
