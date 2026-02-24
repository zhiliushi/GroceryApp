import {Model} from '@nozbe/watermelondb';
import {text, field, readonly, date, relation} from '@nozbe/watermelondb/decorators';
import type {WeightUnit} from '../../config/constants';
import type Store from './Store';

/**
 * PriceHistory model for tracking historical prices.
 * Created when cart items are checked out.
 * Enables price comparison across stores and dates.
 */
export default class PriceHistory extends Model {
  static table = 'price_history';

  static associations = {
    stores: {type: 'belongs_to' as const, key: 'store_id'},
  };

  @text('barcode') barcode!: string;
  @text('name') name!: string;
  @text('store_id') storeId!: string;
  @field('price') price!: number;
  @field('weight') weight!: number | null;
  @text('weight_unit') weightUnit!: WeightUnit | null;
  @field('price_per_unit') pricePerUnit!: number | null;
  @date('purchase_date') purchaseDate!: Date;
  @text('notes') notes!: string | null;
  @text('user_id') userId!: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @relation('stores', 'store_id') store!: Store;

  // ---------------------------------------------------------------------------
  // Computed properties
  // ---------------------------------------------------------------------------

  /** Whether weight-based price comparison is available. */
  get hasWeightInfo(): boolean {
    return this.weight !== null && this.weight > 0 && this.weightUnit !== null;
  }

  /** Price per standard unit (per kg or per lb) for comparison. */
  get normalizedPricePerUnit(): number | null {
    if (!this.hasWeightInfo || !this.pricePerUnit) return null;

    // Normalize to per-kg for comparison
    switch (this.weightUnit) {
      case 'g':
        return this.pricePerUnit * 1000; // per gram → per kg
      case 'kg':
        return this.pricePerUnit; // already per kg
      case 'oz':
        return this.pricePerUnit * 35.274; // per oz → per kg (approx)
      case 'lb':
        return this.pricePerUnit * 2.205; // per lb → per kg (approx)
      default:
        return null;
    }
  }

  /** Days since this purchase. */
  get daysSincePurchase(): number {
    const diffMs = Date.now() - this.purchaseDate.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /** Formatted price display. */
  get formattedPrice(): string {
    return `$${this.price.toFixed(2)}`;
  }

  /** Formatted price per unit display. */
  get formattedPricePerUnit(): string | null {
    if (!this.pricePerUnit || !this.weightUnit) return null;
    return `$${this.pricePerUnit.toFixed(2)}/${this.weightUnit}`;
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  static validate(data: {
    barcode?: string;
    name?: string;
    storeId?: string;
    price?: number;
    userId?: string;
  }): string[] {
    const errors: string[] = [];

    if (!data.barcode || data.barcode.trim().length === 0) {
      errors.push('Barcode is required');
    }
    if (!data.name || data.name.trim().length === 0) {
      errors.push('Product name is required');
    }
    if (!data.storeId || data.storeId.trim().length === 0) {
      errors.push('Store is required');
    }
    if (data.price === undefined || data.price < 0 || !Number.isFinite(data.price)) {
      errors.push('Price must be a valid non-negative number');
    }
    if (!data.userId || data.userId.trim().length === 0) {
      errors.push('User ID is required');
    }

    return errors;
  }

  // ---------------------------------------------------------------------------
  // Static helpers
  // ---------------------------------------------------------------------------

  /**
   * Calculate price per unit from price and weight.
   * Used when creating a new price history record.
   */
  static calculatePricePerUnit(
    price: number,
    weight: number | null,
    weightUnit: WeightUnit | null,
  ): number | null {
    if (weight === null || weight <= 0 || weightUnit === null) {
      return null;
    }
    return price / weight;
  }

  // ---------------------------------------------------------------------------
  // Data transformation
  // ---------------------------------------------------------------------------

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      barcode: this.barcode,
      name: this.name,
      storeId: this.storeId,
      price: this.price,
      weight: this.weight,
      weightUnit: this.weightUnit,
      pricePerUnit: this.pricePerUnit,
      purchaseDate: this.purchaseDate.toISOString(),
      notes: this.notes,
      userId: this.userId,
    };
  }
}
