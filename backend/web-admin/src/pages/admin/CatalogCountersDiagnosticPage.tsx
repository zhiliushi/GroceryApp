import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCatalogCounterDiagnostics } from '@/api/queries/useCatalogCounterDiagnostics';
import { qk } from '@/api/queries/keys';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import type { CatalogCounterRow } from '@/types/api';
import { cn } from '@/utils/cn';

type SortKey = 'inflation' | 'delta_total' | 'stored_total' | 'logical' | 'recent';

export default function CatalogCountersDiagnosticPage() {
  const qc = useQueryClient();
  const [uidInput, setUidInput] = useState('');
  const [appliedUid, setAppliedUid] = useState<string | undefined>(undefined);
  const [sortKey, setSortKey] = useState<SortKey>('inflation');
  const { data, isLoading, isFetching, error, refetch } =
    useCatalogCounterDiagnostics(appliedUid);

  function handleApplyUid() {
    const next = uidInput.trim() || undefined;
    setAppliedUid(next);
    qc.invalidateQueries({ queryKey: qk.catalogCounterDiagnostics(next) });
  }

  if (isLoading) return <LoadingSpinner text="Computing diagnostic…" />;
  if (error)
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
          Failed to load: {(error as Error).message}
        </div>
      </div>
    );
  if (!data) return null;

  const sortedRows = [...data.rows].sort(rowSorter(sortKey));
  const computedAt = new Date(data.computed_at).toLocaleString();

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <PageHeader title="Catalog Counter Diagnostic" icon="🩺" />
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={uidInput}
            onChange={(e) => setUidInput(e.target.value)}
            placeholder="user_id (blank = self)"
            className="px-3 py-1.5 text-sm rounded bg-ga-bg-card border border-ga-border text-ga-text-primary"
          />
          <button
            onClick={handleApplyUid}
            className="px-3 py-1.5 rounded bg-ga-accent text-white text-sm"
          >
            Run
          </button>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-3 py-1.5 rounded bg-ga-bg-card border border-ga-border text-ga-text-primary text-sm disabled:opacity-60"
          >
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      <p className="text-xs text-ga-text-secondary">
        User: <span className="font-mono">{data.user_id}</span> · Computed: {computedAt}
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="Catalog rows" value={data.total_catalog_rows} />
        <SummaryCard label="Total events" value={data.total_events} />
        <SummaryCard
          label="Drift (real bug)"
          value={data.divergent_count}
          tone={data.divergent_count > 0 ? 'red' : 'green'}
        />
        <SummaryCard
          label="Inflation (split-driven)"
          value={data.inflated_count}
          tone={data.inflated_count > 0 ? 'amber' : 'green'}
        />
        <SummaryCard
          label="Orphan events"
          value={data.orphan_event_count}
          tone={data.orphan_event_count > 0 ? 'red' : 'green'}
        />
      </div>

      {/* What the metrics mean */}
      <details className="bg-ga-bg-card border border-ga-border rounded-lg p-3 text-xs text-ga-text-secondary">
        <summary className="cursor-pointer text-ga-text-primary font-medium">
          What do these metrics mean?
        </summary>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>
            <span className="text-ga-text-primary">delta_total</span> = stored counter
            minus recomputed event count. Non-zero = real storage drift bug; the
            stored counter has fallen out of sync with the underlying events.
          </li>
          <li>
            <span className="text-ga-text-primary">inflation</span> = stored counter
            minus logical purchase count (events with no <code>split_from_event_id</code>).
            Positive = "numbering not tally" symptom — Phase 1-4 splits inflate the
            count beyond what the user mentally tracks as "purchases."
          </li>
          <li>
            <span className="text-ga-text-primary">Orphans</span> = events whose
            catalog_name_norm doesn't have a matching catalog row. Should be 0.
          </li>
        </ul>
      </details>

      {/* Top inflated */}
      {data.top_inflated.length > 0 && (
        <Section title={`Top ${data.top_inflated.length} most inflated rows`}>
          <CounterTable rows={data.top_inflated} />
        </Section>
      )}

      {/* Top divergent (real bugs) */}
      {data.top_divergent.length > 0 && (
        <Section title={`Top ${data.top_divergent.length} drifted rows (real bug)`} tone="red">
          <CounterTable rows={data.top_divergent} />
        </Section>
      )}

      {/* Orphan events */}
      {data.orphan_events.length > 0 && (
        <Section title={`Orphan events (showing ${data.orphan_events.length})`} tone="red">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-ga-text-secondary">
                <tr>
                  <th className="text-left p-2">name_norm</th>
                  <th className="text-left p-2">event_id</th>
                  <th className="text-left p-2">display</th>
                  <th className="text-left p-2">barcode</th>
                  <th className="text-left p-2">status</th>
                  <th className="text-left p-2">date_bought</th>
                </tr>
              </thead>
              <tbody>
                {data.orphan_events.map((o) => (
                  <tr key={o.event_id} className="border-t border-ga-border/50">
                    <td className="p-2 font-mono text-ga-text-primary">{o.catalog_name_norm}</td>
                    <td className="p-2 font-mono text-ga-text-secondary">{o.event_id}</td>
                    <td className="p-2 text-ga-text-primary">{o.catalog_display ?? '—'}</td>
                    <td className="p-2 font-mono text-ga-text-secondary">{o.barcode ?? '—'}</td>
                    <td className="p-2 text-ga-text-secondary">{o.status ?? '—'}</td>
                    <td className="p-2 text-ga-text-secondary">{o.date_bought ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Full table */}
      <Section title={`All catalog rows (${data.rows.length})`}>
        <div className="flex items-center gap-2 mb-2 text-xs">
          <span className="text-ga-text-secondary">Sort:</span>
          {(['inflation', 'delta_total', 'stored_total', 'logical', 'recent'] as SortKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setSortKey(k)}
              className={cn(
                'px-2 py-1 rounded',
                sortKey === k
                  ? 'bg-ga-accent text-white'
                  : 'bg-ga-bg-card border border-ga-border text-ga-text-secondary',
              )}
            >
              {k}
            </button>
          ))}
        </div>
        <CounterTable rows={sortedRows} />
      </Section>
    </div>
  );
}

function rowSorter(key: SortKey) {
  return (a: CatalogCounterRow, b: CatalogCounterRow) => {
    switch (key) {
      case 'inflation':
        return b.inflation - a.inflation;
      case 'delta_total':
        return Math.abs(b.delta_total) - Math.abs(a.delta_total);
      case 'stored_total':
        return b.stored_total_purchases - a.stored_total_purchases;
      case 'logical':
        return b.recomputed_logical_purchase_count - a.recomputed_logical_purchase_count;
      case 'recent':
        return (b.last_event_at ?? '').localeCompare(a.last_event_at ?? '');
    }
  };
}

function SummaryCard({
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
    <div className={cn('bg-ga-bg-card border rounded-lg p-3', toneClass)}>
      <div className="text-xs text-ga-text-secondary">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: 'red';
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'bg-ga-bg-card border rounded-lg p-4',
        tone === 'red' ? 'border-red-500/40' : 'border-ga-border',
      )}
    >
      <h3 className="text-sm font-medium text-ga-text-primary mb-3">{title}</h3>
      {children}
    </div>
  );
}

