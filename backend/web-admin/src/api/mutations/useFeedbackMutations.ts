import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';

export type FeedbackKind = 'cap_request' | 'bug' | 'feature' | 'general';
/**
 * `source` flags where the feedback came from. Web app sets:
 *   - 'web'                   — general feedback form
 *   - 'cap_hit_primary'       — auto-prompt when 15-primary cap fires
 *   - 'cap_hit_alternative'   — auto-prompt when 3-alt cap fires
 * Future raspberry-pi capture writes 'rpi_voice' or 'rpi_text' to the
 * same endpoint; no schema change needed.
 */
export type FeedbackSource =
  | 'web'
  | 'cap_hit_primary'
  | 'cap_hit_alternative'
  | 'rpi_voice'
  | 'rpi_text'
  | string;

export interface SubmitFeedbackPayload {
  kind: FeedbackKind;
  message: string;
  source?: FeedbackSource;
  context?: Record<string, unknown>;
}

export function useSubmitFeedback() {
  // Invalidate the user's "my feedback" list so the just-submitted row
  // shows up immediately in the User Hub. Also invalidate the admin
  // listing so the Admin Hub picks up new submissions without a manual
  // reload (admin browsing while a user submits).
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubmitFeedbackPayload) =>
      apiClient.post(API.FEEDBACK, payload).then((r) => r.data),
    onSuccess: () => {
      toast.success('Thanks — feedback received.');
      qc.invalidateQueries({ queryKey: ['feedback', 'mine'] });
      qc.invalidateQueries({ queryKey: ['admin', 'feedback'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || 'Failed to send feedback');
    },
  });
}
