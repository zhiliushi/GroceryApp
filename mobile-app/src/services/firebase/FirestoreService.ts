import firestore from '@react-native-firebase/firestore';
import type {FirebaseFirestoreTypes} from '@react-native-firebase/firestore';
import {
  userDocRef,
  inventoryColRef,
  shoppingListsColRef,
  listItemsColRef,
  analyticsColRef,
  foodbanksColRef,
  priceRecordsColRef,
} from '../../config/firebase';
import type {FirestoreFoodbank} from '../../types/database';
import type InventoryItem from '../../database/models/InventoryItem';
import type ShoppingList from '../../database/models/ShoppingList';
import type ListItem from '../../database/models/ListItem';

// ---------------------------------------------------------------------------
// Firestore document types
// ---------------------------------------------------------------------------

/**
 * Firestore data structure:
 *
 * users/{userId}                         ← FirestoreUserProfile
 *   grocery_items/{itemId}               ← FirestoreInventoryItem
 *   shopping_lists/{listId}              ← FirestoreShoppingList
 *     items/{itemId}                     ← FirestoreListItem
 *   analytics/{eventId}                  ← FirestoreAnalyticsEvent
 */

export interface FirestoreUserProfile {
  email: string;
  displayName: string | null;
  location: string | null;
  tier: 'free' | 'paid';
  subscribedAt: number | null;     // timestamp when subscribed
  subscriptionExpiry: number | null; // subscription expiry timestamp
  preferences: FirestoreUserPreferences;
  createdAt: number;
  updatedAt: number;
}

export interface FirestoreUserPreferences {
  defaultLocation: string;
  expiryWarningDays: number;
  darkMode: boolean;
  notificationsEnabled: boolean;
  [key: string]: unknown;
}

export interface FirestoreInventoryItem {
  name: string;
  barcode: string | null;
  brand: string | null;
  categoryId: string;
  quantity: number;
  unitId: string;
  price: number | null;
  purchaseDate: number | null;
  expiryDate: number | null;
  location: string;
  notes: string | null;
  imageUrl: string | null;
  status: string;
  consumedDate: number | null;
  reason: string | null;
  quantityRemaining: number | null;
  isImportant: boolean;
  restockThreshold: number;
  expiryConfirmed: boolean;
  needsReview: boolean;
  updatedAt: number;
}

export interface FirestoreShoppingList {
  name: string;
  isCompleted: boolean;
  createdDate: number;
  userId: string;
  isCheckedOut: boolean;
  checkoutDate: number | null;
  storeId: string | null;
  totalPrice: number | null;
  updatedAt: number;
}

export interface FirestoreListItem {
  itemName: string;
  quantity: number;
  unitId: string;
  categoryId: string;
  isPurchased: boolean;
  barcode: string | null;
  brand: string | null;
  price: number | null;
  weight: number | null;
  weightUnit: string | null;
  imageUrl: string | null;
  notes: string | null;
  updatedAt: number;
}

