import {Database, Q} from '@nozbe/watermelondb';
import type {Model} from '@nozbe/watermelondb';
import ShoppingList from '../models/ShoppingList';
import ListItem from '../models/ListItem';
import InventoryItem from '../models/InventoryItem';
import PriceHistory from '../models/PriceHistory';
import type {CreateListItemInput, UpdateListItemInput} from '../../types/database';
import type {StorageLocation} from '../../config/constants';
import type {CartRepository} from './CartRepository';

/**
 * Input for shopping list checkout — converts purchased list items to inventory.
 */
export interface ShoppingCheckoutInput {
  storeId: string;
  userId: string;
  defaultLocation: StorageLocation;
  /** Override location per list item ID. */
  locationOverrides?: Record<string, StorageLocation>;
  /** Override expiry date per list item ID (timestamp ms). */
  expiryDateOverrides?: Record<string, number>;
}

export class ShoppingListRepository {
  private listsCollection;
  private itemsCollection;
  private inventoryCollection;
  private priceHistoryCollection;

  constructor(private database: Database) {
    this.listsCollection = database.get<ShoppingList>('shopping_lists');
    this.itemsCollection = database.get<ListItem>('list_items');
    this.inventoryCollection = database.get<InventoryItem>('inventory_items');
    this.priceHistoryCollection = database.get<PriceHistory>('price_history');
  }

  // ---------------------------------------------------------------------------
  // List read operations
  // ---------------------------------------------------------------------------

  /** Get all active (non-completed) shopping lists, newest first. */
  async getAll(): Promise<ShoppingList[]> {
    return this.listsCollection
      .query(Q.where('is_completed', false), Q.sortBy('created_date', Q.desc))
      .fetch();
  }

  /** Get all lists including completed ones. */
  async getAllIncludingCompleted(): Promise<ShoppingList[]> {
    return this.listsCollection
      .query(Q.sortBy('created_date', Q.desc))
      .fetch();
  }

  /** Get a single list by ID. */
  async getById(id: string): Promise<ShoppingList> {
    return this.listsCollection.find(id);
  }

  /** Get lists for a specific user. */
  async getByUserId(userId: string): Promise<ShoppingList[]> {
    return this.listsCollection
      .query(
        Q.where('user_id', userId),
        Q.where('is_completed', false),
        Q.sortBy('created_date', Q.desc),
      )
      .fetch();
  }

  // ---------------------------------------------------------------------------
  // List write operations
  // ---------------------------------------------------------------------------

  /** Create a new shopping list. */
  async createList(name: string, userId: string, notes?: string | null): Promise<ShoppingList> {
    const errors = ShoppingList.validate({name, userId});
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    return this.database.write(async () => {
      return this.listsCollection.create(record => {
        record.name = name;
        record.createdDate = new Date();
        record.isCompleted = false;
        record.userId = userId;
        record.isCheckedOut = false;
        record.checkoutDate = null;
        record.storeId = null;
        record.totalPrice = null;
        record.notes = notes ?? null;
      });
    });
  }

  /** Update a list's notes. */
  async updateListNotes(list: ShoppingList, notes: string | null): Promise<void> {
    await this.database.write(async () => {
      await list.update(record => {
        record.notes = notes;
      });
    });
  }

  /** Rename an existing list. */
  async renameList(list: ShoppingList, newName: string): Promise<void> {
    await this.database.write(async () => {
      await list.update(record => {
        record.name = newName;
      });
    });
  }

  /** Mark a list as completed. */
  async markCompleted(list: ShoppingList): Promise<void> {
    await this.database.write(async () => {
      await list.update(record => {
        record.isCompleted = true;
      });
    });
  }

  /** Reopen a completed list. */
  async reopenList(list: ShoppingList): Promise<void> {
    await this.database.write(async () => {
      await list.update(record => {
        record.isCompleted = false;
      });
    });
  }

  /** Delete a list and all its items. */
  async deleteList(list: ShoppingList): Promise<void> {
    await this.database.write(async () => {
      const items = await this.itemsCollection
        .query(Q.where('list_id', list.id))
        .fetch();
      const deletions = items.map(item => item.prepareDestroyPermanently());
      deletions.push(list.prepareDestroyPermanently());
      await this.database.batch(...deletions);
    });
  }

