import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import HealthBar from '@/components/waste/HealthBar';
import HealthTrendChart from '@/components/waste/HealthTrendChart';
import PageHeader from '@/components/shared/PageHeader';
import Breadcrumbs from '@/components/shared/Breadcrumbs';
import ExpiryCountdownChip from '@/components/waste/ExpiryCountdownChip';
import { usePurchases } from '@/api/queries/usePurchases';
import type { PurchaseEvent } from '@/types/api';
import { cn } from '@/utils/cn';

type TabKey = 'expiring' | 'expired' | 'untracked' | 'wasted';

const TABS: { key: TabKey; label: string; hint: string }[] = [
  { key: 'expiring', label: 'Expiring', hint: 'Items going off in the next 7 days, soonest first.' },
  { key: 'expired', label: 'Expired', hint: 'Items already past their expiry date — decide Use or Throw.' },
  { key: 'untracked', label: 'Untracked', hint: 'Bought items with no expiry date. Older buckets are riskier.' },
  { key: 'wasted', label: 'Wasted this month', hint: 'Items you marked Thrown since the 1st of this month.' },
];

const MS_DAY = 24 * 60 * 60 * 1000;

export default function HealthScorePage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as TabKey) ?? 'expiring';

  const active = usePurchases({ status: 'active', limit: 500 });
  const thrown = usePurchases({ status: 'thrown', limit: 500 });

  const now = Date.now();
  const weekAhead = now + 7 * MS_DAY;

  const expiring = useMemo(() => {
    const items = (active.data?.items ?? [])
      .filter((e) => e.expiry_date && new Date(e.expiry_date).getTime() <= weekAhead && new Date(e.expiry_date).getTime() >= now)
      .sort((a, b) => new Date(a.expiry_date!).getTime() - new Date(b.expiry_date!).getTime());
    return items;
  }, [active.data, now, weekAhead]);

  const expired = useMemo(() => {
    return (active.data?.items ?? [])
      .filter((e) => e.expiry_date && new Date(e.expiry_date).getTime() < now)
      .sort((a, b) => new Date(a.expiry_date!).getTime() - new Date(b.expiry_date!).getTime());
  }, [active.data, now]);

  const untrackedByBucket = useMemo(() => {
    const buckets: Record<'7' | '14' | '21', PurchaseEvent[]> = { '7': [], '14': [], '21': [] };
    for (const e of active.data?.items ?? []) {
      if (e.expiry_date || !e.date_bought) continue;
      const age = Math.floor((now - new Date(e.date_bought).getTime()) / MS_DAY);
      if (age >= 21) buckets['21'].push(e);
      else if (age >= 14) buckets['14'].push(e);
      else if (age >= 7) buckets['7'].push(e);
    }
    return buckets;
  }, [active.data, now]);

  const wastedThisMonth = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const startMs = monthStart.getTime();
    return (thrown.data?.items ?? []).filter(
      (e) => e.consumed_date && new Date(e.consumed_date).getTime() >= startMs,
    );
  }, [thrown.data]);

  const activeTabHint = TABS.find((t) => t.key === tab)?.hint ?? '';

  return (
    <div className="p-6 space-y-4">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Health Score' }]} />
      <PageHeader title="Inventory Health" icon="💚" />

      <details className="bg-ga-bg-card border border-ga-border rounded-lg group">
        <summary className="cursor-pointer list-none px-4 py-2 text-xs text-ga-text-secondary flex items-center justify-between hover:bg-ga-bg-hover/40 rounded-lg">
          <span>ⓘ How is this score calculated?</span>
          <span className="text-[10px] group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="px-4 pb-3 pt-1 text-xs text-ga-text-secondary space-y-1.5 border-t border-ga-border">
          <p>
            <span className="text-ga-text-primary font-medium">The score (0–100)</span>{' '}
            blends two things: 70% from how healthy your active items look right now (fewer
            expiring or expired = higher score), 30% from your waste rate this month
            (less thrown = higher score).
          </p>
          <p>
            <span className="text-ga-text-primary font-medium">Colour bands:</span>{' '}
            <span className="text-green-500">green ≥ 80 (healthy)</span>,
            <span className="text-yellow-500"> yellow 50–79 (needs attention)</span>,
            <span className="text-red-500"> red &lt; 50 (urgent)</span>.
          </p>
          <p>
            <span className="text-ga-text-primary font-medium">The four tabs below</span>{' '}
            group items by the action you can take: Expiring (use soon), Expired (decide
            now), Untracked (set an expiry), Wasted this month (look back).
          </p>
          <p>
            <span className="text-ga-text-primary font-medium">The 30-day chart</span>{' '}
            uses one snapshot per day at 23:30 UTC. Days without a snapshot copy the
            previous day&apos;s value, so the line may look flat across gaps.
          </p>
        </div>
      </details>

      <HealthBar drillToPath="/health-score" />
      <HealthTrendChart />

      <div className="flex border-b border-ga-border overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setParams({ tab: t.key })}
            title={t.hint}
            className={cn(
              'px-4 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors',
              tab === t.key
                ? 'border-ga-accent text-ga-text-primary font-medium'
                : 'border-transparent text-ga-text-secondary hover:text-ga-text-primary',
            )}
          >
            {t.label}{' '}
            <Count
              n={
                t.key === 'expiring'
                  ? expiring.length
                  : t.key === 'expired'
                  ? expired.length
                  : t.key === 'untracked'
                  ? untrackedByBucket['7'].length + untrackedByBucket['14'].length + untrackedByBucket['21'].length
                  : wastedThisMonth.length
              }
            />
          </button>
        ))}
      </div>
      <p className="text-[11px] text-ga-text-secondary -mt-2" aria-live="polite">
        {activeTabHint}
      </p>

      {tab === 'expiring' && <ItemList items={expiring} emptyMsg="Nothing expiring in the next 7 days — nice!" />}
      {tab === 'expired' && (
        <ItemList items={expired} emptyMsg="No expired items." tone="expired" />
      )}
      {tab === 'untracked' && <UntrackedTab buckets={untrackedByBucket} />}
      {tab === 'wasted' && <WastedTab items={wastedThisMonth} />}
    </div>
  );
}

