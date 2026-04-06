import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { API } from '@/api/endpoints';
import { qk } from '@/api/queries/keys';
import { toast } from 'sonner';
import type { LocationItem } from '@/types/api';

export function useAddLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; icon: string; color: string }) => {
      const resp = await apiClient.post(API.CONFIG_LOCATIONS_ADMIN, data);
      return resp.data;
    },
    onSuccess: (data) => {
      toast.success(`Added ${data.location?.name || 'location'}`);
      qc.invalidateQueries({ queryKey: qk.locations });
    },
    onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail || 'Failed to add location');
    },
  });
}

export function useUpdateLocations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (locations: LocationItem[]) => {
      const resp = await apiClient.put(API.CONFIG_LOCATIONS_ADMIN, { locations });
      return resp.data;
    },
    onSuccess: () => {
      toast.success('Locations updated');
      qc.invalidateQueries({ queryKey: qk.locations });
    },
    onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail || 'Failed to update locations');
    },
  });
}

export function useDeleteLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      const resp = await apiClient.delete(`${API.CONFIG_LOCATIONS_ADMIN}/${key}`);
      return resp.data;
    },
    onSuccess: () => {
      toast.success('Location deleted');
      qc.invalidateQueries({ queryKey: qk.locations });
    },
    onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail || 'Failed to delete location');
    },
  });
}
