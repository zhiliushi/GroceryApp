import { useState, useMemo } from 'react';
import { useUsers } from '@/api/queries/useUsers';
import {
  useChangeTier,
  useToggleUserStatus,
  useApproveUser,
  useDeleteUser,
  useUpdateUserTools,
} from '@/api/mutations/useUserMutations';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import ToolSelectionModal from './ToolSelectionModal';
import { formatDate, truncateUid } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { User } from '@/types/api';

const TIER_OPTIONS = [
  { value: 'free', label: 'Basic Basket' },
  { value: 'plus', label: 'Smart Cart' },
  { value: 'pro', label: 'Full Fridge' },
];

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-400',
  pending: 'text-yellow-400',
  disabled: 'text-red-400',
};

const STATUS_ICONS: Record<string, string> = {
  active: '●',
  pending: '○',
  disabled: '✗',
};

export default function UserApprovalTab() {
  const { data, isLoading } = useUsers();
  const changeTier = useChangeTier();
  const toggleStatus = useToggleUserStatus();
  const approveUser = useApproveUser();
  const deleteUser = useDeleteUser();
  const updateTools = useUpdateUserTools();
  const dialog = useConfirmDialog();

  const [statusFilter, setStatusFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [toolsUser, setToolsUser] = useState<User | null>(null);

  const users = useMemo(() => {
    let list = data?.users || [];
    if (statusFilter) list = list.filter((u) => (u.status || 'active') === statusFilter);
    if (tierFilter) list = list.filter((u) => (u.tier || 'free') === tierFilter);
    return list;
  }, [data, statusFilter, tierFilter]);

  if (isLoading) return <LoadingSpinner />;

  const handleTierChange = (user: User, newTier: string) => {
    dialog.confirm({
      title: 'Change Tier',
      message: `Change ${user.email || user.uid} tier to ${TIER_OPTIONS.find((t) => t.value === newTier)?.label || newTier}?`,
      variant: 'default',
      onConfirm: () => changeTier.mutate({ uid: user.uid, tier: newTier }),
    });
  };

  return (
    <>
      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs text-ga-text-secondary">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-ga-bg-primary border border-ga-border rounded px-2 py-1.5 text-sm text-ga-text-primary outline-none"
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-ga-text-secondary">Tier:</label>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="bg-ga-bg-primary border border-ga-border rounded px-2 py-1.5 text-sm text-ga-text-primary outline-none"
          >
            <option value="">All</option>
            {TIER_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-ga-bg-card border border-ga-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ga-border">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ga-text-secondary">Email</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ga-text-secondary">Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ga-text-secondary">Tier</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ga-text-secondary">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ga-text-secondary">Joined</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-ga-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const status = user.status || 'active';
                const tier = user.tier || 'free';

                return (
                  <tr key={user.uid} className="border-b border-ga-border/50 hover:bg-ga-bg-hover transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="text-ga-text-primary">{user.email || '—'}</span>
                      <div className="text-xs text-ga-text-secondary font-mono" title={user.uid}>
                        {truncateUid(user.uid)}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-ga-text-primary">{user.displayName || '—'}</td>
                    <td className="px-4 py-2.5">
                      <select
                        value={tier}
                        onChange={(e) => handleTierChange(user, e.target.value)}
                        className="bg-ga-bg-primary border border-ga-border rounded px-2 py-1 text-xs text-ga-text-primary outline-none"
                      >
                        {TIER_OPTIONS.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn('text-sm', STATUS_COLORS[status] || 'text-ga-text-secondary')}>
                        {STATUS_ICONS[status] || '?'} {status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-ga-text-secondary text-xs">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Tools button for Smart Cart users */}
                        {tier === 'plus' && (
                          <button
                            onClick={() => setToolsUser(user)}
                            className="text-blue-400 hover:text-blue-300 text-xs px-2 py-1 border border-blue-500/30 rounded transition-colors"
                          >
                            Tools
                          </button>
                        )}

                        {/* Approve button for pending */}
                        {status === 'pending' && (
                          <button
                            onClick={() => approveUser.mutate(user.uid)}
                            className="text-green-400 hover:text-green-300 text-xs px-2 py-1 border border-green-500/30 rounded transition-colors"
                          >
                            ✓ Approve
                          </button>
                        )}

                        {/* Enable/Disable toggle */}
                        {status === 'active' && (
                          <button
                            onClick={() =>
                              dialog.confirm({
                                title: 'Disable User',
                                message: `Disable ${user.email || user.uid}? They will not be able to access the app.`,
                                variant: 'danger',
                                onConfirm: () => toggleStatus.mutate({ uid: user.uid, status: 'disabled' }),
                              })
                            }
                            className="text-yellow-400 hover:text-yellow-300 text-xs px-2 py-1 border border-yellow-500/30 rounded transition-colors"
                          >
                            Disable
                          </button>
                        )}
                        {status === 'disabled' && (
                          <button
                            onClick={() => toggleStatus.mutate({ uid: user.uid, status: 'active' })}
                            className="text-green-400 hover:text-green-300 text-xs px-2 py-1 border border-green-500/30 rounded transition-colors"
                          >
                            Enable
                          </button>
                        )}

                        {/* Delete */}
                        <button
                          onClick={() =>
                            dialog.confirm({
                              title: 'Delete User',
                              message: `Permanently delete ${user.email || user.uid}? This removes their Firestore data and Firebase Auth account.`,
                              variant: 'danger',
                              onConfirm: () => deleteUser.mutate(user.uid),
                            })
                          }
                          className="text-red-400 hover:text-red-300 text-xs px-2 py-1"
                        >
                          ✗
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ga-text-secondary">
                    No users match the filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog state={dialog.state} onCancel={dialog.close} />

      {toolsUser && (
        <ToolSelectionModal
          user={toolsUser}
          onSave={(tools) => {
            updateTools.mutate({ uid: toolsUser.uid, tools }, { onSuccess: () => setToolsUser(null) });
          }}
          onClose={() => setToolsUser(null)}
          isSaving={updateTools.isPending}
        />
      )}
    </>
  );
}
