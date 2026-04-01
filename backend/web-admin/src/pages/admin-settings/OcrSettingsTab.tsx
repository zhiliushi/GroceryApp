import { useState, useCallback } from 'react';
import { useOcrConfig, useAdminReceiptScans, useAdminReceiptErrors, useOcrRequirements } from '@/api/queries/useOcrConfig';
import { useUpdateOcrConfig, useTestOcrProvider } from '@/api/mutations/useOcrMutations';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import type { OcrProviderConfig, ProviderRequirements, ProviderTestResult } from '@/types/api';

const PROVIDER_ICONS: Record<string, string> = {
  google_vision: '☁️',
  mindee: '🧾',
  tesseract: '🔤',
};

type SubTab = 'providers' | 'setup' | 'monitoring';

export default function OcrSettingsTab() {
  const [subTab, setSubTab] = useState<SubTab>('providers');

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-ga-border/50 pb-2">
        {([
          { key: 'providers' as const, label: 'Providers & Priority' },
          { key: 'setup' as const, label: 'Setup & Requirements' },
          { key: 'monitoring' as const, label: 'Monitoring' },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              subTab === tab.key
                ? 'bg-ga-accent/20 text-ga-accent font-medium'
                : 'text-ga-text-secondary hover:text-ga-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === 'providers' && <ProvidersTab />}
      {subTab === 'setup' && <SetupTab />}
      {subTab === 'monitoring' && <MonitoringTab />}
    </div>
  );
}


// ==========================================================================
// Providers & Priority Tab
// ==========================================================================

function ProvidersTab() {
  const { data: config, isLoading, error } = useOcrConfig();
  const updateMutation = useUpdateOcrConfig();
  const [localProviders, setLocalProviders] = useState<OcrProviderConfig[] | null>(null);
  const providers = localProviders ?? config?.providers ?? [];

  const handleToggleEnabled = useCallback((key: string) => {
    setLocalProviders((prev) => {
      const list = prev ?? config?.providers ?? [];
      return list.map((p) => (p.key === key ? { ...p, enabled: !p.enabled } : p));
    });
  }, [config]);

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    setLocalProviders((prev) => {
      const list = [...(prev ?? config?.providers ?? [])];
      [list[index - 1], list[index]] = [list[index], list[index - 1]];
      return list.map((p, i) => ({ ...p, priority: i + 1 }));
    });
  }, [config]);

  const handleMoveDown = useCallback((index: number) => {
    setLocalProviders((prev) => {
      const list = [...(prev ?? config?.providers ?? [])];
      if (index >= list.length - 1) return list;
      [list[index], list[index + 1]] = [list[index + 1], list[index]];
      return list.map((p, i) => ({ ...p, priority: i + 1 }));
    });
  }, [config]);

  const handleSave = useCallback(() => {
    if (!localProviders) return;
    updateMutation.mutate(
      { providers: localProviders },
      { onSuccess: () => setLocalProviders(null) },
    );
  }, [localProviders, updateMutation]);

  if (isLoading) return <LoadingSpinner text="Loading OCR config..." />;

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <h3 className="text-red-400 font-medium mb-1">Failed to load OCR config</h3>
        <p className="text-sm text-ga-text-secondary">{(error as Error).message}</p>
        <p className="text-xs text-ga-text-secondary mt-2">
          This usually means the Firestore document hasn't been created yet. Try refreshing — the backend will seed default config on first access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-ga-text-secondary">
        When scanning a receipt, providers are tried in this order. If one fails or reaches its quota, the next is tried.
      </p>

      {providers.map((provider, index) => (
        <div
          key={provider.key}
          className={`bg-ga-bg-card border rounded-lg p-4 flex items-center gap-4 ${
            provider.enabled ? 'border-ga-border' : 'border-ga-border/50 opacity-60'
          }`}
        >
          <div className="flex flex-col gap-0.5">
            <button onClick={() => handleMoveUp(index)} disabled={index === 0}
              className="text-xs text-ga-text-secondary hover:text-ga-text-primary disabled:opacity-30">▲</button>
            <span className="text-xs text-ga-text-secondary text-center font-mono">{index + 1}</span>
            <button onClick={() => handleMoveDown(index)} disabled={index === providers.length - 1}
              className="text-xs text-ga-text-secondary hover:text-ga-text-primary disabled:opacity-30">▼</button>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span>{PROVIDER_ICONS[provider.key] || '🔧'}</span>
              <span className="font-medium text-ga-text-primary text-sm">{provider.name}</span>
              {provider.api_key_set === false && (
                <span className="text-xs bg-yellow-500/20 text-yellow-400 rounded px-1.5 py-0.5">
                  ⚠ Not configured
                </span>
              )}
              {provider.api_key_set === true && (
                <span className="text-xs bg-green-500/20 text-green-400 rounded px-1.5 py-0.5">
                  ✓ Ready
                </span>
              )}
              {provider.api_key_set === null && (
                <span className="text-xs text-ga-text-secondary">No key needed</span>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-ga-text-secondary">
              {provider.monthly_limit > 0 ? (
                <span>
                  {provider.usage_count}/{provider.monthly_limit} this month
                </span>
              ) : (
                <span>{provider.usage_count} this month (unlimited)</span>
              )}
              {provider.usage_errors > 0 && (
                <span className="text-red-400">{provider.usage_errors} errors</span>
              )}
            </div>
            {provider.monthly_limit > 0 && (
              <div className="mt-1.5 h-1.5 bg-ga-bg-hover rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    provider.usage_count / provider.monthly_limit > 0.9 ? 'bg-red-500'
                      : provider.usage_count / provider.monthly_limit > 0.7 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(100, (provider.usage_count / provider.monthly_limit) * 100)}%` }}
                />
              </div>
            )}
          </div>

          <button onClick={() => handleToggleEnabled(provider.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              provider.enabled ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                : 'bg-ga-bg-hover text-ga-text-secondary hover:text-ga-text-primary'
            }`}>
            {provider.enabled ? 'Enabled' : 'Disabled'}
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
            className="border border-ga-border text-ga-text-secondary text-sm rounded-lg px-4 py-2 hover:text-ga-text-primary">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}


// ==========================================================================
// Setup & Requirements Tab
// ==========================================================================

function SetupTab() {
  const { data: requirements, isLoading, error } = useOcrRequirements();
  const testMutation = useTestOcrProvider();
  const [testResults, setTestResults] = useState<Record<string, ProviderTestResult>>({});

  const handleTest = useCallback((providerKey: string) => {
    testMutation.mutate(providerKey, {
      onSuccess: (result) => setTestResults((prev) => ({ ...prev, [providerKey]: result })),
      onError: (err) => setTestResults((prev) => ({
        ...prev,
        [providerKey]: { success: false, provider: providerKey, duration_ms: 0, message: err.message },
      })),
    });
  }, [testMutation]);

  if (isLoading) return <LoadingSpinner text="Checking requirements..." />;

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <h3 className="text-red-400 font-medium mb-1">Failed to check requirements</h3>
        <p className="text-sm text-ga-text-secondary">{(error as Error).message}</p>
      </div>
    );
  }

  if (!requirements) return null;

  const providers: [string, ProviderRequirements][] = [
    ['google_vision', requirements.google_vision],
    ['mindee', requirements.mindee],
    ['tesseract', requirements.tesseract],
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-ga-text-secondary">
        Each provider has its own requirements. Green checks mean ready, yellow means unknown (test to verify), red means action needed.
      </p>

      {providers.map(([key, req]) => {
        const testResult = testResults[key];
        const icon = PROVIDER_ICONS[key] || '🔧';

        return (
          <div key={key} className="bg-ga-bg-card border border-ga-border rounded-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-ga-border/50">
              <div className="flex items-center gap-2">
                <span>{icon}</span>
                <span className="font-medium text-ga-text-primary">{req.name}</span>
                <span className={`text-xs rounded px-1.5 py-0.5 ${
                  req.ready
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {req.ready ? '✓ Ready' : '⚠ Needs setup'}
                </span>
                <span className="text-xs text-ga-text-secondary">({req.free_tier})</span>
              </div>
              <button
                onClick={() => handleTest(key)}
                disabled={testMutation.isPending && testMutation.variables === key}
                className="bg-ga-accent/20 hover:bg-ga-accent/30 text-ga-accent text-xs font-medium rounded px-3 py-1.5 transition-colors disabled:opacity-50"
              >
                {testMutation.isPending && testMutation.variables === key ? 'Testing...' : 'Test Connection'}
              </button>
            </div>

            {/* Requirements checklist */}
            <div className="px-4 py-3 space-y-1.5">
              {req.checks.map((check) => (
                <div key={check.check} className="flex items-start gap-2 text-xs">
                  <span className={`mt-0.5 ${
                    check.ok === true ? 'text-green-400' : check.ok === false ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {check.ok === true ? '✓' : check.ok === false ? '✗' : '?'}
                  </span>
                  <div>
                    <span className="text-ga-text-primary">{check.label}</span>
                    {check.fix && check.ok !== true && (
                      <div className="text-ga-text-secondary mt-0.5">{check.fix}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Setup steps */}
            <details className="border-t border-ga-border/50">
              <summary className="px-4 py-2 text-xs text-ga-text-secondary cursor-pointer hover:text-ga-text-primary">
                Setup instructions
              </summary>
              <div className="px-4 pb-3">
                <ol className="list-decimal list-inside space-y-1 text-xs text-ga-text-primary">
                  {req.setup_steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
                {req.setup_url && (
                  <a
                    href={req.setup_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs text-ga-accent hover:underline"
                  >
                    Open setup page →
                  </a>
                )}
              </div>
            </details>

            {/* Test result */}
            {testResult && (
              <div className={`px-4 py-2.5 border-t text-xs ${
                testResult.success
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}>
                <div className="font-medium">{testResult.message}</div>
                {testResult.success && testResult.items_found !== undefined && (
                  <div className="text-ga-text-secondary mt-0.5">
                    {testResult.items_found} items detected | {testResult.duration_ms}ms | confidence: {Math.round((testResult.confidence ?? 0) * 100)}%
                  </div>
                )}
                {!testResult.success && testResult.error_type && (
                  <div className="mt-0.5">
                    Error type: <code className="font-mono">{testResult.error_type}</code>
                    {testResult.error_message && (
                      <span className="text-ga-text-secondary"> — {testResult.error_message}</span>
                    )}
                  </div>
                )}
                {testResult.raw_text_preview && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-ga-text-secondary">Raw text preview</summary>
                    <pre className="mt-1 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">{testResult.raw_text_preview}</pre>
                  </details>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


// ==========================================================================
// Monitoring Tab
// ==========================================================================

function MonitoringTab() {
  const { data: scansData, isLoading: scansLoading } = useAdminReceiptScans(10);
  const { data: errorsData } = useAdminReceiptErrors(10);

  if (scansLoading) return <LoadingSpinner text="Loading scan data..." />;

  const stats = scansData?.stats;

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-ga-text-primary mb-3">
            {stats.month} Overview
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-ga-text-primary">{stats.total_scans}</div>
              <div className="text-xs text-ga-text-secondary">Total scans</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">{stats.confirmed}</div>
              <div className="text-xs text-ga-text-secondary">Confirmed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-400">{stats.failed}</div>
              <div className="text-xs text-ga-text-secondary">Failed</div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Errors */}
      {errorsData && errorsData.errors.length > 0 && (
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-ga-text-primary mb-3">
            Recent Errors ({errorsData.count})
          </h3>
          <div className="space-y-1.5">
            {errorsData.errors.map((scan) => (
              <div key={scan.scan_id} className="flex items-center gap-3 text-xs">
                <span className="text-ga-text-secondary">{new Date(scan.created_at).toLocaleString()}</span>
                <span className="font-mono text-ga-text-secondary">{scan.user_id?.slice(0, 8)}</span>
                <span className="text-red-400">{scan.status}</span>
                {scan.attempts?.filter((a) => a.status === 'error').map((a, i) => (
                  <span key={i} className="text-ga-text-secondary">{a.provider}: {a.error_type}</span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Scans */}
      {scansData && scansData.scans.length > 0 ? (
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-ga-text-primary mb-3">Recent Scans</h3>
          <div className="space-y-1.5">
            {scansData.scans.map((scan) => (
              <div key={scan.scan_id} className="flex items-center gap-3 text-xs">
                <span className="text-ga-text-secondary">{new Date(scan.created_at).toLocaleString()}</span>
                <span className="font-mono text-ga-text-secondary">{scan.user_id?.slice(0, 8)}</span>
                <span className="text-ga-text-primary">{scan.store_name || '—'}</span>
                <span>{scan.items_detected} items</span>
                <span className={scan.confirmed ? 'text-green-400' : scan.status === 'all_failed' ? 'text-red-400' : 'text-yellow-400'}>
                  {scan.confirmed ? '✓ confirmed' : scan.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-8 text-center">
          <div className="text-3xl mb-2">📊</div>
          <p className="text-sm text-ga-text-secondary">No receipt scans yet</p>
        </div>
      )}
    </div>
  );
}
