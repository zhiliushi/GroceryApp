import {Database, Q} from '@nozbe/watermelondb';
import Foodbank from '../models/Foodbank';

/**
 * Repository for the foodbanks table.
 * Read-only on the mobile side — data is pushed from the backend via Firestore.
 */
export class FoodbankRepository {
  private collection;

  constructor(private database: Database) {
    this.collection = database.get<Foodbank>('foodbanks');
  }

  // ---------------------------------------------------------------------------
  // Read operations
  // ---------------------------------------------------------------------------

  /** Get all active foodbanks, sorted by name. */
  async getAll(): Promise<Foodbank[]> {
    return this.collection
      .query(Q.where('is_active', true), Q.sortBy('name', Q.asc))
      .fetch();
  }

  /** Get foodbanks for a specific country (ISO code). */
  async getByCountry(country: string): Promise<Foodbank[]> {
    return this.collection
      .query(
        Q.where('country', country.toUpperCase()),
        Q.where('is_active', true),
        Q.sortBy('name', Q.asc),
      )
      .fetch();
  }

  /** Get a single foodbank by ID. */
  async getById(id: string): Promise<Foodbank> {
    return this.collection.find(id);
  }

  /** Count all active foodbanks. */
  async count(): Promise<number> {
    return this.collection
      .query(Q.where('is_active', true))
      .fetchCount();
  }

  /** Count foodbanks for a country. */
  async countByCountry(country: string): Promise<number> {
    return this.collection
      .query(
        Q.where('country', country.toUpperCase()),
        Q.where('is_active', true),
      )
      .fetchCount();
  }

  // ---------------------------------------------------------------------------
  // Reactive observers
  // ---------------------------------------------------------------------------

  /** Observe all active foodbanks. */
  observeAll() {
    return this.collection
      .query(Q.where('is_active', true), Q.sortBy('name', Q.asc))
      .observe();
  }

  /** Observe foodbanks for a country. */
  observeByCountry(country: string) {
    return this.collection
      .query(
        Q.where('country', country.toUpperCase()),
        Q.where('is_active', true),
        Q.sortBy('name', Q.asc),
      )
      .observe();
  }

  // ---------------------------------------------------------------------------
  // Sync (upsert from Firestore)
  // ---------------------------------------------------------------------------

  /**
   * Bulk upsert foodbanks from Firestore data.
   * Uses the Firestore document ID as the WatermelonDB record ID.
   */
  async upsertFromFirestore(
    data: Array<{
      id: string;
      name: string;
      description?: string | null;
      country: string;
      state?: string | null;
      locationName?: string | null;
      locationAddress?: string | null;
      locationLink?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      sourceUrl?: string | null;
      sourceName?: string | null;
      isActive: boolean;
    }>,
  ): Promise<void> {
    if (data.length === 0) return;

    await this.database.write(async () => {
      const batch: Foodbank[] = [];

      for (const item of data) {
        let existing: Foodbank | null = null;
        try {
          existing = await this.collection.find(item.id);
        } catch {
          // not found — will create
        }

        if (existing) {
          batch.push(
            existing.prepareUpdate(record => {
              record.name = item.name;
              record.description = item.description ?? null;
              record.country = item.country;
              record.state = item.state ?? null;
              record.locationName = item.locationName ?? null;
              record.locationAddress = item.locationAddress ?? null;
              record.locationLink = item.locationLink ?? null;
              record.latitude = item.latitude ?? null;
              record.longitude = item.longitude ?? null;
              record.sourceUrl = item.sourceUrl ?? null;
              record.sourceName = item.sourceName ?? null;
              record.isActive = item.isActive;
            }),
          );
        } else {
          batch.push(
            this.collection.prepareCreateFromDirtyRaw({
              id: item.id,
              name: item.name,
              description: item.description ?? null,
              country: item.country,
              state: item.state ?? null,
              location_name: item.locationName ?? null,
              location_address: item.locationAddress ?? null,
              location_link: item.locationLink ?? null,
              latitude: item.latitude ?? null,
              longitude: item.longitude ?? null,
              source_url: item.sourceUrl ?? null,
              source_name: item.sourceName ?? null,
              is_active: item.isActive,
            }),
          );
        }
      }

      await this.database.batch(...batch);
    });
  }
}
