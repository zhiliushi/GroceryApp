import {PAID_FEATURES, FeatureKey} from '../config/constants';
import type {StorageLocation, InventoryStatus} from '../database/models/InventoryItem';
import type {AnalyticsEventType} from '../database/models/AnalyticsEvent';
import type {
  IInventoryItem,
  IShoppingList,
  IListItem,
  IAnalyticsEvent,
  CreateInventoryItemInput,
  CreateListItemInput,
} from '../types/database';

// ---------------------------------------------------------------------------
// Feature gating
// ---------------------------------------------------------------------------

export function isFeatureAvailable(
  feature: FeatureKey,
  tier: 'free' | 'paid',
): boolean {
  if (tier === 'paid') return true;
  return !(PAID_FEATURES as readonly string[]).includes(feature);
}

// ---------------------------------------------------------------------------
// String helpers
// ---------------------------------------------------------------------------

export function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + '\u2026';
}

export function formatPrice(
  amount: number | null | undefined,
  currency = 'USD',
): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Async helpers
// ---------------------------------------------------------------------------

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Data transformation: Model → Plain interface
// ---------------------------------------------------------------------------

/**
 * Convert a WatermelonDB InventoryItem model to a plain IInventoryItem interface.
 * Useful for passing data across serialization boundaries (e.g. navigation params).
 */
export function inventoryItemToInterface(model: {
  id: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  categoryId: string;
  quantity: number;
  unitId: string;
  expiryDate: Date | null;
  location: StorageLocation;
  imageUrl: string | null;
  addedDate: Date;
  price: number | null;
  purchaseDate: Date | null;
  notes: string | null;
  sourceScanId: string | null;
  status: InventoryStatus;
  consumedDate: Date | null;
  reason: string | null;
  quantityRemaining: number | null;
  userId: string;
  syncedToCloud: boolean;
}): IInventoryItem {
  return {
    id: model.id,
    barcode: model.barcode,
    name: model.name,
    brand: model.brand,
    categoryId: model.categoryId,
    quantity: model.quantity,
    unitId: model.unitId,
    expiryDate: model.expiryDate,
    location: model.location,
    imageUrl: model.imageUrl,
    addedDate: model.addedDate,
    price: model.price,
    purchaseDate: model.purchaseDate,
    notes: model.notes,
    sourceScanId: model.sourceScanId,
    status: model.status,
    consumedDate: model.consumedDate,
    reason: model.reason as IInventoryItem['reason'],
    quantityRemaining: model.quantityRemaining,
    userId: model.userId,
    syncedToCloud: model.syncedToCloud,
  };
}

/**
 * Convert a WatermelonDB ShoppingList model to a plain IShoppingList interface.
 */
export function shoppingListToInterface(model: {
  id: string;
  name: string;
  createdDate: Date;
  isCompleted: boolean;
  userId: string;
  isCheckedOut?: boolean;
  checkoutDate?: Date | null;
  storeId?: string | null;
  totalPrice?: number | null;
  notes?: string | null;
}): IShoppingList {
  return {
    id: model.id,
    name: model.name,
    createdDate: model.createdDate,
    isCompleted: model.isCompleted,
    userId: model.userId,
    isCheckedOut: model.isCheckedOut ?? false,
    checkoutDate: model.checkoutDate ?? null,
    storeId: model.storeId ?? null,
    totalPrice: model.totalPrice ?? null,
    notes: model.notes ?? null,
  };
}

/**
 * Convert a WatermelonDB ListItem model to a plain IListItem interface.
 */
export function listItemToInterface(model: {
  id: string;
  listId: string;
  itemName: string;
  quantity: number;
  unitId: string;
  isPurchased: boolean;
  categoryId: string;
  barcode?: string | null;
  brand?: string | null;
  price?: number | null;
  weight?: number | null;
  weightUnit?: string | null;
  imageUrl?: string | null;
  notes?: string | null;
}): IListItem {
  return {
    id: model.id,
    listId: model.listId,
    itemName: model.itemName,
    quantity: model.quantity,
    unitId: model.unitId,
    isPurchased: model.isPurchased,
    categoryId: model.categoryId,
    barcode: model.barcode ?? null,
    brand: model.brand ?? null,
    price: model.price ?? null,
    weight: model.weight ?? null,
    weightUnit: model.weightUnit ?? null,
    imageUrl: model.imageUrl ?? null,
    notes: model.notes ?? null,
  };
}

