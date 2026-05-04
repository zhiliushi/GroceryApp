/**
 * RegistrationClosedPage — shown when:
 *   - Admin flipped `registration_open=false`, OR
 *   - `max_active_users` cap is reached and user isn't already on the waitlist.
 *
 * No retry button — the only way through is admin action (raise cap or open
 * registration). User can sign out and try later.
 */
import { useAuthStore } from '@/stores/authStore';

export default function RegistrationClosedPage() {
  const { user, signOut } = useAuthStore();

  return (
    <div className="min-h-screen flex items-center justify-center bg-ga-bg-primary px-4">
      <div className="w-full max-w-sm">
        <div className="bg-ga-bg-card border border-ga-border rounded-xl p-8">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🚧</div>
            <h1 className="text-xl font-bold text-ga-text-primary">Registration closed</h1>
            <p className="text-sm text-ga-text-secondary mt-2">
              {user?.reason || "We're not accepting new sign-ups right now."}
            </p>
          </div>

          <div className="text-xs text-ga-text-secondary text-center space-y-2">
            <p>
              Closed-beta capacity is limited. If someone in the household is sending you an
              invitation by email, that link bypasses this gate.
            </p>
            <p>Otherwise, check back later — the admin will open it up when there's room.</p>
          </div>

          <div className="mt-6 pt-4 border-t border-ga-border text-center">
            <button
              type="button"
              onClick={signOut}
              title="Sign out and try again later. Your sign-in record was cleared because there was no slot available."
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
