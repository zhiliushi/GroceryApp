import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useLocations } from '@/api/queries/useLocations';
import { usePurchases } from '@/api/queries/usePurchases';
import {
  useAddLocation,
  useUpdateLocations,
  useDeleteLocation,
} from '@/api/mutations/useLocationMutations';
import { useAuthStore } from '@/stores/authStore';
import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { cn } from '@/utils/cn';
import type { LocationItem, PurchaseEvent } from '@/types/api';

const UNSORTED_KEY = '_unsorted';

/**
 * Storage page — card dashboard, one card per storage location.
 *
 * Each card is the user's mental model of a kitchen area (Fridge,
 * Pantry, Freezer, plus an "Unsorted" bucket when any active event has
 * no location set). Clicking a card opens the per-storage detail page
 * (`/storage/:locationKey`) for "what's inside?". Admin controls
 * (Edit / move-up / move-down / Delete) stay on the card but
 * stopPropagation so they don't trigger the card-level click.
 *
 * Earlier iterations used `useInventory` (legacy grocery_items shim).
 * Now reads `usePurchases({status:'active'})` directly — same source as
 * StorageDetailPage and the dashboard's StorageListCard. Cache-shared.
 *
 * Title-row right-padding (`md:pr-[280px]`) reserves clearance for the
 * fixed top-right Add/Scan pills (z-30). Without it the title and the
 * "+ Add Location" admin button slide under the pills.
 */
