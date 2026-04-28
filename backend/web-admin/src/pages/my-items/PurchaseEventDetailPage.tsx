import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePurchase } from '@/api/queries/usePurchases';
import { useCatalogEntry } from '@/api/queries/useCatalog';
import {
  useChangePurchaseStatus,
  useDeletePurchase,
  useUpdatePurchase,
} from '@/api/mutations/usePurchaseMutations';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import Breadcrumbs from '@/components/shared/Breadcrumbs';
import ExpiryCountdownChip from '@/components/waste/ExpiryCountdownChip';
import ThrowAwayModal from '@/components/waste/ThrowAwayModal';
import GiveAwayModal from '@/components/waste/GiveAwayModal';
import ExpiryInput from '@/components/quickadd/ExpiryInput';
import { useUndoableAction } from '@/hooks/useUndoableAction';
import {
  getPurchaseEventActions,
  getPurchaseEventState,
  getStatusBadge,
  type Action,
} from '@/utils/actionResolver';
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/utils/cn';

const LOCATIONS = ['fridge', 'freezer', 'pantry', 'counter', 'other'];

export default function PurchaseEventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { data: event, isLoading, error } = usePurchase(eventId);
  const { data: catalogEntry } = useCatalogEntry(event?.catalog_name_norm);
  const changeStatus = useChangePurchaseStatus();
  const deleteMutation = useDeletePurchase();
  const updateMutation = useUpdatePurchase();
  const undoable = useUndoableAction();
  const setRecentlyEditedPurchaseId = useUiStore((s) => s.setRecentlyEditedPurchaseId);

  const [editingExpiry, setEditingExpiry] = useState(false);
  const [expiryRaw, setExpiryRaw] = useState('');
  const [editingLocation, setEditingLocation] = useState(false);
  const [editLocation, setEditLocation] = useState('');
  const [throwOpen, setThrowOpen] = useState(false);
  const [giveOpen, setGiveOpen] = useState(false);

  if (isLoading) return <LoadingSpinner text="Loading…" />;
  if (error || !event) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
          Could not load purchase event.
        </div>
      </div>
    );
  }

  const state = getPurchaseEventState(event);
  const actions = getPurchaseEventActions(event);
  const badge = getStatusBadge(event.status);

  function handleAction(action: Action) {
    if (!event) return;
    if (action.disabled) return;
    switch (action.id) {
      case 'mark_used':
        // Plan principle: Undo over confirm — deferred commit with Undo toast
        undoable.run(
          () =>
            changeStatus.mutate({
              id: event.id,
              data: { status: 'used', reason: 'used_up' },
              silent: true,
            }),
          `Marked "${event.catalog_display}" as used`,
        );
        break;
      case 'mark_thrown':
        setThrowOpen(true);
        break;
      case 'give_away':
        setGiveOpen(true);
        break;
      case 'set_expiry':
        setEditingExpiry(true);
        setExpiryRaw(event.expiry_raw || '');
        break;
      case 'set_location':
      case 'move_location':
        setEditingLocation(true);
        setEditLocation(event.location || 'pantry');
        break;
      case 'delete':
        // Plan principle: no up-front confirm; deferred mutation with Undo
        navigate('/my-items');  // navigate away first; undoable commits in background
        undoable.run(
          () => deleteMutation.mutate({ id: event.id, silent: true }),
          `Deleted "${event.catalog_display}"`,
        );
        break;
      case 'view_history':
        if (event.catalog_name_norm) {
          navigate(`/catalog/${event.catalog_name_norm}`);
        }
        break;
      default:
        break;
    }
  }

  function saveExpiry() {
    if (!event) return;
    updateMutation.mutate(
      { id: event.id, data: { expiry_raw: expiryRaw || undefined } },
      {
        onSuccess: () => {
          setEditingExpiry(false);
          setRecentlyEditedPurchaseId(event.id);
        },
      },
    );
  }

  function saveLocation() {
    if (!event) return;
    updateMutation.mutate(
      { id: event.id, data: { location: editLocation } },
      {
        onSuccess: () => {
          setEditingLocation(false);
          setRecentlyEditedPurchaseId(event.id);
        },
      },
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <ThrowAwayModal open={throwOpen} event={event} onClose={() => setThrowOpen(false)} />
      <GiveAwayModal open={giveOpen} event={event} onClose={() => setGiveOpen(false)} />
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'My Items', to: '/my-items' },
          { label: event.catalog_display },
        ]}
      />
      <Link to="/my-items" className="text-sm text-ga-accent hover:underline">
        ← My Items
      </Link>

      <div className="bg-ga-bg-card border border-ga-border rounded-lg p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-ga-text-primary">{event.catalog_display}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn('text-xs px-2 py-0.5 rounded-full', badge.color)}>
                {badge.label}
              </span>
              <ExpiryCountdownChip expiryDate={event.expiry_date} />
            </div>
          </div>
          {event.quantity !== 1 && (
            <div className="text-sm text-ga-text-secondary">qty × {event.quantity}</div>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <Row label="Bought">
            {event.date_bought ? new Date(event.date_bought).toLocaleDateString() : '—'}
          </Row>
          <Row label="Location">
            {editingLocation ? (
              <div className="flex gap-2 items-center">
                <select
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="px-2 py-1 bg-ga-bg-card border border-ga-border rounded text-sm"
                >
                  {LOCATIONS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
                <button
                  onClick={saveLocation}
                  className="text-xs px-2 py-1 bg-ga-accent text-white rounded"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingLocation(false)}
                  className="text-xs px-2 py-1 border border-ga-border rounded"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <span
                className="cursor-pointer hover:underline"
                onClick={() => {
                  setEditingLocation(true);
                  setEditLocation(event.location || 'pantry');
                }}
              >
                📍 {event.location || '(none)'} ✎
              </span>
            )}
          </Row>
          <Row label="Barcode">{event.barcode ?? '—'}</Row>
          <Row label="Price">
            {event.price !== null && event.price !== undefined
              ? `${event.currency ? event.currency + ' ' : ''}${event.price.toFixed(2)}${event.payment_method ? ` (${event.payment_method})` : ''}`
              : '—'}
          </Row>
          <Row label="Expiry">
            {editingExpiry ? (
              <div className="col-span-2 space-y-2">
                <ExpiryInput value={expiryRaw} onChange={setExpiryRaw} />
                <div className="flex gap-2">
                  <button
                    onClick={saveExpiry}
                    className="text-xs px-3 py-1 bg-ga-accent text-white rounded"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingExpiry(false)}
                    className="text-xs px-3 py-1 border border-ga-border rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <span
                className="cursor-pointer hover:underline"
                onClick={() => {
                  setEditingExpiry(true);
                  setExpiryRaw(event.expiry_raw || '');
                }}
              >
                {event.expiry_date ? new Date(event.expiry_date).toLocaleDateString() : '—'} ✎
              </span>
            )}
          </Row>
          <Row label="Status">{event.status}</Row>
          {event.consumed_date && (
            <Row label="Consumed">
              {new Date(event.consumed_date).toLocaleDateString()}
              {event.consumed_reason ? ` (${event.consumed_reason})` : ''}
            </Row>
          )}
          {event.transferred_to && <Row label="Given to">{event.transferred_to}</Row>}
        </dl>

        {catalogEntry && (
          <div className="border-t border-ga-border pt-4">
            <h3 className="text-sm font-semibold text-ga-text-primary mb-2">Catalog info</h3>
            <p className="text-xs text-ga-text-secondary">
              "{catalogEntry.display_name}" · bought {catalogEntry.total_purchases}× ·{' '}
              {catalogEntry.active_purchases} currently active
            </p>
            <Link
              to={`/catalog/${catalogEntry.name_norm}`}
              className="text-xs text-ga-accent hover:underline mt-1 inline-block"
            >
              → View catalog entry
            </Link>
          </div>
        )}

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
                  action.severity === 'tertiary' && 'text-ga-text-secondary hover:bg-ga-bg-hover border border-ga-border',
                  action.severity === 'danger' && 'bg-red-500/10 text-red-500 hover:bg-red-500/20',
                  action.disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-ga-text-secondary mt-2">State: {state}</p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-ga-text-secondary">{label}</dt>
      <dd className="text-ga-text-primary">{children}</dd>
    </>
  );
}
