/**
 * RegistrationFormPage — collects name + country + currency from a user whose
 * `state` is `registration_required`. Backend's `complete_registration`
 * service validates ISO codes and sets `registration_complete=true`. If the
 * profile has `invitation_code_used` set (came in via /join/CODE), the
 * backend auto-accepts that invitation on submit and joins the user to the
 * household.
 *
 * Defaults country + currency from `Intl.DateTimeFormat().resolvedOptions().locale`
 * — a Malaysian browser shows MY + MYR pre-selected, a Singaporean shows SG + SGD.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { ISO_3166_COUNTRIES, type CountryEntry } from '@/utils/isoCountries';
import { ISO_4217_CURRENCIES } from '@/utils/isoCurrencies';

function deriveDefaultCountry(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const parts = locale.split('-');
    const region = parts[parts.length - 1];
    if (region && region.length === 2) return region.toUpperCase();
  } catch {
    /* fall through */
  }
  return 'MY';
}

function deriveDefaultCurrency(country: string): string {
  const entry = ISO_3166_COUNTRIES.find((c) => c.code === country);
  return entry?.currency || 'MYR';
}

export default function RegistrationFormPage() {
  const navigate = useNavigate();
  const { user, signOut, fetchUserInfo } = useAuthStore();

  const initialCountry = useMemo(() => deriveDefaultCountry(), []);
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [country, setCountry] = useState(initialCountry);
  const [currency, setCurrency] = useState(deriveDefaultCurrency(initialCountry));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Re-derive currency when country changes (user can override after).
  useEffect(() => {
    setCurrency(deriveDefaultCurrency(country));
  }, [country]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const cookie = document.cookie.match(/__session=([^;]+)/);
      const token = cookie?.[1] || '';
      const resp = await fetch('/api/me/complete-registration', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ display_name: displayName.trim(), country, currency }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.detail || 'Failed to complete registration');
      }
      // Backend auto-accepted any pending invitation. Refresh /api/me so
      // the auth store flips to state="active" and ProtectedRoute lets us
      // through to /dashboard.
      await fetchUserInfo();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to complete registration';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const valid =
    displayName.trim().length >= 2 &&
    displayName.trim().length <= 50 &&
    /^[A-Z]{2}$/.test(country) &&
    /^[A-Z]{3}$/.test(currency);

  return (
    <div className="min-h-screen flex items-center justify-center bg-ga-bg-primary px-4">
      <div className="w-full max-w-sm">
        <div className="bg-ga-bg-card border border-ga-border rounded-xl p-8">
          <div className="text-center mb-6">
            <div className="text-3xl mb-2">🛒</div>
            <h1 className="text-xl font-bold text-ga-text-primary">Tell us about you</h1>
            <p className="text-sm text-ga-text-secondary mt-1">
              Just three quick fields to finish setting up.
            </p>
            {user?.invitation_household_name && (
              <div className="mt-3 bg-ga-accent/10 border border-ga-accent/30 rounded-md p-2 text-xs text-ga-accent">
                You'll join <strong>{user.invitation_household_name}</strong> after you submit.
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className="block text-xs font-medium text-ga-text-secondary mb-1.5"
                title="The name household members and shopping-list collaborators will see next to your actions. Editable later in Settings."
              >
                Display name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                minLength={2}
                maxLength={50}
                className="w-full bg-ga-bg-primary border border-ga-border rounded-md px-3 py-2 text-sm text-ga-text-primary placeholder:text-gray-600 focus:border-ga-accent focus:ring-1 focus:ring-ga-accent/30 outline-none"
                placeholder="What family + housemates call you"
              />
            </div>

            <div>
              <label
                className="block text-xs font-medium text-ga-text-secondary mb-1.5"
                title="Used to suggest local foodbanks and pick a default currency. Pre-filled from your browser locale."
              >
                Country
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
                className="w-full bg-ga-bg-primary border border-ga-border rounded-md px-3 py-2 text-sm text-ga-text-primary focus:border-ga-accent focus:ring-1 focus:ring-ga-accent/30 outline-none"
                required
              >
                {ISO_3166_COUNTRIES.map((c: CountryEntry) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                className="block text-xs font-medium text-ga-text-secondary mb-1.5"
                title="The currency every spending and waste total is shown in. Past prices keep their original FX rate; only future entries use the new setting."
              >
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                className="w-full bg-ga-bg-primary border border-ga-border rounded-md px-3 py-2 text-sm text-ga-text-primary focus:border-ga-accent focus:ring-1 focus:ring-ga-accent/30 outline-none"
                required
              >
                {ISO_4217_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-ga-text-secondary">
                Used to show prices in your familiar currency. Change later in Settings.
              </p>
            </div>

            <button
              type="submit"
              disabled={!valid || submitting}
              title="Save your profile and go to the dashboard. If you arrived via an invite link, you'll be added to that household automatically."
              className="w-full bg-ga-accent hover:bg-ga-accent-hover text-white font-medium rounded-md px-3 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : 'Continue'}
            </button>
          </form>

          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-md px-3 py-2 text-sm">
              {error}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-ga-border text-center">
            <button
              type="button"
              onClick={signOut}
              className="text-xs text-ga-text-secondary hover:text-ga-text-primary"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
