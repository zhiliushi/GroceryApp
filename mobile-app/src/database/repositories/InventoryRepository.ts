import {Database, Q} from '@nozbe/watermelondb';
import type {Model} from '@nozbe/watermelondb';
import InventoryItem from '../models/InventoryItem';
import type {
  StorageLocation,
  InventoryStatus,
  ConsumeReason,
} from '../models/InventoryItem';
import type ScannedItem from '../models/ScannedItem';
import type {
  CreateInventoryItemInput,
  UpdateInventoryItemInput,
} from '../../types/database';

/**
 * Repository for inventory_items (Stage 2 + Stage 3).
 *
 * Active items (status='active') are current inventory.
 * Consumed/expired/discarded items are archived history.
 */
export class InventoryRepository {
  private collection;

  constructor(private database: Database) {
    this.collection = database.get<InventoryItem>('inventory_items');
  }

  // ---------------------------------------------------------------------------
  // Read — Active inventory (Stage 2)
  // ---------------------------------------------------------------------------

  /** Get all active inventory items, newest first. */
  async getActive(): Promise<InventoryItem[]> {
    return this.collection
      .query(
        Q.where('status', 'active'),
        Q.sortBy('updated_at', Q.desc),
      )
      .fetch();
  }

  /** Get active items filtered by category ID. */
  async getActiveByCategory(categoryId: string): Promise<InventoryItem[]> {
    return this.collection
      .query(
        Q.where('status', 'active'),
        Q.where('category_id', categoryId),
        Q.sortBy('name', Q.asc),
      )
      .fetch();
  }

  /** Get active items filtered by storage location. */
  async getActiveByLocation(location: StorageLocation): Promise<InventoryItem[]> {
    return this.collection
      .query(
        Q.where('status', 'active'),
        Q.where('location', location),
        Q.sortBy('name', Q.asc),
      )
      .fetch();
  }

  /** Get active items expiring within the next N days. */
  async getExpiring(days: number): Promise<InventoryItem[]> {
    const now = Date.now();
    const limit = now + days * 24 * 60 * 60 * 1000;
    return this.collection
      .query(
        Q.where('status', 'active'),
        Q.where('expiry_date', Q.notEq(null)),
        Q.where('expiry_date', Q.lte(limit)),
        Q.where('expiry_date', Q.gte(now)),
        Q.sortBy('expiry_date', Q.asc),
      )
      .fetch();
  }

  /** Get active items that have already expired. */
  async getExpiredItems(): Promise<InventoryItem[]> {
    return this.collection
      .query(
        Q.where('status', 'active'),
        Q.where('expiry_date', Q.notEq(null)),
        Q.where('expiry_date', Q.lt(Date.now())),
        Q.sortBy('expiry_date', Q.asc),
      )
      .fetch();
  }

  // ---------------------------------------------------------------------------
  // Read — Consumed/history (Stage 3)
  // ---------------------------------------------------------------------------

  /** Get all consumed/expired/discarded items, newest first. */
  async getConsumed(): Promise<InventoryItem[]> {
    return this.collection
      .query(
        Q.where('status', Q.notEq('active')),
        Q.sortBy('consumed_date', Q.desc),
      )
      .fetch();
  }

  /** Get consumed items within a date range. */
  async getConsumedByDateRange(
    startMs: number,
    endMs: number,
  ): Promise<InventoryItem[]> {
    return this.collection
      .query(
        Q.where('status', Q.notEq('active')),
        Q.where('consumed_date', Q.gte(startMs)),
        Q.where('consumed_date', Q.lte(endMs)),
        Q.sortBy('consumed_date', Q.desc),
      )
      .fetch();
  }

  /** Get consumed items filtered by reason. */
  async getConsumedByReason(reason: ConsumeReason): Promise<InventoryItem[]> {
    return this.collection
      .query(
        Q.where('status', Q.notEq('active')),
        Q.where('reason', reason),
        Q.sortBy('consumed_date', Q.desc),
      )
      .fetch();
  }

  /** Get consumption stats for the last N days. */
  async getConsumptionStats(days: number): Promise<{
    total: number;
    usedUp: number;
    expired: number;
    discarded: number;
  }> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const consumed = await this.collection
      .query(
        Q.where('status', Q.notEq('active')),
        Q.where('consumed_date', Q.gte(cutoff)),
      )
      .fetch();

