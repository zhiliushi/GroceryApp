import { Link } from 'react-router-dom';
import { useReminders } from '@/api/queries/useReminders';
import { useFeatureFlags } from '@/api/queries/useFeatureFlags';
import { useDismissReminder } from '@/api/mutations/useReminderMutations';
import { useUndoableAction } from '@/hooks/useUndoableAction';
import type { ReminderDismissAction } from '@/types/api';
import { cn } from '@/utils/cn';

/**
 * Top-of-dashboard nudge for a single highest-stage reminder.
 * Hidden when progressive_nudges flag is off.
 */
export default function NudgeBanner() {
  const { data: flags } = useFeatureFlags();
  const { data } = useReminders(false);
  const dismissMutation = useDismissReminder();
  const undoable = useUndoableAction();

  if (flags?.progressive_nudges === false) return null;
  if (!data || data.reminders.length === 0) return null;

  // Highest-stage reminder first (sorted server-side by stage desc)
  const top = data.reminders[0];

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg border p-3 text-sm',
        top.stage >= 21
          ? 'bg-red-500/10 border-red-500/30 text-red-600'
          : top.stage >= 14
          ? 'bg-orange-500/10 border-orange-500/30 text-orange-600'
          : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700',
      )}
    >
      <div className="flex-1">
        <div className="font-medium">{top.message || `Reminder: ${top.display_name}`}</div>
        <div className="text-xs opacity-80">Stage {top.stage} days · {data.count} total reminders</div>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        {(['used', 'thrown', 'still_have'] as const).map((action) => (
          <button
            key={action}
            onClick={() => dispatchReminder(action, top.id, top.display_name)}
            className="px-2 py-1 text-xs bg-ga-bg-card rounded hover:bg-ga-bg-hover"
          >
            {action === 'used' ? 'Used' : action === 'thrown' ? 'Thrown' : 'Still have'}
          </button>
        ))}
        <Link to="/reminders" className="px-2 py-1 text-xs underline">
          All →
        </Link>
      </div>
    </div>
  );

  function dispatchReminder(action: ReminderDismissAction, id: string, name: string) {
    const reason = action === 'thrown' ? 'expired' : undefined;
    undoable.run(
      () =>
        dismissMutation.mutate({
          id,
          data: { action, reason },
          silent: true,
        }),
      action === 'still_have' ? 'Snoozed' : `Marked "${name}" as ${action}`,
    );
  }
}
