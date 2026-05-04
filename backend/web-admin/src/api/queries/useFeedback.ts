import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import type {
  AdminFeedbackResponse,
  FeedbackBadge,
  FeedbackEntry,
  FeedbackMessage,
  MyFeedbackResponse,
  ThreadResponse,
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
  /** One-line takeaway shown to the user above the thread. Empty string clears. */
  summary?: string;
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


// ---------------------------------------------------------------------------
// Threading — chronological message subcollection per feedback doc.
// User-side hooks hit /api/feedback/{id}/messages (ownership enforced
// server-side); admin-side hooks hit /api/admin/feedback/{id}/messages
// (admin gate). Cache key shape matches the pattern used elsewhere:
// ['feedback', 'thread', id, 'mine' | 'admin'] so user + admin views
// of the same thread invalidate together.
// ---------------------------------------------------------------------------

function isAdminEndpoint(scope: 'mine' | 'admin'): boolean {
  return scope === 'admin';
}

export function useFeedbackThread(
  id: string | null | undefined,
  scope: 'mine' | 'admin',
  enabled = true,
) {
  return useQuery({
    queryKey: ['feedback', 'thread', id, scope],
    enabled: enabled && !!id,
    queryFn: () =>
      apiClient
        .get<ThreadResponse>(
          isAdminEndpoint(scope)
            ? API.ADMIN_FEEDBACK_THREAD(id!)
            : API.FEEDBACK_THREAD(id!),
        )
        .then((r) => r.data),
    staleTime: 30_000,
  });
}

export function usePostThreadMessage(scope: 'mine' | 'admin') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      apiClient
        .post<FeedbackMessage>(
          isAdminEndpoint(scope)
            ? API.ADMIN_FEEDBACK_THREAD(id)
            : API.FEEDBACK_THREAD(id),
          { text },
        )
        .then((r) => r.data),
    onSuccess: (_msg, { id }) => {
      // Invalidate BOTH scopes for this thread so admin and user see
      // each other's reply, plus the parent lists (admin queue + user
      // My feedback) since admin replies stamp responded_at + a user
      // reply may re-open a closed thread.
      qc.invalidateQueries({ queryKey: ['feedback', 'thread', id, 'mine'] });
      qc.invalidateQueries({ queryKey: ['feedback', 'thread', id, 'admin'] });
      qc.invalidateQueries({ queryKey: ['admin', 'feedback'] });
      qc.invalidateQueries({ queryKey: ['feedback', 'mine'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail;
      toast.error(msg || 'Failed to post reply');
    },
  });
}
