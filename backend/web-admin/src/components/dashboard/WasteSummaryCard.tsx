import { Link } from 'react-router-dom';
import { useWasteSummary } from '@/api/queries/useWaste';

export default function WasteSummaryCard() {
  const { data, isLoading } = useWasteSummary('month');

  return (
    <Link
      to="/waste"
      className="block bg-ga-bg-card border border-ga-border rounded-lg p-4 hover:border-ga-accent/50 transition-colors"
    >
      <div className="flex items-start justify-between">
        <h4 className="text-sm font-semibold text-ga-text-primary">Waste this month →</h4>
        {isLoading ? (
          <span className="text-xs text-ga-text-secondary">…</span>
        ) : (
          <span className="text-xl font-bold text-red-500">{data?.thrown_count ?? 0}</span>
        )}
      </div>
      <p className="text-xs text-ga-text-secondary mt-1">
        {data ? `${data.thrown_value.toFixed(2)} total value` : 'No data yet'}
      </p>
      {data?.top_wasted && data.top_wasted.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {data.top_wasted.slice(0, 3).map((t) => (
            <li key={t.catalog_name_norm} className="text-xs text-ga-text-secondary flex justify-between">
              <span>{t.display_name}</span>
              <span>{t.count}×</span>
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
}
