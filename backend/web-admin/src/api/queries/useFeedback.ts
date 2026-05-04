import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import type { MyFeedbackResponse } from '@/types/api';

/**
 * User-side: fetch the current user's own feedback submissions, newest first.
 *
 * Powers `<MyFeedbackSection />` on `/settings` so users can see what
 * they submitted + each item's triage status. Closes the loop that
 * would otherwise leave submissions feeling like a void.
 *
 * Backend: GET /api/feedback/mine (route in app/api/routes/feedback.py).
 */
export function useMyFeedback(enabled = true) {
  return useQuery({
    queryKey: ['feedback', 'mine'],
    queryFn: () =>
      apiClient.get<MyFeedbackResponse>(API.FEEDBACK_MINE).then((r) => r.data),
    staleTime: 60_000,
    enabled,
  });
}
