import { useState } from 'react';
import { useHousehold } from '@/api/queries/useHousehold';
import {
  useCreateHousehold,
  useDissolveHousehold,
  useLeaveHousehold,
  useRemoveMember,
  useRenameHousehold,
  useGenerateInvite,
  useRevokeInvite,
  useJoinHousehold,
} from '@/api/mutations/useHouseholdMutations';
import { useAuthStore } from '@/stores/authStore';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { cn } from '@/utils/cn';
import type { FamilyRole } from '@/types/api';

export default function HouseholdSection() {
  const { data, isLoading } = useHousehold();
  const user = useAuthStore((s) => s.user);

  if (isLoading) return <LoadingSpinner text="Loading household..." />;

  const household = data?.household;

  if (!household) {
    return <NoHouseholdView availableRoles={data?.available_roles ?? []} />;
  }

  return <HouseholdView data={data!} currentUid={user?.uid ?? ''} />;
}


// ==========================================================================
// No Household — Create or Join
// ==========================================================================

function NoHouseholdView({ availableRoles }: { availableRoles: FamilyRole[] }) {
  const [name, setName] = useState('');
  const [selectedRole, setSelectedRole] = useState('papa');
  const [joinCode, setJoinCode] = useState('');

  const createMutation = useCreateHousehold();
  const joinMutation = useJoinHousehold();

  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5">
      <h2 className="text-sm font-semibold text-ga-text-primary mb-4">🏠 Household</h2>

      <p className="text-sm text-ga-text-secondary mb-4">
        You're not in a household. Create one to share grocery data with family.
      </p>

      {/* Create */}
      <div className="space-y-3 mb-6">
        <div>
          <label className="block text-xs text-ga-text-secondary mb-1">Household Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Shahir's Family"
            className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary" />
        </div>

        <div>
          <label className="block text-xs text-ga-text-secondary mb-1">Your Role</label>
          <div className="flex gap-2 flex-wrap">
            {availableRoles.map((role) => (
              <button key={role.key} onClick={() => setSelectedRole(role.key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1.5',
                  selectedRole === role.key
                    ? 'bg-ga-accent text-white'
                    : 'border border-ga-border text-ga-text-secondary hover:bg-ga-bg-hover',
                )}>
                <span>{role.icon}</span> {role.name}
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => createMutation.mutate({ name, role: selectedRole })}
          disabled={name.trim().length < 2 || createMutation.isPending}
          className="bg-ga-accent hover:bg-ga-accent/90 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2">
          {createMutation.isPending ? 'Creating...' : '🏠 Create Household'}
        </button>
      </div>

      {/* Join */}
      <div className="border-t border-ga-border pt-4">
        <label className="block text-xs text-ga-text-secondary mb-1">Have an invite code?</label>
        <div className="flex gap-2">
          <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ABC123" maxLength={6}
            className="w-32 bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary font-mono text-center uppercase" />
          <button onClick={() => joinMutation.mutate(joinCode)}
            disabled={joinCode.length < 4 || joinMutation.isPending}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2">
            {joinMutation.isPending ? 'Joining...' : 'Join'}
          </button>
        </div>
      </div>
    </div>
  );
}


// ==========================================================================
// Household View — Members + Invites
// ==========================================================================

function HouseholdView({ data, currentUid }: { data: import('@/types/api').HouseholdResponse; currentUid: string }) {
  const household = data.household!;
  const isOwner = household.owner_uid === currentUid;
  const members = household.members;
  const activeCount = members.filter((m) => !m.frozen).length;
  const pendingInvites = data.pending_invites;

  const [inviteRole, setInviteRole] = useState('brother');
  const [inviteEmail, setInviteEmail] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(household.name);

  const renameMutation = useRenameHousehold();
  const dissolveMutation = useDissolveHousehold();
  const leaveMutation = useLeaveHousehold();
  const removeMutation = useRemoveMember();
  const inviteMutation = useGenerateInvite();
  const revokeMutation = useRevokeInvite();
  const dialog = useConfirmDialog();

  const handleInvite = () => {
    inviteMutation.mutate(
      { role: inviteRole, email: inviteEmail || undefined },
      { onSuccess: (result) => setGeneratedCode(result.invitation?.code ?? null) },
    );
  };

  const copyLink = (code: string) => {
    const link = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(link);
    import('sonner').then((m) => m.toast.success('Link copied!'));
  };

  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {editingName ? (
            <div className="flex items-center gap-2">
              <input value={newName} onChange={(e) => setNewName(e.target.value)}
                className="bg-ga-bg-hover border border-ga-border rounded px-2 py-1 text-sm text-ga-text-primary" />
              <button onClick={() => { renameMutation.mutate(newName); setEditingName(false); }}
                className="text-xs text-ga-accent">Save</button>
              <button onClick={() => setEditingName(false)} className="text-xs text-ga-text-secondary">Cancel</button>
            </div>
          ) : (
            <h2 className="text-sm font-semibold text-ga-text-primary flex items-center gap-2">
              🏠 {household.name}
              {isOwner && (
                <button onClick={() => setEditingName(true)} className="text-xs text-ga-text-secondary hover:text-ga-accent">✏️</button>
              )}
            </h2>
          )}
          <span className="text-xs text-ga-text-secondary capitalize">
            {household.tier} • {activeCount}/{household.max_members} members
          </span>
        </div>
      </div>

      {/* Members */}
      <div>
        <h3 className="text-xs font-semibold text-ga-text-secondary uppercase tracking-wide mb-2">Members</h3>
        <div className="space-y-1.5">
          {members.map((m) => (
            <div key={m.uid}
              className={cn('flex items-center gap-3 px-3 py-2 rounded-lg', m.frozen ? 'opacity-40 bg-ga-bg-hover' : '')}>
              <span className="text-lg" style={{ color: m.role_color }}>{m.role_icon}</span>
              <div className="flex-1">
                <span className="text-sm text-ga-text-primary font-medium">{m.display_role}</span>
                <span className="text-xs text-ga-text-secondary ml-2">{m.display_name}</span>
                {m.uid === currentUid && <span className="text-xs text-ga-accent ml-1">(you)</span>}
                {m.frozen && <span className="text-xs text-yellow-400 ml-2">frozen</span>}
              </div>
              <span className="text-[10px] text-ga-text-secondary">{m.role}</span>
              {isOwner && m.uid !== currentUid && !m.frozen && (
                <button onClick={() => dialog.confirm({
                  title: 'Remove Member',
                  message: `Remove ${m.display_name} from the household?`,
                  variant: 'danger',
                  onConfirm: () => removeMutation.mutate(m.uid),
                })}
                  className="text-xs text-red-400 hover:text-red-300">Remove</button>
              )}
            </div>
          ))}
        </div>

        {/* Available roles */}
        {data.available_roles.length > members.length && (
          <p className="text-xs text-ga-text-secondary mt-2">
            Available roles: {data.available_roles
              .filter((r) => !members.some((m) => m.default_role === r.key))
              .map((r) => `${r.icon} ${r.name}`)
              .join(', ')}
          </p>
        )}
      </div>

      {/* Invite (owner only) */}
      {isOwner && activeCount < household.max_members && (
        <div className="border-t border-ga-border pt-4">
          <h3 className="text-xs font-semibold text-ga-text-secondary uppercase tracking-wide mb-2">Invite</h3>

          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs text-ga-text-secondary">Role:</label>
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
              className="bg-ga-bg-hover border border-ga-border rounded px-2 py-1 text-xs text-ga-text-primary">
              {data.available_roles
                .filter((r) => !members.some((m) => m.default_role === r.key && !m.frozen))
                .map((r) => (
                  <option key={r.key} value={r.key}>{r.icon} {r.name}</option>
                ))}
            </select>
          </div>

          <div className="flex gap-2 mb-2">
            <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email (optional)" type="email"
              className="flex-1 bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary" />
            <button onClick={handleInvite} disabled={inviteMutation.isPending}
              className="bg-ga-accent hover:bg-ga-accent/90 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2">
              {inviteMutation.isPending ? '...' : 'Generate Code'}
            </button>
          </div>

          {generatedCode && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
              <code className="text-lg font-mono font-bold text-green-400">{generatedCode}</code>
              <button onClick={() => copyLink(generatedCode)} className="text-xs text-ga-accent hover:underline">
                📋 Copy Link
              </button>
            </div>
          )}

          {/* Pending invites */}
          {pendingInvites.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs text-ga-text-secondary">Pending invitations:</p>
              {pendingInvites.map((inv) => (
                <div key={inv.code} className="flex items-center gap-2 text-xs">
                  <code className="font-mono text-ga-text-primary">{inv.code}</code>
                  <span className="text-ga-text-secondary">
                    {inv.assigned_role} • expires {new Date(inv.expires_at).toLocaleDateString()}
                  </span>
                  {inv.invited_email && <span className="text-ga-text-secondary">→ {inv.invited_email}</span>}
                  <button onClick={() => revokeMutation.mutate(inv.code)}
                    className="text-red-400 hover:text-red-300 ml-auto">Revoke</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="border-t border-ga-border pt-4 flex gap-2">
        {isOwner ? (
          <button onClick={() => dialog.confirm({
            title: 'Dissolve Household',
            message: `Dissolve "${household.name}"? All ${activeCount} members will lose shared access. No data is deleted.`,
            variant: 'danger',
            onConfirm: () => dissolveMutation.mutate(),
          })}
            className="text-xs text-red-400 hover:text-red-300">
            🗑 Dissolve Household
          </button>
        ) : (
          <button onClick={() => dialog.confirm({
            title: 'Leave Household',
            message: `Leave "${household.name}"? You'll keep your own data but lose shared access.`,
            variant: 'danger',
            onConfirm: () => leaveMutation.mutate(),
          })}
            className="text-xs text-red-400 hover:text-red-300">
            Leave Household
          </button>
        )}
      </div>

      <ConfirmDialog state={dialog.state} onCancel={dialog.close} />
    </div>
  );
}
