import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { toast } from 'sonner';
import { cn } from '@/utils/cn';

const PROVIDER_ICONS: Record<string, string> = {
  resend: '📧',
  sendgrid: '📨',
  smtp: '🔧',
};

interface EmailProvider {
  key: string;
  name: string;
  enabled: boolean;
  priority: number;
  api_key_set: boolean | null;
  daily_limit: number;
  usage_today: number;
  errors_today: number;
  last_sent: string | null;
}

interface EmailConfig {
  enabled: boolean;
  providers: EmailProvider[];
}

export default function EmailSettingsTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['email', 'config'],
    queryFn: () => apiClient.get<EmailConfig>('/api/admin/config/email').then((r) => r.data),
    staleTime: 60_000,
  });

  const qc = useQueryClient();
  const updateMutation = useMutation({
    mutationFn: (config: Partial<EmailConfig>) => apiClient.put('/api/admin/config/email', config),
    onSuccess: () => { toast.success('Email config saved'); qc.invalidateQueries({ queryKey: ['email'] }); },
  });

  const testMutation = useMutation({
    mutationFn: (to?: string) => apiClient.post('/api/admin/config/email/test', { to }).then((r) => r.data),
    onSuccess: (d) => d.success ? toast.success(d.message) : toast.error(d.message),
  });

  const [localProviders, setLocalProviders] = useState<EmailProvider[] | null>(null);
  const providers = localProviders ?? data?.providers ?? [];

  const handleToggle = useCallback((key: string) => {
    setLocalProviders((prev) => {
      const list = prev ?? data?.providers ?? [];
      return list.map((p) => (p.key === key ? { ...p, enabled: !p.enabled } : p));
    });
  }, [data]);

  const handleMoveUp = useCallback((i: number) => {
    if (i === 0) return;
    setLocalProviders((prev) => {
      const list = [...(prev ?? data?.providers ?? [])];
      [list[i - 1], list[i]] = [list[i], list[i - 1]];
      return list.map((p, idx) => ({ ...p, priority: idx + 1 }));
    });
  }, [data]);

  const handleMoveDown = useCallback((i: number) => {
    setLocalProviders((prev) => {
      const list = [...(prev ?? data?.providers ?? [])];
      if (i >= list.length - 1) return list;
      [list[i], list[i + 1]] = [list[i + 1], list[i]];
      return list.map((p, idx) => ({ ...p, priority: idx + 1 }));
    });
  }, [data]);

  const handleSave = () => {
    if (localProviders) updateMutation.mutate({ providers: localProviders }, { onSuccess: () => setLocalProviders(null) });
  };

  if (isLoading) return <LoadingSpinner text="Loading email config..." />;
  if (error) return <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">{(error as Error).message}</div>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-ga-text-secondary">
        Email is used for household invitations and future features. Providers cascade — if one fails, the next is tried.
      </p>

      {providers.map((p, i) => (
        <div key={p.key} className={cn(
          'bg-ga-bg-card border rounded-lg p-4 flex items-center gap-4',
          p.enabled ? 'border-ga-border' : 'border-ga-border/50 opacity-60',
        )}>
          <div className="flex flex-col gap-0.5">
            <button onClick={() => handleMoveUp(i)} disabled={i === 0} className="text-xs text-ga-text-secondary hover:text-ga-text-primary disabled:opacity-30">▲</button>
            <span className="text-xs text-ga-text-secondary text-center font-mono">{i + 1}</span>
            <button onClick={() => handleMoveDown(i)} disabled={i === providers.length - 1} className="text-xs text-ga-text-secondary hover:text-ga-text-primary disabled:opacity-30">▼</button>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span>{PROVIDER_ICONS[p.key] || '📧'}</span>
              <span className="font-medium text-ga-text-primary text-sm">{p.name}</span>
              {p.api_key_set === false && <span className="text-xs bg-yellow-500/20 text-yellow-400 rounded px-1.5 py-0.5">Not configured</span>}
              {p.api_key_set === true && <span className="text-xs bg-green-500/20 text-green-400 rounded px-1.5 py-0.5">Ready</span>}
            </div>
            <div className="flex items-center gap-4 text-xs text-ga-text-secondary">
              <span>Today: {p.usage_today}/{p.daily_limit > 0 ? p.daily_limit : '∞'}</span>
              {p.errors_today > 0 && <span className="text-red-400">{p.errors_today} errors</span>}
            </div>
          </div>

          <button onClick={() => testMutation.mutate(undefined)} disabled={!p.enabled || !p.api_key_set || testMutation.isPending}
            className="text-xs text-ga-accent hover:underline disabled:opacity-30">
            Test
          </button>

          <button onClick={() => handleToggle(p.key)}
            className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              p.enabled ? 'bg-green-600/20 text-green-400' : 'bg-ga-bg-hover text-ga-text-secondary',
            )}>
            {p.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      ))}

      {localProviders && (
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={updateMutation.isPending}
            className="bg-ga-accent hover:bg-ga-accent/90 text-white text-sm font-medium rounded-lg px-4 py-2 disabled:opacity-50">
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
          <button onClick={() => setLocalProviders(null)}
            className="border border-ga-border text-ga-text-secondary text-sm rounded-lg px-4 py-2">Cancel</button>
        </div>
      )}
    </div>
  );
}
