import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import type { Reminder, ReminderDismissRequest } from '@/types/api';

export function useDismissReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReminderDismissRequest; silent?: boolean }) =>
      apiClient.post<Reminder>(API.REMINDER_DISMISS(id), data).then((r) => r.data),
    onSuccess: (_data, vars) => {
      if (!vars.silent) toast.success('Reminder dismissed');
      qc.invalidateQueries({ queryKey: ['reminders'] });
      qc.invalidateQueries({ queryKey: ['purchases'] });
      qc.invalidateQueries({ queryKey: ['waste'] });
    },
    onError: () => toast.error('Failed to dismiss reminder'),
  });
}
