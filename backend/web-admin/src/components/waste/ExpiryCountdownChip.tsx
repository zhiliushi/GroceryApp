import { getExpiryChipMeta } from '@/utils/actionResolver';
import { cn } from '@/utils/cn';

/**
 * Colour+icon chip showing expiry status at a glance.
 * Tones: ok (green), warn (yellow), urgent (orange), expired (red), unknown (grey).
 */
export default function ExpiryCountdownChip({ expiryDate }: { expiryDate: string | null }) {
  const meta = getExpiryChipMeta(expiryDate);

  const cls =
    meta.tone === 'ok'
      ? 'bg-green-100 text-green-800'
      : meta.tone === 'warn'
      ? 'bg-yellow-100 text-yellow-800'
      : meta.tone === 'urgent'
      ? 'bg-orange-100 text-orange-800'
      : meta.tone === 'expired'
      ? 'bg-red-100 text-red-800'
      : 'bg-gray-100 text-gray-600';

  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', cls)}>
      <span aria-hidden>{meta.icon}</span>
      <span>{meta.label}</span>
    </span>
  );
}
