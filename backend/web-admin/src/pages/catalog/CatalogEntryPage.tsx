import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCatalogEntry, useCatalog } from '@/api/queries/useCatalog';
import {
  useDeleteCatalogEntry,
  useMergeCatalogEntry,
  useUpdateCatalogEntry,
} from '@/api/mutations/useCatalogMutations';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import Breadcrumbs from '@/components/shared/Breadcrumbs';
import ExpiryCountdownChip from '@/components/waste/ExpiryCountdownChip';
import QuickAddModal from '@/components/quickadd/QuickAddModal';
import { getCatalogEntryActions, getStatusBadge, type Action } from '@/utils/actionResolver';
import { cn } from '@/utils/cn';
import type { CatalogEntry } from '@/types/api';

export default function CatalogEntryPage() {
  const { nameNorm } = useParams<{ nameNorm: string }>();
  const navigate = useNavigate();
  const { data: entry, isLoading, error } = useCatalogEntry(nameNorm);
  const updateMutation = useUpdateCatalogEntry();
  const deleteMutation = useDeleteCatalogEntry();
  const mergeMutation = useMergeCatalogEntry();

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);

  if (isLoading) return <LoadingSpinner text="Loading…" />;
  if (error || !entry) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
          Could not load catalog entry.
        </div>
      </div>
    );
  }

  function handleAction(action: Action) {
    if (!entry || action.disabled) return;
    switch (action.id) {
      case 'new_purchase':
        setAddOpen(true);
        break;
      case 'edit_name':
        setEditingName(true);
        setNameDraft(entry.display_name);
        break;
      case 'unlink_barcode':
        if (window.confirm('Unlink barcode from this catalog entry?')) {
          updateMutation.mutate({ nameNorm: entry.name_norm, data: { barcode: null } });
        }
        break;
      case 'merge_into':
        setMergeOpen(true);
        break;
      case 'delete':
        if (
          window.confirm(
            `Delete catalog entry "${entry.display_name}"? Its ${entry.total_purchases} purchase(s) will become orphan history.`,
          )
        ) {
          deleteMutation.mutate(
            { nameNorm: entry.name_norm },
            { onSuccess: () => navigate('/catalog') },
          );
        }
        break;
      default:
        break;
    }
  }

  function saveName() {
    if (!entry || !nameDraft.trim()) {
      setEditingName(false);
      return;
    }
    updateMutation.mutate(
      { nameNorm: entry.name_norm, data: { display_name: nameDraft.trim() } },
      { onSuccess: () => setEditingName(false) },
    );
  }

  const actions = getCatalogEntryActions(entry);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'My Catalog', to: '/catalog' },
          { label: entry.display_name },
        ]}
      />
      <Link to="/catalog" className="text-sm text-ga-accent hover:underline">
        ← My Catalog
      </Link>

      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  autoFocus
                  className="text-xl font-semibold bg-ga-bg-hover px-2 py-1 rounded"
                />
                <button onClick={saveName} className="text-xs px-2 py-1 bg-ga-accent text-white rounded">
                  Save
                </button>
                <button onClick={() => setEditingName(false)} className="text-xs px-2 py-1 border border-ga-border rounded">
                  Cancel
                </button>
              </div>
            ) : (
              <h1
                className="text-xl font-semibold text-ga-text-primary cursor-pointer hover:underline"
                onClick={() => {
                  setEditingName(true);
                  setNameDraft(entry.display_name);
                }}
                title="Click to edit"
              >
                {entry.display_name} ✎
              </h1>
            )}
            <div className="flex items-center gap-3 text-xs text-ga-text-secondary mt-1">
              {entry.barcode && <span>🏷️ {entry.barcode}</span>}
              {entry.country_code && <span>{entry.country_code}</span>}
              {entry.needs_review && (
                <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                  Needs review
                </span>
              )}
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <Stat label="Total purchases" value={entry.total_purchases} />
          <Stat label="Active" value={entry.active_purchases} />
          <Stat label="Location" value={entry.default_location || '—'} />
          <Stat
            label="Last bought"
            value={
              entry.last_purchased_at
                ? new Date(entry.last_purchased_at).toLocaleDateString()
                : '—'
            }
          />
        </dl>

        <div className="border-t border-ga-border pt-4">
          <h3 className="text-sm font-semibold text-ga-text-primary mb-2">Recent purchases</h3>
          {!entry.history || entry.history.length === 0 ? (
            <p className="text-xs text-ga-text-secondary italic">No purchase history yet.</p>
          ) : (
            <ul className="space-y-1">
              {entry.history.slice(0, 10).map((h) => {
                const badge = getStatusBadge(h.status);
                return (
                  <li
                    key={h.id}
                    className="flex items-center gap-2 text-xs py-1.5 border-b border-ga-border/30 last:border-0"
                  >
                    <span className={cn('px-1.5 py-0.5 rounded text-[10px]', badge.color)}>
                      {badge.label}
                    </span>
                    <span className="text-ga-text-primary">
                      {new Date(h.date_bought).toLocaleDateString()}
                    </span>
                    {h.price !== null && h.price !== undefined && (
                      <span className="text-ga-text-secondary">
                        {h.currency ? `${h.currency} ` : ''}
                        {h.price.toFixed(2)}
                      </span>
                    )}
                    {h.status === 'active' && <ExpiryCountdownChip expiryDate={h.expiry_date} />}
                    <Link
                      to={`/my-items/${h.id}`}
                      className="ml-auto text-ga-accent hover:underline"
                    >
                      View →
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-ga-border pt-4">
          <h3 className="text-sm font-semibold text-ga-text-primary mb-2">Actions</h3>
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <button
                key={action.id}
                disabled={action.disabled}
                onClick={() => handleAction(action)}
                title={action.disabledReason}
                className={cn(
                  'px-3 py-1.5 text-sm rounded',
                  action.severity === 'primary' && 'bg-ga-accent text-white hover:opacity-90',
                  action.severity === 'secondary' && 'bg-ga-bg-hover text-ga-text-primary hover:bg-ga-bg-card',
                  action.severity === 'tertiary' &&
                    'text-ga-text-secondary hover:bg-ga-bg-hover border border-ga-border',
                  action.severity === 'danger' && 'bg-red-500/10 text-red-500 hover:bg-red-500/20',
                  action.disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <QuickAddModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        defaults={{ catalogEntry: entry }}
      />

      {mergeOpen && (
        <MergeModal
          source={entry}
          onClose={() => setMergeOpen(false)}
          onMerge={(target) => {
            mergeMutation.mutate(
              { srcNameNorm: entry.name_norm, targetNameNorm: target.name_norm },
              {
                onSuccess: () => {
                  setMergeOpen(false);
                  navigate(`/catalog/${target.name_norm}`);
                },
              },
            );
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-xs text-ga-text-secondary">{label}</div>
      <div className="text-lg font-semibold text-ga-text-primary">{value}</div>
    </div>
  );
}

function MergeModal({
  source,
  onClose,
  onMerge,
}: {
  source: CatalogEntry;
  onClose: () => void;
  onMerge: (target: CatalogEntry) => void;
}) {
  const [q, setQ] = useState('');
  const { data } = useCatalog({ q, limit: 20 });
  const candidates = (data?.items ?? []).filter((e) => e.name_norm !== source.name_norm);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-ga-bg-card border border-ga-border rounded-xl shadow-2xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-ga-border">
          <h3 className="text-base font-semibold text-ga-text-primary">
            Merge "{source.display_name}" into…
          </h3>
          <p className="text-xs text-ga-text-secondary mt-1">
            All {source.total_purchases} purchase(s) will be re-parented to the target. Source entry is deleted.
          </p>
        </div>
        <div className="px-5 py-4 space-y-2">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search catalog…"
            autoFocus
            className="w-full px-3 py-2 bg-ga-bg-card border border-ga-border rounded-md text-ga-text-primary focus:outline-none focus:border-ga-accent"
          />
          <div className="max-h-64 overflow-y-auto space-y-1">
            {candidates.length === 0 ? (
              <p className="text-xs text-ga-text-secondary italic text-center py-4">
                No candidates. Create another catalog entry first.
              </p>
            ) : (
              candidates.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onMerge(c)}
                  className="w-full text-left px-3 py-2 rounded hover:bg-ga-bg-hover text-sm"
                >
                  <div className="text-ga-text-primary">{c.display_name}</div>
                  <div className="text-xs text-ga-text-secondary">
                    {c.total_purchases}× bought
                    {c.barcode && ` · ${c.barcode}`}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
        <div className="px-5 py-3 border-t border-ga-border flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm border border-ga-border rounded-md text-ga-text-primary hover:bg-ga-bg-hover"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
