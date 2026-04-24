import { Link } from 'react-router-dom';
import { useSpendingSummary } from '@/api/queries/useWaste';
import { useFeatureFlags } from '@/api/queries/useFeatureFlags';

export default function SpendingCard() {
  const { data: flags } = useFeatureFlags();
  const { data, isLoading } = useSpendingSummary('month');

  // Hidden if financial_tracking flag off
  if (flags && flags.financial_tracking === false) return null;

  return (
    <Link
      to="/spending"
      className="block bg-ga-bg-card border border-ga-border rounded-lg p-4 hover:border-ga-accent/50 transition-colors"
    >
      <div className="flex items-start justify-between">
        <h4 className="text-sm font-semibold text-ga-text-primary">Spending this month →</h4>
        {isLoading ? (
          <span className="text-xs text-ga-text-secondary">…</span>
        ) : (
          <span className="text-lg font-bold text-ga-text-primary">
            {data?.grand_total?.toFixed(2) ?? '0.00'}
          </span>
        )}
      </div>
      {data && (
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <Stat label="💵 Cash" value={data.cash_total} />
          <Stat label="💳 Card" value={data.card_total} />
          <Stat label="? Untracked" value={data.untracked_count} suffix=" items" />
        </div>
      )}
    </Link>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-ga-text-secondary">{label}</span>
      <span className="text-ga-text-primary font-medium">
        {suffix ? `${value}${suffix}` : value.toFixed(2)}
      </span>
    </div>
  );
}
