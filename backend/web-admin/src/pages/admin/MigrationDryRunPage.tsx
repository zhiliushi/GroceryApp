import { useState } from 'react';
import {
  useMigrationDryRunV2User,
  useMigrationDryRunV2AllUsers,
} from '@/api/queries/useMigrationDryRunV2';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import { cn } from '@/utils/cn';

type Mode = 'user' | 'all';

export default function MigrationDryRunPage() {
  const [mode, setMode] = useState<Mode>('user');
  const [uidInput, setUidInput] = useState('');
  const [appliedUid, setAppliedUid] = useState<string | undefined>(undefined);

  const userQuery = useMigrationDryRunV2User(appliedUid, mode === 'user');
  const allQuery = useMigrationDryRunV2AllUsers(mode === 'all');

  const isLoading = mode === 'user' ? userQuery.isLoading : allQuery.isLoading;
  const isFetching = mode === 'user' ? userQuery.isFetching : allQuery.isFetching;
  const error = mode === 'user' ? userQuery.error : allQuery.error;

  function applyUid() {
    setMode('user');
    setAppliedUid(uidInput.trim() || undefined);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <PageHeader title="Migration v2 — Dry Run" icon="📋" />
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={uidInput}
            onChange={(e) => setUidInput(e.target.value)}
            placeholder="user_id (blank = self)"
            className="px-3 py-1.5 text-sm rounded bg-ga-bg-card border border-ga-border text-ga-text-primary"
          />
          <button onClick={applyUid} className="px-3 py-1.5 rounded bg-ga-accent text-white text-sm">
            Run for user
          </button>
          <button
            onClick={() => setMode('all')}
            className={cn(
              'px-3 py-1.5 rounded text-sm border',
              mode === 'all'
                ? 'bg-ga-accent text-white border-transparent'
                : 'bg-ga-bg-card text-ga-text-primary border-ga-border',
            )}
          >
            Run for all users
          </button>
        </div>
      </div>

      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-3 text-xs text-ga-text-secondary">
        Pass criterion: <span className="text-ga-text-primary">total_ambiguous_pct &lt; 5%</span>.
        Above that, triage ambiguities before running the live migration in Phase A.
      </div>

      {isLoading && <LoadingSpinner text="Computing dry-run…" />}
      {isFetching && !isLoading && <p className="text-xs text-ga-text-secondary">Refreshing…</p>}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
          Failed to load: {(error as Error).message}
        </div>
      )}

      {mode === 'user' && userQuery.data && <SingleUserReport data={userQuery.data} />}
      {mode === 'all' && allQuery.data && <AllUsersReport data={allQuery.data} />}
    </div>
  );
}

