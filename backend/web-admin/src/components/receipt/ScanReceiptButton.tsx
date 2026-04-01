import { useState } from 'react';
import { useVisibility } from '@/hooks/useVisibility';
import UpgradeBanner from '@/components/shared/UpgradeBanner';
import ReceiptScanModal from './ReceiptScanModal';

interface ScanReceiptButtonProps {
  /** Where confirmed items should be saved */
  destination: 'inventory' | 'shopping_list' | 'price_only';
  /** Page key for section visibility check */
  pageKey: string;
  /** Shopping list ID (required when destination=shopping_list) */
  listId?: string;
  className?: string;
}

export default function ScanReceiptButton({
  destination,
  pageKey,
  listId,
  className,
}: ScanReceiptButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { canAccessSection, canUseTool } = useVisibility();

  // 1. Admin visibility check — render nothing if section disabled
  if (!canAccessSection(pageKey, 'receipt_scanning')) {
    return null;
  }

  // 2. Tier/tool check — show upgrade banner if no access
  if (!canUseTool('receipt_scanning_ocr')) {
    return (
      <UpgradeBanner
        feature="Receipt Scanning"
        requiredTier="Smart Cart"
        compact
        className={className}
      />
    );
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-2 bg-ga-accent hover:bg-ga-accent/90 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors ${className || ''}`}
      >
        <span>📷</span>
        Scan Receipt
      </button>

      {isOpen && (
        <ReceiptScanModal
          destination={destination}
          listId={listId}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
