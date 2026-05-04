import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { usePurchase } from '@/api/queries/usePurchases';
import { useCatalogEntry } from '@/api/queries/useCatalog';
import { useStores } from '@/api/queries/useStores';
import {
  useDeletePurchase,
  useUpdatePurchase,
  useRestoreEvent,
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
  const restoreMutation = useRestoreEvent();
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

      <details className="bg-ga-bg-card border border-ga-border rounded-lg group">
        <summary className="cursor-pointer list-none px-4 py-2 text-xs text-ga-text-secondary flex items-center justify-between hover:bg-ga-bg-hover/40 rounded-lg">
          <span>ⓘ What can I do here?</span>
          <span className="text-[10px] group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="px-4 pb-3 pt-1 text-xs text-ga-text-secondary space-y-1.5 border-t border-ga-border">
          <p>
            <span className="text-ga-text-primary font-medium">This page</span> is one
            specific batch of an item — bought on one day, in one location. Different
            from <em>My Catalog</em> which groups every batch under one item name.
          </p>
          <p>
            <span className="text-ga-text-primary font-medium">Tap a field with ✎</span>{' '}
            (Location, Expiry) to edit it inline. Other fields are read-only.
          </p>
          <p>
            <span className="text-ga-text-primary font-medium">Action buttons</span>{' '}
            change based on state — an active item shows <em>Used / Thrown / Give away</em>;
            a thrown item shows <em>Restore to active</em>. The chip at the top tells you
            which state you&apos;re in.
          </p>
          <p>
            <span className="text-ga-text-primary font-medium">Use / Throw / Give away</span>{' '}
            each open a small modal where you can dial down to a partial amount (e.g.
            "used 2 of 12") before confirming. The original event splits in two — the
            consumed portion gets the new status, the rest stays active.
          </p>
          <p>
            <span className="text-ga-text-primary font-medium">Multi-pack</span> means
            this batch is part of a sibling group bought together (a 6-pack of the same
            yogurt). Sibling packs share a multi-pack id; mark each one as you finish it.
          </p>
        </div>
      </details>

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
          <Row label="Bought" hint="When you logged this purchase.">
            {event.date_bought ? new Date(event.date_bought).toLocaleDateString() : '—'}
          </Row>
          <Row label="Location" hint="Where this batch sits. Click to move it.">
            <span
              className="cursor-pointer hover:underline"
              onClick={() => setMoveOpen(true)}
              title="Open the move modal — change location and optionally split into a partial move."
            >
              📍 {event.location || '(none)'} ✎
            </span>
          </Row>
          <Row label="Barcode" hint="The barcode on the package, if scanned.">{event.barcode ?? '—'}</Row>
          <Row label="Price" hint="Original currency on top, your display currency below if different, then per-unit price.">
            <PriceCell event={event} />
          </Row>
          <Row label="Pack size" hint="How many units came in this purchase (e.g. 12 eggs in a carton, 6 bottles in a multi-pack).">
            {event.pack_size && event.pack_size > 1
              ? `${event.pack_size} ${event.base_unit_label || 'unit'}${event.pack_size === 1 ? '' : 's'} / pack`
              : `1 ${event.base_unit_label || 'unit'}`}
          </Row>
          <Row label="Store" hint="The shop you bought this at — used for cross-store price comparison on the catalog page.">
            {event.store_id
              ? event.store_id === 'unknown'
                ? <span className="text-ga-text-secondary">Unknown / Other</span>
                : <span>🏪 {storeName ?? event.store_id}</span>
              : '—'}
          </Row>
          {event.multi_pack_parent_id && (
            <Row label="Multi-pack" hint="Sibling packs bought together share this id, so you can track them as a group.">
              <span className="font-mono text-xs">{event.multi_pack_parent_id.slice(0, 8)}…</span>{' '}
              <span className="text-xs text-ga-text-secondary">(sibling packs share this id)</span>
            </Row>
          )}
          <Row label="Expiry" hint="Best-before date. Click to edit — accepts natural language like 'tomorrow' or 'next Friday'.">
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
                title="Click to edit. You can type 'tomorrow', 'next Friday', or an ISO date."
              >
                {event.expiry_date ? new Date(event.expiry_date).toLocaleDateString() : '—'} ✎
              </span>
            )}
          </Row>
          <Row label="Status" hint="Raw state — also shown as the colored chip at the top.">{event.status}</Row>
          {event.consumed_date && (
            <Row label="Consumed" hint="When and why this batch left active stock.">
              {new Date(event.consumed_date).toLocaleDateString()}
              {event.consumed_reason ? ` (${event.consumed_reason})` : ''}
            </Row>
          )}
          {event.transferred_to && <Row label="Given to" hint="Who you gave this to. Doesn't count as waste.">{event.transferred_to}</Row>}
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
            {/* Restore button — only visible for terminal events. The 7-day
                Undo toast handles in-session mistakes; this is for older
                mis-clicks (e.g. "I marked this thrown last week, want it
                back") and disaster recovery. */}
            {event.status !== 'active' && (
              <button
                onClick={() => restoreMutation.mutate(event.id)}
                disabled={restoreMutation.isPending}
                title="Flip this event back to active"
                className="px-3 py-1.5 text-sm rounded border border-green-500/40 bg-green-500/10 text-green-500 hover:bg-green-500/20 disabled:opacity-50"
              >
                {restoreMutation.isPending ? 'Restoring…' : '↺ Restore to active'}
              </button>
            )}
          </div>
          <p
            className="text-xs text-ga-text-secondary mt-2"
            title="Diagnostic state from the action resolver. Decides which buttons appear above."
          >State: {state}</p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <>
      <dt className="text-ga-text-secondary" title={hint}>{label}</dt>
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