function SingleUserReport({
  data,
}: {
  data: import('@/types/api').MigrationDryRunReport;
}) {
  const passed = data.totals.pass_threshold_met;
  return (
    <div className="space-y-4">
      <p className="text-xs text-ga-text-secondary">
        User: <span className="font-mono">{data.user_id}</span>
        {data.user_tier && <> · Tier: <span className="text-ga-text-primary">{data.user_tier}</span></>}
        {' '}· Computed: {new Date(data.computed_at).toLocaleString()}
      </p>

      {/* Pass/fail banner */}
      <div
        className={cn(
          'border rounded-lg p-3 text-sm',
          passed
            ? 'bg-green-500/10 border-green-500/40 text-green-400'
            : 'bg-orange-500/10 border-orange-500/40 text-orange-400',
        )}
      >
        {passed ? '✓ ' : '⚠ '}
        Total ambiguous: <strong>{data.totals.total_ambiguous_pct}%</strong> (threshold:{' '}
        {data.totals.pass_threshold_pct}%) ·{' '}
        {data.totals.total_writes_predicted} predicted writes
      </div>

      {/* Catalog summary */}
      <Section title="Catalog rows">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Total" value={data.catalog.total} />
          <Stat label="→ global_linked" value={data.catalog.predicted_global_linked} tone="green" />
          <Stat
            label="→ user_custom (barcode rename)"
            value={data.catalog.predicted_user_custom_with_barcode}
            tone="amber"
          />
          <Stat
            label="→ user_custom (no barcode)"
            value={data.catalog.predicted_user_custom_no_barcode}
            tone="amber"
          />
        </div>
        <p className="mt-3 text-xs text-ga-text-secondary">
          Ambiguous: <strong>{data.catalog.ambiguous_count}</strong> ({data.catalog.ambiguous_pct}%)
        </p>
        {data.catalog.ambiguous.length > 0 && (
          <CatalogAmbiguousTable rows={data.catalog.ambiguous} />
        )}
      </Section>

      {/* Events summary */}
      <Section title="Purchase events">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Total events" value={data.events.total} />
          <Stat label="Logical purchases" value={data.events.logical_event_count} />
          <Stat label="Splits (children)" value={data.events.split_event_count} tone="amber" />
          <Stat label="No price" value={data.events.no_price_count} tone={data.events.no_price_count > 0 ? 'amber' : undefined} />
          <Stat label="Base unit inferred" value={data.events.base_unit_inferred_count} tone="green" />
          <Stat label="Base unit default ('unit')" value={data.events.base_unit_default_count} tone="amber" />
          <Stat label="Currency set" value={data.events.currency_set_count} />
          <Stat label="Currency defaulted" value={data.events.currency_default_count} tone={data.events.currency_default_count > 0 ? 'amber' : undefined} />
        </div>
        <p className="mt-3 text-xs text-ga-text-secondary">
          Currencies seen:{' '}
          {Object.keys(data.events.currencies_seen).length === 0
            ? '—'
            : Object.entries(data.events.currencies_seen)
                .map(([c, n]) => `${c} (${n})`)
                .join(', ')}
          {data.events.multi_currency_user && (
            <span className="ml-2 text-orange-400">⚠ multi-currency — needs FX in Phase B</span>
          )}
        </p>
        <p className="mt-1 text-xs text-ga-text-secondary">
          Ambiguous: <strong>{data.events.ambiguous_count}</strong> ({data.events.ambiguous_pct}%)
        </p>
        {data.events.ambiguous.length > 0 && <EventsAmbiguousTable rows={data.events.ambiguous} />}
      </Section>

      {/* User predicted */}
      <Section title="User document — predicted updates">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KV k="is_paid" v={String(data.user.predicted_is_paid)} />
          <KV k="currency_preference" v={data.user.predicted_currency_preference} />
          <KV
            k="catalog_quota_used / limit"
            v={`${data.user.predicted_catalog_quota_used} / ${data.user.predicted_catalog_quota_limit}`}
          />
          <KV
            k="store_quota_used / limit"
            v={`${data.user.predicted_store_quota_used} / ${data.user.predicted_store_quota_limit}`}
          />
          <KV k="schema_version" v={String(data.user.predicted_schema_version)} />
          <KV
            k="quota at/over limit?"
            v={data.user.quota_at_or_above_limit ? 'YES' : 'no'}
            tone={data.user.quota_at_or_above_limit ? 'red' : undefined}
          />
        </div>
      </Section>

      {/* Stores */}
      <Section title="Stores — auto-creation">
        <p className="text-xs text-ga-text-secondary">
          {data.stores.will_create_unknown_store
            ? `Will create "Unknown" store with use_count=${data.stores.auto_created_store_doc?.use_count}.`
            : 'No events → no store will be created.'}
        </p>
      </Section>

      {/* Sample diffs */}
      {(data.sample_diffs.catalog || data.sample_diffs.event) && (
        <Section title="Sample predicted diffs">
          {data.sample_diffs.catalog && (
            <details className="mb-2">
              <summary className="text-xs text-ga-text-primary cursor-pointer">Catalog row sample</summary>
              <pre className="text-xs bg-ga-bg-card border border-ga-border rounded p-2 mt-1 overflow-x-auto">
                {JSON.stringify(data.sample_diffs.catalog, null, 2)}
              </pre>
            </details>
          )}
          {data.sample_diffs.event && (
            <details>
              <summary className="text-xs text-ga-text-primary cursor-pointer">Event sample</summary>
              <pre className="text-xs bg-ga-bg-card border border-ga-border rounded p-2 mt-1 overflow-x-auto">
                {JSON.stringify(data.sample_diffs.event, null, 2)}
              </pre>
            </details>
          )}
        </Section>
      )}
    </div>
  );
}

