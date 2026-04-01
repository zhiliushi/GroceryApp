import { useState } from 'react';
import { useUpdateInventoryItem } from '@/api/mutations/useInventoryMutations';
import { useLocations } from '@/api/queries/useLocations';
import { cn } from '@/utils/cn';
import type { InventoryItem } from '@/types/api';

interface ItemActionBarProps {
  item: InventoryItem;
  uid: string;
}

export default function ItemActionBar({ item, uid }: ItemActionBarProps) {
  const updateMutation = useUpdateInventoryItem();
  const { locations } = useLocations();
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  const isActive = item.status === 'active';
  const isDone = ['consumed', 'expired', 'discarded'].includes(item.status);

  const expiryMs = item.expiryDate ?? item.expiry_date;
  const expMs = expiryMs ? (expiryMs > 1e12 ? expiryMs : expiryMs * 1000) : null;
  const isExpired = expMs ? expMs < Date.now() : false;
  const isExpiringSoon = expMs ? (expMs - Date.now() < 7 * 24 * 60 * 60 * 1000 && !isExpired) : false;

  const handleStatusChange = (status: string, reason?: string) => {
    const now = Date.now();
    updateMutation.mutate({
      uid,
      id: item.id,
      data: {
        status,
        consumed_date: now,
        reason: reason || status,
      },
    });
  };

  const handleMove = (locationKey: string) => {
    updateMutation.mutate({
      uid,
      id: item.id,
      data: { location: locationKey, storage_location: locationKey },
    });
    setShowMoveMenu(false);
  };

  const handleRestore = () => {
    updateMutation.mutate({
      uid,
      id: item.id,
      data: { status: 'active', consumed_date: null, reason: null },
    });
  };

  if (isDone) {
    return (
      <div className="bg-ga-bg-hover border border-ga-border rounded-lg p-3 flex items-center gap-3">
        <span className="text-sm text-ga-text-secondary capitalize">
          This item was <strong>{item.status}</strong>
        </span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={handleRestore}
            disabled={updateMutation.isPending}
            className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-md px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            Restore to Active
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Urgency banner */}
      {isExpired && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
          <span className="text-red-400 text-sm font-medium">
            This item is past its expiry date
          </span>
        </div>
      )}
      {isExpiringSoon && !isExpired && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg px-3 py-2">
          <span className="text-orange-400 text-sm font-medium">
            Expiring soon — use it before it goes to waste
          </span>
        </div>
      )}
      {item.needsReview && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 flex items-center justify-between">
          <span className="text-yellow-400 text-sm font-medium">Flagged for review</span>
          <button
            onClick={() => updateMutation.mutate({ uid, id: item.id, data: { needsReview: false } })}
            className="text-xs text-yellow-400 hover:underline"
          >
            Clear flag
          </button>
        </div>
      )}

      {/* Action buttons */}
      {isActive && (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mark Used */}
          <button
            onClick={() => handleStatusChange('consumed', 'used_up')}
            disabled={updateMutation.isPending}
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
          >
            ✅ Mark Used
          </button>

          {/* Discard (more visible when expired) */}
          {isExpired && (
            <button
              onClick={() => handleStatusChange('discarded', 'discarded')}
              disabled={updateMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
            >
              🗑 Discard
            </button>
          )}

          {/* Move Location */}
          <div className="relative">
            <button
              onClick={() => setShowMoveMenu(!showMoveMenu)}
              className="border border-ga-border text-ga-text-secondary hover:text-ga-text-primary text-sm rounded-lg px-4 py-2 transition-colors"
            >
              📍 Move
            </button>
            {showMoveMenu && (
              <div className="absolute top-full left-0 mt-1 bg-ga-bg-card border border-ga-border rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
                {locations.map((loc) => (
                  <button
                    key={loc.key}
                    onClick={() => handleMove(loc.key)}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-sm hover:bg-ga-bg-hover transition-colors flex items-center gap-2',
                      (item.location === loc.key || item.storage_location === loc.key) && 'text-ga-accent font-medium',
                    )}
                  >
                    <span>{loc.icon}</span>
                    {loc.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
