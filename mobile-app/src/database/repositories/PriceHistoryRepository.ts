import {Database, Q} from '@nozbe/watermelondb';
import PriceHistory from '../models/PriceHistory';
import type {WeightUnit} from '../../config/constants';

/**
 * Price comparison result for a product across stores.
 */
export interface PriceComparison {
  storeId: string;
  storeName: string;
  lowestPrice: number;
  highestPrice: number;
  averagePrice: number;
  recordCount: number;
  latestRecord: PriceHistory;
}

/**
 * Repository for price_history table.
 * Manages historical price data for comparison across stores and dates.
 */
export class PriceHistoryRepository {
  private collection;

  constructor(private database: Database) {
    this.collection = database.get<PriceHistory>('price_history');
  }

  // ---------------------------------------------------------------------------
  // Read operations
  // ---------------------------------------------------------------------------

  /** Get all price history for a barcode, newest first. */
  async getByBarcode(barcode: string): Promise<PriceHistory[]> {
    return this.collection
      .query(Q.where('barcode', barcode), Q.sortBy('purchase_date', Q.desc))
      .fetch();
  }

  /** Get price history for a barcode at a specific store. */
  async getByBarcodeAndStore(barcode: string, storeId: string): Promise<PriceHistory[]> {
    return this.collection
      .query(
        Q.where('barcode', barcode),
        Q.where('store_id', storeId),
        Q.sortBy('purchase_date', Q.desc),
      )
      .fetch();
  }

  /** Get all price history for a user, newest first. */
  async getByUserId(userId: string): Promise<PriceHistory[]> {
    return this.collection
      .query(Q.where('user_id', userId), Q.sortBy('purchase_date', Q.desc))
      .fetch();
  }

  /** Get price history within a date range. */
  async getByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PriceHistory[]> {
    return this.collection
      .query(
        Q.where('user_id', userId),
        Q.where('purchase_date', Q.gte(startDate.getTime())),
        Q.where('purchase_date', Q.lte(endDate.getTime())),
        Q.sortBy('purchase_date', Q.desc),
      )
      .fetch();
  }

  /** Get all price history for a store. */
  async getByStore(storeId: string): Promise<PriceHistory[]> {
    return this.collection
      .query(Q.where('store_id', storeId), Q.sortBy('purchase_date', Q.desc))
      .fetch();
  }

  /** Get the most recent price for a barcode at any store. */
  async getLatestPrice(barcode: string): Promise<PriceHistory | null> {
    const records = await this.collection
      .query(Q.where('barcode', barcode), Q.sortBy('purchase_date', Q.desc), Q.take(1))
      .fetch();
    return records.length > 0 ? records[0] : null;
  }

  /** Get the most recent price for a barcode at a specific store. */
  async getLatestPriceAtStore(barcode: string, storeId: string): Promise<PriceHistory | null> {
    const records = await this.collection
      .query(
        Q.where('barcode', barcode),
        Q.where('store_id', storeId),
        Q.sortBy('purchase_date', Q.desc),
        Q.take(1),
      )
      .fetch();
    return records.length > 0 ? records[0] : null;
  }

  /** Get the lowest price ever recorded for a barcode. */
  async getLowestPrice(barcode: string): Promise<PriceHistory | null> {
    const records = await this.getByBarcode(barcode);
    if (records.length === 0) return null;
    return records.reduce((min, r) => (r.price < min.price ? r : min), records[0]);
  }

  /** Count of price records. */
  async count(userId: string): Promise<number> {
    return this.collection.query(Q.where('user_id', userId)).fetchCount();
  }

  /** Get unique barcodes in price history. */
  async getUniqueBarcodes(userId: string): Promise<string[]> {
    const records = await this.getByUserId(userId);
    const barcodes = new Set(records.map(r => r.barcode));
    return Array.from(barcodes);
  }

  // ---------------------------------------------------------------------------
  // Price comparison
  // ---------------------------------------------------------------------------

