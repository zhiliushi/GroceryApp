import {Database, Q} from '@nozbe/watermelondb';
import Category from '../models/Category';

export class CategoryRepository {
  private collection;

  constructor(private database: Database) {
    this.collection = database.get<Category>('categories');
  }

  // ---------------------------------------------------------------------------
  // Read operations
  // ---------------------------------------------------------------------------

  /** Get all categories ordered by sort_order. */
  async getAll(): Promise<Category[]> {
    return this.collection
      .query(Q.sortBy('sort_order', Q.asc))
      .fetch();
  }

  /** Get only default (seeded) categories. */
  async getDefaults(): Promise<Category[]> {
    return this.collection
      .query(
        Q.where('is_default', true),
        Q.sortBy('sort_order', Q.asc),
      )
      .fetch();
  }

  /** Find a single category by ID. */
  async getById(id: string): Promise<Category> {
    return this.collection.find(id);
  }

  /** Find a category by exact name match. */
  async getByName(name: string): Promise<Category | null> {
    const results = await this.collection
      .query(Q.where('name', name))
      .fetch();
    return results[0] ?? null;
  }

  /** Total category count. */
  async count(): Promise<number> {
    return this.collection.query().fetchCount();
  }

  // ---------------------------------------------------------------------------
  // Reactive observers
  // ---------------------------------------------------------------------------

  /** Observe all categories reactively, ordered by sort_order. */
  observeAll() {
    return this.collection
      .query(Q.sortBy('sort_order', Q.asc))
      .observe();
  }

  // ---------------------------------------------------------------------------
  // Write operations
  // ---------------------------------------------------------------------------

  /** Create a new user-defined category. */
  async create(data: {
    name: string;
    icon: string;
    color: string;
    sortOrder?: number;
  }): Promise<Category> {
    const errors = Category.validate(data);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    return this.database.write(async () => {
      return this.collection.create(record => {
        record.name = data.name;
        record.icon = data.icon;
        record.color = data.color;
        record.sortOrder = data.sortOrder ?? 999;
        record.isDefault = false;
      });
    });
  }

  /**
   * Delete a category.
   * Default (seeded) categories cannot be deleted.
   */
  async delete(category: Category): Promise<void> {
    if (category.isDefault) {
      throw new Error('Cannot delete a default category');
    }
    await this.database.write(async () => {
      await category.destroyPermanently();
    });
  }
}
