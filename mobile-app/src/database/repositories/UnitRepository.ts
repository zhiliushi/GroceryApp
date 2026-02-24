import {Database, Q} from '@nozbe/watermelondb';
import Unit from '../models/Unit';
import type {UnitType} from '../models/Unit';

export class UnitRepository {
  private collection;

  constructor(private database: Database) {
    this.collection = database.get<Unit>('units');
  }

  // ---------------------------------------------------------------------------
  // Read operations
  // ---------------------------------------------------------------------------

  /** Get all units, sorted by name. */
  async getAll(): Promise<Unit[]> {
    return this.collection
      .query(Q.sortBy('name', Q.asc))
      .fetch();
  }

  /** Get units filtered by measurement type (weight, volume, count). */
  async getByType(unitType: UnitType): Promise<Unit[]> {
    return this.collection
      .query(
        Q.where('unit_type', unitType),
        Q.sortBy('name', Q.asc),
      )
      .fetch();
  }

  /** Find a single unit by ID. */
  async getById(id: string): Promise<Unit> {
    return this.collection.find(id);
  }

  /** Find a unit by its abbreviation (e.g. "kg", "ml"). */
  async getByAbbreviation(abbreviation: string): Promise<Unit | null> {
    const results = await this.collection
      .query(Q.where('abbreviation', abbreviation))
      .fetch();
    return results[0] ?? null;
  }

  /** Total unit count. */
  async count(): Promise<number> {
    return this.collection.query().fetchCount();
  }

  // ---------------------------------------------------------------------------
  // Reactive observers
  // ---------------------------------------------------------------------------

  /** Observe all units reactively, sorted by name. */
  observeAll() {
    return this.collection
      .query(Q.sortBy('name', Q.asc))
      .observe();
  }

  /** Observe units of a specific type reactively. */
  observeByType(unitType: UnitType) {
    return this.collection
      .query(
        Q.where('unit_type', unitType),
        Q.sortBy('name', Q.asc),
      )
      .observe();
  }
}
