import type {StorageLocation, InventoryStatus, ConsumeReason} from '../database/models/InventoryItem';
import type {UnitType} from '../database/models/Unit';
import type {AnalyticsEventType} from '../database/models/AnalyticsEvent';

// ---------------------------------------------------------------------------
// Category
// ---------------------------------------------------------------------------

/** Complete category record as stored in the database. */
export interface ICategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
}

// ---------------------------------------------------------------------------
// Unit
// ---------------------------------------------------------------------------

/** Complete unit record as stored in the database. */
export interface IUnit {
  id: string;
  name: string;
  abbreviation: string;
  unitType: UnitType;
}

// ---------------------------------------------------------------------------
// Scanned Item (Stage 1)
// ---------------------------------------------------------------------------

/** Complete scanned item record as stored in the database. */
export interface IScannedItem {
  id: string;
  barcode: string;
  name: string | null;
  brand: string | null;
  imageUrl: string | null;
  lookupData: Record<string, unknown> | null;
  scannedAt: Date;
  expiresAt: Date;
  isExpired: boolean;
  userId: string;
}

/** Data required to create a new scanned item. */
export interface CreateScannedItemInput {
  barcode: string;
  userId: string;
  name?: string | null;
  brand?: string | null;
  imageUrl?: string | null;
  lookupData?: string | null;
}

// ---------------------------------------------------------------------------
// Inventory Item (Stage 2 + Stage 3)
// ---------------------------------------------------------------------------

/** Complete inventory item record as stored in the database. */
export interface IInventoryItem {
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
  reason: ConsumeReason | null;
  quantityRemaining: number | null;
  userId: string;
  syncedToCloud: boolean;
}

/** Data required to create a new inventory item. */
export interface CreateInventoryItemInput {
  name: string;
  categoryId: string;
  quantity: number;
  unitId: string;
  location: StorageLocation;
  userId: string;
  barcode?: string;
  brand?: string;
  expiryDate?: Date;
  imageUrl?: string;
  price?: number;
  purchaseDate?: Date;
  notes?: string;
  sourceScanId?: string;
  isImportant?: boolean;
  restockThreshold?: number;
  expiryConfirmed?: boolean;
  needsReview?: boolean;
}

/** Data for updating an existing inventory item (all fields optional). */
export interface UpdateInventoryItemInput {
  name?: string;
  barcode?: string | null;
  brand?: string | null;
  categoryId?: string;
  quantity?: number;
  unitId?: string;
  expiryDate?: Date | null;
  location?: StorageLocation;
  imageUrl?: string | null;
  price?: number | null;
  purchaseDate?: Date | null;
  notes?: string | null;
  isImportant?: boolean;
  restockThreshold?: number;
  expiryConfirmed?: boolean;
  needsReview?: boolean;
}

// ---------------------------------------------------------------------------
// Shopping List
// ---------------------------------------------------------------------------

/** Complete shopping list record as stored in the database. */
export interface IShoppingList {
  id: string;
  name: string;
  createdDate: Date;
  isCompleted: boolean;
  userId: string;
  isCheckedOut: boolean;
  checkoutDate: Date | null;
  storeId: string | null;
  totalPrice: number | null;
  notes: string | null;
}

/** Data required to create a new shopping list. */
export interface CreateShoppingListInput {
  name: string;
  userId: string;
  notes?: string | null;
}

