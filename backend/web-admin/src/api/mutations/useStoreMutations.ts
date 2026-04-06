import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { toast } from 'sonner';
import type { ManualStore } from '@/types/api';

export function useAddStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<ManualStore, 'id' | 'created_at'>) => {
      const resp = await apiClient.post(API.ADMIN_STORES, data);
      return resp.data;
    },
    onSuccess: (data) => {
      toast.success(`Added ${data.store?.name || 'store'}`);
      qc.invalidateQueries({ queryKey: ['stores'] });
    },
    onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail || 'Failed to add store');
    },
  });
}

export function useUpdateStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<ManualStore> & { id: string }) => {
      const resp = await apiClient.put(API.ADMIN_STORE(id), data);
      return resp.data;
    },
    onSuccess: () => {
      toast.success('Store updated');
      qc.invalidateQueries({ queryKey: ['stores'] });
    },
    onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail || 'Failed to update store');
    },
  });
}

export function useDeleteStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const resp = await apiClient.delete(API.ADMIN_STORE(id));
      return resp.data;
    },
    onSuccess: () => {
      toast.success('Store deleted');
      qc.invalidateQueries({ queryKey: ['stores'] });
    },
    onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail || 'Failed to delete store');
    },
  });
}

export function useUpdateMapConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { center_lat: number; center_lng: number; default_zoom: number }) => {
      const resp = await apiClient.put(API.ADMIN_CONFIG_MAP, data);
      return resp.data;
    },
    onSuccess: () => {
      toast.success('Map center updated');
      qc.invalidateQueries({ queryKey: ['map-config'] });
    },
    onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail || 'Failed to update map config');
    },
  });
}