    return {
      total: consumed.length,
      usedUp: consumed.filter(i => i.reason === 'used_up').length,
      expired: consumed.filter(i => i.reason === 'expired').length,
      discarded: consumed.filter(i => i.reason === 'discarded').length,
    };
  }

  // ---------------------------------------------------------------------------
  // Read — All items (both stages)
  // ---------------------------------------------------------------------------

  /** Get all items (active + consumed), newest first. */
  async getAll(): Promise<InventoryItem[]> {
    return this.collection
      .query(Q.sortBy('updated_at', Q.desc))
      .fetch();
  }

  /** Find a single item by its WatermelonDB ID. */
  async getById(id: string): Promise<InventoryItem> {
    return this.collection.find(id);
  }

  /** Look up items by barcode (returns array — duplicates allowed). */
  async getByBarcode(barcode: string): Promise<InventoryItem[]> {
    return this.collection
      .query(Q.where('barcode', barcode))
      .fetch();
  }

  /** Full-text search on name and brand. */
  async search(query: string): Promise<InventoryItem[]> {
    const q = Q.sanitizeLikeString(query);
    return this.collection
      .query(
        Q.where('status', 'active'),
        Q.or(
          Q.where('name', Q.like(`%${q}%`)),
          Q.where('brand', Q.like(`%${q}%`)),
        ),
      )
      .fetch();
  }

  /** Get items that have not been synced to the cloud yet. */
  async getUnsynced(): Promise<InventoryItem[]> {
    return this.collection
      .query(Q.where('synced_to_cloud', false))
      .fetch();
  }

  /** Get items for a specific user (active only). */
  async getByUserId(userId: string): Promise<InventoryItem[]> {
    return this.collection
      .query(
        Q.where('user_id', userId),
        Q.where('status', 'active'),
        Q.sortBy('updated_at', Q.desc),
      )
      .fetch();
  }

  /** Count of all items. */
  async count(): Promise<number> {
    return this.collection.query().fetchCount();
  }

  /** Count of active items only. */
  async activeCount(): Promise<number> {
    return this.collection
      .query(Q.where('status', 'active'))
      .fetchCount();
  }

  // ---------------------------------------------------------------------------
  // Read — Restock tracking
  // ---------------------------------------------------------------------------

  /** Get active items that are important and below their restock threshold. */
  async getNeedingRestock(): Promise<InventoryItem[]> {
    const important = await this.collection
      .query(
        Q.where('status', 'active'),
        Q.where('is_important', true),
      )
      .fetch();
    return important.filter(i => i.quantity <= i.restockThreshold);
  }

  /** Count of items needing restock. */
  async getNeedingRestockCount(): Promise<number> {
    const items = await this.getNeedingRestock();
    return items.length;
  }

  /** Get all active items marked as important. */
  async getImportantItems(): Promise<InventoryItem[]> {
    return this.collection
      .query(
        Q.where('status', 'active'),
        Q.where('is_important', true),
        Q.sortBy('name', Q.asc),
      )
      .fetch();
  }

  /** Get active items that need expiry attention (no expiry, not confirmed). */
  async getNeedingExpiryAttention(): Promise<InventoryItem[]> {
    return this.collection
      .query(
        Q.where('status', 'active'),
        Q.where('expiry_date', Q.eq(null)),
        Q.where('expiry_confirmed', false),
      )
      .fetch();
  }

  // ---------------------------------------------------------------------------
  // Reactive observers
  // ---------------------------------------------------------------------------

  /** Observe all active items reactively. */
  observeActive() {
    return this.collection
      .query(
        Q.where('status', 'active'),
        Q.sortBy('updated_at', Q.desc),
      )
      .observe();
  }

  /** Observe active items by category reactively. */
  observeActiveByCategory(categoryId: string) {
    return this.collection
      .query(
        Q.where('status', 'active'),
        Q.where('category_id', categoryId),
        Q.sortBy('name', Q.asc),
      )
      .observe();
  }

  /** Observe active items by storage location reactively. */
  observeActiveByLocation(location: StorageLocation) {
    return this.collection
      .query(
        Q.where('status', 'active'),
        Q.where('location', location),
        Q.sortBy('name', Q.asc),
      )
      .observe();
  }

  /** Observe all consumed items reactively. */
  observeConsumed() {
    return this.collection
      .query(
        Q.where('status', Q.notEq('active')),
        Q.sortBy('consumed_date', Q.desc),
      )
      .observe();
  }

  // ---------------------------------------------------------------------------
  // Write operations
  // ---------------------------------------------------------------------------

  /** Insert a new inventory item (Stage 2 — active). */
  async insert(data: CreateInventoryItemInput): Promise<InventoryItem> {
    const errors = InventoryItem.validate({
      name: data.name,
      categoryId: data.categoryId,
      quantity: data.quantity,
      unitId: data.unitId,
      location: data.location,
      userId: data.userId,
    });
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    return this.database.write(async () => {
      return this.collection.create(record => {
        record.name = data.name;
        record.categoryId = data.categoryId;
        record.quantity = data.quantity;
        record.unitId = data.unitId;
        record.location = data.location;
        record.userId = data.userId;
        record.barcode = data.barcode ?? null;
        record.brand = data.brand ?? null;
        record.expiryDate = data.expiryDate ?? null;
        record.imageUrl = data.imageUrl ?? null;
        record.price = data.price ?? null;
        record.purchaseDate = data.purchaseDate ?? null;
        record.notes = data.notes ?? null;
        record.sourceScanId = data.sourceScanId ?? null;
        record.addedDate = new Date();
        record.status = 'active';
        record.consumedDate = null;
        record.reason = null;
        record.quantityRemaining = null;
        record.syncedToCloud = false;
        record.isImportant = data.isImportant ?? false;
        record.restockThreshold = data.restockThreshold ?? 0;
        record.expiryConfirmed = data.expiryConfirmed ?? false;
        record.needsReview = data.needsReview ?? false;
      });
    });
  }

  /** Update an existing item's fields. */
  async update(
    item: InventoryItem,
    changes: UpdateInventoryItemInput,
  ): Promise<void> {
    await this.database.write(async () => {
      await item.update(record => {
        if (changes.name !== undefined) record.name = changes.name;
        if (changes.barcode !== undefined) record.barcode = changes.barcode;
        if (changes.brand !== undefined) record.brand = changes.brand;
        if (changes.categoryId !== undefined) record.categoryId = changes.categoryId;
        if (changes.quantity !== undefined) record.quantity = changes.quantity;
        if (changes.unitId !== undefined) record.unitId = changes.unitId;
        if (changes.expiryDate !== undefined) record.expiryDate = changes.expiryDate;
        if (changes.location !== undefined) record.location = changes.location;
        if (changes.imageUrl !== undefined) record.imageUrl = changes.imageUrl;
        if (changes.price !== undefined) record.price = changes.price;
        if (changes.purchaseDate !== undefined) record.purchaseDate = changes.purchaseDate;
        if (changes.notes !== undefined) record.notes = changes.notes;
        if (changes.isImportant !== undefined) record.isImportant = changes.isImportant;
        if (changes.restockThreshold !== undefined) record.restockThreshold = changes.restockThreshold;
        if (changes.expiryConfirmed !== undefined) record.expiryConfirmed = changes.expiryConfirmed;
        if (changes.needsReview !== undefined) record.needsReview = changes.needsReview;
        record.syncedToCloud = false;
      });
    });
  }

  /**
   * Promote a Stage 1 scanned item to Stage 2 inventory.
   * Creates the inventory record and deletes the scan.
   */
  async promoteFromScan(
    scannedItem: ScannedItem,
    additionalData: {
      categoryId: string;
      unitId: string;
      quantity: number;
      location: StorageLocation;
      userId: string;
      expiryDate?: Date | null;
      price?: number | null;
      notes?: string | null;
    },
  ): Promise<InventoryItem> {
    const promo = scannedItem.promotionData;

    return this.database.write(async () => {
      const inventoryItem = await this.collection.create(record => {
        record.barcode = promo.barcode;
        record.name = promo.name ?? 'Unknown Item';
        record.brand = promo.brand ?? null;
        record.imageUrl = promo.imageUrl ?? null;
        record.sourceScanId = promo.sourceScanId;
        record.categoryId = additionalData.categoryId;
        record.unitId = additionalData.unitId;
        record.quantity = additionalData.quantity;
        record.location = additionalData.location;
        record.userId = additionalData.userId;
        record.expiryDate = additionalData.expiryDate ?? null;
        record.price = additionalData.price ?? null;
        record.purchaseDate = new Date();
        record.notes = additionalData.notes ?? null;
        record.addedDate = new Date();
        record.status = 'active';
        record.consumedDate = null;
        record.reason = null;
        record.quantityRemaining = null;
        record.syncedToCloud = false;
        record.isImportant = false;
        record.restockThreshold = 0;
        record.expiryConfirmed = !!additionalData.expiryDate;
      });

      // Delete the scanned item after promotion
      await scannedItem.destroyPermanently();

      return inventoryItem;
    });
  }

  /**
   * Transition from Stage 2 (active) to Stage 3 (consumed/expired/discarded).
   * Uses the model's @writer method.
   */
  async markConsumed(
    item: InventoryItem,
    reason: ConsumeReason,
    quantityRemaining?: number,
  ): Promise<void> {
    await item.markConsumed(reason, quantityRemaining);
  }

  /** Restore a consumed/expired/discarded item to active inventory. */
  async restoreToActive(item: InventoryItem): Promise<void> {
    await item.restoreToActive();
  }

  /** Get all non-active items (past items: consumed, expired, discarded). */
  async getPastItems(): Promise<InventoryItem[]> {
    return this.collection
      .query(
        Q.where('status', Q.notEq('active')),
        Q.sortBy('consumed_date', Q.desc),
      )
      .fetch();
  }

  /** Permanently delete an item from the database. */
  async delete(item: InventoryItem): Promise<void> {
    await this.database.write(async () => {
      await item.destroyPermanently();
    });
  }

  /** Mark as deleted using WatermelonDB's built-in soft delete. */
  async markAsDeleted(item: InventoryItem): Promise<void> {
    await this.database.write(async () => {
      await item.markAsDeleted();
    });
  }

  /** Mark a batch of items as synced to cloud. */
  async markSyncedBatch(items: InventoryItem[]): Promise<void> {
    if (items.length === 0) return;
    await this.database.write(async () => {
      const updates = items.map(item =>
        item.prepareUpdate(record => {
          record.syncedToCloud = true;
        }),
      );
      await this.database.batch(...updates);
    });
  }
}