/** Data for updating an existing shopping list. */
export interface UpdateShoppingListInput {
  name?: string;
  isCompleted?: boolean;
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// List Item
// ---------------------------------------------------------------------------

/** Complete list item record as stored in the database. */
export interface IListItem {
  id: string;
  listId: string;
  itemName: string;
  quantity: number;
  unitId: string;
  isPurchased: boolean;
  categoryId: string;
  barcode: string | null;
  brand: string | null;
  price: number | null;
  weight: number | null;
  weightUnit: string | null;
  imageUrl: string | null;
  notes: string | null;
}

/** Data required to add an item to a shopping list. */
export interface CreateListItemInput {
  listId: string;
  itemName: string;
  quantity: number;
  unitId: string;
  categoryId: string;
  barcode?: string | null;
  brand?: string | null;
  price?: number | null;
  weight?: number | null;
  weightUnit?: string | null;
  imageUrl?: string | null;
  notes?: string | null;
}

/** Data for updating an existing list item. */
export interface UpdateListItemInput {
  itemName?: string;
  quantity?: number;
  unitId?: string;
  categoryId?: string;
  barcode?: string | null;
  brand?: string | null;
  price?: number | null;
  weight?: number | null;
  weightUnit?: string | null;
  imageUrl?: string | null;
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// Analytics Event
// ---------------------------------------------------------------------------

/** Complete analytics event record as stored in the database. */
export interface IAnalyticsEvent {
  id: string;
  eventType: AnalyticsEventType;
  eventData: Record<string, unknown>;
  timestamp: Date;
  synced: boolean;
  userId: string;
}

/** Data required to log a new analytics event. */
export interface CreateAnalyticsEventInput {
  eventType: AnalyticsEventType;
  eventData: Record<string, unknown>;
  userId: string;
}

// ---------------------------------------------------------------------------
// Event data payload shapes (typed event data for each event type)
// ---------------------------------------------------------------------------

export interface BarcodeScanEventData {
  barcode: string;
  format: string;
  productFound: boolean;
  productName?: string;
}

export interface ItemAddedEventData {
  itemId: string;
  name: string;
  categoryId: string;
  source: 'manual' | 'barcode_scan';
}

export interface ItemRemovedEventData {
  itemId: string;
  name: string;
  reason: 'consumed' | 'expired' | 'deleted';
}

export interface ListCreatedEventData {
  listId: string;
  name: string;
  initialItemCount: number;
}

export interface ListCompletedEventData {
  listId: string;
  name: string;
  totalItems: number;
  purchasedItems: number;
}

export interface PurchaseRecordedEventData {
  listId: string;
  itemName: string;
  quantity: number;
  unitId: string;
}

export interface SyncCompletedEventData {
  itemsSynced: number;
  eventsSynced: number;
  direction: 'push' | 'pull' | 'both';
}

/** Stage 1: barcode scanned event data. */
export interface ItemScannedEventData {
  barcode: string;
  productFound: boolean;
  productName?: string;
  scannedItemId: string;
}

/** Stage 1 → 2: scan promoted to inventory event data. */
export interface ScanPromotedEventData {
  scannedItemId: string;
  inventoryItemId: string;
  barcode: string;
  name: string;
}

/** Stage 2 → 3: item consumed/expired/discarded event data. */
export interface ItemConsumedEventData {
  inventoryItemId: string;
  name: string;
  reason: ConsumeReason;
  quantityRemaining: number;
}

// ---------------------------------------------------------------------------
// Foodbank
// ---------------------------------------------------------------------------

/** Complete foodbank record as stored in the database. */
export interface IFoodbank {
  id: string;
  name: string;
  description: string | null;
  country: string;
  state: string | null;
  locationName: string | null;
  locationAddress: string | null;
  locationLink: string | null;
  latitude: number | null;
  longitude: number | null;
  sourceUrl: string | null;
  sourceName: string | null;
  isActive: boolean;
}

/** Firestore representation of a foodbank document. */
export interface FirestoreFoodbank {
  name: string;
  description: string | null;
  country: string;
  state: string | null;
  location_name: string | null;
  location_address: string | null;
  location_link: string | null;
  latitude: number | null;
  longitude: number | null;
  source_url: string | null;
  source_name: string | null;
  is_active: boolean;
  created_at: number;
  updated_at: number;
}

// ---------------------------------------------------------------------------
// Utility types
// ---------------------------------------------------------------------------

/** Maps event types to their specific payload shapes. */
export interface AnalyticsEventDataMap {
  barcode_scan: BarcodeScanEventData;
  item_added: ItemAddedEventData;
  item_removed: ItemRemovedEventData;
  item_updated: Record<string, unknown>;
  item_expired: {itemId: string; name: string; expiredDaysAgo: number};
  list_created: ListCreatedEventData;
  list_completed: ListCompletedEventData;
  list_deleted: {listId: string; name: string};
  purchase_recorded: PurchaseRecordedEventData;
  sync_completed: SyncCompletedEventData;
  search_performed: {query: string; resultsCount: number};
  category_viewed: {categoryId: string; itemCount: number};
  item_scanned: ItemScannedEventData;
  scan_promoted: ScanPromotedEventData;
  scan_discarded: {scannedItemId: string; barcode: string; reason: 'user' | 'ttl'};
  item_consumed: ItemConsumedEventData;
}

/** Re-export lifecycle types for convenience. */
export type {StorageLocation, InventoryStatus, ConsumeReason};
export type {UnitType};
