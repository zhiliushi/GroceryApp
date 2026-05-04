/**
 * DisabledPage — terminal state. Admin disabled the account. User cannot
 * proceed beyond this screen; their refresh tokens are revoked server-side
 * (via `firebase_auth.revoke_refresh_tokens` in `update_user_status` and
 * `reject_user`) so signing out + back in won't help.
 */
import { useAuthStore } from '@/stores/authStore';

export default function DisabledPage() {
  const { user, signOut } = useAuthStore();

  return (
    <div className="min-h-screen flex items-center justify-center bg-ga-bg-primary px-4">
      <div className="w-full max-w-sm">
        <div className="bg-ga-bg-card border border-ga-border rounded-xl p-8">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🚫</div>
            <h1 className="text-xl font-bold text-ga-text-primary">Account disabled</h1>
            <p className="text-sm text-ga-text-secondary mt-2">
              {user?.disabled_reason
                ? `Reason: ${user.disabled_reason}`
                : 'This account has been disabled by an administrator.'}
            </p>
            {user?.email && (
              <p className="text-xs text-ga-text-secondary mt-2 break-all">
                Account: <span className="text-ga-text-primary">{user.email}</span>
              </p>
            )}
          </div>

          <div className="text-xs text-ga-text-secondary text-center space-y-1">
            <p>Contact the admin if you believe this is a mistake.</p>
            <p className="text-[11px]">
              Signing out and back in will not restore access — re-enabling has to come from the admin side.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-ga-border text-center">
            <button
              type="button"
              onClick={signOut}
              title="Clears your local session. The account stays disabled on the server until an admin re-enables it."
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