export default function StoragePage() {
  const [showAdd, setShowAdd] = useState(false);
  const { locations, isLoading: locLoading } = useLocations();
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const { data: purchases, isLoading: purchasesLoading } = usePurchases({
    status: 'active',
    limit: 200,
  });
  const updateMutation = useUpdateLocations();

  const stats = useMemo(
    () => buildLocationStats(locations, purchases?.items ?? []),
    [locations, purchases],
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0) return;
      const updated = [...locations];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      updated.forEach((loc, i) => (loc.sort = i));
      updateMutation.mutate(updated);
    },
    [locations, updateMutation],
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= locations.length - 1) return;
      const updated = [...locations];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      updated.forEach((loc, i) => (loc.sort = i));
      updateMutation.mutate(updated);
    },
    [locations, updateMutation],
  );

  const handleSave = useCallback(
    (index: number, updates: Partial<LocationItem>) => {
      const updated = locations.map((loc, i) =>
        i === index ? { ...loc, ...updates } : loc,
      );
      updateMutation.mutate(updated);
    },
    [locations, updateMutation],
  );

  if (locLoading || purchasesLoading) return <LoadingSpinner />;

  return (
    <div className="p-3 sm:p-6 max-w-5xl mx-auto">
      {/* Right-padding clears the floating Add/Scan pills (top-right z-30). */}
      <div className="md:pr-[280px]">
        <div className="flex items-center justify-between mb-2">
          <PageHeader
            title="Storage"
            icon="🗄️"
            count={stats.locationCards.length}
          />
          {isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="bg-ga-accent hover:bg-ga-accent-hover text-white text-sm font-medium rounded-lg px-3 py-1.5 transition-colors flex-shrink-0"
            >
              + Add Location
            </button>
          )}
        </div>
        <p className="text-xs text-ga-text-secondary mb-5">
          Tap any location to see what's inside.
        </p>
      </div>

      {/* Add form — admin only */}
      {showAdd && (
        <div className="mb-6">
          <AddLocationForm onDone={() => setShowAdd(false)} />
        </div>
      )}

      {/* Location card grid */}
      {stats.locationCards.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.locationCards.map((card, index) => (
            <LocationCard
              key={card.location.key}
              card={card}
              isAdmin={isAdmin}
              isFirst={index === 0}
              isLast={index === stats.locationCards.length - 1}
              isOnly={stats.locationCards.length === 1}
              onMoveUp={() => handleMoveUp(index)}
              onMoveDown={() => handleMoveDown(index)}
              onSave={(updates) => handleSave(index, updates)}
            />
          ))}
          {/* Unsorted bucket card — only when there are unassigned events. Admin
              controls don't apply here; it's a virtual location. */}
          {stats.unsortedCard && <UnsortedCard card={stats.unsortedCard} />}
        </div>
      ) : (
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-8 text-center">
          <div className="text-3xl mb-3">🗄️</div>
          <p className="text-ga-text-primary font-medium">
            No storage locations yet
          </p>
          <p className="text-ga-text-secondary text-sm mt-1">
            Add the places you keep your groceries — Fridge, Pantry, Freezer,
            counter, etc.
          </p>
          {isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="bg-ga-accent hover:bg-ga-accent-hover text-white text-sm font-medium rounded-lg px-4 py-2 mt-4 transition-colors"
            >
              + Add your first location
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Location card — clickable Link wrapper around the dashboard content.
// Admin controls live in the same card but use stopPropagation so they
// don't trigger the card-level navigation.
// ---------------------------------------------------------------------------

interface CardData {
  location: LocationItem;
  count: number;
  expired: number;
  expiringSoon: number; // ≤ 7 days
  mostUrgent: { name: string; days: number } | null;
}

function LocationCard({
  card,
  isAdmin,
  isFirst,
  isLast,
  isOnly,
  onMoveUp,
  onMoveDown,
  onSave,
}: {
  card: CardData;
  isAdmin: boolean;
  isFirst: boolean;
  isLast: boolean;
  isOnly: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onSave: (updates: Partial<LocationItem>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(card.location.name);
  const [editIcon, setEditIcon] = useState(card.location.icon);
  const [editColor, setEditColor] = useState(card.location.color);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteMutation = useDeleteLocation();

  const stopBubble = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleSaveEdit = () => {
    onSave({ name: editName.trim(), icon: editIcon, color: editColor });
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditName(card.location.name);
    setEditIcon(card.location.icon);
    setEditColor(card.location.color);
    setEditing(false);
    setConfirmDelete(false);
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(card.location.key);
      setConfirmDelete(false);
    } catch {
      // toast shown by mutation
    }
  };

  const empty = card.count === 0;
  const urgent = !!card.mostUrgent && card.mostUrgent.days <= 3;
  const expired = card.expired > 0;

  // Color tint for the card border + accent strip — uses the location's
  // configured color so the user's mental "fridge is blue, pantry is amber"
  // map is preserved visually.
  const accent = editing ? editColor : card.location.color;

  return (
    <div
      className={cn(
        'bg-ga-bg-card border rounded-lg overflow-hidden transition-shadow',
        expired ? 'border-red-500/40' : urgent ? 'border-orange-500/40' : 'border-ga-border',
        !editing && 'hover:shadow-md',
      )}
    >
      {/* Color strip — keep, doubles as a quick visual identity. */}
      <div className="h-1.5" style={{ backgroundColor: accent }} />

      {editing ? (
        <EditMode
          name={editName}
          icon={editIcon}
          color={editColor}
          onName={setEditName}
          onIcon={setEditIcon}
          onColor={setEditColor}
          onSave={handleSaveEdit}
          onCancel={handleCancelEdit}
          isOnly={isOnly}
          confirmDelete={confirmDelete}
          onAskDelete={() => setConfirmDelete(true)}
          onDelete={handleDelete}
          onCancelDelete={() => setConfirmDelete(false)}
          totalItems={card.count}
          deleteIsPending={deleteMutation.isPending}
        />
      ) : (
        <Link
          to={`/storage/${card.location.key}`}
          className={cn(
            'block p-4 hover:bg-ga-bg-hover/30',
            empty && 'opacity-90',
          )}
          aria-label={`Open ${card.location.name}`}
        >
          {/* Header: icon + name + count + chevron affordance */}
          <div className="flex items-center gap-3 mb-3">
            <span
              className="flex-shrink-0 w-10 h-10 rounded flex items-center justify-center text-xl"
              style={{ backgroundColor: accent + '22' }}
            >
              {card.location.icon}
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-ga-text-primary truncate">
                {card.location.name}
              </h3>
              <p className="text-xs text-ga-text-secondary">
                {empty
                  ? 'Empty — tap to add'
                  : `${card.count} pack${card.count === 1 ? '' : 's'} stored`}
              </p>
            </div>
            <span className="text-ga-text-secondary text-sm flex-shrink-0">
              ›
            </span>
          </div>

          {/* Most-urgent banner — single line, color-coded. The "reason to
              click" — without it, the card is a passive count. */}
          {!empty && card.mostUrgent && (
            <UrgencyLine mostUrgent={card.mostUrgent} />
          )}

          {/* Stat chips — only when something needs attention. */}
          {(card.expired > 0 || card.expiringSoon > 0) && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {card.expired > 0 && (
                <span className="px-2 py-0.5 text-[11px] rounded bg-red-500/15 text-red-500 font-medium">
                  ⚠ {card.expired} expired
                </span>
              )}
              {card.expiringSoon > 0 && (
                <span className="px-2 py-0.5 text-[11px] rounded bg-orange-500/15 text-orange-500 font-medium">
                  ⏰ {card.expiringSoon} expiring soon
                </span>
              )}
            </div>
          )}
        </Link>
      )}

      {/* Admin footer — only for admins, sibling to the Link so click
          handling is independent. */}
      {isAdmin && !editing && (
        <div className="border-t border-ga-border/50 px-3 py-2 flex items-center gap-1">
          <button
            onClick={(e) => {
              stopBubble(e);
              setEditing(true);
            }}
            className="text-xs text-ga-text-secondary hover:text-ga-accent px-2 py-1 rounded transition-colors"
          >
            ✏ Edit
          </button>
          <div className="flex-1" />
          <button
            onClick={(e) => {
              stopBubble(e);
              onMoveUp();
            }}
            disabled={isFirst}
            className="text-xs text-ga-text-secondary hover:text-ga-text-primary disabled:opacity-30 px-1.5 py-1 rounded transition-colors"
            title="Move up"
          >
            ▲
          </button>
          <button
            onClick={(e) => {
              stopBubble(e);
              onMoveDown();
            }}
            disabled={isLast}
            className="text-xs text-ga-text-secondary hover:text-ga-text-primary disabled:opacity-30 px-1.5 py-1 rounded transition-colors"
            title="Move down"
          >
            ▼
          </button>
        </div>
      )}
    </div>
  );
}

function UrgencyLine({
  mostUrgent,
}: {
  mostUrgent: { name: string; days: number };
}) {
  const { name, days } = mostUrgent;
  const cls =
    days < 0
      ? 'bg-red-500/10 text-red-500 border border-red-500/30'
      : days <= 1
      ? 'bg-red-500/10 text-red-500 border border-red-500/30'
      : days <= 3
      ? 'bg-orange-500/10 text-orange-500 border border-orange-500/30'
      : days <= 7
      ? 'bg-yellow-500/10 text-yellow-700 border border-yellow-500/30'
      : 'bg-green-500/10 text-green-600 border border-green-500/20';
  const label =
    days < 0
      ? `${name} expired ${Math.abs(days)}d ago`
      : days === 0
      ? `${name} expires today`
      : days === 1
      ? `${name} expires tomorrow`
      : `${name} in ${days}d`;
  return (
    <div className={cn('px-2.5 py-1 rounded text-xs font-medium', cls)}>
      {days < 0 ? '⚠' : days <= 3 ? '⏰' : '·'} {label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit mode — kept inside the same card to avoid jumping between views.
// ---------------------------------------------------------------------------

function EditMode({
  name,
  icon,
  color,
  onName,
  onIcon,
  onColor,
  onSave,
  onCancel,
  isOnly,
  confirmDelete,
  onAskDelete,
  onDelete,
  onCancelDelete,
  totalItems,
  deleteIsPending,
}: {
  name: string;
  icon: string;
  color: string;
  onName: (s: string) => void;
  onIcon: (s: string) => void;
  onColor: (s: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isOnly: boolean;
  confirmDelete: boolean;
  onAskDelete: () => void;
  onDelete: () => void;
  onCancelDelete: () => void;
  totalItems: number;
  deleteIsPending: boolean;
}) {
  return (
    <div className="p-4 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <input
            value={name}
            onChange={(e) => onName(e.target.value)}
            className="w-full bg-ga-bg-hover border border-ga-border rounded px-2 py-1.5 text-sm text-ga-text-primary"
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSave();
            }}
          />
        </div>
        <div className="flex gap-1">
          <input
            value={icon}
            onChange={(e) => onIcon(e.target.value)}
            className="w-12 bg-ga-bg-hover border border-ga-border rounded px-1 py-1.5 text-sm text-center"
            maxLength={4}
          />
          <input
            type="color"
            value={color}
            onChange={(e) => onColor(e.target.value)}
            className="w-10 h-[34px] bg-ga-bg-hover border border-ga-border rounded cursor-pointer"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={!name.trim()}
          className="bg-ga-accent hover:bg-ga-accent-hover disabled:opacity-50 text-white text-xs font-medium rounded px-3 py-1.5 transition-colors"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="text-ga-text-secondary hover:text-ga-text-primary text-xs rounded px-3 py-1.5 transition-colors"
        >
          Cancel
        </button>
        {!isOnly && (
          <button
            onClick={onAskDelete}
            className="text-red-400 hover:text-red-300 text-xs rounded px-3 py-1.5 transition-colors ml-auto"
          >
            Delete
          </button>
        )}
      </div>
      {confirmDelete && (
        <div className="bg-red-500/10 border border-red-500/20 rounded p-3">
          {totalItems > 0 ? (
            <div className="text-xs text-red-400">
              <p className="font-medium mb-1">
                Can't delete — {totalItems} pack{totalItems === 1 ? '' : 's'} stored here.
              </p>
              <Link to="/my-items" className="text-ga-accent hover:underline">
                Move items first →
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-xs text-red-400 mb-2">
                Delete this location? This can't be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={onDelete}
                  disabled={deleteIsPending}
                  className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-medium rounded px-3 py-1 transition-colors"
                >
                  {deleteIsPending ? 'Deleting…' : 'Delete'}
                </button>
                <button
                  onClick={onCancelDelete}
                  className="text-ga-text-secondary text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Unsorted card — virtual location, no admin controls. Same visual shape
// as a normal card so the user can fix the unassigned bucket as easily as
// they'd open any other location.
// ---------------------------------------------------------------------------

function UnsortedCard({ card }: { card: CardData }) {
  const expired = card.expired > 0;
  const urgent = !!card.mostUrgent && card.mostUrgent.days <= 3;
  return (
    <div
      className={cn(
        'bg-ga-bg-card border rounded-lg overflow-hidden hover:shadow-md transition-shadow',
        expired
          ? 'border-red-500/40'
          : urgent
          ? 'border-orange-500/40'
          : 'border-ga-border',
      )}
    >
      <div
        className="h-1.5"
        style={{ backgroundColor: card.location.color }}
      />
      <Link
        to={`/storage/${UNSORTED_KEY}`}
        className="block p-4 hover:bg-ga-bg-hover/30"
        aria-label="Open Unsorted bucket"
      >
        <div className="flex items-center gap-3 mb-3">
          <span
            className="flex-shrink-0 w-10 h-10 rounded flex items-center justify-center text-xl"
            style={{ backgroundColor: card.location.color + '22' }}
          >
            {card.location.icon}
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-ga-text-primary truncate">
              {card.location.name}
            </h3>
            <p className="text-xs text-ga-text-secondary">
              {card.count} pack{card.count === 1 ? '' : 's'} with no location
              set
            </p>
          </div>
          <span className="text-ga-text-secondary text-sm flex-shrink-0">›</span>
        </div>
        {card.mostUrgent && <UrgencyLine mostUrgent={card.mostUrgent} />}
        {(card.expired > 0 || card.expiringSoon > 0) && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {card.expired > 0 && (
              <span className="px-2 py-0.5 text-[11px] rounded bg-red-500/15 text-red-500 font-medium">
                ⚠ {card.expired} expired
              </span>
            )}
            {card.expiringSoon > 0 && (
              <span className="px-2 py-0.5 text-[11px] rounded bg-orange-500/15 text-orange-500 font-medium">
                ⏰ {card.expiringSoon} expiring soon
              </span>
            )}
          </div>
        )}
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Location form — admin only, expanded above the grid.
// ---------------------------------------------------------------------------

function AddLocationForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📍');
  const [color, setColor] = useState('#6B7280');
  const addMutation = useAddLocation();

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      await addMutation.mutateAsync({ name: name.trim(), icon, color });
      onDone();
    } catch {
      /* toast in mutation */
    }
  };

  return (
    <div className="bg-ga-bg-card border border-ga-accent/30 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-ga-text-primary mb-3">
        Add new location
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs text-ga-text-secondary mb-1">
            Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
            placeholder="e.g. Kitchen Shelf"
            className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs text-ga-text-secondary mb-1">
            Icon
          </label>
          <input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary text-center"
            maxLength={4}
          />
        </div>
        <div>
          <label className="block text-xs text-ga-text-secondary mb-1">
            Color
          </label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-full h-[38px] bg-ga-bg-hover border border-ga-border rounded-lg cursor-pointer"
          />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleSave}
          disabled={!name.trim() || addMutation.isPending}
          className="bg-ga-accent hover:bg-ga-accent-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
        >
          {addMutation.isPending ? 'Adding…' : 'Add Location'}
        </button>
        <button
          onClick={onDone}
          className="border border-ga-border text-ga-text-secondary hover:text-ga-text-primary text-sm rounded-lg px-4 py-2 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats builder — one card per registered location plus an Unsorted bucket
// when active events exist with no location.
// ---------------------------------------------------------------------------

function buildLocationStats(
  locations: LocationItem[],
  events: PurchaseEvent[],
): { locationCards: CardData[]; unsortedCard: CardData | null } {
  const now = Date.now();
  const byKey = new Map<string, PurchaseEvent[]>();
  for (const ev of events) {
    const key = ev.location || UNSORTED_KEY;
    const arr = byKey.get(key) ?? [];
    arr.push(ev);
    byKey.set(key, arr);
  }

  const locationCards: CardData[] = locations
    .slice()
    .sort((a, b) => a.sort - b.sort)
    .map((loc) => toCard(loc, byKey.get(loc.key) ?? [], now));

  const unsortedEvents = byKey.get(UNSORTED_KEY) ?? [];
  const unsortedCard =
    unsortedEvents.length > 0
      ? toCard(
          {
            key: UNSORTED_KEY,
            name: 'Unsorted',
            icon: '📥',
            color: '#6B7280',
            sort: 999,
          },
          unsortedEvents,
          now,
        )
      : null;

  return { locationCards, unsortedCard };
}

function toCard(
  location: LocationItem,
  events: PurchaseEvent[],
  now: number,
): CardData {
  let expired = 0;
  let expiringSoon = 0;
  let mostUrgent: { name: string; days: number } | null = null;

  for (const ev of events) {
    if (!ev.expiry_date) continue;
    const ms = new Date(ev.expiry_date).getTime();
    if (Number.isNaN(ms)) continue;
    const days = Math.ceil((ms - now) / 86400000);
    if (days < 0) expired++;
    else if (days <= 7) expiringSoon++;
    if (!mostUrgent || days < mostUrgent.days) {
      mostUrgent = { name: ev.catalog_display, days };
    }
  }

  return {
    location,
    count: events.length,
    expired,
    expiringSoon,
    mostUrgent,
  };
}