  /** Duplicate a list and all its items. */
  async duplicateList(list: ShoppingList, userId: string): Promise<ShoppingList> {
    return this.database.write(async () => {
      const newList = await this.listsCollection.create(record => {
        record.name = `${list.name} (copy)`;
        record.createdDate = new Date();
        record.isCompleted = false;
        record.userId = userId;
        record.isCheckedOut = false;
        record.checkoutDate = null;
        record.storeId = null;
        record.totalPrice = null;
        record.notes = list.notes;
      });

      const items = await this.itemsCollection
        .query(Q.where('list_id', list.id))
        .fetch();

      if (items.length > 0) {
        const copies = items.map(item =>
          this.itemsCollection.prepareCreate(record => {
            record.listId = newList.id;
            record.itemName = item.itemName;
            record.quantity = item.quantity;
            record.unitId = item.unitId;
            record.isPurchased = false;
            record.categoryId = item.categoryId;
            record.barcode = item.barcode;
            record.brand = item.brand;
            record.price = item.price;
            record.weight = item.weight;
            record.weightUnit = item.weightUnit;
            record.imageUrl = item.imageUrl;
            record.notes = item.notes;
          }),
        );
        await this.database.batch(...copies);
      }

      return newList;
    });
  }

  // ---------------------------------------------------------------------------
  // Item read operations
  // ---------------------------------------------------------------------------

  /** Get all items in a list. */
  async getListItems(listId: string): Promise<ListItem[]> {
    return this.itemsCollection
      .query(Q.where('list_id', listId))
      .fetch();
  }

  /** Get only unpurchased items in a list. */
  async getUnpurchasedItems(listId: string): Promise<ListItem[]> {
    return this.itemsCollection
      .query(
        Q.where('list_id', listId),
        Q.where('is_purchased', false),
      )
      .fetch();
  }

  /** Count items in a list. */
  async getListItemCount(listId: string): Promise<number> {
    return this.itemsCollection
      .query(Q.where('list_id', listId))
      .fetchCount();
  }

  // ---------------------------------------------------------------------------
  // Item write operations
  // ---------------------------------------------------------------------------

  /** Add an item to a shopping list. */
  async addItem(data: CreateListItemInput): Promise<ListItem> {
    const errors = ListItem.validate({
      listId: data.listId,
      itemName: data.itemName,
      quantity: data.quantity,
      unitId: data.unitId,
      categoryId: data.categoryId,
    });
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    return this.database.write(async () => {
      return this.itemsCollection.create(record => {
        record.listId = data.listId;
        record.itemName = data.itemName;
        record.quantity = data.quantity;
        record.unitId = data.unitId;
        record.isPurchased = false;
        record.categoryId = data.categoryId;
        record.barcode = data.barcode ?? null;
        record.brand = data.brand ?? null;
        record.price = data.price ?? null;
        record.weight = data.weight ?? null;
        record.weightUnit = data.weightUnit ?? null;
        record.imageUrl = data.imageUrl ?? null;
        record.notes = data.notes ?? null;
      });
    });
  }

  /** Update an existing list item's details. */
  async updateItem(
    item: ListItem,
    changes: UpdateListItemInput,
  ): Promise<void> {
    await this.database.write(async () => {
      await item.update(record => {
        if (changes.itemName !== undefined) record.itemName = changes.itemName;
        if (changes.quantity !== undefined) record.quantity = changes.quantity;
        if (changes.unitId !== undefined) record.unitId = changes.unitId;
        if (changes.categoryId !== undefined) record.categoryId = changes.categoryId;
        if (changes.barcode !== undefined) record.barcode = changes.barcode ?? null;
        if (changes.brand !== undefined) record.brand = changes.brand ?? null;
        if (changes.price !== undefined) record.price = changes.price ?? null;
        if (changes.weight !== undefined) record.weight = changes.weight ?? null;
        if (changes.weightUnit !== undefined) record.weightUnit = changes.weightUnit ?? null;
        if (changes.imageUrl !== undefined) record.imageUrl = changes.imageUrl ?? null;
        if (changes.notes !== undefined) record.notes = changes.notes ?? null;
      });
    });
  }

