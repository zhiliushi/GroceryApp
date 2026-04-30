import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import { useMe } from '@/api/queries/useMe';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/utils/cn';

const COMMON_CURRENCIES = [
  'SGD', 'MYR', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'IDR', 'THB', 'PHP', 'VND', 'INR', 'AUD',
];

export default function DisplayCurrencySection() {
  const { data: user } = useMe();
  const fetchUserInfo = useAuthStore((s) => s.fetchUserInfo);
  const qc = useQueryClient();
  const current = user?.currency_preference || user?.currency || 'SGD';
  const [pending, setPending] = useState<string>(current);

  useEffect(() => {
    setPending(current);
  }, [current]);

  const mutation = useMutation({
    mutationFn: (currency: string) =>
      apiClient
        .put<{ success: boolean; currency_preference: string }>(
          API.ME_CURRENCY_PREFERENCE,
          { currency },
        )
        .then((r) => r.data),
    onSuccess: async (data) => {
      toast.success(`Display currency set to ${data.currency_preference}`);
      qc.invalidateQueries({ queryKey: qk.me });
      // Also re-fetch the auth-store snapshot so banners + QuickAddModal pick it up.
      await fetchUserInfo();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || 'Failed to update currency');
    },
  });

  const dirty = pending !== current;

  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5">
      <h2 className="text-sm font-semibold text-ga-text-primary mb-3">Display currency</h2>
      <p className="text-xs text-ga-text-secondary mb-3">
        Prices entered in any currency are converted to your display currency at save time
        using the day's FX rate. Past events are NOT re-aggregated when you change this — they
        remain in their original locked rate.
      </p>
      <div className="flex items-center gap-2">
        <select
          value={pending}
          onChange={(e) => setPending(e.target.value)}
          className="px-3 py-2 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary focus:outline-none focus:border-ga-accent"
        >
          {(COMMON_CURRENCIES.includes(pending)
            ? COMMON_CURRENCIES
            : [pending, ...COMMON_CURRENCIES]
          ).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          onClick={() => mutation.mutate(pending)}
          disabled={!dirty || mutation.isPending}
          className={cn(
            'px-3 py-1.5 rounded text-sm',
            !dirty || mutation.isPending
              ? 'bg-ga-bg-hover text-ga-text-secondary cursor-not-allowed'
              : 'bg-ga-accent text-white hover:opacity-90',
          )}
        >
          {mutation.isPending ? 'Saving…' : 'Save'}
        </button>
        {dirty && (
          <button
            onClick={() => setPending(current)}
            className="text-xs text-ga-text-secondary hover:underline"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