function AllUsersReport({
  data,
}: {
  data: import('@/types/api').MigrationDryRunAllUsers;
}) {
  const a = data.aggregate;
  return (
    <div className="space-y-4">
      <p className="text-xs text-ga-text-secondary">
        Users: <strong>{data.user_count}</strong> · Computed:{' '}
        {new Date(data.computed_at).toLocaleString()}
      </p>

      <div
        className={cn(
          'border rounded-lg p-3 text-sm',
          a.pass_threshold_met
            ? 'bg-green-500/10 border-green-500/40 text-green-400'
            : 'bg-orange-500/10 border-orange-500/40 text-orange-400',
        )}
      >
        {a.pass_threshold_met ? '✓ ' : '⚠ '}
        Overall ambiguous: <strong>{a.overall_ambiguous_pct}%</strong> (threshold:{' '}
        {a.pass_threshold_pct}%)
      </div>

      <Section title="Aggregate predictions (all users)">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Catalog rows" value={a.catalog_total} />
          <Stat label="→ global_linked" value={a.catalog_global_linked} tone="green" />
          <Stat label="→ user_custom" value={a.catalog_user_custom} tone="amber" />
          <Stat label="Catalog ambiguous" value={a.catalog_ambiguous} tone={a.catalog_ambiguous > 0 ? 'amber' : undefined} />
          <Stat label="Events total" value={a.events_total} />
          <Stat label="Logical events" value={a.events_logical} />
          <Stat label="Split children" value={a.events_split} tone="amber" />
          <Stat label="Events ambiguous" value={a.events_ambiguous} tone={a.events_ambiguous > 0 ? 'amber' : undefined} />
          <Stat label="Base-unit inferred" value={a.base_unit_inferred} tone="green" />
          <Stat label="Base-unit default" value={a.base_unit_default} tone="amber" />
          <Stat
            label="Multi-currency users"
            value={a.multi_currency_users}
            tone={a.multi_currency_users > 0 ? 'amber' : undefined}
          />
          <Stat
            label="Over-quota users"
            value={a.over_quota_users}
            tone={a.over_quota_users > 0 ? 'red' : undefined}
          />
        </div>
      </Section>

      <Section title={`Per-user summary (${data.per_user.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-ga-text-secondary">
              <tr>
                <th className="text-left p-2">user_id</th>
                <th className="text-left p-2">tier</th>
                <th className="text-right p-2">catalog</th>
                <th className="text-right p-2">global / custom</th>
                <th className="text-right p-2">events</th>
                <th className="text-right p-2">logical / split</th>
                <th className="text-right p-2">ambig %</th>
                <th className="text-left p-2">flags</th>
              </tr>
            </thead>
            <tbody>
              {data.per_user.map((u) => (
                <tr key={u.user_id} className="border-t border-ga-border/50">
                  <td className="p-2 font-mono text-ga-text-primary">{u.user_id}</td>
                  <td className="p-2 text-ga-text-secondary">{u.user_tier ?? '—'}</td>
                  <td className="p-2 text-right tabular-nums">{u.catalog_total ?? '—'}</td>
                  <td className="p-2 text-right tabular-nums">
                    {u.catalog_global_linked ?? '—'} / {u.catalog_user_custom ?? '—'}
                  </td>
                  <td className="p-2 text-right tabular-nums">{u.events_total ?? '—'}</td>
                  <td className="p-2 text-right tabular-nums">
                    {u.events_logical ?? '—'} / {u.events_split ?? '—'}
                  </td>
                  <td
                    className={cn(
                      'p-2 text-right tabular-nums',
                      u.pass_threshold_met === false && 'text-orange-400 font-medium',
                    )}
                  >
                    {u.ambiguous_pct ?? '—'}
                  </td>
                  <td className="p-2 text-ga-text-secondary">
                    {[
                      u.multi_currency && 'multi-currency',
                      u.quota_at_or_above_limit && 'quota-hit',
                      u.error && `ERROR: ${u.error}`,
                    ]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
      <h3 className="text-sm font-medium text-ga-text-primary mb-3">{title}</h3>
      {children}
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

function KV({
  k,
  v,
  tone,
}: {
  k: string;
  v: string;
  tone?: 'red';
}) {
  return (
    <div
      className={cn(
        'border rounded p-2 text-xs',
        tone === 'red' ? 'border-red-500/40 text-red-400' : 'border-ga-border',
      )}
    >
      <div className="text-[10px] text-ga-text-secondary uppercase tracking-wide">{k}</div>
      <div className="font-mono mt-0.5 text-ga-text-primary">{v}</div>
    </div>
  );
}

function CatalogAmbiguousTable({
  rows,
}: {
  rows: import('@/types/api').MigrationDryRunCatalogPrediction[];
}) {
  return (
    <div className="overflow-x-auto mt-3">
      <table className="w-full text-xs">
        <thead className="text-ga-text-secondary">
          <tr>
            <th className="text-left p-2">name_norm</th>
            <th className="text-left p-2">display</th>
            <th className="text-left p-2">barcode</th>
            <th className="text-left p-2">→ mode</th>
            <th className="text-left p-2">flags</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name_norm} className="border-t border-ga-border/50">
              <td className="p-2 font-mono text-ga-text-primary">{r.name_norm}</td>
              <td className="p-2 text-ga-text-primary">{r.display_name ?? '—'}</td>
              <td className="p-2 font-mono text-ga-text-secondary">{r.barcode ?? '—'}</td>
              <td className="p-2 text-ga-text-secondary">{r.predicted_catalog_mode}</td>
              <td className="p-2 text-orange-400">{r.ambiguity_flags.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EventsAmbiguousTable({
  rows,
}: {
  rows: import('@/types/api').MigrationDryRunEventPrediction[];
}) {
  return (
    <div className="overflow-x-auto mt-3">
      <table className="w-full text-xs">
        <thead className="text-ga-text-secondary">
          <tr>
            <th className="text-left p-2">event_id</th>
            <th className="text-left p-2">catalog</th>
            <th className="text-left p-2">unit</th>
            <th className="text-left p-2">currency</th>
            <th className="text-left p-2">flags</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.event_id} className="border-t border-ga-border/50">
              <td className="p-2 font-mono text-ga-text-secondary">{r.event_id}</td>
              <td className="p-2 text-ga-text-primary">{r.catalog_display ?? r.catalog_name_norm ?? '—'}</td>
              <td className="p-2 text-ga-text-secondary">
                {r.predicted_base_unit_label}
                {r.base_unit_inferred && <span className="ml-1 text-green-400">✓</span>}
              </td>
              <td className="p-2 text-ga-text-secondary">{r.predicted_currency}</td>
              <td className="p-2 text-orange-400">{r.ambiguity_flags.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
