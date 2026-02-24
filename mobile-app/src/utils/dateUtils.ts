import {format, formatDistanceToNow, differenceInDays, isAfter} from 'date-fns';

export function formatDate(timestamp: number): string {
  return format(new Date(timestamp), 'MMM d, yyyy');
}

export function formatDateShort(timestamp: number): string {
  return format(new Date(timestamp), 'MM/dd/yy');
}

export function timeAgo(timestamp: number): string {
  return formatDistanceToNow(new Date(timestamp), {addSuffix: true});
}

export function daysUntil(timestamp: number): number {
  return differenceInDays(new Date(timestamp), new Date());
}

export function isFuture(timestamp: number): boolean {
  return isAfter(new Date(timestamp), new Date());
}

export function expiryStatus(
  expiryTimestamp: number | null | undefined,
): 'expired' | 'expiring' | 'fresh' | 'unknown' {
  if (expiryTimestamp == null) return 'unknown';
  const days = daysUntil(expiryTimestamp);
  if (days < 0) return 'expired';
  if (days <= 3) return 'expiring';
  return 'fresh';
}
