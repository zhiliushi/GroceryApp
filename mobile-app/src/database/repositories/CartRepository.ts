import {Database, Q} from '@nozbe/watermelondb';
import type {Model} from '@nozbe/watermelondb';
import CartItem from '../models/CartItem';
import InventoryItem from '../models/InventoryItem';
import PriceHistory from '../models/PriceHistory';
import {CART_TTL_HOURS} from '../../config/constants';
import type {WeightUnit, StorageLocation} from '../../config/constants';

/**
 * Input for creating a cart item.
 */
export interface CreateCartItemInput {
  name: string;
  userId: string;
  unitId: string;
  quantity?: number;
  barcode?: string | null;
  brand?: string | null;
  price?: number | null;
  weight?: number | null;
  weightUnit?: WeightUnit | null;
  imageUrl?: string | null;
  notes?: string | null;
}

/**
 * Input for checkout - converts cart items to inventory + price history.
 */
export interface CheckoutInput {
  storeId: string;
  userId: string;
  categoryId: string;
  defaultLocation: StorageLocation;
  /** Override location per cart item ID. */
  locationOverrides?: Record<string, StorageLocation>;
  /** Override expiry date per cart item ID (timestamp ms). */
  expiryDateOverrides?: Record<string, number>;
}

/**
 * Repository for cart_items table.
 * Manages the temporary shopping cart before purchase confirmation.
 */
export class CartRepository {
  private collection;
  private inventoryCollection;
  private priceHistoryCollection;

  constructor(private database: Database) {
    this.collection = database.get<CartItem>('cart_items');
    this.inventoryCollection = database.get<InventoryItem>('inventory_items');
    this.priceHistoryCollection = database.get<PriceHistory>('price_history');
  }

  // ---------------------------------------------------------------------------
  // Read operations
  // ---------------------------------------------------------------------------

  /** Get all cart items for a user, newest first. */
  async getAll(userId: string): Promise<CartItem[]> {
    return this.collection
      .query(Q.where('user_id', userId), Q.sortBy('created_at', Q.desc))
      .fetch();
  }

  /** Get a cart item by ID. */
  async getById(id: string): Promise<CartItem> {
    return this.collection.find(id);
  }

  /** Find cart item by barcode. */
  async findByBarcode(barcode: string, userId: string): Promise<CartItem | null> {
    const items = await this.collection
      .query(Q.where('user_id', userId), Q.where('barcode', barcode))
      .fetch();
    return items.length > 0 ? items[0] : null;
  }

  /** Get count of cart items. */
  async count(userId: string): Promise<number> {
    return this.collection.query(Q.where('user_id', userId)).fetchCount();
  }

  /** Get total price of all cart items. */
  async getTotalPrice(userId: string): Promise<number> {
    const items = await this.getAll(userId);
    return items.reduce((total, item) => {
      if (item.price !== null) {
        return total + item.price * item.quantity;
      }
      return total;
    }, 0);
  }

  /** Check if cart is empty. */
  async isEmpty(userId: string): Promise<boolean> {
    const count = await this.count(userId);
    return count === 0;
  }

  // ---------------------------------------------------------------------------
  // Reactive observers
  // ---------------------------------------------------------------------------

  /** Observe all cart items for a user. */
  observeAll(userId: string) {
    return this.collection
      .query(Q.where('user_id', userId), Q.sortBy('created_at', Q.desc))
      .observe();
  }

  /** Observe cart item count. */
  observeCount(userId: string) {
    return this.collection.query(Q.where('user_id', userId)).observeCount();
  }

  // ---------------------------------------------------------------------------
  // Write operations
  // ---------------------------------------------------------------------------

  /** Add an item to cart. Items auto-expire after CART_TTL_HOURS. */
  async add(data: CreateCartItemInput): Promise<CartItem> {
    const errors = CartItem.validate({
      name: data.name,
      quantity: data.quantity ?? 1,
      unitId: data.unitId,
      userId: data.userId,
    });
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    const ttlMs = CART_TTL_HOURS * 60 * 60 * 1000;
    const expiresAt = Date.now() + ttlMs;

    return this.database.write(async () => {
      return this.collection.create(record => {
        record.name = data.name.trim();
        record.userId = data.userId;
        record.unitId = data.unitId;
        record.quantity = data.quantity ?? 1;
        record.barcode = data.barcode ?? null;
        record.brand = data.brand?.trim() ?? null;
        record.price = data.price ?? null;
        record.weight = data.weight ?? null;
        record.weightUnit = data.weightUnit ?? null;
        record.imageUrl = data.imageUrl ?? null;
        record.notes = data.notes?.trim() ?? null;
        record.expiresAt = expiresAt;
      });
    });
  }

