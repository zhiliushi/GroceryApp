import { useReminders } from '@/api/queries/useReminders';
import { useDismissReminder } from '@/api/mutations/useReminderMutations';
import { useUndoableAction } from '@/hooks/useUndoableAction';
import PageHeader from '@/components/shared/PageHeader';
import Breadcrumbs from '@/components/shared/Breadcrumbs';
import { SkeletonList } from '@/components/shared/Skeleton';
import type { ReminderDismissAction } from '@/types/api';

export default function RemindersPage() {
  const { data, isLoading } = useReminders(false);
  const dismiss = useDismissReminder();
  const undoable = useUndoableAction();

  function dispatchReminder(action: ReminderDismissAction, id: string, name: string) {
    const reason = action === 'thrown' ? 'expired' : undefined;
    undoable.run(
      () => dismiss.mutate({ id, data: { action, reason }, silent: true }),
      action === 'still_have' ? `Snoozed "${name}"` : `Marked "${name}" as ${action}`,
    );
  }

  return (
    <div className="p-6 space-y-4">
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Reminders' }]} />
      <PageHeader title="Reminders" icon="⏰" />
      {isLoading ? (
        <SkeletonList count={4} />
      ) : !data || data.reminders.length === 0 ? (
        <p className="text-sm text-ga-text-secondary">No active reminders.</p>
      ) : (
        <div className="space-y-2">
          {data.reminders.map((r) => (
            <div key={r.id} className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="text-sm font-medium text-ga-text-primary">{r.display_name}</div>
                  <div className="text-xs text-ga-text-secondary">{r.message}</div>
                  <div className="text-xs text-ga-text-secondary mt-1">
                    Stage {r.stage} days · created{' '}
                    {new Date(r.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => dispatchReminder('used', r.id, r.display_name)}
                    className="px-2 py-1 text-xs bg-blue-500/10 text-blue-600 rounded hover:bg-blue-500/20"
                  >
                    Used
                  </button>
                  <button
                    onClick={() => dispatchReminder('thrown', r.id, r.display_name)}
                    className="px-2 py-1 text-xs bg-red-500/10 text-red-600 rounded hover:bg-red-500/20"
                  >
                    Thrown
                  </button>
                  <button
                    onClick={() => dispatchReminder('still_have', r.id, r.display_name)}
                    className="px-2 py-1 text-xs bg-ga-bg-hover text-ga-text-secondary rounded hover:bg-ga-bg-card"
                  >
                    Still have
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
