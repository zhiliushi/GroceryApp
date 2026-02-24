import {useMemo} from 'react';
import {Database} from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import {grocerySchema} from '../database/schema';
import migrations from '../database/migrations/migration_v1';
import Category from '../database/models/Category';
import Unit from '../database/models/Unit';
import ScannedItem from '../database/models/ScannedItem';
import InventoryItem from '../database/models/InventoryItem';
import ShoppingList from '../database/models/ShoppingList';
import ListItem from '../database/models/ListItem';
import AnalyticsEvent from '../database/models/AnalyticsEvent';
import Store from '../database/models/Store';
import CartItem from '../database/models/CartItem';
import PriceHistory from '../database/models/PriceHistory';
import Foodbank from '../database/models/Foodbank';
import {CategoryRepository} from '../database/repositories/CategoryRepository';
import {UnitRepository} from '../database/repositories/UnitRepository';
import {ScannedItemRepository} from '../database/repositories/ScannedItemRepository';
import {InventoryRepository} from '../database/repositories/InventoryRepository';
import {ShoppingListRepository} from '../database/repositories/ShoppingListRepository';
import {AnalyticsRepository} from '../database/repositories/AnalyticsRepository';
import {StoreRepository} from '../database/repositories/StoreRepository';
import {CartRepository} from '../database/repositories/CartRepository';
import {PriceHistoryRepository} from '../database/repositories/PriceHistoryRepository';
import {FoodbankRepository} from '../database/repositories/FoodbankRepository';
import {seedDatabase} from '../database/seed';
import {DB_NAME} from '../config/constants';

let _database: Database | null = null;
let _initialized = false;

/** Lazily create and return the singleton Database instance. */
function getDatabase(): Database {
  if (!_database) {
    const adapter = new SQLiteAdapter({
      schema: grocerySchema,
      migrations,
      dbName: DB_NAME,
      jsi: true,
      onSetUpError: error => {
        console.error('[DB] setup error:', error);
      },
    });

    _database = new Database({
      adapter,
      modelClasses: [
        Category,
        Unit,
        ScannedItem,
        InventoryItem,
        ShoppingList,
        ListItem,
        AnalyticsEvent,
        Store,
        CartItem,
        PriceHistory,
        Foodbank,
      ],
    });
  }
  return _database;
}

/**
 * Run one-time initialization: seed default data and clean up expired items.
 * Safe to call multiple times — only runs once.
 */
async function initDatabase(database: Database): Promise<void> {
  if (_initialized) return;
  _initialized = true;

  try {
    // Seed default categories and units
    await seedDatabase(database);

    // TTL cleanup: delete expired scanned items
    const scanRepo = new ScannedItemRepository(database);
    const deletedScans = await scanRepo.deleteExpired();
    if (deletedScans > 0) {
      console.log(`[DB] Cleaned up ${deletedScans} expired scanned items`);
    }

    // TTL cleanup: delete expired cart items
    const cartRepo = new CartRepository(database);
    const deletedCart = await cartRepo.deleteExpired();
    if (deletedCart > 0) {
      console.log(`[DB] Cleaned up ${deletedCart} expired cart items`);
    }
  } catch (error) {
    console.error('[DB] initialization error:', error);
    _initialized = false; // Allow retry on next call
  }
}

/**
 * Returns the database instance and all repository singletons.
 * Safe to call from any component — the database is created once.
 */
export function useDatabase() {
  const database = getDatabase();

  // Trigger async initialization (seed + cleanup) on first use
  useMemo(() => {
    initDatabase(database);
  }, [database]);

  const repos = useMemo(
    () => ({
      category: new CategoryRepository(database),
      unit: new UnitRepository(database),
      scannedItem: new ScannedItemRepository(database),
      inventory: new InventoryRepository(database),
      shoppingList: new ShoppingListRepository(database),
      analytics: new AnalyticsRepository(database),
      store: new StoreRepository(database),
      cart: new CartRepository(database),
      priceHistory: new PriceHistoryRepository(database),
      foodbank: new FoodbankRepository(database),
    }),
    [database],
  );

  return {database, ...repos};
}

/** Access the raw database outside of React (e.g. in services). */
export {getDatabase, initDatabase};
