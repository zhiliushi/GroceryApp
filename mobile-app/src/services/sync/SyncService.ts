import NetInfo from '@react-native-community/netinfo';
import BackgroundFetch from 'react-native-background-fetch';
import FirestoreService from '../firebase/FirestoreService';
import AnalyticsServiceFirebase from '../firebase/AnalyticsService';
import {InventoryRepository} from '../../database/repositories/InventoryRepository';
import {ShoppingListRepository} from '../../database/repositories/ShoppingListRepository';
import {AnalyticsRepository} from '../../database/repositories/AnalyticsRepository';
import type {Database} from '@nozbe/watermelondb';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Background fetch interval: 6 hours in minutes. */
const BG_FETCH_INTERVAL_MIN = 6 * 60;

/** Max analytics events per sync batch. */
const ANALYTICS_BATCH_SIZE = 100;

/** Max retry attempts for a failed sync. */
const MAX_RETRIES = 3;

/** Base delay between retries (ms). Exponential: 2s, 4s, 8s. */
const RETRY_BASE_DELAY_MS = 2000;

/** Age threshold for purging old synced analytics (days). */
const ANALYTICS_PURGE_DAYS = 30;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface SyncResult {
  status: SyncStatus;
  inventoryPushed: number;
  listsPushed: number;
  eventsPushed: number;
  eventsPurged: number;
  errors: string[];
  timestamp: number;
}

