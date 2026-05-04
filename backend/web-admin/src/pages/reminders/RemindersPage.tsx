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

      <details className="bg-ga-bg-card border border-ga-border rounded-lg group">
        <summary className="cursor-pointer list-none px-4 py-2 text-xs text-ga-text-secondary flex items-center justify-between hover:bg-ga-bg-hover/40 rounded-lg">
          <span>ⓘ How do reminders work?</span>
          <span className="text-[10px] group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="px-4 pb-3 pt-1 text-xs text-ga-text-secondary space-y-1.5 border-t border-ga-border">
          <p>
            <span className="text-ga-text-primary font-medium">Why am I seeing this?</span>{' '}
            You bought an item but didn&apos;t record an expiry date. After 7 days the app
            checks in to make sure it isn&apos;t forgotten. Stages re-fire at 14 and 21 days
            if you haven&apos;t logged what happened.
          </p>
          <p>
            <span className="text-ga-text-primary font-medium">What the buttons do:</span>
          </p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>
              <span className="text-blue-600 font-medium">Used</span> — marks the item used.
              Counts as a healthy outcome on your dashboard.
            </li>
            <li>
              <span className="text-red-600 font-medium">Thrown</span> — marks the item
              thrown with reason <em>expired</em>. Counts as waste on your spending +
              waste pages.
            </li>
            <li>
              <span className="text-ga-text-primary font-medium">Still have</span> — dismisses
              just this reminder. The next stage (14 or 21 days) will still fire if the item
              is still active without an expiry.
            </li>
          </ul>
          <p>
            <span className="text-ga-text-primary font-medium">Stop the reminder cycle</span>{' '}
            by opening the item from My Items or its catalog page and setting an expiry —
            once an expiry is recorded, no further reminders fire on that item.
          </p>
        </div>
      </details>

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
                    title="Mark item used. Healthy outcome — counts on your dashboard."
                    className="px-2 py-1 text-xs bg-blue-500/10 text-blue-600 rounded hover:bg-blue-500/20"
                  >
                    Used
                  </button>
                  <button
                    onClick={() => dispatchReminder('thrown', r.id, r.display_name)}
                    title="Mark item thrown with reason 'expired'. Counts as waste."
                    className="px-2 py-1 text-xs bg-red-500/10 text-red-600 rounded hover:bg-red-500/20"
                  >
                    Thrown
                  </button>
                  <button
                    onClick={() => dispatchReminder('still_have', r.id, r.display_name)}
                    title="Dismiss this stage only. Next stage (14 or 21 days) will still fire."
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
