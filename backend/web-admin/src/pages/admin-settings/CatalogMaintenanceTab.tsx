import { useState } from 'react';
import { apiClient } from '@/api/client';
import { toast } from 'sonner';

/**
 * Admin tab for v3 catalog maintenance — orphan cleanup + ref reconcile.
 * Both operations default to dry_run=true so admin can preview before
 * committing destructive actions.
 *
 * - Orphan cleanup: finds user_custom catalog rows with active_purchases==0
 *   AND transit_ref_count<=0. Eligible for GC; missed by eager-on-delete
 *   path due to crashes/race conditions/pre-v3 leftovers.
 * - Ref reconcile: per-user; recounts transit_ref_count from actual
 *   shopping-list refs, fixes drift.
 */

interface OrphanCandidate {
  id: string;
  user_id: string;
  name_norm: string;
  display_name: string;
  last_purchased_at: string | null;
  transit_ref_count: number;
}

interface OrphanCleanupResult {
  dry_run: boolean;
  candidates_count: number;
  deleted_count: number;
  sample: OrphanCandidate[];
}

interface ReconcileDrift {
  name_norm: string;
  display_name: string;
  stored: number;
  actual: number;
  delta: number;
}

interface ReconcileResult {
  dry_run: boolean;
  rows_checked: number;
  drift_count: number;
  fixed_count: number;
  sample: ReconcileDrift[];
}