function CounterTable({ rows }: { rows: CatalogCounterRow[] }) {
  if (rows.length === 0) {
    return <p className="text-xs text-ga-text-secondary">No rows.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-ga-text-secondary">
          <tr>
            <th className="text-left p-2">display_name</th>
            <th className="text-left p-2">barcode</th>
            <th className="text-right p-2">stored</th>
            <th className="text-right p-2">events</th>
            <th className="text-right p-2">logical</th>
            <th className="text-right p-2">Δ total</th>
            <th className="text-right p-2">inflation</th>
            <th className="text-right p-2">splits</th>
            <th className="text-right p-2">stored / recomp active</th>
            <th className="text-left p-2">last event</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.name_norm}
              className={cn(
                'border-t border-ga-border/50',
                r.delta_total !== 0 && 'bg-red-500/5',
                r.delta_total === 0 && r.inflation > 0 && 'bg-orange-500/5',
              )}
            >
              <td className="p-2 text-ga-text-primary">{r.display_name}</td>
              <td className="p-2 font-mono text-ga-text-secondary">{r.barcode ?? '—'}</td>
              <td className="p-2 text-right tabular-nums">{r.stored_total_purchases}</td>
              <td className="p-2 text-right tabular-nums">{r.recomputed_total_event_count}</td>
              <td className="p-2 text-right tabular-nums">{r.recomputed_logical_purchase_count}</td>
              <td
                className={cn(
                  'p-2 text-right tabular-nums',
                  r.delta_total !== 0 ? 'text-red-400 font-medium' : 'text-ga-text-secondary',
                )}
              >
                {r.delta_total > 0 ? `+${r.delta_total}` : r.delta_total}
              </td>
              <td
                className={cn(
                  'p-2 text-right tabular-nums',
                  r.inflation > 0 ? 'text-orange-400 font-medium' : 'text-ga-text-secondary',
                )}
              >
                {r.inflation > 0 ? `+${r.inflation}` : r.inflation}
              </td>
              <td className="p-2 text-right tabular-nums text-ga-text-secondary">
                {r.split_event_count}
              </td>
              <td className="p-2 text-right tabular-nums">
                {r.stored_active_purchases} / {r.recomputed_active}
              </td>
              <td className="p-2 text-ga-text-secondary">
                {r.last_event_at ? new Date(r.last_event_at).toLocaleDateString() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
