import { useState } from 'react';
import {
  useAddRevenue,
  useBusinessMetrics,
  useDeleteRevenue,
  useRevenueEntries,
} from '@/api/queries/useBusinessMetrics';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import type { BusinessMetricsSignal } from '@/types/api';
import { cn } from '@/utils/cn';

export default function BusinessMetricsPage() {
  const { data, isLoading, error, refetch, isFetching } = useBusinessMetrics();
  const [showRevenueForm, setShowRevenueForm] = useState(false);

  if (isLoading) return <LoadingSpinner text="Aggregating metrics across all users…" />;
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
          Failed to load: {(error as Error).message}
        </div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <PageHeader
        title="Business Metrics"
        icon="📊"
        subtitle={
          <>
            Market validation dashboard. Read{' '}
            <a href="https://github.com/zhiliushi/GroceryApp/blob/main/docs/MARKET_VALIDATION.md" target="_blank" rel="noreferrer" className="underline text-ga-accent">
              MARKET_VALIDATION.md
            </a>{' '}
            for thresholds + weekly ritual.
          </>
        }
      />
      <div className="flex justify-between items-center text-xs text-ga-text-secondary">
        <span>Last computed: {new Date(data.computed_at).toLocaleString()}</span>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="px-3 py-1 rounded border border-ga-border hover:bg-ga-bg-hover disabled:opacity-50"
        >
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <SignalsCard signals={data.signals} />

      <RevenueCard
        revenue={data.revenue}
        showForm={showRevenueForm}
        onToggleForm={() => setShowRevenueForm((s) => !s)}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <FunnelCard data={data} />
        <EngagementCard data={data} />
        <RetentionCard data={data} />
        <HealthCard data={data} />
        <SignupsByWeekCard data={data} />
        <RevenueByMonthCard data={data} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Signals — auto-generated alerts at the top
// ---------------------------------------------------------------------------

function SignalsCard({ signals }: { signals: BusinessMetricsSignal[] }) {
  if (!signals?.length) return null;
  return (
    <div className="space-y-2">
      {signals.map((s, i) => (
        <SignalRow key={i} signal={s} />
      ))}
    </div>
  );
}

function SignalRow({ signal }: { signal: BusinessMetricsSignal }) {
  const tone =
    signal.kind === 'warn'
      ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
      : signal.kind === 'good'
      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
      : 'bg-sky-500/10 border-sky-500/30 text-sky-200';
  const icon = signal.kind === 'warn' ? '⚠️' : signal.kind === 'good' ? '✅' : '💡';
  return (
    <div className={cn('border rounded-lg p-3 flex items-start gap-3', tone)}>
      <span className="text-lg leading-none">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{signal.title}</div>
        <div className="text-xs mt-0.5 opacity-80">{signal.text}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Revenue — goal progress + manual entry
// ---------------------------------------------------------------------------

function RevenueCard({
  revenue,
  showForm,
  onToggleForm,
}: {
  revenue: import('@/types/api').BusinessMetrics['revenue'];
  showForm: boolean;
  onToggleForm: () => void;
}) {
  const pct = Math.round(revenue.pct_to_goal * 100);
  const tone =
    pct >= 100
      ? 'bg-emerald-500'
      : pct >= 50
      ? 'bg-sky-500'
      : pct > 0
      ? 'bg-amber-500'
      : 'bg-ga-bg-hover';

  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-semibold">$200 USD goal</h2>
        <button
          type="button"
          onClick={onToggleForm}
          className="text-xs px-2 py-1 rounded border border-ga-border hover:bg-ga-bg-hover"
        >
          {showForm ? 'Close' : '+ Log revenue'}
        </button>
      </div>
      <div className="flex justify-between text-xs text-ga-text-secondary mb-1">
        <span>
          ${revenue.received_usd.toFixed(2)} of ${revenue.goal_usd.toFixed(2)} USD
        </span>
        <span>
          MYR {revenue.received_myr.toFixed(2)} of {revenue.goal_myr.toFixed(2)}
        </span>
      </div>
      <div className="h-3 bg-ga-bg-hover rounded-full overflow-hidden">
        <div className={cn('h-full transition-all', tone)} style={{ width: `${pct}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
        <Stat label="Last 30d" value={`$${revenue.last_30d_usd.toFixed(2)}`} />
        <Stat
          label="Forecast to goal"
          value={
            revenue.forecast_months_to_goal !== null
              ? `${revenue.forecast_months_to_goal} mo`
              : '—'
          }
        />
        <Stat
          label="Days since last $"
          value={revenue.days_since_last_entry !== null ? `${revenue.days_since_last_entry}d` : '—'}
        />
      </div>
      {showForm && <RevenueForm onClose={onToggleForm} />}
      <RevenueLog />
    </div>
  );
}

function RevenueForm({ onClose }: { onClose: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [source, setSource] = useState('ko-fi');
  const [amountUsd, setAmountUsd] = useState('');
  const [amountMyr, setAmountMyr] = useState('');
  const [note, setNote] = useState('');
  const add = useAddRevenue();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amountUsd && !amountMyr) return;
    add.mutate(
      {
        date,
        source: source.trim() || 'manual',
        amount_usd: amountUsd ? Number(amountUsd) : undefined,
        amount_myr: amountMyr ? Number(amountMyr) : undefined,
        note: note.trim(),
      },
      {
        onSuccess: () => {
          setAmountUsd('');
          setAmountMyr('');
          setNote('');
          onClose();
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 p-3 border border-ga-border rounded-lg space-y-2 bg-ga-bg-hover/40">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
        </Field>
        <Field label="Source">
          <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="ko-fi / bmac / stripe / transfer" required className={inputClass} />
        </Field>
        <Field label="Amount USD (or MYR below)">
          <input type="number" step="0.01" min="0" value={amountUsd} onChange={(e) => setAmountUsd(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Amount MYR">
          <input type="number" step="0.01" min="0" value={amountMyr} onChange={(e) => setAmountMyr(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <Field label="Note (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Friend X tipped via Ko-fi" className={inputClass} />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="text-xs px-3 py-1.5 rounded border border-ga-border hover:bg-ga-bg-hover">Cancel</button>
        <button type="submit" disabled={add.isPending || (!amountUsd && !amountMyr)} className="text-xs px-3 py-1.5 rounded bg-ga-accent text-white disabled:opacity-50">
          {add.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
      {add.error && <div className="text-xs text-red-400">{(add.error as Error).message}</div>}
    </form>
  );
}

function RevenueLog() {
  const { data: entries } = useRevenueEntries();
  const del = useDeleteRevenue();
  if (!entries?.length) return null;
  return (
    <div className="mt-4">
      <div className="text-xs text-ga-text-secondary mb-1">Recent entries</div>
      <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
        {entries.slice(0, 8).map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-2 py-1 border-b border-ga-border/50">
            <div className="min-w-0 flex-1">
              <span className="font-mono text-ga-text-secondary mr-2">{e.date}</span>
              <span className="font-medium">${e.amount_usd.toFixed(2)}</span>
              <span className="text-ga-text-secondary ml-2">via {e.source}</span>
              {e.note && <span className="text-ga-text-secondary ml-2 truncate">— {e.note}</span>}
            </div>
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete this revenue entry? (${e.date} $${e.amount_usd})`)) del.mutate(e.id);
              }}
              className="text-ga-text-secondary hover:text-red-400 px-1"
              title="Delete"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Funnel + engagement + retention + health
// ---------------------------------------------------------------------------

function FunnelCard({ data }: { data: import('@/types/api').BusinessMetrics }) {
  return (
    <Card title="Funnel">
      <Stat label="Signups (total)" value={data.acquisition.total_users} />
      <Stat label="New (7d)" value={data.acquisition.new_signups_7d} />
      <Stat label="New (30d)" value={data.acquisition.new_signups_30d} />
      <Stat
        label="Activated"
        value={`${data.activation.activated_users} (${Math.round(data.activation.activation_rate * 100)}%)`}
        threshold={data.activation.activation_rate >= 0.6 ? 'good' : data.activation.activation_rate < 0.3 ? 'bad' : 'warn'}
      />
    </Card>
  );
}

function EngagementCard({ data }: { data: import('@/types/api').BusinessMetrics }) {
  return (
    <Card title="Engagement">
      <Stat label="WAU" value={data.engagement.wau} />
      <Stat label="MAU" value={data.engagement.mau} />
      <Stat
        label="WAU / MAU"
        value={data.engagement.wau_mau_ratio.toFixed(2)}
        threshold={data.engagement.wau_mau_ratio >= 0.4 ? 'good' : data.engagement.wau_mau_ratio < 0.2 ? 'bad' : 'warn'}
      />
      <Stat label="Items added (7d)" value={data.engagement.items_added_7d} />
      <Stat label="Items resolved (7d)" value={data.engagement.items_resolved_7d} />
      <Stat
        label="Items / WAU / wk"
        value={data.engagement.items_per_wau_7d.toFixed(1)}
        threshold={data.engagement.items_per_wau_7d >= 3 ? 'good' : data.engagement.items_per_wau_7d < 1 ? 'bad' : 'warn'}
      />
    </Card>
  );
}

function RetentionCard({ data }: { data: import('@/types/api').BusinessMetrics }) {
  const d7 = data.retention.d7;
  const d7Pct = d7 !== null ? `${Math.round(d7 * 100)}%` : 'n/a';
  return (
    <Card title="Retention (D7)">
      <Stat
        label="D7 retention"
        value={d7Pct}
        threshold={d7 === null ? undefined : d7 >= 0.25 ? 'good' : d7 < 0.10 ? 'bad' : 'warn'}
      />
      <Stat label="Eligible cohort" value={data.retention.d7_eligible_count} />
      <Stat label="Returned" value={data.retention.d7_returned_count} />
      <p className="text-[11px] text-ga-text-secondary mt-1">
        Of users who signed up 7-14 days ago, how many were active in the last 7 days.
      </p>
    </Card>
  );
}

function HealthCard({ data }: { data: import('@/types/api').BusinessMetrics }) {
  const today = data.health.median_today;
  const old = data.health.median_30d_ago;
  const trendIcon = data.health.trend === 'up' ? '↗' : data.health.trend === 'down' ? '↘' : '→';
  return (
    <Card title="Health-score trend">
      <Stat label="Median today" value={today ?? '—'} />
      <Stat label="Median 30d ago" value={old ?? '—'} />
      <Stat
        label="Trend"
        value={`${trendIcon} ${data.health.trend}`}
        threshold={data.health.trend === 'up' ? 'good' : data.health.trend === 'down' ? 'bad' : 'warn'}
      />
      <Stat label="Sample size" value={data.health.sample_size} />
      <p className="text-[11px] text-ga-text-secondary mt-1">
        Rising = users wasting less. Strongest signal that the product works.
      </p>
    </Card>
  );
}

function SignupsByWeekCard({ data }: { data: import('@/types/api').BusinessMetrics }) {
  const weeks = data.acquisition.by_week;
  const max = Math.max(1, ...weeks.map((w) => w.signups));
  return (
    <Card title="Signups by week (last 12)">
      {weeks.length === 0 ? (
        <p className="text-xs text-ga-text-secondary">No signups yet.</p>
      ) : (
        <ul className="space-y-1">
          {weeks.map((w) => (
            <li key={w.week} className="flex items-center gap-2 text-xs">
              <span className="font-mono text-ga-text-secondary w-20">{w.week}</span>
              <div className="flex-1 h-3 bg-ga-bg-hover rounded">
                <div className="h-full bg-sky-500 rounded" style={{ width: `${(w.signups / max) * 100}%` }} />
              </div>
              <span className="w-6 text-right">{w.signups}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RevenueByMonthCard({ data }: { data: import('@/types/api').BusinessMetrics }) {
  const months = data.revenue.by_month;
  const max = Math.max(1, ...months.map((m) => m.amount_usd));
  return (
    <Card title="Revenue by month">
      {months.length === 0 ? (
        <p className="text-xs text-ga-text-secondary">No revenue logged yet. Tap "+ Log revenue" above.</p>
      ) : (
        <ul className="space-y-1">
          {months.map((m) => (
            <li key={m.month} className="flex items-center gap-2 text-xs">
              <span className="font-mono text-ga-text-secondary w-16">{m.month}</span>
              <div className="flex-1 h-3 bg-ga-bg-hover rounded">
                <div className="h-full bg-emerald-500 rounded" style={{ width: `${(m.amount_usd / max) * 100}%` }} />
              </div>
              <span className="w-14 text-right">${m.amount_usd.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4 space-y-1.5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  threshold,
}: {
  label: string;
  value: React.ReactNode;
  threshold?: 'good' | 'warn' | 'bad';
}) {
  const tone =
    threshold === 'good'
      ? 'text-emerald-400'
      : threshold === 'bad'
      ? 'text-red-400'
      : threshold === 'warn'
      ? 'text-amber-400'
      : 'text-ga-text-primary';
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-ga-text-secondary">{label}</span>
      <span className={cn('font-medium', tone)}>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="text-ga-text-secondary">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full mt-0.5 px-2 py-1 bg-ga-bg-card border border-ga-border rounded text-xs text-ga-text-primary focus:outline-none focus:border-ga-accent';