/**
 * Convert a WatermelonDB AnalyticsEvent model to a plain IAnalyticsEvent.
 */
export function analyticsEventToInterface(model: {
  id: string;
  eventType: AnalyticsEventType;
  eventData: string;
  timestamp: Date;
  synced: boolean;
  userId: string;
}): IAnalyticsEvent {
  let parsedData: Record<string, unknown>;
  try {
    parsedData = JSON.parse(model.eventData);
  } catch {
    parsedData = {};
  }
  return {
    id: model.id,
    eventType: model.eventType,
    eventData: parsedData,
    timestamp: model.timestamp,
    synced: model.synced,
    userId: model.userId,
  };
}

// ---------------------------------------------------------------------------
// Data transformation: Plain input → Database-ready
// ---------------------------------------------------------------------------

/**
 * Convert a Date or ISO string into a timestamp number for WatermelonDB storage.
 * Returns null for null/undefined input.
 */
export function toTimestamp(date: Date | string | null | undefined): number | null {
  if (date == null) return null;
  if (typeof date === 'string') return new Date(date).getTime();
  return date.getTime();
}

/**
 * Convert a timestamp number to a Date object.
 * Returns null for null/undefined input.
 */
export function fromTimestamp(timestamp: number | null | undefined): Date | null {
  if (timestamp == null) return null;
  return new Date(timestamp);
}

/**
 * Prepare a Stage 1 scanned item for promotion to Stage 2 inventory.
 * Maps scanned item data to CreateInventoryItemInput shape.
 */
export function scannedItemToInventoryInput(
  scanData: {
    barcode: string;
    name: string | null;
    brand: string | null;
    imageUrl: string | null;
    sourceScanId: string;
  },
  defaults: {
    userId: string;
    location: StorageLocation;
    categoryId: string;
    unitId: string;
    quantity?: number;
    price?: number;
    expiryDate?: Date;
    notes?: string;
  },
): CreateInventoryItemInput {
  return {
    name: scanData.name ?? 'Unknown Product',
    categoryId: defaults.categoryId,
    quantity: defaults.quantity ?? 1,
    unitId: defaults.unitId,
    location: defaults.location,
    userId: defaults.userId,
    barcode: scanData.barcode,
    brand: scanData.brand ?? undefined,
    imageUrl: scanData.imageUrl ?? undefined,
    sourceScanId: scanData.sourceScanId,
    price: defaults.price,
    expiryDate: defaults.expiryDate,
    notes: defaults.notes,
  };
}

/**
 * Convert an inventory item into a list item input (for adding inventory items
 * directly to a shopping list).
 */
export function inventoryItemToListItemInput(
  item: IInventoryItem,
  listId: string,
  quantity?: number,
): CreateListItemInput {
  return {
    listId,
    itemName: item.name,
    quantity: quantity ?? 1,
    unitId: item.unitId,
    categoryId: item.categoryId,
  };
}

// ---------------------------------------------------------------------------
// Grouping & sorting helpers
// ---------------------------------------------------------------------------

/** Group an array of items by a key extracted from each item. */
export function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
  }
  return result;
}

/** Group items by their category ID. */
export function groupByCategoryId<T extends {categoryId: string}>(items: T[]): Record<string, T[]> {
  return groupBy(items, item => item.categoryId);
}

/** Group items by their storage location. */
export function groupByLocation<T extends {location: string}>(items: T[]): Record<string, T[]> {
  return groupBy(items, item => item.location);
}

/** Group inventory items by their status. */
export function groupByStatus<T extends {status: string}>(items: T[]): Record<string, T[]> {
  return groupBy(items, item => item.status);
}

/** Sort items by expiry date (soonest first, no-expiry at end). */
export function sortByExpiry<T extends {expiryDate: Date | null}>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (!a.expiryDate && !b.expiryDate) return 0;
    if (!a.expiryDate) return 1;
    if (!b.expiryDate) return -1;
    return a.expiryDate.getTime() - b.expiryDate.getTime();
  });
}
