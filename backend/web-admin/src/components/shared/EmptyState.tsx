import { cn } from '@/utils/cn';

interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
  className?: string;
}

export default function EmptyState({ icon = '📭', title, subtitle, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12', className)}>
      <span className="text-4xl opacity-50 mb-3">{icon}</span>
      <p className="text-ga-text-secondary text-sm">{title}</p>
      {subtitle && <p className="text-ga-text-secondary/70 text-xs mt-1">{subtitle}</p>}
    </div>
  );
}
