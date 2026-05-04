import { useEffect, useState } from 'react';
import { Navigate, useParams, useNavigate, Link } from 'react-router-dom';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { useJoinHousehold } from '@/api/mutations/useHouseholdMutations';
import { useHousehold } from '@/api/queries/useHousehold';
import { setPendingInvite, useAuthStore } from '@/stores/authStore';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface InviteInfo {
  valid: boolean;
  error?: string;
  household_name?: string;
  assigned_role?: string;
  expires_at?: string;
}

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const joinMutation = useJoinHousehold();
  // MH-1: surface the user's current household (if any) so we can tell them
  // they'll keep that membership when they accept this invite, instead of
  // throwing the legacy "leave first" error that no longer applies.
  const { data: currentHousehold } = useHousehold();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;
    apiClient.get(API.HOUSEHOLD_JOIN_INFO(code))
      .then((r) => setInfo(r.data))
      .catch(() => setInfo({ valid: false, error: 'Failed to load invitation' }))
      .finally(() => setLoading(false));
  }, [code]);

  const handleJoin = () => {
    if (!code) return;
    joinMutation.mutate(code, {
      onSuccess: () => navigate('/settings'),
    });
  };

  const handleSignInToJoin = () => {
    if (!code) return;
    // Onboarding v2 (PLAN_ONBOARDING_V2.md Phase 4): stash the code so
    // authStore.fetchUserInfo passes it to /api/me?invitation_code= after
    // Firebase sign-in completes. The backend then auto-approves the user
    // (skip admin queue) and links the profile to the invitation for later
    // auto-accept on registration completion.
    setPendingInvite(code);
    navigate('/login', { state: { from: `/join/${code}` } });
  };

  if (loading) return <LoadingSpinner text="Loading invitation..." />;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ga-bg-primary p-4">
        <div className="bg-ga-bg-card border border-ga-border rounded-xl p-8 max-w-sm text-center">
          <div className="text-4xl mb-3">🏠</div>
          <h1 className="text-lg font-semibold text-ga-text-primary mb-2">Join Household</h1>
          <p className="text-sm text-ga-text-secondary mb-4">
            {info?.valid
              ? `You're invited to join "${info.household_name}". Sign in to continue.`
              : 'Sign in to accept this invitation.'}
          </p>
          <button
            onClick={handleSignInToJoin}
            title="Sign in (or create an account) to accept this invitation. Invited accounts skip the admin approval queue."
            className="bg-ga-accent hover:bg-ga-accent/90 text-white text-sm font-medium rounded-lg px-6 py-2.5"
          >
            Sign in to join
          </button>
          <p className="mt-3 text-[11px] text-ga-text-secondary">
            Use the email address that received this invitation — codes are email-bound.
          </p>
        </div>
      </div>
    );
  }

  // Authenticated but not yet active (e.g. registration_required, pending_approval).
  // Send them through the normal auth funnel — ProtectedRoute / StateGate handles
  // the destination. The pending invitation, if it was bound at sign-in time,
  // auto-accepts when registration completes.
  const state = user?.state ?? 'active';
  if (state !== 'active') {
    return <Navigate to="/dashboard" replace />;
  }

  if (!info?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ga-bg-primary p-4">
        <div className="bg-ga-bg-card border border-ga-border rounded-xl p-8 max-w-sm text-center">
          <div className="text-4xl mb-3">❌</div>
          <h1 className="text-lg font-semibold text-ga-text-primary mb-2">Invalid Invitation</h1>
          <p className="text-sm text-ga-text-secondary mb-4">{info?.error || 'This invitation is not valid.'}</p>
          <Link to="/settings" className="text-ga-accent hover:underline text-sm">Go to Settings</Link>
        </div>
      </div>
    );
  }

  // MH-1: detect the multi-household case — user is already in a household
  // *different* from the invitation's. Under the corrected asymmetric model,
  // they can join the new one as a member without leaving the existing one.
  const existingHousehold = currentHousehold?.household ?? null;
  const isJoiningAdditionalHousehold =
    existingHousehold !== null && existingHousehold.id !== info.household_id;

  return (
    <div className="min-h-screen flex items-center justify-center bg-ga-bg-primary p-4">
      <div className="bg-ga-bg-card border border-ga-border rounded-xl p-8 max-w-sm text-center">
        <div className="text-4xl mb-3">🏠</div>
        <h1 className="text-lg font-semibold text-ga-text-primary mb-2">
          Join {info.household_name}
        </h1>
        <p className="text-sm text-ga-text-secondary mb-1">
          You'll share grocery inventory, shopping lists, and price data.
        </p>
        {info.assigned_role && (
          <p className="text-sm text-ga-text-secondary mb-4">
            Your role: <strong className="text-ga-text-primary capitalize">{info.assigned_role}</strong>
          </p>
        )}

        {/* MH-1: clarifying line for users already in another household.
            Replaces the legacy "leave first" error path — multi-membership
            is now allowed for member role. */}
        {isJoiningAdditionalHousehold && (
          <div className="bg-ga-accent/10 border border-ga-accent/30 rounded-lg px-3 py-2 text-xs text-ga-text-primary mb-4 text-left leading-snug">
            <p className="font-medium mb-1">You&apos;re already in {existingHousehold.name}.</p>
            <p className="text-ga-text-secondary">
              Joining {info.household_name} keeps that membership — you&apos;ll be able
              to switch between them using the household pill in the top bar.
            </p>
          </div>
        )}

        {joinMutation.error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-400 mb-4">
            {joinMutation.error.message}
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <button onClick={handleJoin} disabled={joinMutation.isPending}
            title={
              isJoiningAdditionalHousehold
                ? `Join ${info.household_name} as a member while staying in ${existingHousehold.name}.`
                : 'Accept the invitation and start sharing inventory with the household.'
            }
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-6 py-2.5">
            {joinMutation.isPending ? 'Joining...' : 'Join Household'}
          </button>
          <Link to="/dashboard"
            title="Decline for now. The invitation stays valid until it expires; you can come back to this link anytime."
            className="border border-ga-border text-ga-text-secondary text-sm rounded-lg px-6 py-2.5 hover:text-ga-text-primary">
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
