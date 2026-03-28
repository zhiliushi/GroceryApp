import { cn } from '@/utils/cn';

interface UpgradeBannerProps {
  feature: string;
  requiredTier: string;
  className?: string;
  compact?: boolean;
}

export default function UpgradeBanner({ feature, requiredTier, className, compact }: UpgradeBannerProps) {
  if (compact) {
    return (
      <div className={cn('inline-flex items-center gap-1.5 text-xs text-ga-text-secondary bg-ga-bg-hover rounded px-2 py-1', className)}>
        <span>🔒</span>
        <span>Requires {requiredTier}</span>
      </div>
    );
  }

  return (
    <div className={cn('bg-ga-bg-card border border-ga-border rounded-lg p-8 text-center', className)}>
      <div className="text-4xl mb-3">🔒</div>
      <h3 className="text-lg font-semibold text-ga-text-primary capitalize mb-2">
        {feature}
      </h3>
      <p className="text-sm text-ga-text-secondary mb-4">
        This feature requires the <strong className="text-ga-accent">{requiredTier}</strong> plan.
      </p>
      <p className="text-xs text-ga-text-secondary">
        Contact your admin to upgrade your subscription.
      </p>
    </div>
  );
}
