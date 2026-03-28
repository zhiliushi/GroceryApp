import { cn } from '@/utils/cn';

interface StatsCardProps {
  icon: string;
  label: string;
  value: number | string | undefined;
  accentColor?: 'green' | 'red' | 'yellow';
  loading?: boolean;
}

export default function StatsCard({ icon, label, value, accentColor = 'green', loading }: StatsCardProps) {
  const underlineColor = {
    green: 'bg-green-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
  }[accentColor];

  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-ga-text-secondary">{label}</span>
      </div>
      <div className="text-2xl font-bold text-ga-text-primary">
        {loading ? (
          <div className="h-8 w-16 bg-ga-bg-hover rounded animate-pulse" />
        ) : (
          value ?? '—'
        )}
      </div>
      <div className={cn('h-0.5 mt-2 rounded-full', underlineColor)} />
    </div>
  );
}
