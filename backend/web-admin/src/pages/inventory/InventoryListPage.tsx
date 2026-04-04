import { useState, useMemo } from 'react';
import { useInventory } from '@/api/queries/useInventory';
import { useLocations } from '@/api/queries/useLocations';
import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import LocationGroup from '@/components/inventory/LocationGroup';
import ScanReceiptButton from '@/components/receipt/ScanReceiptButton';
import ScanBarcodeButton from '@/components/barcode/ScanBarcodeButton';
import ShelfAuditModal from '@/components/scanner/ShelfAuditModal';
import { cn } from '@/utils/cn';
import { formatExpiry } from '@/utils/format';
import { Link } from 'react-router-dom';
import type { InventoryItem } from '@/types/api';

type FilterTab = 'all' | 'active' | 'expiring' | 'expired' | 'incomplete';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function getExpiryMs(item: InventoryItem): number | null {
  const exp = item.expiryDate ?? item.expiry_date;
  if (!exp) return null;
  return exp > 1e12 ? exp : exp * 1000;
}

function isExpiringSoon(item: InventoryItem): boolean {
  const exp = getExpiryMs(item);
  if (!exp) return false;
  const diff = exp - Date.now();
  return diff > 0 && diff < SEVEN_DAYS_MS;
}

function isExpiredItem(item: InventoryItem): boolean {
  const exp = getExpiryMs(item);
  if (!exp) return false;
  return exp < Date.now();
}

function isIncomplete(item: InventoryItem): boolean {
  const noLocation = !item.location && !item.storage_location;
  const noExpiry = !item.expiryDate && !item.expiry_date;
  return item.status === 'active' && (noLocation || noExpiry);
}

function sortByExpiryUrgency(items: InventoryItem[]): InventoryItem[] {
  return [...items].sort((a, b) => {
    const aExp = getExpiryMs(a);
    const bExp = getExpiryMs(b);
    const aExpired = aExp ? aExp < Date.now() : false;
    const bExpired = bExp ? bExp < Date.now() : false;
    if (aExpired && !bExpired) return -1;
    if (!aExpired && bExpired) return 1;
    if (aExp && bExp) return aExp - bExp;
    if (aExp && !bExp) return -1;
    if (!aExp && bExp) return 1;
    return a.name.localeCompare(b.name);
  });
}

