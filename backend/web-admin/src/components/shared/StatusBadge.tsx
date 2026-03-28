import { cn } from '@/utils/cn';

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-600 text-white',
  consumed: 'bg-blue-600 text-white',
  expired: 'bg-red-600 text-white',
  discarded: 'bg-orange-500 text-white',
  pending_review: 'bg-yellow-500 text-black',
  approved: 'bg-green-600 text-white',
  rejected: 'bg-red-600 text-white',
  needs_info: 'bg-purple-500 text-white',
  healthy: 'bg-green-600 text-white',
  cooldown: 'bg-yellow-500 text-black',
  disabled: 'bg-gray-500 text-white',
  admin: 'bg-green-600 text-white',
  user: 'bg-gray-600 text-white',
  openfoodfacts: 'bg-blue-500 text-white',
  contributed: 'bg-yellow-500 text-black',
  manual: 'bg-blue-600 text-white',
  unknown: 'bg-gray-600 text-white',
};

interface StatusBadgeProps {
  status: string | null | undefined;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  if (!status) return null;
  const style = STATUS_STYLES[status] || 'bg-gray-600 text-white';
  const label = status.replace(/_/g, ' ');

  return (
    <span className={cn('inline-block rounded px-2 py-0.5 text-xs font-medium capitalize', style, className)}>
      {label}
    </span>
  );
}
