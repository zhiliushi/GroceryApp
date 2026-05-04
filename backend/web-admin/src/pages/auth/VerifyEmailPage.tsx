/**
 * VerifyEmailPage — shown when a password-provider user signed up but hasn't
 * clicked the verification link yet. Backend's `_verify_token` rejects their
 * token, so they technically reach the unauthenticated state — but this page
 * is what we redirect them to BEFORE that rejection fires (during their first
 * sign-in attempt). Implementation note: the StateGate route uses
 * requires="verify_email_required" but we also handle the
 * just-signed-up-but-not-yet-verified case where Firebase Auth has them
 * authenticated locally even though the backend won't.
 *
 * Resend verification uses the Firebase web SDK directly (no backend round-trip).
 */
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getAuth, sendEmailVerification } from 'firebase/auth';
import { useAuthStore } from '@/stores/authStore';

export default function VerifyEmailPage() {
  const { firebaseUser, signOut, fetchUserInfo } = useAuthStore();
  const [sending, setSending] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  if (!firebaseUser) {
    return <Navigate to="/login" replace />;
  }

  const handleResend = async () => {
    setSending(true);
    setError('');
    try {
      const auth = getAuth();
      if (!auth.currentUser) throw new Error('Not signed in');
      await sendEmailVerification(auth.currentUser);
      setSentAt(Date.now());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend';
      setError(msg.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim());
    } finally {
      setSending(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Force-refresh the ID token so the new email_verified claim flows through.
      const auth = getAuth();
      if (auth.currentUser) {
        await auth.currentUser.reload();
        await auth.currentUser.getIdToken(true);
      }
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
            <div className="text-4xl mb-2">✉️</div>
            <h1 className="text-xl font-bold text-ga-text-primary">Verify your email</h1>
            <p className="text-sm text-ga-text-secondary mt-2">
              We sent a verification link to
            </p>
            <p className="text-sm font-medium text-ga-text-primary mt-1 break-all">
              {firebaseUser.email}
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              title="Tap after you click the link in your inbox. We re-check your verification status and let you in."
              className="w-full bg-ga-accent hover:bg-ga-accent-hover disabled:opacity-50 text-white font-medium rounded-md px-3 py-2 text-sm transition-colors"
            >
              {refreshing ? 'Checking...' : "I've verified — refresh"}
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={sending || (sentAt !== null && Date.now() - sentAt < 60_000)}
              title="If the email didn't arrive, send another. There's a 60-second cooldown to prevent spam."
              className="w-full border border-ga-border hover:bg-ga-bg-hover disabled:opacity-50 text-ga-text-primary text-sm font-medium rounded-md px-3 py-2 transition-colors"
            >
              {sending
                ? 'Sending...'
                : sentAt !== null
                ? Date.now() - sentAt < 60_000
                  ? 'Resend (wait 1 min)'
                  : 'Resend verification email'
                : 'Resend verification email'}
            </button>
          </div>

          <p className="mt-4 text-[11px] text-ga-text-secondary text-center leading-snug">
            Didn&apos;t get it? Check spam, or use <em>Resend</em>. The verification link is sent
            by Firebase, not from a person — replies bounce.
          </p>

          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-md px-3 py-2 text-sm">
              {error}
            </div>
          )}
          {sentAt !== null && !error && (
            <div className="mt-4 bg-green-500/10 border border-green-500/30 text-green-400 rounded-md px-3 py-2 text-sm">
              Verification email sent. Check your inbox + spam folder.
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
