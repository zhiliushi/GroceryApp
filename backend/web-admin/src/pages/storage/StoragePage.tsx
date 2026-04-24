import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useLocations } from '@/api/queries/useLocations';
import { useInventory } from '@/api/queries/useInventory';
import { useAddLocation, useUpdateLocations, useDeleteLocation } from '@/api/mutations/useLocationMutations';
import { useAuthStore } from '@/stores/authStore';
import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import type { LocationItem, InventoryItem } from '@/types/api';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function getExpiryMs(item: InventoryItem): number | null {
  const exp = item.expiryDate ?? item.expiry_date;
  if (!exp) return null;
  return exp > 1e12 ? exp : exp * 1000;
}

interface LocationStats {
  location: LocationItem;
  active: number;
  expiring: number;
  expired: number;
}

function useLocationStats() {
  const { locations, isLoading: locLoading } = useLocations();
  const { data: inventory, isLoading: invLoading } = useInventory();

  const stats = useMemo(() => {
    if (!inventory?.items) return { locationStats: [] as LocationStats[], noLocationCount: 0 };

    const now = Date.now();
    const activeItems = inventory.items.filter((i) => i.status === 'active');

    const locationStats: LocationStats[] = locations.map((loc) => {
      const locItems = activeItems.filter(
        (i) => (i.location || i.storage_location) === loc.key,
      );
      let expiring = 0;
      let expired = 0;
      for (const item of locItems) {
        const exp = getExpiryMs(item);
        if (!exp) continue;
        if (exp < now) expired++;
        else if (exp - now < SEVEN_DAYS_MS) expiring++;
      }
      return { location: loc, active: locItems.length, expiring, expired };
    });

    const noLocationCount = activeItems.filter(
      (i) => !i.location && !i.storage_location,
    ).length;

    return { locationStats, noLocationCount };
  }, [locations, inventory?.items]);

  return { ...stats, isLoading: locLoading || invLoading };
}

