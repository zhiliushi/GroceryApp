import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

/**
 * ProtectedRoute — gate for the AppLayout-wrapped routes.
 *
 * Onboarding v2 (PLAN_ONBOARDING_V2.md Phase 4):
 *   - Unauthenticated → /login
 *   - state="verify_email_required" → /auth/verify-email
 *   - state="pending_approval"      → /auth/pending
 *   - state="registration_required" → /register
 *   - state="disabled"              → /auth/disabled
 *   - state="registration_closed"   → /auth/closed
 *   - state="active" (or absent)    → render children
 *
 * Older backends (pre-Phase-2) don't return a `state` field; we treat that
 * as `active` for backward compatibility. Once Phase 6 ships and all clients
 * are on the new SPA, we can drop that fallback.
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, initialized, user } = useAuthStore();
  const location = useLocation();

  if (!initialized || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ga-accent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const state = user?.state ?? 'active';

  if (state === 'verify_email_required') {
    return <Navigate to="/auth/verify-email" replace />;
  }
  if (state === 'pending_approval') {
    return <Navigate to="/auth/pending" replace />;
  }
  if (state === 'registration_required') {
    return <Navigate to="/register" replace />;
  }
  if (state === 'disabled') {
    return <Navigate to="/auth/disabled" replace />;
  }
  if (state === 'registration_closed') {
    return <Navigate to="/auth/closed" replace />;
  }

  return <>{children}</>;
}
