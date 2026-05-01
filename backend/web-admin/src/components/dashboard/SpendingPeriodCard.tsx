import { useState } from 'react';
import { useSpendingSummary } from '@/api/queries/useWaste';
import { formatCurrencyWithSymbol } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { SpendingPeriod } from '@/types/api';

/**
 * Single-period spending card. The dashboard renders three of these
 * (week / month / last month) side by side.
 *
 * Click anywhere on the card to toggle a top-5 list of the most
 * expensive purchases in that period. Collapsed state shows only the
 * headline number — that's the answer to "did I overspend"; the list
 * is the answer to "where did the money go", available on demand.
 *
 * The whole card is keyboard-accessible (button role) so the toggle
 * works without touch.
 */
export default function SpendingPeriodCard({
  period,
  label,
  hint,
  highlight,
  defaultOpen,
}: {
  period: SpendingPeriod;
  /** Top-line label, e.g. "This week". */
  label: string;
  /** Sub-label clarifying the period, e.g. "last 7 days". */
  hint: string;
  /** Visually emphasise this card (used on "This month" — the most-watched figure). */
  highlight?: boolean;
  defaultOpen?: boolean;
}) {
  const { data, isLoading } = useSpendingSummary(period);
  const [open, setOpen] = useState(!!defaultOpen);

  const currency = data?.display_currency || 'SGD';
  const total = data?.grand_total ?? 0;
  const items = data?.top_items ?? [];
  const untracked = data?.untracked_count ?? 0;

  return (
    <div
      className={cn(
        'rounded-lg border transition-colors',
        highlight
          ? 'bg-ga-accent/5 border-ga-accent/30'
          : 'bg-ga-bg-card border-ga-border',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-3 hover:bg-ga-bg-hover/40 rounded-lg"
        aria-expanded={open}
      >
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-xs text-ga-text-secondary leading-tight">{label}</div>
            <div className="text-[10px] text-ga-text-secondary leading-tight">{hint}</div>
          </div>
          <span className="text-[11px] text-ga-text-secondary ml-2">
            {open ? '▾' : '▸'}
          </span>
        </div>
        <div
          className={cn(
            'mt-1 font-bold tabular-nums text-ga-text-primary',
            highlight ? 'text-2xl' : 'text-xl',
          )}
        >
          {isLoading ? '…' : formatCurrencyWithSymbol(total, currency)}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-3 -mt-1">
          <div className="border-t border-ga-border pt-2">
            <ItemsBody
              items={items}
              total={total}
              currency={currency}
              untracked={untracked}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function formatQty(n: number): string {
  return n === Math.floor(n) ? String(n) : n.toFixed(1);
}

/**
 * Three-state empty handling — the original copy ("Top 0 most expensive
 * — nothing yet") was misleading when the card had a non-zero total
 * (the user sees money but no items, so "nothing" reads as a bug).
 *
 * Resolved cases:
 *   1. total > 0, items present → render the list
 *   2. total > 0, items empty → backend version mismatch (top_items
 *      not in response). Tell the user, don't claim "nothing yet".
 *   3. total === 0 → genuinely no purchases.
 */
function ItemsBody({
  items,
  total,
  currency,
  untracked,
}: {
  items: Array<{
    id: string;
    display_name: string;
    amount: number;
    quantity: number;
  }>;
  total: number;
  currency: string;
  untracked: number;
}) {
  if (items.length > 0) {
    return (
      <>
        <div className="text-[11px] text-ga-text-secondary mb-1.5">
          Top {Math.min(items.length, 5)} most expensive
        </div>
        <ul className="space-y-1">
          {items.map((it, idx) => (
            <li key={it.id} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 truncate min-w-0">
                <span className="text-ga-text-secondary font-mono w-3.5 flex-shrink-0">
                  {idx + 1}.
                </span>
                <span className="text-ga-text-primary truncate">{it.display_name}</span>
                {it.quantity > 1 && (
                  <span className="text-ga-text-secondary text-[10px] flex-shrink-0">
                    ×{formatQty(it.quantity)}
                  </span>
                )}
              </span>
              <span className="text-ga-text-primary font-medium tabular-nums flex-shrink-0 ml-2">
                {formatCurrencyWithSymbol(it.amount, currency)}
              </span>
            </li>
          ))}
        </ul>
        {untracked > 0 && (
          <p className="mt-2 text-[10px] text-ga-text-secondary">
            +{untracked} purchase{untracked === 1 ? '' : 's'} with no price recorded.
          </p>
        )}
      </>
    );
  }

  if (total > 0) {
    return (
      <p className="text-[11px] text-ga-text-secondary">
        Item breakdown unavailable — refresh the page or restart the backend
        to pick up the latest version.
        {untracked > 0 && (
          <>
            {' '}
            ({untracked} purchase{untracked === 1 ? '' : 's'} with no price
            recorded.)
          </>
        )}
      </p>
    );
  }

  return (
    <p className="text-[11px] text-ga-text-secondary">
      No purchases in this period.
      {untracked > 0 && (
        <>
          {' '}
          {untracked} item{untracked === 1 ? '' : 's'} added without a price.
        </>
      )}
    </p>
  );
}
