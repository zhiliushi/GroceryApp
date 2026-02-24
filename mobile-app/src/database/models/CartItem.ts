import {Model} from '@nozbe/watermelondb';
import {text, field, readonly, date, writer} from '@nozbe/watermelondb/decorators';
import type {WeightUnit} from '../../config/constants';

/**
 * CartItem model for temporary shopping cart.
 * Items in cart have been scanned/added but not yet confirmed as purchased.
 * On checkout, cart items are moved to inventory_items and price_history.
 * Items auto-expire after CART_TTL_HOURS (default 24 hours).
 */
export default class CartItem extends Model {
  static table = 'cart_items';

  @text('barcode') barcode!: string | null;
  @text('name') name!: string;
  @text('brand') brand!: string | null;
  @field('quantity') quantity!: number;
  @text('unit_id') unitId!: string;
  @field('price') price!: number | null;
  @field('weight') weight!: number | null;
  @text('weight_unit') weightUnit!: WeightUnit | null;
  @text('image_url') imageUrl!: string | null;
  @text('notes') notes!: string | null;
  @field('expires_at') expiresAt!: number;
  @text('user_id') userId!: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  // ---------------------------------------------------------------------------
  // Computed properties
  // ---------------------------------------------------------------------------

  /** Whether the cart item has expired (past its TTL). */
  get isExpired(): boolean {
    return Date.now() > this.expiresAt;
  }

  /** Whether the item has a price set. */
  get hasPrice(): boolean {
    return this.price !== null && this.price > 0;
  }

  /** Whether the item has weight information for price-per-unit comparison. */
  get hasWeight(): boolean {
    return this.weight !== null && this.weight > 0 && this.weightUnit !== null;
  }

  /** Calculate price per unit (if weight info available). */
  get pricePerUnit(): number | null {
    if (!this.hasPrice || !this.hasWeight) return null;
    return this.price! / this.weight!;
  }

  /** Total price for this cart item (price * quantity). */
  get totalPrice(): number | null {
    if (!this.hasPrice) return null;
    return this.price! * this.quantity;
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  static validate(data: {
    name?: string;
    quantity?: number;
    unitId?: string;
    userId?: string;
  }): string[] {
    const errors: string[] = [];

    if (!data.name || data.name.trim().length === 0) {
      errors.push('Product name is required');
    }
    if (data.name && data.name.length > 200) {
      errors.push('Product name must be 200 characters or less');
    }
    if (data.quantity !== undefined && (data.quantity < 1 || !Number.isFinite(data.quantity))) {
      errors.push('Quantity must be at least 1');
    }
    if (!data.unitId || data.unitId.trim().length === 0) {
      errors.push('Unit is required');
    }
    if (!data.userId || data.userId.trim().length === 0) {
      errors.push('User ID is required');
    }

    return errors;
  }

  // ---------------------------------------------------------------------------
  // Writer methods
  // ---------------------------------------------------------------------------

  /** Update quantity. */
  @writer async setQuantity(quantity: number): Promise<void> {
    await this.update(record => {
      record.quantity = Math.max(1, quantity);
    });
  }

  /** Update price. */
  @writer async setPrice(price: number | null): Promise<void> {
    await this.update(record => {
      record.price = price;
    });
  }

  /** Update weight information. */
  @writer async setWeight(weight: number | null, unit: WeightUnit | null): Promise<void> {
    await this.update(record => {
      record.weight = weight;
      record.weightUnit = unit;
    });
  }

  /** Update cart item details. */
  @writer async updateDetails(data: {
    name?: string;
    brand?: string | null;
    quantity?: number;
    price?: number | null;
    weight?: number | null;
    weightUnit?: WeightUnit | null;
    notes?: string | null;
  }): Promise<void> {
    await this.update(record => {
      if (data.name !== undefined) record.name = data.name;
      if (data.brand !== undefined) record.brand = data.brand;
      if (data.quantity !== undefined) record.quantity = Math.max(1, data.quantity);
      if (data.price !== undefined) record.price = data.price;
      if (data.weight !== undefined) record.weight = data.weight;
      if (data.weightUnit !== undefined) record.weightUnit = data.weightUnit;
      if (data.notes !== undefined) record.notes = data.notes;
    });
  }

  // ---------------------------------------------------------------------------
  // Data transformation
  // ---------------------------------------------------------------------------

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      barcode: this.barcode,
      name: this.name,
      brand: this.brand,
      quantity: this.quantity,
      unitId: this.unitId,
      price: this.price,
      weight: this.weight,
      weightUnit: this.weightUnit,
      imageUrl: this.imageUrl,
      notes: this.notes,
      expiresAt: this.expiresAt,
      userId: this.userId,
    };
  }
}