export default function CatalogMaintenanceTab() {
  // Orphan cleanup state
  const [scopeUser, setScopeUser] = useState('');
  const [cleanupResult, setCleanupResult] = useState<OrphanCleanupResult | null>(null);
  const [cleanupBusy, setCleanupBusy] = useState(false);

  // Reconcile state
  const [reconcileUser, setReconcileUser] = useState('');
  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null);
  const [reconcileBusy, setReconcileBusy] = useState(false);

  async function runCleanup(dryRun: boolean) {
    setCleanupBusy(true);
    try {
      const r = await apiClient.post<OrphanCleanupResult>(
        '/api/admin/catalog/cleanup-orphans',
        {
          dry_run: dryRun,
          user_id: scopeUser.trim() || undefined,
        },
      );
      setCleanupResult(r.data);
      toast.success(
        dryRun
          ? `Preview: ${r.data.candidates_count} candidate${r.data.candidates_count === 1 ? '' : 's'}`
          : `Deleted ${r.data.deleted_count} orphan${r.data.deleted_count === 1 ? '' : 's'}`,
      );
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || 'Cleanup failed');
    } finally {
      setCleanupBusy(false);
    }
  }

  async function runReconcile(dryRun: boolean) {
    if (!reconcileUser.trim()) {
      toast.error('User ID required');
      return;
    }
    setReconcileBusy(true);
    try {
      const r = await apiClient.post<ReconcileResult>(
        '/api/admin/catalog/reconcile-refs',
        {
          user_id: reconcileUser.trim(),
          dry_run: dryRun,
        },
      );
      setReconcileResult(r.data);
      toast.success(
        dryRun
          ? `Drift report: ${r.data.drift_count} of ${r.data.rows_checked} rows`
          : `Fixed ${r.data.fixed_count} of ${r.data.drift_count} drifted rows`,
      );
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || 'Reconcile failed');
    } finally {
      setReconcileBusy(false);
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Card 1: Orphan cleanup */}
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5">
        <h2 className="text-sm font-semibold text-ga-text-primary mb-1">
          Catalog orphan cleanup
        </h2>
        <p className="text-xs text-ga-text-secondary mb-3">
          Deletes user_custom catalog rows with no active purchases and no
          shopping-list refs. The eager-on-delete path catches most cases
          live; this is the safety net for crashes / races / pre-v3
          leftovers. Always preview first.
        </p>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="Scope to user_id (optional)"
            value={scopeUser}
            onChange={(e) => setScopeUser(e.target.value)}
            className="flex-1 px-3 py-1.5 bg-ga-bg-primary border border-ga-border rounded-md text-sm text-ga-text-primary focus:outline-none focus:border-ga-accent"
          />
          <button
            onClick={() => runCleanup(true)}
            disabled={cleanupBusy}
            className="px-3 py-1.5 text-sm border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover disabled:opacity-50"
          >
            {cleanupBusy ? '…' : 'Preview (dry-run)'}
          </button>
          <button
            onClick={() => {
              if (
                window.confirm(
                  'Delete orphan catalog rows for real? This cannot be undone.',
                )
              )
                runCleanup(false);
            }}
            disabled={cleanupBusy || !cleanupResult || cleanupResult.candidates_count === 0}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {cleanupBusy ? '…' : 'Delete'}
          </button>
        </div>

        {cleanupResult && (
          <div className="text-xs">
            <div className="mb-2 text-ga-text-secondary">
              {cleanupResult.dry_run
                ? `Dry-run found ${cleanupResult.candidates_count} candidate${cleanupResult.candidates_count === 1 ? '' : 's'}.`
                : `Deleted ${cleanupResult.deleted_count} of ${cleanupResult.candidates_count} candidate${cleanupResult.candidates_count === 1 ? '' : 's'}.`}
            </div>
            {cleanupResult.sample.length > 0 && (
              <table className="w-full text-xs border border-ga-border rounded">
                <thead className="bg-ga-bg-hover/40 text-ga-text-secondary">
                  <tr>
                    <th className="text-left p-1.5">User</th>
                    <th className="text-left p-1.5">Name</th>
                    <th className="text-left p-1.5">Last bought</th>
                    <th className="text-right p-1.5">Refs</th>
                  </tr>
                </thead>
                <tbody>
                  {cleanupResult.sample.map((c) => (
                    <tr key={c.id} className="border-t border-ga-border/60">
                      <td className="p-1.5 font-mono text-ga-text-secondary">
                        {c.user_id?.slice(0, 8) || '—'}
                      </td>
                      <td className="p-1.5 text-ga-text-primary">{c.display_name}</td>
                      <td className="p-1.5 text-ga-text-secondary">
                        {c.last_purchased_at || 'never'}
                      </td>
                      <td className="p-1.5 text-right tabular-nums">
                        {c.transit_ref_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Card 2: Ref reconcile */}
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5">
        <h2 className="text-sm font-semibold text-ga-text-primary mb-1">
          Transit ref counter reconcile
        </h2>
        <p className="text-xs text-ga-text-secondary mb-3">
          Per-user. Walks shopping_lists, recounts how many primaries +
          alternatives reference each catalog row, and fixes drift in
          <code className="px-1">transit_ref_count</code>. Use when the
          eager GC paths have left a row stuck (counter never reached 0).
        </p>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="Target user_id (required)"
            value={reconcileUser}
            onChange={(e) => setReconcileUser(e.target.value)}
            className="flex-1 px-3 py-1.5 bg-ga-bg-primary border border-ga-border rounded-md text-sm text-ga-text-primary focus:outline-none focus:border-ga-accent"
          />
          <button
            onClick={() => runReconcile(true)}
            disabled={reconcileBusy || !reconcileUser.trim()}
            className="px-3 py-1.5 text-sm border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover disabled:opacity-50"
          >
            {reconcileBusy ? '…' : 'Preview drift'}
          </button>
          <button
            onClick={() => {
              if (window.confirm('Apply reconcile fixes for real?'))
                runReconcile(false);
            }}
            disabled={
              reconcileBusy ||
              !reconcileResult ||
              reconcileResult.drift_count === 0
            }
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-ga-accent text-white hover:bg-ga-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {reconcileBusy ? '…' : 'Apply fixes'}
          </button>
        </div>

        {reconcileResult && (
          <div className="text-xs">
            <div className="mb-2 text-ga-text-secondary">
              {reconcileResult.dry_run
                ? `Checked ${reconcileResult.rows_checked} rows · ${reconcileResult.drift_count} drifted.`
                : `Fixed ${reconcileResult.fixed_count} of ${reconcileResult.drift_count} drifted rows.`}
            </div>
            {reconcileResult.sample.length > 0 && (
              <table className="w-full text-xs border border-ga-border rounded">
                <thead className="bg-ga-bg-hover/40 text-ga-text-secondary">
                  <tr>
                    <th className="text-left p-1.5">Name</th>
                    <th className="text-right p-1.5">Stored</th>
                    <th className="text-right p-1.5">Actual</th>
                    <th className="text-right p-1.5">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {reconcileResult.sample.map((d) => (
                    <tr key={d.name_norm} className="border-t border-ga-border/60">
                      <td className="p-1.5 text-ga-text-primary">{d.display_name}</td>
                      <td className="p-1.5 text-right tabular-nums">{d.stored}</td>
                      <td className="p-1.5 text-right tabular-nums">{d.actual}</td>
                      <td
                        className={`p-1.5 text-right tabular-nums ${
                          d.delta < 0
                            ? 'text-red-400'
                            : d.delta > 0
                              ? 'text-orange-400'
                              : 'text-ga-text-secondary'
                        }`}
                      >
                        {d.delta > 0 ? `+${d.delta}` : d.delta}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
