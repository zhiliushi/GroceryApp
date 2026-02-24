import {Database, Q} from '@nozbe/watermelondb';
import Store from '../models/Store';

/**
 * Repository for stores table.
 * Manages store/location data for price tracking.
 */
export class StoreRepository {
  private collection;

  constructor(private database: Database) {
    this.collection = database.get<Store>('stores');
  }

  // ---------------------------------------------------------------------------
  // Read operations
  // ---------------------------------------------------------------------------

  /** Get all stores, sorted by name. */
  async getAll(): Promise<Store[]> {
    return this.collection.query(Q.sortBy('name', Q.asc)).fetch();
  }

  /** Get stores for a specific user. */
  async getByUserId(userId: string): Promise<Store[]> {
    return this.collection
      .query(Q.where('user_id', userId), Q.sortBy('name', Q.asc))
      .fetch();
  }

  /** Find a store by ID. */
  async getById(id: string): Promise<Store> {
    return this.collection.find(id);
  }

  /** Find a store by name (case-insensitive search). */
  async findByName(name: string, userId: string): Promise<Store | null> {
    const stores = await this.collection
      .query(
        Q.where('user_id', userId),
        Q.where('name', Q.like(`${Q.sanitizeLikeString(name)}`)),
      )
      .fetch();
    return stores.length > 0 ? stores[0] : null;
  }

  /** Search stores by name. */
  async search(query: string, userId: string): Promise<Store[]> {
    const q = Q.sanitizeLikeString(query);
    return this.collection
      .query(
        Q.where('user_id', userId),
        Q.where('name', Q.like(`%${q}%`)),
        Q.sortBy('name', Q.asc),
      )
      .fetch();
  }

  /** Get stores with location data. */
  async getWithLocation(userId: string): Promise<Store[]> {
    return this.collection
      .query(
        Q.where('user_id', userId),
        Q.where('latitude', Q.notEq(null)),
        Q.where('longitude', Q.notEq(null)),
      )
      .fetch();
  }

  /** Count of all stores for a user. */
  async count(userId: string): Promise<number> {
    return this.collection
      .query(Q.where('user_id', userId))
      .fetchCount();
  }

  // ---------------------------------------------------------------------------
  // Reactive observers
  // ---------------------------------------------------------------------------

  /** Observe all stores for a user. */
  observeAll(userId: string) {
    return this.collection
      .query(Q.where('user_id', userId), Q.sortBy('name', Q.asc))
      .observe();
  }

  // ---------------------------------------------------------------------------
  // Write operations
  // ---------------------------------------------------------------------------

  /** Create a new store. */
  async create(data: {
    name: string;
    userId: string;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  }): Promise<Store> {
    const errors = Store.validate({name: data.name, userId: data.userId});
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    return this.database.write(async () => {
      return this.collection.create(record => {
        record.name = data.name.trim();
        record.userId = data.userId;
        record.address = data.address?.trim() ?? null;
        record.latitude = data.latitude ?? null;
        record.longitude = data.longitude ?? null;
      });
    });
  }

  /** Update a store. */
  async update(
    store: Store,
    data: {
      name?: string;
      address?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    },
  ): Promise<void> {
    await this.database.write(async () => {
      await store.update(record => {
        if (data.name !== undefined) record.name = data.name.trim();
        if (data.address !== undefined) record.address = data.address?.trim() ?? null;
        if (data.latitude !== undefined) record.latitude = data.latitude;
        if (data.longitude !== undefined) record.longitude = data.longitude;
      });
    });
  }

  /** Delete a store permanently. */
  async delete(store: Store): Promise<void> {
    await this.database.write(async () => {
      await store.destroyPermanently();
    });
  }

  /** Get or create a store by name. */
  async getOrCreate(name: string, userId: string): Promise<Store> {
    const existing = await this.findByName(name, userId);
    if (existing) return existing;
    return this.create({name, userId});
  }
}
