import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useFoodbanks, useFoodbankSources } from '@/api/queries/useFoodbanks';
import {
  useDeleteFoodbank,
  useToggleFoodbank,
  useSeedFoodbanks,
  useRefreshAllFoodbanks,
} from '@/api/mutations/useFoodbankMutations';
import {
  useFetchSource,
  useResetSourceCooldown,
  useToggleSource,
} from '@/api/mutations/useFoodbankSourceMutations';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import PageHeader from '@/components/shared/PageHeader';
import FilterBar from '@/components/shared/FilterBar';
import StatusBadge from '@/components/shared/StatusBadge';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import { truncateText, formatRelativeDate } from '@/utils/format';
import { FOODBANK_COUNTRIES } from '@/utils/constants';
import type { Foodbank, FoodbankSource } from '@/types/api';

export default function FoodbanksListPage() {
  const { isAdmin } = useAuthStore();
  const [countryFilter, setCountryFilter] = useState('');
  const [appliedCountry, setAppliedCountry] = useState<string | undefined>(undefined);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);

  const { data, isLoading } = useFoodbanks(appliedCountry);
  const { data: sourcesData, isLoading: sourcesLoading } = useFoodbankSources();

  const deleteMutation = useDeleteFoodbank();
  const toggleMutation = useToggleFoodbank();
  const seedMutation = useSeedFoodbanks();
  const refreshAllMutation = useRefreshAllFoodbanks();
  const fetchSourceMutation = useFetchSource();
  const resetSourceMutation = useResetSourceCooldown();
  const toggleSourceMutation = useToggleSource();

  const dialog = useConfirmDialog();

  const applyFilter = () => {
    setAppliedCountry(countryFilter || undefined);
  };

  const countryOptions = [
    { value: '', label: 'All Countries' },
    ...FOODBANK_COUNTRIES.map((c) => ({ value: c.value, label: c.label })),
  ];

  const handleDelete = (fb: Foodbank) => {
    dialog.confirm({
      title: 'Delete Foodbank',
      message: `Delete "${fb.name}"? This cannot be undone.`,
      variant: 'danger',
      onConfirm: () => deleteMutation.mutate(fb.id),
    });
  };

  const getSourceAction = (source: FoodbankSource) => {
    switch (source.status) {
      case 'healthy':
        return (
          <button
            onClick={() => fetchSourceMutation.mutate(source.id)}
            disabled={fetchSourceMutation.isPending}
            className="text-ga-accent hover:underline text-xs disabled:opacity-50"
          >
            Fetch
          </button>
        );
      case 'cooldown':
        return (
          <button
            onClick={() => resetSourceMutation.mutate(source.id)}
            disabled={resetSourceMutation.isPending}
            className="text-yellow-400 hover:underline text-xs disabled:opacity-50"
          >
            Reset
          </button>
        );
      case 'disabled':
        return (
          <button
            onClick={() => toggleSourceMutation.mutate(source.id)}
            disabled={toggleSourceMutation.isPending}
            className="text-green-400 hover:underline text-xs disabled:opacity-50"
          >
            Enable
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Foodbanks"
        icon="🏦"
        count={data?.count}
        action={
          isAdmin ? (
            <Link
              to="/foodbanks/new"
              className="bg-ga-accent hover:bg-ga-accent-hover text-white text-sm font-medium rounded-md px-3 py-1.5 transition-colors"
            >
              + Add Foodbank
            </Link>
          ) : undefined
        }
      />

      <FilterBar onApply={applyFilter} className="mb-4">
        <FilterBar.Dropdown
          label="Country"
          value={countryFilter}
          options={countryOptions}
          onChange={setCountryFilter}
        />
      </FilterBar>

      {/* Admin quick actions */}
      {isAdmin && (
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="border border-ga-border text-ga-text-primary hover:bg-ga-bg-hover text-xs font-medium rounded-md px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            {seedMutation.isPending ? 'Seeding...' : 'Seed Foodbanks'}
          </button>
          <button
            onClick={() => refreshAllMutation.mutate()}
            disabled={refreshAllMutation.isPending}
            className="border border-ga-border text-ga-text-primary hover:bg-ga-bg-hover text-xs font-medium rounded-md px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            {refreshAllMutation.isPending ? 'Refreshing...' : 'Refresh All'}
          </button>
        </div>
      )}

      {/* Sources panel */}
      {isAdmin && (
        <div className="bg-ga-bg-card border border-ga-border rounded-lg mb-4 overflow-hidden">
          <button
            onClick={() => setSourcesExpanded(!sourcesExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-ga-text-primary hover:bg-ga-bg-hover transition-colors"
          >
            <span>Foodbank Sources ({sourcesData?.count ?? 0})</span>
            <span className="text-ga-text-secondary">{sourcesExpanded ? '▼' : '▶'}</span>
          </button>
          {sourcesExpanded && (
            <div className="border-t border-ga-border overflow-x-auto">
              {sourcesLoading ? (
                <LoadingSpinner text="Loading sources..." />
              ) : !sourcesData?.sources.length ? (
                <EmptyState title="No sources configured" icon="📡" />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ga-border">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ga-text-secondary">Name</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ga-text-secondary">Country</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-ga-text-secondary">Status</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ga-text-secondary">Last Success</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ga-text-secondary">Error</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-ga-text-secondary">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sourcesData.sources.map((src) => (
                      <tr key={src.id} className="border-b border-ga-border/50 hover:bg-ga-bg-hover">
                        <td className="px-3 py-2.5 font-medium text-ga-text-primary">{src.name}</td>
                        <td className="px-3 py-2.5 text-ga-text-secondary">{src.country}</td>
                        <td className="px-3 py-2.5 text-center"><StatusBadge status={src.status} /></td>
                        <td className="px-3 py-2.5 text-xs text-ga-text-secondary">{formatRelativeDate(src.last_success)}</td>
                        <td className="px-3 py-2.5 text-xs text-red-400">{truncateText(src.error_message, 40)}</td>
                        <td className="px-3 py-2.5 text-right">{getSourceAction(src)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* Foodbank cards grid */}
      {isLoading ? (
        <LoadingSpinner text="Loading foodbanks..." />
      ) : !data?.foodbanks.length ? (
        <EmptyState title="No foodbanks found" icon="🏦" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.foodbanks.map((fb) => (
            <div
              key={fb.id}
              className="bg-ga-bg-card border border-ga-border rounded-lg p-4 hover:border-ga-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-ga-text-primary text-sm">{fb.name}</h3>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <StatusBadge status={fb.state || fb.country} />
                  <StatusBadge status={fb.is_active ? 'active' : 'disabled'} />
                </div>
              </div>

              {fb.description && (
                <p className="text-xs text-ga-text-secondary mb-2">
                  {truncateText(fb.description, 100)}
                </p>
              )}

              {fb.location_address && (
                <p className="text-xs text-ga-text-secondary mb-1">
                  📍 {truncateText(fb.location_address, 60)}
                </p>
              )}

              {fb.location_link && (
                <a
                  href={fb.location_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ga-accent hover:underline text-xs"
                >
                  View on Map
                </a>
              )}

              {isAdmin && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-ga-border/50">
                  <Link
                    to={`/foodbanks/${fb.id}/edit`}
                    className="text-ga-accent hover:underline text-xs"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => toggleMutation.mutate(fb.id)}
                    disabled={toggleMutation.isPending}
                    className="text-yellow-400 hover:underline text-xs disabled:opacity-50"
                  >
                    {fb.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleDelete(fb)}
                    className="text-red-400 hover:text-red-300 text-xs"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog state={dialog.state} onCancel={dialog.close} />
    </div>
  );
}
