import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import type { ExchangeRates } from '@/types/api';

export function useExchangeRates() {
  const { data: ratesData, isLoading } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: () => apiClient.get<ExchangeRates>(API.EXCHANGE_RATES).then((r) => r.data),
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  const convert = useCallback(
    (amount: number, fromCurrency: string, toCurrency: string): number | null => {
      if (fromCurrency === toCurrency) return amount;
      if (!ratesData?.rates) return null;
      const fromRate = ratesData.rates[fromCurrency];
      const toRate = ratesData.rates[toCurrency];
      if (!fromRate || !toRate) return null;
      return Math.round(amount * (toRate / fromRate) * 100) / 100;
    },
    [ratesData],
  );

  const formatConverted = useCallback(
    (amount: number | null | undefined, fromCurrency: string, toCurrency: string): string => {
      if (amount == null) return '—';
      if (fromCurrency === toCurrency) {
        return `${getCurrencySymbol(fromCurrency)} ${amount.toFixed(2)}`;
      }
      const converted = convert(amount, fromCurrency, toCurrency);
      if (converted == null) return `${getCurrencySymbol(fromCurrency)} ${amount.toFixed(2)}`;
      return `${getCurrencySymbol(toCurrency)} ${converted.toFixed(2)}`;
    },
    [convert],
  );

  return { rates: ratesData, isLoading, convert, formatConverted };
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  MYR: 'RM',
  SGD: 'S$',
  USD: '$',
  IDR: 'Rp',
  PHP: '₱',
  THB: '฿',
  GBP: '£',
  EUR: '€',
  AUD: 'A$',
};

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || currency;
}