  /** Toggle an item's purchased status. */
  async markPurchased(item: ListItem): Promise<void> {
    await this.database.write(async () => {
      await item.update(record => {
        record.isPurchased = !record.isPurchased;
      });
    });
  }

  /** Remove an item from the list permanently. */
  async deleteItem(item: ListItem): Promise<void> {
    await this.database.write(async () => {
      await item.destroyPermanently();
    });
  }

  /** Mark all items in a list as purchased. */
  async markAllPurchased(listId: string): Promise<void> {
    const unpurchased = await this.getUnpurchasedItems(listId);
    if (unpurchased.length === 0) return;
    await this.database.write(async () => {
      const updates = unpurchased.map(item =>
        item.prepareUpdate(record => {
          record.isPurchased = true;
        }),
      );
      await this.database.batch(...updates);
    });
  }

  // ---------------------------------------------------------------------------
  // Reactive observers
  // ---------------------------------------------------------------------------

  /** Observe all active lists reactively. */
  observeAll() {
    return this.listsCollection
      .query(Q.where('is_completed', false), Q.sortBy('created_date', Q.desc))
      .observe();
  }

  /** Observe all lists including completed ones reactively. */
  observeAllIncludingCompleted() {
    return this.listsCollection
      .query(Q.sortBy('created_date', Q.desc))
      .observe();
  }

  /** Observe items in a specific list reactively. */
  observeListItems(listId: string) {
    return this.itemsCollection
      .query(Q.where('list_id', listId))
      .observe();
  }

  /** Count purchased items in a list. */
  async getPurchasedItemCount(listId: string): Promise<number> {
    return this.itemsCollection
      .query(
        Q.where('list_id', listId),
        Q.where('is_purchased', true),
      )
      .fetchCount();
  }

  // ---------------------------------------------------------------------------
  // Checkout (v5) — converts purchased list items → inventory items
  // ---------------------------------------------------------------------------