  /** Update a cart item. */
  async update(
    item: CartItem,
    data: {
      name?: string;
      brand?: string | null;
      quantity?: number;
      price?: number | null;
      weight?: number | null;
      weightUnit?: WeightUnit | null;
      notes?: string | null;
    },
  ): Promise<void> {
    await this.database.write(async () => {
      await item.update(record => {
        if (data.name !== undefined) record.name = data.name.trim();
        if (data.brand !== undefined) record.brand = data.brand?.trim() ?? null;
        if (data.quantity !== undefined) record.quantity = Math.max(1, data.quantity);
        if (data.price !== undefined) record.price = data.price;
        if (data.weight !== undefined) record.weight = data.weight;
        if (data.weightUnit !== undefined) record.weightUnit = data.weightUnit;
        if (data.notes !== undefined) record.notes = data.notes?.trim() ?? null;
      });
    });
  }

  /** Remove an item from cart. */
  async remove(item: CartItem): Promise<void> {
    await this.database.write(async () => {
      await item.destroyPermanently();
    });
  }

  /** Clear all items from cart for a user. */
  async clear(userId: string): Promise<void> {
    const items = await this.getAll(userId);
    if (items.length === 0) return;

    await this.database.write(async () => {
      const deletions = items.map(item => item.prepareDestroyPermanently());
      await this.database.batch(...deletions);
    });
  }

  /** Increment quantity of a cart item. */
  async incrementQuantity(item: CartItem): Promise<void> {
    await item.setQuantity(item.quantity + 1);
  }

  /** Decrement quantity of a cart item (min 1). */
  async decrementQuantity(item: CartItem): Promise<void> {
    await item.setQuantity(Math.max(1, item.quantity - 1));
  }

  // ---------------------------------------------------------------------------
  // TTL cleanup
  // ---------------------------------------------------------------------------

  /**
   * Delete expired cart items (past their TTL).
   * Should be called on app startup.
   * @returns Number of deleted items.
   */
  async deleteExpired(): Promise<number> {
    const now = Date.now();
    const expired = await this.collection
      .query(Q.where('expires_at', Q.lt(now)))
      .fetch();

    if (expired.length === 0) {
      return 0;
    }

    await this.database.write(async () => {
      const deletions = expired.map(item => item.prepareDestroyPermanently());
      await this.database.batch(...deletions);
    });

    return expired.length;
  }

  // ---------------------------------------------------------------------------
  // Checkout - Convert cart to inventory + price history
  // ---------------------------------------------------------------------------

  /**
   * Checkout: Move all cart items to inventory and create price history records.
   * Returns the created inventory items.
   */
  async checkout(input: CheckoutInput): Promise<InventoryItem[]> {
    const cartItems = await this.getAll(input.userId);
    if (cartItems.length === 0) {
      throw new Error('Cart is empty');
    }

    return this.database.write(async () => {
      const batch: Model[] = [];
      const inventoryItems: InventoryItem[] = [];

      for (const cartItem of cartItems) {
        const location =
          input.locationOverrides?.[cartItem.id] ?? input.defaultLocation;

        // Create inventory item
        const expiryMs = input.expiryDateOverrides?.[cartItem.id];
        const expiryDate = expiryMs ? new Date(expiryMs) : null;

        const inventoryItem = this.inventoryCollection.prepareCreate(record => {
          record.name = cartItem.name;
          record.barcode = cartItem.barcode;
          record.brand = cartItem.brand;
          record.categoryId = input.categoryId;
          record.quantity = cartItem.quantity;
          record.unitId = cartItem.unitId;
          record.location = location;
          record.imageUrl = cartItem.imageUrl;
          record.price = cartItem.price;
          record.purchaseDate = new Date();
          record.notes = cartItem.notes;
          record.addedDate = new Date();
          record.status = 'active';
          record.userId = input.userId;
          record.syncedToCloud = false;
          record.expiryDate = expiryDate;
          record.sourceScanId = null;
          record.consumedDate = null;
          record.reason = null;
          record.quantityRemaining = null;
          record.isImportant = false;
          record.restockThreshold = 0;
          record.expiryConfirmed = !!expiryDate;
        });
        batch.push(inventoryItem);
        inventoryItems.push(inventoryItem);

        // Create price history if price and barcode available
        if (cartItem.price !== null && cartItem.barcode !== null) {
          const pricePerUnit = PriceHistory.calculatePricePerUnit(
            cartItem.price,
            cartItem.weight,
            cartItem.weightUnit,
          );

          const priceRecord = this.priceHistoryCollection.prepareCreate(record => {
            record.barcode = cartItem.barcode!;
            record.name = cartItem.name;
            record.storeId = input.storeId;
            record.price = cartItem.price!;
            record.weight = cartItem.weight;
            record.weightUnit = cartItem.weightUnit;
            record.pricePerUnit = pricePerUnit;
            record.purchaseDate = new Date();
            record.notes = cartItem.notes;
            record.userId = input.userId;
          });
          batch.push(priceRecord);
        }

        // Mark cart item for deletion
        batch.push(cartItem.prepareDestroyPermanently());
      }

      await this.database.batch(...batch);
      return inventoryItems;
    });
  }
}
