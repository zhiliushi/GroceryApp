export function formatDate(ts: number | null | undefined): string {
  if (!ts) return '—';
  const ms = ts > 1e12 ? ts : ts * 1000;
  return new Date(ms).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(ts: number | null | undefined): string {
  if (!ts) return '—';
  const ms = ts > 1e12 ? ts : ts * 1000;
  return new Date(ms).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatRelativeDate(ts: number | null | undefined): string {
  if (!ts) return '—';
  const ms = ts > 1e12 ? ts : ts * 1000;
  const diffMs = Date.now() - ms;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  const diffWk = Math.floor(diffDay / 7);
  if (diffWk < 5) return `${diffWk}w ago`;
  const diffMo = Math.floor(diffDay / 30);
  if (diffMo < 12) return `${diffMo}mo ago`;
  return `${Math.floor(diffDay / 365)}y ago`;
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return `RM ${amount.toFixed(2)}`;
}

export function truncateUid(uid: string | null | undefined, length = 8): string {
  if (!uid) return '—';
  if (uid.length <= length) return uid;
  return uid.substring(0, length) + '...';
}

export function truncateText(text: string | null | undefined, maxLength: number): string {
  if (!text) return '—';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export interface ExpiryDisplay {
  text: string;
  className: string;
}

export function formatExpiry(expiryMs: number | null | undefined): ExpiryDisplay {
  if (!expiryMs) return { text: '—', className: 'text-ga-text-secondary/50' };
  const ms = expiryMs > 1e12 ? expiryMs : expiryMs * 1000;
  const now = Date.now();
  const diffMs = ms - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { text: 'Expired', className: 'text-red-500 font-medium' };
  if (diffDays <= 3) return { text: `${diffDays}d left`, className: 'text-red-400' };
  if (diffDays <= 7) return { text: `${diffDays}d left`, className: 'text-orange-400' };
  if (diffDays <= 14) return { text: `${diffDays}d left`, className: 'text-yellow-400' };
  return { text: formatDate(expiryMs), className: 'text-ga-text-secondary' };
}

// === Currency ===

const CURRENCY_SYMBOLS: Record<string, string> = {
  MYR: 'RM', SGD: 'S$', USD: '$', IDR: 'Rp',
  PHP: '₱', THB: '฿', GBP: '£', EUR: '€', AUD: 'A$',
};

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || currency;
}

export function formatCurrencyWithSymbol(amount: number | null | undefined, currency: string): string {
  if (amount == null) return '—';
  return `${getCurrencySymbol(currency)} ${amount.toFixed(2)}`;
}

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
): number | null {
  if (fromCurrency === toCurrency) return amount;
  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];
  if (!fromRate || !toRate) return null;
  return Math.round(amount * (toRate / fromRate) * 100) / 100;
}