export interface FirestoreAnalyticsEvent {
  eventType: string;
  eventData: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Firestore batch limit. */
const BATCH_LIMIT = 500;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class FirestoreService {
  // -------------------------------------------------------------------------
  // Inventory sync
  // -------------------------------------------------------------------------

  /**
   * Push local inventory items to the user's Firestore subcollection.
   * Handles Firestore's 500-operation batch limit automatically.
   * Uses last-write-wins conflict resolution via updatedAt.
   */
  async syncInventoryItems(userId: string, items: InventoryItem[]): Promise<void> {
    if (items.length === 0) return;

    const colRef = inventoryColRef(userId);
    const chunks = chunkArray(items, BATCH_LIMIT);

    for (const chunk of chunks) {
      const batch = firestore().batch();

      for (const item of chunk) {
        const docRef = colRef.doc(item.id);
        const data: FirestoreInventoryItem = {
          name: item.name,
          barcode: item.barcode,
          brand: item.brand,
          categoryId: item.categoryId,
          quantity: item.quantity,
          unitId: item.unitId,
          price: item.price,
          purchaseDate: item.purchaseDate?.getTime() ?? null,
          expiryDate: item.expiryDate?.getTime() ?? null,
          location: item.location,
          notes: item.notes,
          imageUrl: item.imageUrl,
          status: item.status,
          consumedDate: item.consumedDate?.getTime() ?? null,
          reason: item.reason,
          quantityRemaining: item.quantityRemaining,
          isImportant: item.isImportant,
          restockThreshold: item.restockThreshold,
          expiryConfirmed: item.expiryConfirmed,
          needsReview: item.needsReview,
          updatedAt: Date.now(),
        };

        batch.set(docRef, data, {merge: true});
      }

      await batch.commit();
    }
  }

  /**
   * Fetch all inventory items from the user's Firestore subcollection.
   * Returns typed documents with their Firestore IDs.
   */
  async fetchInventoryItems(
    userId: string,
  ): Promise<Array<FirestoreInventoryItem & {id: string}>> {
    const snapshot = await inventoryColRef(userId).get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as FirestoreInventoryItem),
    }));
  }

  // -------------------------------------------------------------------------
  // Shopping list sync
  // -------------------------------------------------------------------------

  /**
   * Push local shopping lists (with nested items) to Firestore.
   * Each list becomes a document in shopping_lists/, and its items
   * become documents in shopping_lists/{listId}/items/.
   */
  async syncShoppingLists(
    userId: string,
    lists: ShoppingList[],
    listItemsByListId: Record<string, ListItem[]>,
  ): Promise<void> {
    if (lists.length === 0) return;

    for (const list of lists) {
      const items = listItemsByListId[list.id] ?? [];
      const ops = 1 + items.length;

      if (ops <= BATCH_LIMIT) {
        const batch = firestore().batch();

        const listRef = shoppingListsColRef(userId).doc(list.id);
        const listData: FirestoreShoppingList = {
          name: list.name,
          isCompleted: list.isCompleted,
          createdDate: list.createdDate.getTime(),
          userId: list.userId,
          isCheckedOut: list.isCheckedOut ?? false,
          checkoutDate: list.checkoutDate?.getTime() ?? null,
          storeId: list.storeId ?? null,
          totalPrice: list.totalPrice ?? null,
          updatedAt: Date.now(),
        };
        batch.set(listRef, listData, {merge: true});

        for (const item of items) {
          const itemRef = listItemsColRef(userId, list.id).doc(item.id);
          const itemData: FirestoreListItem = {
            itemName: item.itemName,
            quantity: item.quantity,
            unitId: item.unitId,
            categoryId: item.categoryId,
            isPurchased: item.isPurchased,
            barcode: item.barcode ?? null,
            brand: item.brand ?? null,
            price: item.price ?? null,
            weight: item.weight ?? null,
            weightUnit: item.weightUnit ?? null,
            imageUrl: item.imageUrl ?? null,
            notes: item.notes ?? null,
            updatedAt: Date.now(),
          };
          batch.set(itemRef, itemData, {merge: true});
        }

        await batch.commit();
      } else {
        // Write list doc separately, then batch items in chunks
        const listRef = shoppingListsColRef(userId).doc(list.id);
        await listRef.set(
          {
            name: list.name,
            isCompleted: list.isCompleted,
            createdDate: list.createdDate.getTime(),
            userId: list.userId,
            isCheckedOut: list.isCheckedOut ?? false,
            checkoutDate: list.checkoutDate?.getTime() ?? null,
            storeId: list.storeId ?? null,
            totalPrice: list.totalPrice ?? null,
            updatedAt: Date.now(),
          } satisfies FirestoreShoppingList,
          {merge: true},
        );

        const itemChunks = chunkArray(items, BATCH_LIMIT);
        for (const chunk of itemChunks) {
          const batch = firestore().batch();
          for (const item of chunk) {
            const itemRef = listItemsColRef(userId, list.id).doc(item.id);
            batch.set(
              itemRef,
              {
                itemName: item.itemName,
                quantity: item.quantity,
                unitId: item.unitId,
                categoryId: item.categoryId,
                isPurchased: item.isPurchased,
                barcode: item.barcode ?? null,
                brand: item.brand ?? null,
                price: item.price ?? null,
                weight: item.weight ?? null,
                weightUnit: item.weightUnit ?? null,
                imageUrl: item.imageUrl ?? null,
                notes: item.notes ?? null,
                updatedAt: Date.now(),
              } satisfies FirestoreListItem,
              {merge: true},
            );
          }
          await batch.commit();
        }
      }
    }
  }

  /**
   * Fetch all shopping lists with their nested items from Firestore.
   */
  async fetchShoppingLists(userId: string): Promise<
    Array<{
      list: FirestoreShoppingList & {id: string};
      items: Array<FirestoreListItem & {id: string}>;
    }>
  > {
    const listsSnapshot = await shoppingListsColRef(userId).get();

    const results: Array<{
      list: FirestoreShoppingList & {id: string};
      items: Array<FirestoreListItem & {id: string}>;
    }> = [];

    for (const listDoc of listsSnapshot.docs) {
      const listData = listDoc.data() as FirestoreShoppingList;

      const itemsSnapshot = await listItemsColRef(userId, listDoc.id).get();
      const items = itemsSnapshot.docs.map(itemDoc => ({
        id: itemDoc.id,
        ...(itemDoc.data() as FirestoreListItem),
      }));

      results.push({
        list: {id: listDoc.id, ...listData},
        items,
      });
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // User profile & preferences
  // -------------------------------------------------------------------------

  /** Save or update user profile data. */
  async saveUserProfile(
    userId: string,
    data: {
      email: string;
      displayName?: string | null;
      tier?: string;
    },
  ): Promise<void> {
    const now = Date.now();
    const existing = await this.getUserProfile(userId);

    await userDocRef(userId).set(
      {
        email: data.email,
        displayName: data.displayName ?? null,
        tier: data.tier ?? 'free',
        ...(existing ? {} : {createdAt: now}),
        updatedAt: now,
      },
      {merge: true},
    );
  }

  /** Get user profile (includes subscription tier). */
  async getUserProfile(userId: string): Promise<FirestoreUserProfile | null> {
    const doc = await userDocRef(userId).get();
    return doc.exists ? (doc.data() as FirestoreUserProfile) : null;
  }

  /** Save user preferences (merge into profile document). */
  async saveUserPreferences(
    userId: string,
    prefs: Partial<FirestoreUserPreferences>,
  ): Promise<void> {
    await userDocRef(userId).set(
      {
        preferences: prefs,
        updatedAt: Date.now(),
      },
      {merge: true},
    );
  }

  /** Fetch user preferences. Returns defaults if not set. */
  async fetchUserPreferences(userId: string): Promise<FirestoreUserPreferences> {
    const profile = await this.getUserProfile(userId);
    return profile?.preferences ?? DEFAULT_PREFERENCES;
  }

  // -------------------------------------------------------------------------
  // Analytics
  // -------------------------------------------------------------------------

  /** Push analytics events to Firestore. */
  async pushAnalytics(
    userId: string,
    events: Array<FirestoreAnalyticsEvent>,
  ): Promise<void> {
    if (events.length === 0) return;

    const colRef = analyticsColRef(userId);
    const chunks = chunkArray(events, BATCH_LIMIT);

    for (const chunk of chunks) {
      const batch = firestore().batch();
      for (const event of chunk) {
        const ref = colRef.doc();
        batch.set(ref, event);
      }
      await batch.commit();
    }
  }

  // -------------------------------------------------------------------------
  // Conflict resolution
  // -------------------------------------------------------------------------

  /**
   * Merge a remote item with a local item using last-write-wins.
   * Returns the winning version based on updatedAt timestamps.
   */
  mergeWithConflictResolution<T extends {updatedAt: number}>(
    local: T,
    remote: T,
  ): {winner: 'local' | 'remote'; data: T} {
    if (local.updatedAt >= remote.updatedAt) {
      return {winner: 'local', data: local};
    }
    return {winner: 'remote', data: remote};
  }

  /**
   * Perform a full bidirectional sync for inventory items.
   * Pushes local changes, pulls remote changes, resolves conflicts
   * using last-write-wins based on updatedAt timestamps.
   */
  async reconcileInventoryItems(
    userId: string,
    localItems: InventoryItem[],
  ): Promise<{
    toUpdateLocally: Array<FirestoreInventoryItem & {id: string}>;
    pushedCount: number;
  }> {
    // 1. Fetch remote state
    const remoteItems = await this.fetchInventoryItems(userId);
    const remoteMap = new Map(remoteItems.map(r => [r.id, r]));

    // 2. Determine which local items to push (local is newer or not on remote)
    const toPush: InventoryItem[] = [];
    for (const local of localItems) {
      const remote = remoteMap.get(local.id);
      if (!remote) {
        toPush.push(local);
      } else {
        const localUpdatedAt = local.updatedAt?.getTime() ?? 0;
        if (localUpdatedAt >= remote.updatedAt) {
          toPush.push(local);
        }
      }
    }

    // 3. Push winning local items
    if (toPush.length > 0) {
      await this.syncInventoryItems(userId, toPush);
    }

    // 4. Determine which remote items are newer than local
    const localIdSet = new Set(localItems.map(i => i.id));
    const toUpdateLocally = remoteItems.filter(remote => {
      if (!localIdSet.has(remote.id)) return true;
      const local = localItems.find(l => l.id === remote.id);
      if (!local) return true;
      const localUpdatedAt = local.updatedAt?.getTime() ?? 0;
      return remote.updatedAt > localUpdatedAt;
    });

    return {toUpdateLocally, pushedCount: toPush.length};
  }

  // -------------------------------------------------------------------------
  // Foodbanks (global, read-only from mobile)
  // -------------------------------------------------------------------------

  /**
   * Fetch all foodbanks from the global Firestore collection.
   * Optionally filter by country code.
   */
  async fetchFoodbanks(
    country?: string,
  ): Promise<Array<FirestoreFoodbank & {id: string}>> {
    let query: FirebaseFirestoreTypes.Query = foodbanksColRef();
    if (country) {
      query = query.where('country', '==', country.toUpperCase());
    }
    query = query.where('is_active', '==', true);

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as FirestoreFoodbank),
    }));
  }

  // -------------------------------------------------------------------------
  // Data deletion (GDPR)
  // -------------------------------------------------------------------------

  /**
   * Delete all Firestore data for a user.
   * Should be called before AuthService.deleteAccount().
   */
  // ---------------------------------------------------------------------------
  // Price Records
  // ---------------------------------------------------------------------------

  /** Push a price record to Firestore. Firestore SDK handles offline queueing. */
  async pushPriceRecord(
    userId: string,
    data: {
      barcode: string;
      productName: string;
      price: number;
      currency: string;
      storeName: string;
      locationAddress: string | null;
      latitude: number | null;
      longitude: number | null;
    },
  ): Promise<void> {
    try {
      await priceRecordsColRef(userId).add({
        barcode: data.barcode,
        product_name: data.productName,
        price: data.price,
        currency: data.currency,
        store_name: data.storeName,
        location_address: data.locationAddress,
        latitude: data.latitude,
        longitude: data.longitude,
        created_at: Date.now(),
      });
    } catch (error) {
      console.warn('[FirestoreService] pushPriceRecord failed:', error);
      // Non-critical — local record is the source of truth
    }
  }

  // ---------------------------------------------------------------------------
  // GDPR
  // ---------------------------------------------------------------------------

  async deleteUserData(userId: string): Promise<void> {
    // Delete inventory items
    await deleteSubcollection(inventoryColRef(userId));

    // Delete shopping lists and their nested items
    const listsSnapshot = await shoppingListsColRef(userId).get();
    for (const listDoc of listsSnapshot.docs) {
      await deleteSubcollection(listItemsColRef(userId, listDoc.id));
    }
    await deleteSubcollection(shoppingListsColRef(userId));

    // Delete analytics
    await deleteSubcollection(analyticsColRef(userId));

    // Delete user profile document
    await userDocRef(userId).delete();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_PREFERENCES: FirestoreUserPreferences = {
  defaultLocation: 'fridge',
  expiryWarningDays: 3,
  darkMode: false,
  notificationsEnabled: true,
};

/** Split an array into chunks of the given size. */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Delete all documents in a Firestore collection/subcollection.
 * Processes in batches to respect Firestore limits.
 */
async function deleteSubcollection(
  colRef: FirebaseFirestoreTypes.CollectionReference,
): Promise<void> {
  const snapshot = await colRef.get();
  if (snapshot.empty) return;

  const chunks = chunkArray(snapshot.docs, BATCH_LIMIT);
  for (const chunk of chunks) {
    const batch = firestore().batch();
    for (const doc of chunk) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }
}

export default new FirestoreService();
