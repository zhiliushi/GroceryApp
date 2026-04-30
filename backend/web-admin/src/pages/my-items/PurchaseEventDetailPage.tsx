import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { usePurchase } from '@/api/queries/usePurchases';
import { useCatalogEntry } from '@/api/queries/useCatalog';
import { useStores } from '@/api/queries/useStores';
import {
  useDeletePurchase,
  useUpdatePurchase,
} from '@/api/mutations/usePurchaseMutations';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import Breadcrumbs from '@/components/shared/Breadcrumbs';
import ExpiryCountdownChip from '@/components/waste/ExpiryCountdownChip';
import ThrowAwayModal from '@/components/waste/ThrowAwayModal';
import GiveAwayModal from '@/components/waste/GiveAwayModal';
import MarkUsedModal from '@/components/waste/MarkUsedModal';
import MoveLocationModal from '@/components/waste/MoveLocationModal';
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

export default function PurchaseEventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { data: event, isLoading, error } = usePurchase(eventId);
  const { data: catalogEntry } = useCatalogEntry(event?.catalog_name_norm);
  const { data: stores } = useStores();
  const storeName = useMemo(() => {
    if (!event?.store_id || !stores) return null;
    const match = stores.find((s) => s.store_id === event.store_id);
    return match?.name ?? null;
  }, [event?.store_id, stores]);
  const deleteMutation = useDeletePurchase();
  const updateMutation = useUpdatePurchase();
  const undoable = useUndoableAction();
  const setRecentlyEditedPurchaseId = useUiStore((s) => s.setRecentlyEditedPurchaseId);

  const [editingExpiry, setEditingExpiry] = useState(false);
  const [expiryRaw, setExpiryRaw] = useState('');
  const [throwOpen, setThrowOpen] = useState(false);
  const [giveOpen, setGiveOpen] = useState(false);
  const [usedOpen, setUsedOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

  // Auto-open the matching editor when arriving with `?edit=location|expiry`
  // (e.g. from a deep link). The location flow uses the move modal so partial
  // moves are reachable from the deep link too. Consumes the param so refresh
  // doesn't keep reopening.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (!event) return;
    const editTarget = searchParams.get('edit');
    if (editTarget === 'location') {
      setMoveOpen(true);
      setSearchParams({}, { replace: true });
    } else if (editTarget === 'expiry') {
      setEditingExpiry(true);
      setExpiryRaw(event.expiry_raw || '');
      setSearchParams({}, { replace: true });
    }
  }, [event, searchParams, setSearchParams]);

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
        setUsedOpen(true);
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
        setMoveOpen(true);
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

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <ThrowAwayModal open={throwOpen} event={event} onClose={() => setThrowOpen(false)} />
      <GiveAwayModal open={giveOpen} event={event} onClose={() => setGiveOpen(false)} />
      <MarkUsedModal open={usedOpen} event={event} onClose={() => setUsedOpen(false)} />
      <MoveLocationModal open={moveOpen} event={event} onClose={() => setMoveOpen(false)} />
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
            <span
              className="cursor-pointer hover:underline"
              onClick={() => setMoveOpen(true)}
            >
              📍 {event.location || '(none)'} ✎
            </span>
          </Row>
          <Row label="Barcode">{event.barcode ?? '—'}</Row>
          <Row label="Price">
            <PriceCell event={event} />
          </Row>
          <Row label="Pack size">
            {event.pack_size && event.pack_size > 1
              ? `${event.pack_size} ${event.base_unit_label || 'unit'}${event.pack_size === 1 ? '' : 's'} / pack`
              : `1 ${event.base_unit_label || 'unit'}`}
          </Row>
          <Row label="Store">
            {event.store_id
              ? event.store_id === 'unknown'
                ? <span className="text-ga-text-secondary">Unknown / Other</span>
                : <span>🏪 {storeName ?? event.store_id}</span>
              : '—'}
          </Row>
          {event.multi_pack_parent_id && (
            <Row label="Multi-pack">
              <span className="font-mono text-xs">{event.multi_pack_parent_id.slice(0, 8)}…</span>{' '}
              <span className="text-xs text-ga-text-secondary">(sibling packs share this id)</span>
            </Row>
          )}
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

/**
 * Price display per Phase B of catalog_evolution.md:
 *   Original currency line: "MYR 10.99 (cash)"
 *   Display-currency conversion (if different):
 *     "≈ SGD 3.30 (rate 0.30, locked 2026-04-30)"
 *   Per-unit (in display currency):
 *     "$1.83 / egg"
 */
function PriceCell({
  event,
}: {
  event: import('@/types/api').PurchaseEvent;
}) {
  if (event.price == null && event.amount == null) return <>—</>;
  const originalAmount = event.amount ?? event.price;
  const originalCurrency = event.currency || '';
  const display = event.display_amount ?? null;
  const displayCurrency = event.display_currency || originalCurrency;
  const fxRate = event.fx_rate_at_save;
  const fxDate = event.fx_rate_date;
  const unitPrice = event.unit_price;
  const baseUnit = event.base_unit_label || 'unit';
  const isStale = (event as { fx_is_stale?: boolean }).fx_is_stale;

  const originalDiffersFromDisplay =
    display != null && originalCurrency && originalCurrency !== displayCurrency;

  return (
    <div className="flex flex-col gap-0.5">
      <span>
        {originalCurrency ? `${originalCurrency} ` : ''}
        {originalAmount != null ? originalAmount.toFixed(2) : '—'}
        {event.payment_method ? ` (${event.payment_method})` : ''}
      </span>
      {originalDiffersFromDisplay && (
        <span className="text-xs text-ga-text-secondary">
          ≈ {displayCurrency} {display!.toFixed(2)}
          {fxRate != null && ` · rate ${fxRate.toFixed(4)}`}
          {fxDate && ` · locked ${fxDate}`}
          {isStale && <span className="ml-1 text-orange-400">(stale)</span>}
        </span>
      )}
      {unitPrice != null && (
        <span className="text-xs text-ga-text-secondary">
          {displayCurrency} {unitPrice.toFixed(2)} / {baseUnit}
        </span>
      )}
    </div>
  );
}
