import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import type { Reminder, ReminderListResponse } from '@/types/api';

export function useReminders(includeDismissed = false) {
  return useQuery({
    queryKey: qk.reminders.all(includeDismissed),
    queryFn: () =>
      apiClient
        .get<ReminderListResponse>(API.REMINDERS, {
          params: { include_dismissed: includeDismissed },
        })
        .then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useReminder(reminderId: string | undefined) {
  return useQuery({
    queryKey: qk.reminders.detail(reminderId!),
    queryFn: () =>
      apiClient.get<Reminder>(API.REMINDER(reminderId!)).then((r) => r.data),
    enabled: !!reminderId,
  });
}