  /**
   * Compare prices for a product across all stores.
   * Returns aggregated stats per store.
   */
  async comparePricesAcrossStores(barcode: string): Promise<PriceComparison[]> {
    const records = await this.getByBarcode(barcode);
    if (records.length === 0) return [];

    // Group by store
    const byStore = new Map<string, PriceHistory[]>();
    for (const record of records) {
      const existing = byStore.get(record.storeId) ?? [];
      existing.push(record);
      byStore.set(record.storeId, existing);
    }

    // Calculate stats per store
    const comparisons: PriceComparison[] = [];
    for (const [storeId, storeRecords] of byStore) {
      const prices = storeRecords.map(r => r.price);
      const lowestPrice = Math.min(...prices);
      const highestPrice = Math.max(...prices);
      const averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length;

      // Get store name from the latest record (denormalized)
      const latestRecord = storeRecords[0];

      comparisons.push({
        storeId,
        storeName: '', // Will be populated by caller if needed
        lowestPrice,
        highestPrice,
        averagePrice,
        recordCount: storeRecords.length,
        latestRecord,
      });
    }

    // Sort by lowest price
    comparisons.sort((a, b) => a.lowestPrice - b.lowestPrice);
    return comparisons;
  }

  /**
   * Get price trend for a product (all prices over time).
   */
  async getPriceTrend(barcode: string, limit = 20): Promise<PriceHistory[]> {
    return this.collection
      .query(
        Q.where('barcode', barcode),
        Q.sortBy('purchase_date', Q.asc),
        Q.take(limit),
      )
      .fetch();
  }

  /**
   * Find the best current deal (lowest recent price) for a product.
   * Only considers prices from the last 30 days.
   */
  async findBestDeal(barcode: string): Promise<PriceHistory | null> {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentRecords = await this.collection
      .query(
        Q.where('barcode', barcode),
        Q.where('purchase_date', Q.gte(thirtyDaysAgo)),
        Q.sortBy('price', Q.asc),
        Q.take(1),
      )
      .fetch();
    return recentRecords.length > 0 ? recentRecords[0] : null;
  }

  // ---------------------------------------------------------------------------
  // Reactive observers
  // ---------------------------------------------------------------------------

  /** Observe price history for a barcode. */
  observeByBarcode(barcode: string) {
    return this.collection
      .query(Q.where('barcode', barcode), Q.sortBy('purchase_date', Q.desc))
      .observe();
  }

  /** Observe all price history for a user. */
  observeByUserId(userId: string) {
    return this.collection
      .query(Q.where('user_id', userId), Q.sortBy('purchase_date', Q.desc))
      .observe();
  }

  // ---------------------------------------------------------------------------
  // Write operations
  // ---------------------------------------------------------------------------

  /** Create a price history record. */
  async create(data: {
    barcode: string;
    name: string;
    storeId: string;
    price: number;
    userId: string;
    weight?: number | null;
    weightUnit?: WeightUnit | null;
    purchaseDate?: Date;
    notes?: string | null;
  }): Promise<PriceHistory> {
    const errors = PriceHistory.validate({
      barcode: data.barcode,
      name: data.name,
      storeId: data.storeId,
      price: data.price,
      userId: data.userId,
    });
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    const pricePerUnit = PriceHistory.calculatePricePerUnit(
      data.price,
      data.weight ?? null,
      data.weightUnit ?? null,
    );

    return this.database.write(async () => {
      return this.collection.create(record => {
        record.barcode = data.barcode;
        record.name = data.name.trim();
        record.storeId = data.storeId;
        record.price = data.price;
        record.weight = data.weight ?? null;
        record.weightUnit = data.weightUnit ?? null;
        record.pricePerUnit = pricePerUnit;
        record.purchaseDate = data.purchaseDate ?? new Date();
        record.notes = data.notes?.trim() ?? null;
        record.userId = data.userId;
      });
    });
  }

  /** Delete a price history record. */
  async delete(record: PriceHistory): Promise<void> {
    await this.database.write(async () => {
      await record.destroyPermanently();
    });
  }

  /** Delete all price history for a barcode. */
  async deleteByBarcode(barcode: string): Promise<void> {
    const records = await this.getByBarcode(barcode);
    if (records.length === 0) return;

    await this.database.write(async () => {
      const deletions = records.map(r => r.prepareDestroyPermanently());
      await this.database.batch(...deletions);
    });
  }
}
