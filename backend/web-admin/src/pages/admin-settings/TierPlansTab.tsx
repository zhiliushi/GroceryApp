import { useState } from 'react';
import { useTiersConfig } from '@/api/queries/useConfig';
import { useUpdateTiers } from '@/api/mutations/useConfigMutations';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import TierEditModal from './TierEditModal';
import type { TierDefinition, TiersConfig } from '@/types/api';

const TIER_COLORS: Record<string, string> = {
  free: 'border-gray-500',
  plus: 'border-blue-500',
  pro: 'border-ga-accent',
};

function LimitDisplay({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-ga-text-secondary">{label}</span>
      <span className="text-ga-text-primary font-medium">
        {value === -1 ? 'Unlimited' : value}
      </span>
    </div>
  );
}

export default function TierPlansTab() {
  const { data, isLoading } = useTiersConfig();
  const updateMutation = useUpdateTiers();
  const [editingTier, setEditingTier] = useState<TierDefinition | null>(null);

  if (isLoading || !data) return <LoadingSpinner />;

  const tiers = data.tiers;
  const tierOrder = ['free', 'plus', 'pro'];

  const handleSaveTier = (updated: TierDefinition) => {
    const newConfig: TiersConfig = {
      ...data,
      tiers: { ...data.tiers, [updated.key]: updated },
    };
    updateMutation.mutate(newConfig, { onSuccess: () => setEditingTier(null) });
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tierOrder.map((key) => {
          const tier = tiers[key];
          if (!tier) return null;
          return (
            <div
              key={key}
              className={`bg-ga-bg-card border-2 ${TIER_COLORS[key] || 'border-ga-border'} rounded-lg p-5`}
            >
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-ga-text-primary">{tier.name}</h3>
                <div className="text-2xl font-bold text-ga-accent mt-1">
                  {tier.price === 0 ? 'Free' : `RM ${tier.price}`}
                </div>
                {tier.billing && (
                  <span className="text-xs text-ga-text-secondary">/{tier.billing}</span>
                )}
              </div>

              <p className="text-sm text-ga-text-secondary text-center mb-4">{tier.description}</p>

              <div className="space-y-2 mb-4">
                <LimitDisplay label="Max Items" value={tier.limits.max_items} />
                <LimitDisplay label="Max Lists" value={tier.limits.max_lists} />
                <LimitDisplay label="Data Retention" value={tier.limits.data_retention_days} />
                <LimitDisplay label="Scans/Day" value={tier.limits.max_scans_per_day} />
              </div>

              {tier.selectable_tools > 0 && (
                <div className="text-sm text-blue-400 text-center mb-3">
                  Pick {tier.selectable_tools} tools from menu
                </div>
              )}

              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase text-ga-text-secondary mb-1">Features</div>
                {tier.features.map((f) => (
                  <div key={f} className="text-xs text-ga-text-primary flex items-center gap-1.5">
                    <span className="text-green-400">✓</span>
                    {f.replace(/_/g, ' ')}
                  </div>
                ))}
              </div>

              <button
                onClick={() => setEditingTier(tier)}
                className="mt-4 w-full border border-ga-border text-ga-text-primary hover:bg-ga-bg-hover text-sm rounded-md px-3 py-1.5 transition-colors"
              >
                Edit
              </button>
            </div>
          );
        })}
      </div>

      {/* Addons section */}
      {data.separate_addons && Object.keys(data.separate_addons).length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-ga-text-secondary uppercase mb-3">Add-ons</h3>
          {Object.entries(data.separate_addons).map(([key, addon]) => (
            <div key={key} className="bg-ga-bg-card border border-ga-border rounded-lg p-4 flex items-center justify-between">
              <div>
                <span className="font-medium text-ga-text-primary">{addon.name}</span>
                <span className="text-sm text-ga-text-secondary ml-2">
                  {addon.price ? `RM ${addon.price}` : 'Pricing TBD'}
                </span>
                {addon.note && <p className="text-xs text-ga-text-secondary mt-1">{addon.note}</p>}
              </div>
              <div className="flex gap-1">
                {addon.features.map((f) => (
                  <span key={f} className="text-xs bg-purple-500/20 text-purple-300 rounded px-1.5 py-0.5">
                    {f.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editingTier && (
        <TierEditModal
          tier={editingTier}
          onSave={handleSaveTier}
          onClose={() => setEditingTier(null)}
          isSaving={updateMutation.isPending}
        />
      )}
    </>
  );
}
