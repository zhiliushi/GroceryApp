/**
 * StateGate — inverse of ProtectedRoute, used by the auth-state pages.
 *
 * Each auth-state page (verify-email, pending, register, disabled, closed)
 * is reachable ONLY when the user's `state` matches that page. If the user
 * is unauthenticated, redirect to /login. If their state has moved on
 * (e.g. they just got approved while sitting on /auth/pending), redirect
 * to where they belong now.
 *
 * This is the symmetric counterpart to ProtectedRoute — together they form
 * the AuthGate for Onboarding v2.
 */
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import type { AuthState } from '@/types/api';

interface StateGateProps {
  /** The state this page is for. User is allowed if their state === this value. */
  requires: AuthState;
  children: React.ReactNode;
}

const STATE_DESTINATION: Record<AuthState, string> = {
  unauthenticated: '/login',
  verify_email_required: '/auth/verify-email',
  pending_approval: '/auth/pending',
  registration_required: '/register',
  disabled: '/auth/disabled',
  registration_closed: '/auth/closed',
  active: '/dashboard',
};

export default function StateGate({ requires, children }: StateGateProps) {
  const { isAuthenticated, loading, initialized, user } = useAuthStore();

  if (!initialized || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ga-accent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const state = user?.state ?? 'active';
  if (state === requires) return <>{children}</>;

  // State doesn't match — route to wherever this user belongs now.
  return <Navigate to={STATE_DESTINATION[state] ?? '/dashboard'} replace />;
}
