import { useState, useEffect } from 'react';
import { useVisibilityConfig } from '@/api/queries/useConfig';
import { useUpdateVisibility } from '@/api/mutations/useConfigMutations';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import type { VisibilityConfig, PageVisibility, TierOrAdmin } from '@/types/api';

const TIER_OPTIONS: { value: TierOrAdmin; label: string }[] = [
  { value: 'free', label: 'Basic Basket (Free)' },
  { value: 'plus', label: 'Smart Cart (Plus)' },
  { value: 'pro', label: 'Full Fridge (Pro)' },
  { value: 'admin', label: 'Admin Only' },
];

const PAGE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  inventory: 'Inventory',
  shopping_lists: 'Shopping Lists',
  foodbanks: 'Foodbanks',
  analytics: 'Analytics',
  price_tracking: 'Price Tracking',
  settings: 'Settings',
};

const SECTION_LABELS: Record<string, string> = {
  stats_cards: 'Stats Cards',
  recent_activity: 'Recent Activity',
  quick_actions: 'Quick Actions',
  filters: 'Filters',
  bulk_actions: 'Bulk Actions',
  export: 'Export',
  checkout_flow: 'Checkout Flow',
  trip_notes: 'Trip Notes',
  map_view: 'Map View',
  sources_panel: 'Sources Panel',
  stats_overview: 'Stats Overview',
  status_chart: 'Status Chart',
  location_chart: 'Location Chart',
  expiry_chart: 'Expiry Chart',
  price_history: 'Price History',
  price_comparison: 'Price Comparison',
};

export default function PageManagementTab() {
  const { data, isLoading } = useVisibilityConfig();
  const updateMutation = useUpdateVisibility();
  const [config, setConfig] = useState<VisibilityConfig | null>(null);
  const [expandedPage, setExpandedPage] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setConfig(data);
      setIsDirty(false);
    }
  }, [data]);

  if (isLoading || !config) return <LoadingSpinner />;

  const updatePage = (pageKey: string, field: keyof PageVisibility, value: unknown) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, pages: { ...prev.pages } };
      updated.pages[pageKey] = { ...updated.pages[pageKey], [field]: value };
      return updated;
    });
    setIsDirty(true);
  };

  const updateSection = (pageKey: string, sectionKey: string, field: string, value: unknown) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, pages: { ...prev.pages } };
      const page = { ...updated.pages[pageKey], sections: { ...updated.pages[pageKey].sections } };
      page.sections[sectionKey] = { ...page.sections[sectionKey], [field]: value };
      updated.pages[pageKey] = page;
      return updated;
    });
    setIsDirty(true);
  };

  const handleSave = () => {
    if (!config) return;
    updateMutation.mutate(config, { onSuccess: () => setIsDirty(false) });
  };

  return (
    <div className="space-y-3">
      {Object.entries(config.pages).map(([pageKey, page]) => {
        const isExpanded = expandedPage === pageKey;
        const sections = Object.entries(page.sections || {});

        return (
          <div key={pageKey} className="bg-ga-bg-card border border-ga-border rounded-lg overflow-hidden">
            {/* Page header */}
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-ga-bg-hover transition-colors"
              onClick={() => setExpandedPage(isExpanded ? null : pageKey)}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm text-ga-text-secondary">{isExpanded ? '▼' : '▶'}</span>
                <span className="font-medium text-ga-text-primary">
                  {PAGE_LABELS[pageKey] || pageKey}
                </span>
                {page.alwaysFree && (
                  <span className="text-xs bg-green-600/20 text-green-400 rounded px-1.5 py-0.5">Always Free</span>
                )}
              </div>
              <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={page.enabled}
                    onChange={(e) => updatePage(pageKey, 'enabled', e.target.checked)}
                    className="rounded border-ga-border accent-ga-accent"
                  />
                  <span className="text-ga-text-secondary">Enabled</span>
                </label>
                <select
                  value={page.minTier}
                  onChange={(e) => updatePage(pageKey, 'minTier', e.target.value)}
                  className="bg-ga-bg-primary border border-ga-border rounded px-2 py-1 text-xs text-ga-text-primary outline-none"
                >
                  {TIER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sections */}
            {isExpanded && sections.length > 0 && (
              <div className="border-t border-ga-border px-4 py-3 space-y-2 bg-ga-bg-primary/50">
                <div className="text-xs font-semibold uppercase tracking-wide text-ga-text-secondary mb-2">Sections</div>
                {sections.map(([secKey, sec]) => (
                  <div key={secKey} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-ga-text-primary pl-4">
                      {SECTION_LABELS[secKey] || secKey}
                    </span>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={sec.enabled}
                        onChange={(e) => updateSection(pageKey, secKey, 'enabled', e.target.checked)}
                        className="rounded border-ga-border accent-ga-accent"
                      />
                      <select
                        value={sec.minTier}
                        onChange={(e) => updateSection(pageKey, secKey, 'minTier', e.target.value)}
                        className="bg-ga-bg-primary border border-ga-border rounded px-2 py-1 text-xs text-ga-text-primary outline-none"
                      >
                        {TIER_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isExpanded && sections.length === 0 && (
              <div className="border-t border-ga-border px-4 py-3 text-sm text-ga-text-secondary italic">
                No configurable sections
              </div>
            )}
          </div>
        );
      })}

      {/* Save button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={!isDirty || updateMutation.isPending}
          className="bg-ga-accent hover:bg-ga-accent-hover text-white text-sm font-medium rounded-md px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
