import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { toast } from 'sonner';
import type { Foodbank } from '@/types/api';

export function useCreateFoodbank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Foodbank>) =>
      apiClient.post(API.FOODBANKS, data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Foodbank created');
      qc.invalidateQueries({ queryKey: ['foodbanks'] });
    },
    onError: () => toast.error('Failed to create foodbank'),
  });
}

export function useUpdateFoodbank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Foodbank> }) =>
      apiClient.put(API.FOODBANK(id), data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Foodbank updated');
      qc.invalidateQueries({ queryKey: ['foodbanks'] });
    },
    onError: () => toast.error('Failed to update foodbank'),
  });
}

export function useDeleteFoodbank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(API.FOODBANK(id)).then((r) => r.data),
    onSuccess: () => {
      toast.success('Foodbank deleted');
      qc.invalidateQueries({ queryKey: ['foodbanks'] });
    },
    onError: () => toast.error('Failed to delete foodbank'),
  });
}

export function useToggleFoodbank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.patch(API.FOODBANK_TOGGLE(id)).then((r) => r.data),
    onSuccess: () => {
      toast.success('Foodbank toggled');
      qc.invalidateQueries({ queryKey: ['foodbanks'] });
    },
    onError: () => toast.error('Failed to toggle foodbank'),
  });
}

export function useRefreshFoodbankEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post(API.FOODBANK_REFRESH_ENTRY(id)).then((r) => r.data),
    onSuccess: () => {
      toast.success('Foodbank entry refreshed');
      qc.invalidateQueries({ queryKey: ['foodbanks'] });
    },
    onError: () => toast.error('Failed to refresh foodbank entry'),
  });
}

export function useSeedFoodbanks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.post(API.FOODBANK_SEED).then((r) => r.data),
    onSuccess: () => {
      toast.success('Foodbanks seeded');
      qc.invalidateQueries({ queryKey: ['foodbanks'] });
    },
    onError: () => toast.error('Failed to seed foodbanks'),
  });
}

export function useRefreshAllFoodbanks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.post(API.FOODBANK_REFRESH).then((r) => r.data),
    onSuccess: () => {
      toast.success('All foodbanks refreshed');
      qc.invalidateQueries({ queryKey: ['foodbanks'] });
    },
    onError: () => toast.error('Failed to refresh foodbanks'),
  });
}
