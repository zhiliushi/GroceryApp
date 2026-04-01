import { useState, useMemo } from 'react';
import { useInventory } from '@/api/queries/useInventory';
import { useLocations } from '@/api/queries/useLocations';
import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import LocationGroup from '@/components/inventory/LocationGroup';
import ScanReceiptButton from '@/components/receipt/ScanReceiptButton';
import ScanBarcodeButton from '@/components/barcode/ScanBarcodeButton';
import { cn } from '@/utils/cn';
import type { InventoryItem } from '@/types/api';

type FilterTab = 'all' | 'active' | 'expiring' | 'expired' | 'incomplete';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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

/** Sort items: expired first, then by expiry ascending, no-expiry last */
function sortByExpiryUrgency(items: InventoryItem[]): InventoryItem[] {
  return [...items].sort((a, b) => {
    const aExp = getExpiryMs(a);
    const bExp = getExpiryMs(b);

    // Expired items first
    const aExpired = aExp ? aExp < Date.now() : false;
    const bExpired = bExp ? bExp < Date.now() : false;
    if (aExpired && !bExpired) return -1;
    if (!aExpired && bExpired) return 1;

    // Both have expiry → sort ascending (soonest first)
    if (aExp && bExp) return aExp - bExp;

    // Items with expiry before items without
    if (aExp && !bExp) return -1;
    if (!aExp && bExp) return 1;

    // Both no expiry → sort by name
    return a.name.localeCompare(b.name);
  });
}

export default function InventoryListPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>('active');
  const { data, isLoading } = useInventory();
  const { locations } = useLocations();

  const allItems = data?.items ?? [];

  // Compute tab counts from full dataset
  const counts = useMemo(() => {
    const active = allItems.filter((i) => i.status === 'active');
    return {
      all: allItems.length,
      active: active.length,
      expiring: active.filter(isExpiringSoon).length,
      expired: allItems.filter((i) => isExpiredItem(i) || i.status === 'expired').length,
      incomplete: active.filter(isIncomplete).length,
    };
  }, [allItems]);

  // Filter items by active tab
  const filteredItems = useMemo(() => {
    switch (activeTab) {
      case 'active':
        return allItems.filter((i) => i.status === 'active');
      case 'expiring':
        return allItems.filter((i) => i.status === 'active' && isExpiringSoon(i));
      case 'expired':
        return allItems.filter((i) => isExpiredItem(i) || i.status === 'expired');
      case 'incomplete':
        return allItems.filter((i) => isIncomplete(i));
      default:
        return allItems;
    }
  }, [allItems, activeTab]);

  // Group items by location
  const grouped = useMemo(() => {
    const groups = new Map<string, InventoryItem[]>();

    // Initialize groups from config (maintains sort order)
    for (const loc of locations) {
      groups.set(loc.key, []);
    }
    groups.set('__none__', []); // "No Location" group

    for (const item of filteredItems) {
      const locKey = item.location || item.storage_location || '__none__';
      if (!groups.has(locKey)) {
        groups.set(locKey, []); // Unknown location
      }
      groups.get(locKey)!.push(item);
    }

    // Sort items within each group by expiry urgency
    for (const [key, items] of groups) {
      groups.set(key, sortByExpiryUrgency(items));
    }

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
          <ScanBarcodeButton />
          <ScanReceiptButton destination="inventory" pageKey="inventory" />
        </div>
      </div>

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

      {/* Empty state */}
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

          {/* Unknown locations (items with location keys not in config) */}
          {Array.from(grouped.entries())
            .filter(([key]) => key !== '__none__' && !locations.some((l) => l.key === key))
            .map(([key, items]) => (
              <LocationGroup
                key={key}
                location={{ key, name: key, icon: '📍', color: '#6B7280', sort: 99 }}
                items={items}
              />
            ))}

          {/* No Location group */}
          {(grouped.get('__none__')?.length ?? 0) > 0 && (
            <LocationGroup
              location={null}
              items={grouped.get('__none__') ?? []}
              defaultExpanded
            />
          )}
        </div>
      )}
    </div>
  );
}