function Count({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-ga-bg-hover text-[10px] text-ga-text-secondary align-middle">
      {n}
    </span>
  );
}

function ItemList({
  items,
  emptyMsg,
  tone,
}: {
  items: PurchaseEvent[];
  emptyMsg: string;
  tone?: 'expired';
}) {
  if (items.length === 0) {
    return <p className="text-sm text-ga-text-secondary py-8 text-center">{emptyMsg}</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((e) => (
        <li
          key={e.id}
          className={cn(
            'bg-ga-bg-card border rounded-lg p-3',
            tone === 'expired' ? 'border-red-500/30' : 'border-ga-border',
          )}
        >
          <Link
            to={`/my-items/${e.id}`}
            className="flex items-center justify-between hover:opacity-90"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-ga-text-primary truncate">
                {e.catalog_display}
              </div>
              {e.location && (
                <div className="text-xs text-ga-text-secondary mt-0.5">📍 {e.location}</div>
              )}
            </div>
            <div className="ml-3 flex-shrink-0">
              <ExpiryCountdownChip expiryDate={e.expiry_date} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function UntrackedTab({
  buckets,
}: {
  buckets: Record<'7' | '14' | '21', PurchaseEvent[]>;
}) {
  const total = buckets['7'].length + buckets['14'].length + buckets['21'].length;
  if (total === 0) {
    return (
      <p className="text-sm text-ga-text-secondary py-8 text-center">
        Every active item has an expiry date — well done.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-xs text-ga-text-secondary">
        Items bought but without an expiry date. Older items are more likely to be forgotten —
        tap one to set an expiry.
      </p>
      <BucketSection label="7+ days old" tone="yellow" items={buckets['7']} />
      <BucketSection label="14+ days old" tone="orange" items={buckets['14']} />
      <BucketSection label="21+ days old" tone="red" items={buckets['21']} />
    </div>
  );
}

function BucketSection({
  label,
  tone,
  items,
}: {
  label: string;
  tone: 'yellow' | 'orange' | 'red';
  items: PurchaseEvent[];
}) {
  if (items.length === 0) return null;
  const toneClass =
    tone === 'red'
      ? 'text-red-500'
      : tone === 'orange'
      ? 'text-orange-500'
      : 'text-yellow-500';
  return (
    <div>
      <div className={cn('text-sm font-semibold mb-2', toneClass)}>
        {label} <span className="text-ga-text-secondary">· {items.length}</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((e) => (
          <li key={e.id} className="bg-ga-bg-card border border-ga-border rounded-lg p-3">
            <Link
              to={`/my-items/${e.id}`}
              className="flex items-center justify-between hover:opacity-90"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ga-text-primary truncate">
                  {e.catalog_display}
                </div>
                {e.date_bought && (
                  <div className="text-xs text-ga-text-secondary mt-0.5">
                    Bought {new Date(e.date_bought).toLocaleDateString()}
                  </div>
                )}
              </div>
              <div className="ml-3 text-xs text-ga-accent flex-shrink-0">Set expiry →</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WastedTab({ items }: { items: PurchaseEvent[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-ga-text-secondary py-8 text-center">
        No items thrown this month — keep it up!
      </p>
    );
  }
  const total = items.reduce((acc, e) => acc + (e.price ?? 0), 0);
  return (
    <div className="space-y-3">
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
        <div className="text-sm text-red-400">
          {items.length} item{items.length === 1 ? '' : 's'} thrown this month
          {total > 0 && (
            <> · <span className="font-semibold">RM {total.toFixed(2)}</span> wasted</>
          )}
        </div>
      </div>
      <ul className="space-y-2">
        {items.map((e) => (
          <li key={e.id} className="bg-ga-bg-card border border-ga-border rounded-lg p-3">
            <Link
              to={`/my-items/${e.id}`}
              className="flex items-center justify-between hover:opacity-90"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ga-text-primary truncate">
                  {e.catalog_display}
                </div>
                <div className="text-xs text-ga-text-secondary mt-0.5">
                  {e.consumed_reason && <span>{e.consumed_reason}</span>}
                  {e.consumed_date && (
                    <span className="ml-2">
                      {new Date(e.consumed_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              {e.price != null && (
                <div className="ml-3 text-sm text-red-400 font-medium flex-shrink-0">
                  RM {e.price.toFixed(2)}
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
