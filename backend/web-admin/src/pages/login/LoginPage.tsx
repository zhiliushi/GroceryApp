import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export default function LoginPage() {
  const { isAuthenticated, initialized, signInWithEmail, signInWithGoogle } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (initialized && isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmail(email, password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed';
      setError(msg.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim());
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      console.error('Google sign-in error:', err);
      const msg = err instanceof Error ? err.message : 'Google sign in failed';
      setError(msg.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim() || 'Google sign-in failed. Is the Google provider enabled in Firebase Console?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ga-bg-primary px-4">
      <div className="w-full max-w-sm">
        <div className="bg-ga-bg-card border border-ga-border rounded-xl p-8">
          <div className="text-center mb-6">
            <span className="text-3xl">🛒</span>
            <h1 className="text-xl font-bold text-ga-text-primary mt-2">GroceryApp</h1>
            <p className="text-sm text-ga-text-secondary mt-1">Sign in to your account</p>
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ga-text-secondary mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-ga-bg-primary border border-ga-border rounded-md px-3 py-2 text-sm text-ga-text-primary placeholder:text-gray-600 focus:border-ga-accent focus:ring-1 focus:ring-ga-accent/30 outline-none"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ga-text-secondary mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-ga-bg-primary border border-ga-border rounded-md px-3 py-2 text-sm text-ga-text-primary placeholder:text-gray-600 focus:border-ga-accent focus:ring-1 focus:ring-ga-accent/30 outline-none"
                placeholder="Enter your password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ga-accent hover:bg-ga-accent-hover text-white font-medium rounded-md px-3 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="flex items-center my-4">
            <div className="flex-1 border-t border-ga-border" />
            <span className="px-3 text-xs text-ga-text-secondary">or</span>
            <div className="flex-1 border-t border-ga-border" />
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full border border-ga-border text-ga-text-primary hover:bg-ga-bg-hover font-medium rounded-md px-3 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Sign in with Google
          </button>

          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-md px-3 py-2 text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
