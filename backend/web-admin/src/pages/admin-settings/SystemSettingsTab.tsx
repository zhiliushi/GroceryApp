import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { toast } from 'sonner';
import { cn } from '@/utils/cn';

interface SystemConfig {
  max_active_users: number;
  registration_open: boolean;
  active_users: number;
  capacity_percent: number;
  capacity_level: 'normal' | 'warning' | 'critical';
  updated_at: number | null;
}

export default function SystemSettingsTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['system', 'config'],
    queryFn: () => apiClient.get<SystemConfig>('/api/admin/config/system').then((r) => r.data),
    staleTime: 30_000,
  });

  const qc = useQueryClient();
  const [maxUsers, setMaxUsers] = useState<number | null>(null);
  const [regOpen, setRegOpen] = useState<boolean | null>(null);

  const updateMutation = useMutation({
    mutationFn: (config: Record<string, unknown>) => apiClient.put('/api/admin/config/system', config),
    onSuccess: () => { toast.success('System config saved'); qc.invalidateQueries({ queryKey: ['system'] }); },
  });

  if (isLoading) return <LoadingSpinner text="Loading system config..." />;
  if (error) return <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">{(error as Error).message}</div>;
  if (!data) return null;

  const displayMax = maxUsers ?? data.max_active_users;
  const displayRegOpen = regOpen ?? data.registration_open;
  const hasChanges = maxUsers !== null || regOpen !== null;

  const barColor = data.capacity_level === 'critical'
    ? 'bg-red-500'
    : data.capacity_level === 'warning'
      ? 'bg-yellow-500'
      : 'bg-green-500';

  const handleSave = () => {
    const update: Record<string, unknown> = {};
    if (maxUsers !== null) update.max_active_users = maxUsers;
    if (regOpen !== null) update.registration_open = regOpen;
    updateMutation.mutate(update, {
      onSuccess: () => { setMaxUsers(null); setRegOpen(null); },
    });
  };

  return (
    <div className="space-y-6">
      {/* Capacity */}
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-ga-text-primary mb-3">User Capacity</h3>

        <div className="flex items-end gap-3 mb-3">
          <div className="flex-1">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-2xl font-bold text-ga-text-primary">{data.active_users}</span>
              <span className="text-sm text-ga-text-secondary">/ {displayMax} active users</span>
            </div>
            <div className="h-3 bg-ga-bg-hover rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', barColor)}
                style={{ width: `${Math.min(100, data.capacity_percent)}%` }}
              />
            </div>
          </div>
          <span className={cn('text-sm font-medium', {
            'text-green-400': data.capacity_level === 'normal',
            'text-yellow-400': data.capacity_level === 'warning',
            'text-red-400': data.capacity_level === 'critical',
          })}>
            {data.capacity_percent}%
          </span>
        </div>

        {data.capacity_level === 'warning' && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 text-xs text-yellow-400 mb-3">
            Approaching capacity — consider increasing the limit.
          </div>
        )}
        {data.capacity_level === 'critical' && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-400 mb-3">
            At or near capacity! New registrations are blocked.
          </div>
        )}

        <div className="flex items-center gap-3">
          <label className="text-xs text-ga-text-secondary">Max active users:</label>
          <input type="number" min={1} max={10000}
            value={displayMax}
            onChange={(e) => setMaxUsers(parseInt(e.target.value) || 50)}
            className="w-24 bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-1.5 text-sm text-ga-text-primary text-center" />
        </div>
      </div>

      {/* Registration toggle */}
      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-ga-text-primary mb-3">Registration</h3>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setRegOpen(!displayRegOpen)}
            className={cn(
              'relative w-12 h-6 rounded-full transition-colors',
              displayRegOpen ? 'bg-green-500' : 'bg-gray-600',
            )}
          >
            <div className={cn(
              'absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform',
              displayRegOpen ? 'translate-x-6' : 'translate-x-0.5',
            )} />
          </button>
          <span className="text-sm text-ga-text-primary">
            {displayRegOpen ? 'Open — new users can register' : 'Closed — new registrations blocked'}
          </span>
        </div>

        {!displayRegOpen && (
          <p className="text-xs text-ga-text-secondary mt-2">
            New users will see: "Registration is currently closed. Contact admin."
          </p>
        )}
      </div>

      {/* Save */}
      {hasChanges && (
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={updateMutation.isPending}
            className="bg-ga-accent hover:bg-ga-accent/90 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2">
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
          <button onClick={() => { setMaxUsers(null); setRegOpen(null); }}
            className="border border-ga-border text-ga-text-secondary text-sm rounded-lg px-4 py-2">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