type SyncListener = (result: SyncResult) => void;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class SyncService {
  private inventoryRepo!: InventoryRepository;
  private shoppingListRepo!: ShoppingListRepository;
  private analyticsRepo!: AnalyticsRepository;
  private initialized = false;
  private listeners: SyncListener[] = [];

  /** Call once on app start after the database is ready. */
  init(database: Database): void {
    if (this.initialized) return;
    this.inventoryRepo = new InventoryRepository(database);
    this.shoppingListRepo = new ShoppingListRepository(database);
    this.analyticsRepo = new AnalyticsRepository(database);
    this.initialized = true;
  }

  // ---------------------------------------------------------------------------
  // Listeners (for UI status updates)
  // ---------------------------------------------------------------------------

  /** Subscribe to sync results. Returns an unsubscribe function. */
  addListener(listener: SyncListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(result: SyncResult): void {
    for (const listener of this.listeners) {
      try {
        listener(result);
      } catch {
        // Swallow listener errors
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Preflight checks
  // ---------------------------------------------------------------------------

  /** Check if sync conditions are met (online, not low battery). */
  async canSync(): Promise<{ok: boolean; reason?: string}> {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      return {ok: false, reason: 'No internet connection'};
    }
    // Note: battery check would require react-native-device-info.
    // For now we just check connectivity. Battery/doze checks can be
    // added when that dependency is available.
    return {ok: true};
  }

  // ---------------------------------------------------------------------------
  // Background fetch
  // ---------------------------------------------------------------------------

  /** Register a periodic background task for sync. */
  async configureBackgroundFetch(userId?: string): Promise<void> {
    try {
      await BackgroundFetch.configure(
        {
          minimumFetchInterval: BG_FETCH_INTERVAL_MIN,
          stopOnTerminate: false,
          startOnBoot: true,
          enableHeadless: true,
          requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
        },
        async taskId => {
          console.log('[Sync] background task started:', taskId);
          try {
            await this.sync(userId);
          } catch (e) {
            console.error('[Sync] background task error:', e);
          }
          BackgroundFetch.finish(taskId);
        },
        async taskId => {
          console.warn('[Sync] background task timeout:', taskId);
          BackgroundFetch.finish(taskId);
        },
      );
      console.log('[Sync] background fetch configured (every 6h)');
    } catch (e) {
      console.error('[Sync] failed to configure background fetch:', e);
    }
  }

  // ---------------------------------------------------------------------------
  // Core sync orchestrator
  // ---------------------------------------------------------------------------

  /**
   * Run a full sync cycle: analytics → inventory → shopping lists → purge.
   * Analytics sync runs for all users. Inventory + lists sync only for paid.
   */
  async sync(userId?: string, isPaid = false): Promise<SyncResult> {
    if (!this.initialized) {
      const result: SyncResult = {
        status: 'error',
        inventoryPushed: 0,
        listsPushed: 0,
        eventsPushed: 0,
        eventsPurged: 0,
        errors: ['SyncService not initialized'],
        timestamp: Date.now(),
      };
      this.notifyListeners(result);
      return result;
    }

    if (!userId) {
      const result: SyncResult = {
        status: 'idle',
        inventoryPushed: 0,
        listsPushed: 0,
        eventsPushed: 0,
        eventsPurged: 0,
        errors: [],
        timestamp: Date.now(),
      };
      return result;
    }

    // Preflight
    const check = await this.canSync();
    if (!check.ok) {
      const result: SyncResult = {
        status: 'error',
        inventoryPushed: 0,
        listsPushed: 0,
        eventsPushed: 0,
        eventsPurged: 0,
        errors: [check.reason ?? 'Cannot sync'],
        timestamp: Date.now(),
      };
      this.notifyListeners(result);
      return result;
    }

    // Notify: syncing
    const syncingResult: SyncResult = {
      status: 'syncing',
      inventoryPushed: 0,
      listsPushed: 0,
      eventsPushed: 0,
      eventsPurged: 0,
      errors: [],
      timestamp: Date.now(),
    };
    this.notifyListeners(syncingResult);

    const errors: string[] = [];
    let inventoryPushed = 0;
    let listsPushed = 0;
    let eventsPushed = 0;
    let eventsPurged = 0;

    // 1. Sync analytics events (all users — batched)
    try {
      eventsPushed = await this.syncAnalyticsEvents(userId);
    } catch (e: any) {
      errors.push(`Analytics sync failed: ${e.message ?? e}`);
    }

    // 2. Sync inventory items (paid only)
    if (isPaid) {
      try {
        inventoryPushed = await this.syncInventoryItems(userId);
      } catch (e: any) {
        errors.push(`Inventory sync failed: ${e.message ?? e}`);
      }
    }

    // 3. Sync shopping lists (paid only)
    if (isPaid) {
      try {
        listsPushed = await this.syncShoppingLists(userId);
      } catch (e: any) {
        errors.push(`Shopping list sync failed: ${e.message ?? e}`);
      }
    }

    // 4. Purge old synced analytics
    try {
      eventsPurged = await this.purgeOldAnalytics();
    } catch (e: any) {
      errors.push(`Analytics purge failed: ${e.message ?? e}`);
    }

    // 5. Log sync event
    const totalPushed = inventoryPushed + listsPushed + eventsPushed;
    try {
      await AnalyticsServiceFirebase.logSyncCompleted(totalPushed);
    } catch {
      // Non-critical
    }

    const finalResult: SyncResult = {
      status: errors.length > 0 ? 'error' : 'success',
      inventoryPushed,
      listsPushed,
      eventsPushed,
      eventsPurged,
      errors,
      timestamp: Date.now(),
    };
    this.notifyListeners(finalResult);
    return finalResult;
  }

  // ---------------------------------------------------------------------------
  // Individual sync functions
  // ---------------------------------------------------------------------------

  /** Sync unsynced analytics events in batches of 100. */
  async syncAnalyticsEvents(userId: string): Promise<number> {
    const unsynced = await this.analyticsRepo.getUnsyncedEvents();
    if (unsynced.length === 0) return 0;

    let totalSynced = 0;

    // Process in batches of ANALYTICS_BATCH_SIZE
    for (let i = 0; i < unsynced.length; i += ANALYTICS_BATCH_SIZE) {
      const batch = unsynced.slice(i, i + ANALYTICS_BATCH_SIZE);

      const firestoreBatch = batch.map(e => ({
        eventType: e.eventType,
        eventData: e.eventData,
        timestamp: e.timestamp.getTime(),
      }));

      await this.withRetry(
        () => FirestoreService.pushAnalytics(userId, firestoreBatch),
        'analytics batch',
      );

      // Mark as synced after successful upload
      await this.analyticsRepo.markSynced(batch);
      totalSynced += batch.length;
    }

    return totalSynced;
  }

  /** Sync unsynced inventory items to Firestore. */
  async syncInventoryItems(userId: string): Promise<number> {
    const unsyncedItems = await this.inventoryRepo.getUnsynced();
    if (unsyncedItems.length === 0) return 0;

    await this.withRetry(
      () => FirestoreService.syncInventoryItems(userId, unsyncedItems),
      'inventory sync',
    );

    // Mark all as synced
    await this.inventoryRepo.markSyncedBatch(unsyncedItems);
    return unsyncedItems.length;
  }

  /** Sync all shopping lists with their items to Firestore. */
  async syncShoppingLists(userId: string): Promise<number> {
    const allLists = await this.shoppingListRepo.getAllIncludingCompleted();
    if (allLists.length === 0) return 0;

    // Fetch items for each list
    const listItemsByListId: Record<string, any[]> = {};
    for (const list of allLists) {
      listItemsByListId[list.id] = await this.shoppingListRepo.getListItems(
        list.id,
      );
    }

    await this.withRetry(
      () =>
        FirestoreService.syncShoppingLists(userId, allLists, listItemsByListId),
      'shopping lists sync',
    );

    return allLists.length;
  }

  /** Purge analytics events older than 30 days that are already synced. */
  async purgeOldAnalytics(): Promise<number> {
    // Get count before purge for return value
    const before = await this.analyticsRepo.totalCount();
    await this.analyticsRepo.purgeOlderThan(ANALYTICS_PURGE_DAYS);
    const after = await this.analyticsRepo.totalCount();
    return Math.max(0, before - after);
  }

  // ---------------------------------------------------------------------------
  // Conflict resolution
  // ---------------------------------------------------------------------------

  /**
   * Perform bidirectional inventory sync with conflict resolution.
   * Uses FirestoreService.reconcileInventoryItems under the hood.
   * Returns items that need local DB updates (remote was newer).
   */
  async reconcileInventory(userId: string) {
    const localItems = await this.inventoryRepo.getAll();
    return FirestoreService.reconcileInventoryItems(userId, localItems);
  }

  // ---------------------------------------------------------------------------
  // Retry logic
  // ---------------------------------------------------------------------------

  /** Execute an async operation with exponential backoff retry. */
  private async withRetry<T>(
    operation: () => Promise<T>,
    label: string,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (e: any) {
        lastError = e;
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[Sync] ${label} attempt ${attempt + 1}/${MAX_RETRIES} failed, retrying in ${delay}ms:`,
          e.message ?? e,
        );

        // Check if still online before retrying
        const net = await NetInfo.fetch();
        if (!net.isConnected) {
          throw new Error(`${label}: lost connection during retry`);
        }

        await sleep(delay);
      }
    }

    throw lastError ?? new Error(`${label}: all retries exhausted`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default new SyncService();