export default function InventoryListPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>('active');
  const { data, isLoading } = useInventory();
  const { locations, getLocation } = useLocations();

  const [showShelfAudit, setShowShelfAudit] = useState(false);
  const allItems = data?.items ?? [];

  // === Derived data ===

  const activeItems = useMemo(() => allItems.filter((i) => i.status === 'active'), [allItems]);

  const counts = useMemo(() => ({
    all: allItems.length,
    active: activeItems.length,
    expiring: activeItems.filter(isExpiringSoon).length,
    expired: allItems.filter((i) => isExpiredItem(i) || i.status === 'expired').length,
    incomplete: activeItems.filter(isIncomplete).length,
  }), [allItems, activeItems]);

  // "Use Today" — items expiring within 3 days OR already expired but still active
  const useToday = useMemo(() => {
    return activeItems
      .filter((item) => {
        const exp = getExpiryMs(item);
        if (!exp) return false;
        return exp - Date.now() < THREE_DAYS_MS; // includes expired (negative diff)
      })
      .sort((a, b) => {
        const aE = getExpiryMs(a) ?? Infinity;
        const bE = getExpiryMs(b) ?? Infinity;
        return aE - bE;
      });
  }, [activeItems]);

  // Waste stats (from consumed items)
  const wasteStats = useMemo(() => {
    const consumed = allItems.filter((i) => ['consumed', 'expired', 'discarded'].includes(i.status));
    if (consumed.length === 0) return null;
    const wasted = consumed.filter((i) => i.status === 'expired' || i.status === 'discarded').length;
    const used = consumed.filter((i) => i.status === 'consumed').length;
    const wastePct = consumed.length > 0 ? Math.round((wasted / consumed.length) * 100) : 0;
    return { total: consumed.length, used, wasted, wastePct };
  }, [allItems]);

  // Items without expiry (potential risk)
  const noExpiryCount = useMemo(
    () => activeItems.filter((i) => !i.expiryDate && !i.expiry_date).length,
    [activeItems],
  );

  const filteredItems = useMemo(() => {
    switch (activeTab) {
      case 'active': return activeItems;
      case 'expiring': return allItems.filter((i) => i.status === 'active' && isExpiringSoon(i));
      case 'expired': return allItems.filter((i) => isExpiredItem(i) || i.status === 'expired');
      case 'incomplete': return allItems.filter((i) => isIncomplete(i));
      default: return allItems;
    }
  }, [allItems, activeItems, activeTab]);

  const grouped = useMemo(() => {
    const groups = new Map<string, InventoryItem[]>();
    for (const loc of locations) groups.set(loc.key, []);
    groups.set('__none__', []);
    for (const item of filteredItems) {
      const locKey = item.location || item.storage_location || '__none__';
      if (!groups.has(locKey)) groups.set(locKey, []);
      groups.get(locKey)!.push(item);
    }
    for (const [key, items] of groups) groups.set(key, sortByExpiryUrgency(items));
    return groups;
  }, [filteredItems, locations]);

  const tabs: { key: FilterTab; label: string; count: number; color: string }[] = [
    { key: 'all', label: 'All', count: counts.all, color: 'bg-gray-500' },
    { key: 'active', label: 'Active', count: counts.active, color: 'bg-green-500' },
    { key: 'expiring', label: 'Expiring', count: counts.expiring, color: counts.expiring > 0 ? 'bg-orange-500 animate-pulse' : 'bg-orange-500' },
    { key: 'expired', label: 'Expired', count: counts.expired, color: counts.expired > 0 ? 'bg-red-500 animate-pulse' : 'bg-red-500' },
    { key: 'incomplete', label: 'Incomplete', count: counts.incomplete, color: 'bg-yellow-500' },
  ];

  if (isLoading) return <LoadingSpinner text="Loading inventory..." />;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <PageHeader title="Inventory" icon="📦" count={counts.active} />
        <div className="flex items-center gap-2">
          <button onClick={() => setShowShelfAudit(true)}
            className="inline-flex items-center gap-1.5 border border-ga-border text-ga-text-secondary hover:text-ga-text-primary hover:bg-ga-bg-hover text-sm rounded-lg px-3 py-2 transition-colors">
            📷 Audit Shelf
          </button>
          <ScanBarcodeButton />
          <ScanReceiptButton destination="inventory" pageKey="inventory" />
        </div>
      </div>

      {/* ================================================================
          USE TODAY — The #1 waste prevention element.
          Shows items that need to be used NOW (expiring within 3 days or already expired).
          This is the first thing the user sees — it inspires immediate action.
          ================================================================ */}
      {useToday.length > 0 && activeTab !== 'expired' && (
        <div className="bg-gradient-to-r from-red-500/10 via-orange-500/10 to-yellow-500/10 border border-orange-500/30 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-orange-400 uppercase tracking-wide flex items-center gap-2">
              <span className="animate-pulse">🔥</span> Use These First
              <span className="bg-orange-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold">{useToday.length}</span>
            </h2>
            {useToday.length > 3 && (
              <button onClick={() => setActiveTab('expiring')} className="text-xs text-orange-400 hover:underline">
                View all →
              </button>
            )}
          </div>
          <div className="space-y-1">
            {useToday.slice(0, 5).map((item) => {
              const exp = formatExpiry(item.expiryDate ?? item.expiry_date);
              const isExp = isExpiredItem(item);
              const loc = getLocation(item.location || item.storage_location);
              return (
                <Link
                  key={`${item.user_id}-${item.id}`}
                  to={`/inventory/${item.user_id}/${item.id}`}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-white/5',
                    isExp ? 'bg-red-500/5' : '',
                  )}
                >
                  <span className={isExp ? 'text-red-400' : 'text-orange-400'}>
                    {isExp ? '🔴' : '⚠️'}
                  </span>
                  <span className="text-sm text-ga-text-primary font-medium flex-1 truncate">{item.name}</span>
                  {loc && <span className="text-[10px] text-ga-text-secondary">{loc.icon}</span>}
                  <span className="text-xs text-ga-text-secondary">
                    {item.quantity ?? 1} {item.unit || 'pcs'}
                  </span>
                  <span className={cn('text-xs font-bold', exp.className)}>
                    {isExp ? `Expired` : exp.text}
                  </span>
                </Link>
              );
            })}
          </div>
          <Link to="/meals" className="block text-center text-xs text-orange-400 hover:underline mt-2">
            🍳 See meal ideas using these items →
          </Link>
        </div>
      )}

      {/* ================================================================
          WASTE STATS — Small but persistent reminder of how you're doing.
          Shame/pride motivator: "12% waste" in red vs "0% waste" in green.
          Only shows when there's history to measure.
          ================================================================ */}
      {wasteStats && wasteStats.total >= 3 && (
        <div className="flex items-center gap-4 mb-3 text-xs">
          <div className="flex items-center gap-1.5 text-ga-text-secondary">
            <span>📊</span>
            <span>{wasteStats.used} used</span>
            <span className="text-ga-text-secondary/30">|</span>
            <span className={wasteStats.wastePct > 15 ? 'text-red-400 font-medium' : 'text-green-400'}>
              {wasteStats.wasted} wasted ({wasteStats.wastePct}%)
            </span>
          </div>
          {noExpiryCount > 0 && (
            <div className="flex items-center gap-1.5 text-yellow-400">
              <span>⚠️</span>
              <button onClick={() => setActiveTab('incomplete')} className="hover:underline">
                {noExpiryCount} item{noExpiryCount > 1 ? 's' : ''} without expiry date
              </button>
            </div>
          )}
        </div>
      )}

      {/* Expired items banner (only if not already viewing Use Today section) */}
      {counts.expired > 0 && useToday.length === 0 && activeTab !== 'expired' && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2.5 mb-3 flex items-center justify-between">
          <span className="text-sm text-red-400 font-medium">
            🔴 {counts.expired} item{counts.expired > 1 ? 's are' : ' is'} past expiry date
          </span>
          <button onClick={() => setActiveTab('expired')} className="text-xs text-red-400 hover:text-red-300 font-medium">
            Review & Handle →
          </button>
        </div>
      )}

      {/* Status Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg transition-colors inline-flex items-center gap-2',
              activeTab === tab.key
                ? 'bg-ga-accent text-white font-medium'
                : 'border border-ga-border text-ga-text-secondary hover:bg-ga-bg-hover',
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={cn('text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-bold text-white', tab.color)}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Empty states */}
      {filteredItems.length === 0 ? (
        <div className="bg-ga-bg-card border border-ga-border rounded-lg p-12 text-center">
          {allItems.length === 0 ? (
            <>
              <div className="text-4xl mb-3">📦</div>
              <h3 className="text-ga-text-primary font-medium text-lg mb-2">Your inventory is empty</h3>
              <p className="text-ga-text-secondary text-sm mb-4">Start by scanning a barcode or receipt to add items.</p>
              <div className="flex gap-2 justify-center">
                <ScanBarcodeButton />
                <ScanReceiptButton destination="inventory" pageKey="inventory" />
              </div>
            </>
          ) : activeTab === 'expiring' ? (
            <>
              <div className="text-4xl mb-3">🎉</div>
              <h3 className="text-ga-text-primary font-medium">No items expiring soon!</h3>
              <p className="text-ga-text-secondary text-sm mt-1">All your items are fresh.</p>
            </>
          ) : activeTab === 'expired' ? (
            <>
              <div className="text-4xl mb-3">✅</div>
              <h3 className="text-ga-text-primary font-medium">No expired items!</h3>
              <p className="text-ga-text-secondary text-sm mt-1">Great job keeping your inventory fresh.</p>
            </>
          ) : activeTab === 'incomplete' ? (
            <>
              <div className="text-4xl mb-3">✅</div>
              <h3 className="text-ga-text-primary font-medium">All items have complete data!</h3>
              <p className="text-ga-text-secondary text-sm mt-1">Every item has a location and expiry date set.</p>
            </>
          ) : (
            <>
              <div className="text-4xl mb-3">🔍</div>
              <h3 className="text-ga-text-primary font-medium">No items match this filter</h3>
              <button onClick={() => setActiveTab('all')} className="text-ga-accent text-sm mt-2 hover:underline">
                Show all items
              </button>
            </>
          )}
        </div>
      ) : (
        /* Location Groups */
        <div>
          {locations.map((loc) => {
            const items = grouped.get(loc.key) ?? [];
            return (
              <LocationGroup
                key={loc.key}
                location={loc}
                items={items}
                defaultExpanded={items.length > 0}
              />
            );
          })}

          {Array.from(grouped.entries())
            .filter(([key]) => key !== '__none__' && !locations.some((l) => l.key === key))
            .map(([key, items]) => (
              <LocationGroup
                key={key}
                location={{ key, name: key, icon: '📍', color: '#6B7280', sort: 99 }}
                items={items}
              />
            ))}

          {(grouped.get('__none__')?.length ?? 0) > 0 && (
            <LocationGroup
              location={null}
              items={grouped.get('__none__') ?? []}
              defaultExpanded
            />
          )}
        </div>
      )}

      {/* Shelf Audit Modal */}
      {showShelfAudit && <ShelfAuditModal onClose={() => setShowShelfAudit(false)} />}
    </div>
  );
}