  /**
   * Checkout a shopping list: creates inventory items from purchased items,
   * creates price history records, and marks the list as checked out.
   */
  async checkoutList(
    list: ShoppingList,
    input: ShoppingCheckoutInput,
  ): Promise<InventoryItem[]> {
    const purchasedItems = await this.itemsCollection
      .query(
        Q.where('list_id', list.id),
        Q.where('is_purchased', true),
      )
      .fetch();

    if (purchasedItems.length === 0) {
      throw new Error('No purchased items to checkout');
    }

    return this.database.write(async () => {
      const batch: Model[] = [];
      const inventoryItems: InventoryItem[] = [];

      let totalPrice = 0;

      for (const listItem of purchasedItems) {
        const location =
          input.locationOverrides?.[listItem.id] ?? input.defaultLocation;
        const expiryMs = input.expiryDateOverrides?.[listItem.id];
        const expiryDate = expiryMs ? new Date(expiryMs) : null;

        const inventoryItem = this.inventoryCollection.prepareCreate(record => {
          record.name = listItem.itemName;
          record.barcode = listItem.barcode;
          record.brand = listItem.brand;
          record.categoryId = listItem.categoryId;
          record.quantity = listItem.quantity;
          record.unitId = listItem.unitId;
          record.location = location;
          record.imageUrl = listItem.imageUrl;
          record.price = listItem.price;
          record.purchaseDate = new Date();
          record.notes = listItem.notes;
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
        if (listItem.price != null && listItem.barcode != null) {
          const pricePerUnit = PriceHistory.calculatePricePerUnit(
            listItem.price,
            listItem.weight,
            listItem.weightUnit,
          );

          const priceRecord = this.priceHistoryCollection.prepareCreate(record => {
            record.barcode = listItem.barcode!;
            record.name = listItem.itemName;
            record.storeId = input.storeId;
            record.price = listItem.price!;
            record.weight = listItem.weight;
            record.weightUnit = listItem.weightUnit;
            record.pricePerUnit = pricePerUnit;
            record.purchaseDate = new Date();
            record.notes = listItem.notes;
            record.userId = input.userId;
          });
          batch.push(priceRecord);
        }

        if (listItem.price != null) {
          totalPrice += listItem.price * listItem.quantity;
        }
      }

      // Mark the list as checked out
      batch.push(
        list.prepareUpdate(record => {
          record.isCompleted = true;
          record.isCheckedOut = true;
          record.checkoutDate = new Date();
          record.storeId = input.storeId;
          record.totalPrice = totalPrice > 0 ? totalPrice : null;
        }),
      );

      await this.database.batch(...batch);
      return inventoryItems;
    });
  }

  // ---------------------------------------------------------------------------
  // Purchase history (v5)
  // ---------------------------------------------------------------------------

  /** Get all checked-out lists (purchase records), newest first. */
  async getPurchaseHistory(): Promise<ShoppingList[]> {
    return this.listsCollection
      .query(
        Q.where('is_checked_out', true),
        Q.sortBy('checkout_date', Q.desc),
      )
      .fetch();
  }

  /** Get active (non-completed) lists — excludes purchase records. */
  async getActiveLists(): Promise<ShoppingList[]> {
    return this.listsCollection
      .query(
        Q.where('is_completed', false),
        Q.sortBy('created_date', Q.desc),
      )
      .fetch();
  }

  /** Find list items that match a barcode (for scan-to-tick). */
  async findListItemByBarcode(
    listId: string,
    barcode: string,
  ): Promise<ListItem | null> {
    const matches = await this.itemsCollection
      .query(
        Q.where('list_id', listId),
        Q.where('barcode', barcode),
        Q.where('is_purchased', false),
      )
      .fetch();
    return matches.length > 0 ? matches[0] : null;
  }

  // ---------------------------------------------------------------------------
  // List ↔ Cart integration
  // ---------------------------------------------------------------------------

  /**
   * Send unpurchased list items to the cart.
   * Skips items whose barcode is already in the cart.
   */
  async sendListToCart(
    listId: string,
    userId: string,
    cartRepo?: CartRepository,
  ): Promise<{sent: number; skipped: number}> {
    if (!cartRepo) {
      throw new Error('CartRepository is required');
    }

    const unpurchased = await this.getUnpurchasedItems(listId);
    let sent = 0;
    let skipped = 0;

    for (const item of unpurchased) {
      // Skip duplicates by barcode
      if (item.barcode) {
        const existing = await cartRepo.findByBarcode(item.barcode, userId);
        if (existing) {
          skipped++;
          continue;
        }
      }

      await cartRepo.add({
        name: item.itemName,
        userId,
        unitId: item.unitId,
        quantity: item.quantity,
        barcode: item.barcode,
        brand: item.brand,
        price: item.price,
        weight: item.weight,
        weightUnit: item.weightUnit as any,
        imageUrl: item.imageUrl,
        notes: item.notes,
      });
      sent++;
    }

    return {sent, skipped};
  }

  /**
   * Auto-tick list items that match checked-out cart items.
   * Called after cart checkout to cross-reference.
   */
  async crossReferenceAfterCheckout(
    cartItems: {barcode: string | null; name: string}[],
    userId: string,
  ): Promise<number> {
    const activeLists = await this.getByUserId(userId);
    let ticked = 0;

    for (const ci of cartItems) {
      if (!ci.barcode) continue;

      for (const list of activeLists) {
        const match = await this.findListItemByBarcode(list.id, ci.barcode);
        if (match) {
          await this.markPurchased(match);
          ticked++;
        }
      }
    }

    return ticked;
  }

  /** Remove unticked items older than the given number of days. */
  async cleanupExpiredItems(listId: string, maxAgeDays: number): Promise<number> {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const expired = await this.itemsCollection
      .query(
        Q.where('list_id', listId),
        Q.where('is_purchased', false),
        Q.where('created_at', Q.lt(cutoff)),
      )
      .fetch();

    if (expired.length === 0) return 0;

    await this.database.write(async () => {
      const deletions = expired.map(item => item.prepareDestroyPermanently());
      await this.database.batch(...deletions);
    });

    return expired.length;
  }
}
