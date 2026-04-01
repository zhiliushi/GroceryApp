import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import { toast } from 'sonner';

export function useCreateHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; role: string }) =>
      apiClient.post(API.HOUSEHOLD_CREATE, data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Household created!');
      qc.invalidateQueries({ queryKey: qk.household });
    },
    onError: (e) => toast.error(e.message || 'Failed to create household'),
  });
}

export function useRenameHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiClient.put(API.HOUSEHOLD_RENAME, { name }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Household renamed');
      qc.invalidateQueries({ queryKey: qk.household });
    },
  });
}

export function useDissolveHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete(API.HOUSEHOLD_DISSOLVE).then((r) => r.data),
    onSuccess: () => {
      toast.success('Household dissolved');
      qc.invalidateQueries({ queryKey: qk.household });
    },
  });
}

export function useLeaveHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post(API.HOUSEHOLD_LEAVE).then((r) => r.data),
    onSuccess: () => {
      toast.success('You left the household');
      qc.invalidateQueries({ queryKey: qk.household });
    },
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uid: string) =>
      apiClient.post(API.HOUSEHOLD_REMOVE(uid)).then((r) => r.data),
    onSuccess: () => {
      toast.success('Member removed');
      qc.invalidateQueries({ queryKey: qk.household });
    },
  });
}

export function useTransferOwnership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uid: string) =>
      apiClient.post(API.HOUSEHOLD_TRANSFER(uid)).then((r) => r.data),
    onSuccess: () => {
      toast.success('Ownership transferred');
      qc.invalidateQueries({ queryKey: qk.household });
    },
  });
}

export function useUpdateMyRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { display_role?: string; role_icon?: string; role_color?: string }) =>
      apiClient.put(API.HOUSEHOLD_ROLE, data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Role updated');
      qc.invalidateQueries({ queryKey: qk.household });
    },
  });
}

export function useGenerateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { role: string; email?: string }) =>
      apiClient.post(API.HOUSEHOLD_INVITE, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.household });
    },
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      apiClient.post(API.HOUSEHOLD_REVOKE(code)).then((r) => r.data),
    onSuccess: () => {
      toast.success('Invitation revoked');
      qc.invalidateQueries({ queryKey: qk.household });
    },
  });
}

export function useJoinHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      apiClient.post(API.HOUSEHOLD_JOIN(code)).then((r) => r.data),
    onSuccess: () => {
      toast.success('Welcome to the household!');
      qc.invalidateQueries({ queryKey: qk.household });
    },
    onError: (e) => toast.error(e.message || 'Failed to join household'),
  });
}