// --- Add Location Form ---

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
      // toast shown by mutation
    }
  };

  return (
    <div className="bg-ga-bg-card border border-ga-accent/30 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-ga-text-primary mb-3">Add New Location</h3>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs text-ga-text-secondary mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            placeholder="e.g. Kitchen Shelf"
            className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs text-ga-text-secondary mb-1">Icon</label>
          <input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            className="w-full bg-ga-bg-hover border border-ga-border rounded-lg px-3 py-2 text-sm text-ga-text-primary text-center"
            maxLength={4}
          />
        </div>
        <div>
          <label className="block text-xs text-ga-text-secondary mb-1">Color</label>
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
          {addMutation.isPending ? 'Adding...' : 'Add Location'}
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

// --- Location Card ---

interface LocationCardProps {
  stat: LocationStats;
  isAdmin: boolean;
  isFirst: boolean;
  isLast: boolean;
  isOnly: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onSave: (updates: Partial<LocationItem>) => void;
}

function LocationCard({ stat, isAdmin, isFirst, isLast, isOnly, onMoveUp, onMoveDown, onSave }: LocationCardProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(stat.location.name);
  const [editIcon, setEditIcon] = useState(stat.location.icon);
  const [editColor, setEditColor] = useState(stat.location.color);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteMutation = useDeleteLocation();

  const handleSaveEdit = () => {
    onSave({ name: editName.trim(), icon: editIcon, color: editColor });
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditName(stat.location.name);
    setEditIcon(stat.location.icon);
    setEditColor(stat.location.color);
    setEditing(false);
    setConfirmDelete(false);
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(stat.location.key);
      setConfirmDelete(false);
    } catch {
      // toast shown by mutation — includes "X items stored here" message
    }
  };

  const totalItems = stat.active;

  return (
    <div className="bg-ga-bg-card border border-ga-border rounded-lg overflow-hidden">
      {/* Color bar */}
      <div className="h-1.5" style={{ backgroundColor: editing ? editColor : stat.location.color }} />

      <div className="p-4">
        {editing ? (
          // Edit mode
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-ga-bg-hover border border-ga-border rounded px-2 py-1.5 text-sm text-ga-text-primary"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); }}
                />
              </div>
              <div className="flex gap-1">
                <input
                  value={editIcon}
                  onChange={(e) => setEditIcon(e.target.value)}
                  className="w-12 bg-ga-bg-hover border border-ga-border rounded px-1 py-1.5 text-sm text-center"
                  maxLength={4}
                />
                <input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="w-10 h-[34px] bg-ga-bg-hover border border-ga-border rounded cursor-pointer"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={!editName.trim()}
                className="bg-ga-accent hover:bg-ga-accent-hover disabled:opacity-50 text-white text-xs font-medium rounded px-3 py-1.5 transition-colors"
              >
                Save
              </button>
              <button
                onClick={handleCancelEdit}
                className="text-ga-text-secondary hover:text-ga-text-primary text-xs rounded px-3 py-1.5 transition-colors"
              >
                Cancel
              </button>
              {!isOnly && (
                <button
                  onClick={() => setConfirmDelete(true)}
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
                    <p className="font-medium mb-1">Can't delete — {totalItems} items stored here.</p>
                    <Link to="/inventory" className="text-ga-accent hover:underline">
                      Move items first →
                    </Link>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-red-400 mb-2">
                      Delete {stat.location.icon} {stat.location.name}? This can't be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDelete}
                        disabled={deleteMutation.isPending}
                        className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-medium rounded px-3 py-1 transition-colors"
                      >
                        {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
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
        ) : (
          // Display mode
          <>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{stat.location.icon}</span>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-ga-text-primary truncate">{stat.location.name}</h3>
                <p className="text-xs text-ga-text-secondary">
                  {totalItems === 0 ? 'Empty' : `${totalItems} item${totalItems !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>

            {/* Stats badges */}
            {(stat.expiring > 0 || stat.expired > 0) && (
              <div className="flex gap-2 mb-3">
                {stat.expired > 0 && (
                  <span className="text-[10px] bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-medium">
                    {stat.expired} expired
                  </span>
                )}
                {stat.expiring > 0 && (
                  <span className="text-[10px] bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 font-medium">
                    {stat.expiring} expiring
                  </span>
                )}
              </div>
            )}

            {/* Admin controls */}
            {isAdmin && (
              <div className="flex items-center gap-1 pt-2 border-t border-ga-border/50">
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs text-ga-text-secondary hover:text-ga-accent px-2 py-1 rounded transition-colors"
                >
                  Edit
                </button>
                <div className="flex-1" />
                <button
                  onClick={onMoveUp}
                  disabled={isFirst}
                  className="text-xs text-ga-text-secondary hover:text-ga-text-primary disabled:opacity-30 px-1.5 py-1 rounded transition-colors"
                  title="Move up"
                >
                  ▲
                </button>
                <button
                  onClick={onMoveDown}
                  disabled={isLast}
                  className="text-xs text-ga-text-secondary hover:text-ga-text-primary disabled:opacity-30 px-1.5 py-1 rounded transition-colors"
                  title="Move down"
                >
                  ▼
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// --- Main Page ---

export default function StoragePage() {
  const [showAdd, setShowAdd] = useState(false);
  const { locations } = useLocations();
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const { locationStats, noLocationCount, isLoading } = useLocationStats();
  const updateMutation = useUpdateLocations();

  const handleMoveUp = useCallback((index: number) => {
    if (index <= 0) return;
    const updated = [...locations];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    updated.forEach((loc, i) => (loc.sort = i));
    updateMutation.mutate(updated);
  }, [locations, updateMutation]);

  const handleMoveDown = useCallback((index: number) => {
    if (index >= locations.length - 1) return;
    const updated = [...locations];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    updated.forEach((loc, i) => (loc.sort = i));
    updateMutation.mutate(updated);
  }, [locations, updateMutation]);

  const handleSave = useCallback((index: number, updates: Partial<LocationItem>) => {
    const updated = locations.map((loc, i) =>
      i === index ? { ...loc, ...updates } : loc,
    );
    updateMutation.mutate(updated);
  }, [locations, updateMutation]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="p-3 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <PageHeader title="Storage Locations" icon="🗄️" count={locations.length} />
        {isAdmin && (
          <button
            onClick={() => setShowAdd(true)}
            className="bg-ga-accent hover:bg-ga-accent-hover text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
          >
            + Add Location
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mb-6">
          <AddLocationForm onDone={() => setShowAdd(false)} />
        </div>
      )}

      {/* Location cards grid */}
      {locationStats.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {locationStats.map((stat, index) => (
            <LocationCard
              key={stat.location.key}
              stat={stat}
              isAdmin={isAdmin}
              isFirst={index === 0}
              isLast={index === locationStats.length - 1}
              isOnly={locationStats.length === 1}
              onMoveUp={() => handleMoveUp(index)}
              onMoveDown={() => handleMoveDown(index)}
              onSave={(updates) => handleSave(index, updates)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-8 text-center">
          <div className="text-3xl mb-3">🗄️</div>
          <p className="text-ga-text-primary font-medium">No storage locations</p>
          <p className="text-ga-text-secondary text-sm mt-1">
            Add locations to organize your inventory (e.g. Fridge, Pantry, Freezer).
          </p>
          {isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="bg-ga-accent hover:bg-ga-accent-hover text-white text-sm font-medium rounded-lg px-4 py-2 mt-4 transition-colors"
            >
              + Add Location
            </button>
          )}
        </div>
      )}

      {/* Items needing location */}
      {noLocationCount > 0 && (
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <span className="text-lg">⚠️</span>
          <div className="flex-1">
            <p className="text-sm text-yellow-800 font-medium">
              {noLocationCount} item{noLocationCount !== 1 ? 's' : ''} with no storage location
            </p>
            <p className="text-xs text-yellow-700">These items haven't been assigned to a storage location yet.</p>
          </div>
          <Link
            to="/inventory"
            className="text-xs text-ga-accent hover:underline font-medium whitespace-nowrap"
          >
            View in Inventory →
          </Link>
        </div>
      )}
    </div>
  );
}
