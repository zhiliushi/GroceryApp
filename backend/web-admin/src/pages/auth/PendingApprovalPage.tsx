/**
 * PendingApprovalPage — shown to self-signup users while admin reviews their
 * account. Per Decision #2, an admin notification email fires on creation;
 * the user just waits.
 *
 * Polls /api/me every 30 seconds so approval is reflected without a manual
 * refresh — but bounded (stops after 30 mins of polling, user can manual-refresh).
 */
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

const POLL_INTERVAL_MS = 30_000;
const MAX_POLLS = 60; // 30 min total

function formatRelative(epochMs: number | undefined): string {
  if (!epochMs) return 'just now';
  const ageMs = Date.now() - epochMs;
  const min = Math.floor(ageMs / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export default function PendingApprovalPage() {
  const { user, signOut, fetchUserInfo } = useAuthStore();
  const [pollCount, setPollCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (pollCount >= MAX_POLLS) return;
    const t = window.setTimeout(() => {
      void fetchUserInfo();
      setPollCount((n) => n + 1);
    }, POLL_INTERVAL_MS);
    return () => window.clearTimeout(t);
  }, [pollCount, fetchUserInfo]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchUserInfo();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ga-bg-primary px-4">
      <div className="w-full max-w-sm">
        <div className="bg-ga-bg-card border border-ga-border rounded-xl p-8">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">⏳</div>
            <h1 className="text-xl font-bold text-ga-text-primary">Awaiting approval</h1>
            <p className="text-sm text-ga-text-secondary mt-2">
              Your sign-up request was sent to the admin.
            </p>
            {user?.email && (
              <p className="text-xs text-ga-text-secondary mt-1 break-all">
                Account: <span className="text-ga-text-primary">{user.email}</span>
              </p>
            )}
            {user?.pending_since && (
              <p className="text-xs text-ga-text-secondary mt-1">
                Submitted {formatRelative(user.pending_since)}
              </p>
            )}
          </div>

          <div className="space-y-3 text-xs text-ga-text-secondary">
            <p>
              We'll email you once you're approved. Most requests are reviewed within 24 hours.
            </p>
            <p>
              Closed-beta access is invitation-first. If someone in the household is sending you an
              invitation by email, the link in that email will skip this queue automatically.
            </p>
          </div>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="w-full bg-ga-accent hover:bg-ga-accent-hover disabled:opacity-50 text-white font-medium rounded-md px-3 py-2 text-sm transition-colors"
            >
              {refreshing ? 'Checking...' : 'Check approval status'}
            </button>
          </div>

          {pollCount >= MAX_POLLS && (
            <div className="mt-3 text-xs text-ga-text-secondary text-center">
              Auto-checks paused. Use the button above to check again.
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
