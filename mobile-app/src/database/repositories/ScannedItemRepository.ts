import {Database, Q} from '@nozbe/watermelondb';
import ScannedItem, {SCAN_TTL_MS} from '../models/ScannedItem';

/**
 * Stage 1 repository — temporary scan records.
 *
 * Scanned items are local-only (never synced to cloud).
 * Only barcode scans create these — manual adds go directly
 * to inventory_items (Stage 2).
 */
export class ScannedItemRepository {
  private collection;

  constructor(private database: Database) {
    this.collection = database.get<ScannedItem>('scanned_items');
  }

  // ---------------------------------------------------------------------------
  // Read operations
  // ---------------------------------------------------------------------------

  /** Get all scanned items, newest first. */
  async getAll(): Promise<ScannedItem[]> {
    return this.collection
      .query(Q.sortBy('scanned_at', Q.desc))
      .fetch();
  }

  /** Get all non-expired scanned items. */
  async getActive(): Promise<ScannedItem[]> {
    return this.collection
      .query(
        Q.where('expires_at', Q.gte(Date.now())),
        Q.sortBy('scanned_at', Q.desc),
      )
      .fetch();
  }

  /** Find scanned items by barcode (may return multiple if scanned more than once). */
  async getByBarcode(barcode: string): Promise<ScannedItem[]> {
    return this.collection
      .query(Q.where('barcode', barcode))
      .fetch();
  }

  /** Get all expired scanned items (past their TTL). */
  async getExpired(): Promise<ScannedItem[]> {
    return this.collection
      .query(Q.where('expires_at', Q.lt(Date.now())))
      .fetch();
  }

  /** Get scanned items for a specific user. */
  async getByUserId(userId: string): Promise<ScannedItem[]> {
    return this.collection
      .query(
        Q.where('user_id', userId),
        Q.sortBy('scanned_at', Q.desc),
      )
      .fetch();
  }

  /** Total count of scanned items. */
  async count(): Promise<number> {
    return this.collection.query().fetchCount();
  }

  // ---------------------------------------------------------------------------
  // Reactive observers
  // ---------------------------------------------------------------------------

  /** Observe all non-expired scans reactively. */
  observeActive() {
    return this.collection
      .query(
        Q.where('expires_at', Q.gte(Date.now())),
        Q.sortBy('scanned_at', Q.desc),
      )
      .observe();
  }

  // ---------------------------------------------------------------------------
  // Write operations
  // ---------------------------------------------------------------------------

  /** Insert a new scanned item from a barcode scan. */
  async insert(data: {
    barcode: string;
    name?: string | null;
    brand?: string | null;
    imageUrl?: string | null;
    lookupData?: string | null;
    userId: string;
  }): Promise<ScannedItem> {
    const errors = ScannedItem.validate({
      barcode: data.barcode,
      userId: data.userId,
    });
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    const now = Date.now();

    return this.database.write(async () => {
      return this.collection.create(record => {
        record.barcode = data.barcode;
        record.name = data.name ?? null;
        record.brand = data.brand ?? null;
        record.imageUrl = data.imageUrl ?? null;
        record.lookupData = data.lookupData ?? null;
        record.scannedAt = new Date(now);
        record.expiresAt = new Date(now + SCAN_TTL_MS);
        record.userId = data.userId;
      });
    });
  }

  /** Delete a single scanned item. */
  async delete(item: ScannedItem): Promise<void> {
    await this.database.write(async () => {
      await item.destroyPermanently();
    });
  }

  /** Delete all expired scanned items (TTL cleanup). */
  async deleteExpired(): Promise<number> {
    const expired = await this.getExpired();
    if (expired.length === 0) return 0;

    await this.database.write(async () => {
      const deletions = expired.map(item => item.prepareDestroyPermanently());
      await this.database.batch(...deletions);
    });

    return expired.length;
  }
}
