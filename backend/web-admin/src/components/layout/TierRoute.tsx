import { useVisibility } from '@/hooks/useVisibility';
import UpgradeBanner from '@/components/shared/UpgradeBanner';

interface TierRouteProps {
  page: string;
  children: React.ReactNode;
}

export default function TierRoute({ page, children }: TierRouteProps) {
  const { canAccessPage, config, isLoading } = useVisibility();

  // While loading config, render children (fail open)
  if (isLoading) return <>{children}</>;

  if (!canAccessPage(page)) {
    const pageConfig = config?.visibility.pages[page];
    const requiredTier = pageConfig?.minTier || 'plus';
    const tierNames: Record<string, string> = {
      free: 'Basic Basket',
      plus: 'Smart Cart',
      pro: 'Full Fridge',
    };
    return (
      <div className="p-6">
        <UpgradeBanner
          feature={page.replace(/_/g, ' ')}
          requiredTier={tierNames[requiredTier] || requiredTier}
        />
      </div>
    );
  }

  return <>{children}</>;
}
