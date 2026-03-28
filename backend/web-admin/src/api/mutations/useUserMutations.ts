import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { toast } from 'sonner';

export function useToggleUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, role }: { uid: string; role: 'admin' | 'user' }) =>
      apiClient.put(API.USER_ROLE(uid), { role }).then((r) => r.data),
    onSuccess: (_data, { role }) => {
      toast.success(`User ${role === 'admin' ? 'promoted to admin' : 'demoted to user'}`);
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => toast.error('Failed to update user role'),
  });
}
