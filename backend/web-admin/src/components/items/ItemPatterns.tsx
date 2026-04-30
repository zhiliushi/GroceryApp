import { cn } from '@/utils/cn';
import type {
  CatalogOverviewCadence,
  CatalogOverviewWasteCost,
  CatalogOverviewWasteRate,
} from '@/types/api';

interface Props {
  cadence: CatalogOverviewCadence;
  wasteCost: CatalogOverviewWasteCost;
  wasteRate: CatalogOverviewWasteRate;
  baseUnitLabel?: string;
}

/**
 * Behavioural insights — "how do I actually use this item?".
 *
 * Different from the read-out cards (lifetime breakdown, price history) which
 * are factual ledgers. This is interpreted: cadence, money lost, what to do
 * about it.
 *
 * Each bullet renders only when its underlying data is meaningful. With one
 * buy, no cadence; with no consumed events, no consumption stat.
 */
export default function ItemPatterns({
  cadence,
  wasteCost,
  wasteRate,
  baseUnitLabel = 'unit',
}: Props) {
  const bullets = buildBullets(cadence, wasteCost, wasteRate, baseUnitLabel);
  if (bullets.length === 0) {
    return (
      <p className="text-xs text-ga-text-secondary italic">
        Not enough history yet — buy this a few more times to see your patterns.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {bullets.map((b, idx) => (
        <li
          key={idx}
          className={cn(
            'flex items-start gap-2 text-sm',
            b.tone === 'warn' && 'text-orange-400',
            b.tone === 'bad' && 'text-red-400',
            b.tone === 'good' && 'text-green-400',
            !b.tone && 'text-ga-text-primary',
          )}
        >
          <span className="text-base flex-shrink-0">{b.icon}</span>
          <span className="leading-snug">
            {b.text}
            {b.detail && (
              <span className="block text-[11px] text-ga-text-secondary mt-0.5">
                {b.detail}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

interface Bullet {
  icon: string;
  text: React.ReactNode;
  detail?: React.ReactNode;
  tone?: 'good' | 'warn' | 'bad';
}

function buildBullets(
  cadence: CatalogOverviewCadence,
  wasteCost: CatalogOverviewWasteCost,
  wasteRate: CatalogOverviewWasteRate,
  baseUnitLabel: string,
): Bullet[] {
  const out: Bullet[] = [];
  const cur = wasteCost.display_currency || '';
  const fmtMoney = (n: number) => `${cur ? cur + ' ' : ''}${n.toFixed(2)}`;

  // Purchase cadence
  if (cadence.avg_days_between_buys != null && cadence.days_since_last_buy != null) {
    const next = cadence.predicted_next_buy_in_days;
    const overdue = next != null && next < 0;
    out.push({
      icon: overdue ? '⏰' : '🛒',
      tone: overdue ? 'warn' : undefined,
      text: (
        <>
          You buy these every <strong>~{cadence.avg_days_between_buys} days</strong>.
        </>
      ),
      detail: (
        <>
          Last bought {cadence.days_since_last_buy} days ago
          {next != null &&
            (overdue ? (
              <> · <strong>{Math.abs(next).toFixed(0)} days overdue</strong> based on your rhythm.</>
            ) : next < 1 ? (
              <> · likely buying again any day.</>
            ) : (
              <> · next buy expected in ~{next.toFixed(0)} days.</>
            ))}
        </>
      ),
    });
  } else if (cadence.last_buy_at && cadence.days_since_last_buy != null) {
    out.push({
      icon: '🛒',
      text: (
        <>
          First-time buy {cadence.days_since_last_buy} days ago. Buy a few more
          times to see your rhythm.
        </>
      ),
    });
  }

  // Consumption cadence
  if (cadence.avg_days_buy_to_use != null && cadence.use_event_count > 0) {
    out.push({
      icon: '🍽',
      text: (
        <>
          Typically used within <strong>~{cadence.avg_days_buy_to_use} days</strong> of buying
          ({cadence.use_event_count} use{cadence.use_event_count === 1 ? '' : 's'} on record).
        </>
      ),
    });
  }

  // Waste cost — concrete dollar number
  if (wasteCost.thrown_total > 0) {
    const pctValue = wasteCost.waste_pct_by_value;
    const tone = pctValue > 30 ? 'bad' : pctValue > 15 ? 'warn' : undefined;
    out.push({
      icon: '🗑',
      tone,
      text: (
        <>
          Lost <strong>{fmtMoney(wasteCost.thrown_total)}</strong> to waste
          ({pctValue}% of {fmtMoney(wasteCost.spent_total)} spent).
        </>
      ),
      detail:
        wasteRate.thrown_pct !== pctValue ? (
          <>
            By quantity: {wasteRate.thrown_pct}% of {baseUnitLabel}s thrown.
          </>
        ) : null,
    });
  } else if (wasteCost.spent_total > 0) {
    out.push({
      icon: '✓',
      tone: 'good',
      text: (
        <>
          Zero waste — every <strong>{fmtMoney(wasteCost.spent_total)}</strong> spent
          on this is accounted for.
        </>
      ),
    });
  }

  // Spend totals
  if (wasteCost.spent_total > 0) {
    out.push({
      icon: '💵',
      text: (
        <>
          Lifetime spend on this: <strong>{fmtMoney(wasteCost.spent_total)}</strong>.
        </>
      ),
      detail:
        wasteCost.used_total > 0 ? (
          <>
            {fmtMoney(wasteCost.used_total)} actually consumed
            {wasteCost.given_total > 0 && (
              <> · {fmtMoney(wasteCost.given_total)} given/moved</>
            )}.
          </>
        ) : null,
    });
  }

  return out;
}
