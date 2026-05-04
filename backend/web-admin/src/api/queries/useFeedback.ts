import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import type {
  AdminFeedbackResponse,
  FeedbackBadge,
  FeedbackEntry,
  MyFeedbackResponse,
} from '@/types/api';

/**
 * User-side: fetch the current user's own feedback submissions, newest first.
 *
 * Powers `<MyFeedbackSection />` on the User Hub so users can see what
 * they submitted + each item's badge / status / admin reply. Closes the
 * loop that would otherwise leave submissions feeling like a void.
 *
 * `archiveView`: 'active' (default; hides 24h-old resolved/wont_fix
 *                threads, pinned bypass) | 'archived' | 'all'.
 *
 * Backend: GET /api/feedback/mine (route in app/api/routes/feedback.py).
 */
export function useMyFeedback(
  archiveView: 'active' | 'archived' | 'all' = 'active',
  enabled = true,
) {
  return useQuery({
    queryKey: ['feedback', 'mine', archiveView],
    queryFn: () =>
      apiClient
        .get<MyFeedbackResponse>(API.FEEDBACK_MINE, {
          params: { archive_view: archiveView },
        })
        .then((r) => r.data),
    staleTime: 60_000,
    enabled,
  });
}


// ---------------------------------------------------------------------------
// Admin-side queries + mutations for the Admin Hub at /admin-hub.
// (Legacy FeedbackTab in admin-settings still uses ad-hoc fetch; once
// it's retired the hooks here become the single source.)
// ---------------------------------------------------------------------------

export interface AdminFeedbackParams {
  kind?: string;
  status?: string;
  user_id?: string;
  /** Drives Inbox / Archived / All tabs. Default 'all'. */
  archive_view?: 'active' | 'archived' | 'all';
  /** True restricts to pinned rows — drives the Pinned tab. */
  pinned_only?: boolean;
  limit?: number;
}

export function useAdminFeedback(params: AdminFeedbackParams = {}) {
  return useQuery({
    queryKey: ['admin', 'feedback', params],
    queryFn: () =>
      apiClient
        .get<AdminFeedbackResponse>(API.ADMIN_FEEDBACK, { params })
        .then((r) => r.data),
    staleTime: 30_000,
  });
}

export interface UpdateFeedbackPayload {
  status?: 'new' | 'triaged' | 'resolved' | 'wont_fix';
  admin_notes?: string;
  admin_response?: string;
  admin_badge?: FeedbackBadge | '' | null;
  pinned?: boolean;
}

/**
 * Admin: PATCH a feedback row. Pass any subset of fields. Invalidates
 * every admin feedback list + the user's My feedback (so the user sees
 * the badge / reply / pin on next refresh).
 */
export function useUpdateFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateFeedbackPayload }) =>
      apiClient
        .patch<FeedbackEntry>(API.ADMIN_FEEDBACK_ITEM(id), payload)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'feedback'] });
      qc.invalidateQueries({ queryKey: ['feedback', 'mine'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail;
      toast.error(msg || 'Failed to update feedback');
    },
  });
}
