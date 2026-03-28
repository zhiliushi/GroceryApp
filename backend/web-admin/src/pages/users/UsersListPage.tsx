import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useUsers } from '@/api/queries/useUsers';
import { useToggleUserRole } from '@/api/mutations/useUserMutations';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import DataTable, { type Column } from '@/components/shared/DataTable';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { formatDate, formatRelativeDate } from '@/utils/format';
import type { User } from '@/types/api';

function getInitials(user: User): string {
  if (user.displayName) {
    return user.displayName
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
  if (user.email) return user.email[0].toUpperCase();
  return '?';
}

export default function UsersListPage() {
  const { data, isLoading } = useUsers();
  const toggleRole = useToggleUserRole();
  const dialog = useConfirmDialog();

  const columns: Column<User>[] = useMemo(
    () => [
      {
        key: 'avatar',
        header: '',
        className: 'w-[50px]',
        render: (u) => (
          <div className="w-8 h-8 rounded-full bg-ga-accent/20 text-ga-accent flex items-center justify-center text-xs font-bold">
            {getInitials(u)}
          </div>
        ),
      },
      {
        key: 'email',
        header: 'Email',
        render: (u) => (
          <Link
            to={`/users/${u.uid}`}
            className="text-ga-accent hover:underline text-sm"
          >
            {u.email || '—'}
          </Link>
        ),
      },
      {
        key: 'displayName',
        header: 'Name',
        render: (u) => (
          <span className="font-medium text-ga-text-primary">
            {u.displayName || '—'}
          </span>
        ),
      },
      {
        key: 'role',
        header: 'Role',
        headerClassName: 'text-center',
        className: 'text-center',
        render: (u) => <StatusBadge status={u.role} />,
      },
      {
        key: 'created',
        header: 'Created',
        render: (u) => (
          <span className="text-xs text-ga-text-secondary">
            {formatDate(u.createdAt)}
          </span>
        ),
      },
      {
        key: 'lastLogin',
        header: 'Last Login',
        render: (u) => (
          <span className="text-xs text-ga-text-secondary">
            {formatRelativeDate(u.updatedAt)}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        headerClassName: 'text-right',
        className: 'text-right',
        render: (u) => {
          const isAdmin = u.role === 'admin';
          const newRole = isAdmin ? 'user' : 'admin';
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                dialog.confirm({
                  title: isAdmin ? 'Demote User' : 'Promote User',
                  message: `${isAdmin ? 'Demote' : 'Promote'} "${u.displayName || u.email}" to ${newRole}?`,
                  variant: isAdmin ? 'danger' : 'default',
                  onConfirm: () => toggleRole.mutate({ uid: u.uid, role: newRole }),
                });
              }}
              disabled={toggleRole.isPending}
              className={
                isAdmin
                  ? 'text-xs px-2.5 py-1 rounded border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50'
                  : 'text-xs px-2.5 py-1 rounded border border-green-500/50 text-green-400 hover:bg-green-500/10 transition-colors disabled:opacity-50'
              }
            >
              {isAdmin ? 'Demote' : 'Promote'}
            </button>
          );
        },
      },
    ],
    [dialog, toggleRole],
  );

  return (
    <div className="p-6">
      <PageHeader title="Users" icon="👥" count={data?.count} />

      <DataTable
        data={data?.users ?? []}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No users found"
        emptyIcon="👥"
        getKey={(u) => u.uid}
      />

      <ConfirmDialog state={dialog.state} onCancel={dialog.close} />
    </div>
  );
}
