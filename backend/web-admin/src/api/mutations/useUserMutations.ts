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

export function useChangeTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, tier }: { uid: string; tier: string }) =>
      apiClient.put(API.USER_TIER(uid), { tier }).then((r) => r.data),
    onSuccess: (_data, { tier }) => {
      toast.success(`Tier changed to ${tier}`);
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => toast.error('Failed to change tier'),
  });
}

export function useToggleUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, status, reason }: { uid: string; status: string; reason?: string }) =>
      apiClient.put(API.USER_STATUS(uid), { status, reason }).then((r) => r.data),
    onSuccess: (_data, { status }) => {
      toast.success(`User ${status === 'active' ? 'enabled' : 'disabled'}`);
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => toast.error('Failed to update user status'),
  });
}

export function useApproveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uid: string) =>
      apiClient.put(API.USER_APPROVE(uid)).then((r) => r.data),
    onSuccess: () => {
      toast.success('User approved');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => toast.error('Failed to approve user'),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uid: string) =>
      apiClient.delete(API.USER_DELETE(uid)).then((r) => r.data),
    onSuccess: () => {
      toast.success('User deleted');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => toast.error('Failed to delete user'),
  });
}

export function useUpdateUserTools() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uid, tools }: { uid: string; tools: string[] }) =>
      apiClient.put(API.USER_TOOLS(uid), { selected_tools: tools }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Tools updated');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => toast.error('Failed to update tools'),
  });
}
