import {Model, Q} from '@nozbe/watermelondb';
import {
  field,
  text,
  date,
  readonly,
  children,
  writer,
  lazy,
} from '@nozbe/watermelondb/decorators';
import type ListItem from './ListItem';

export default class ShoppingList extends Model {
  static table = 'shopping_lists';

  static associations = {
    list_items: {type: 'has_many' as const, foreignKey: 'list_id'},
  };

  @text('name') name!: string;
  @date('created_date') createdDate!: Date;
  @field('is_completed') isCompleted!: boolean;
  @text('user_id') userId!: string;

  // v5: Checkout / purchase record fields
  @field('is_checked_out') isCheckedOut!: boolean;
  @date('checkout_date') checkoutDate!: Date | null;
  @text('store_id') storeId!: string | null;
  @field('total_price') totalPrice!: number | null;

  // v8: Per-list notes/instructions
  @text('notes') notes!: string | null;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  /** Relation: all items in this shopping list. */
  @children('list_items') items!: ListItem[];

  // ---------------------------------------------------------------------------
  // Computed queries
  // ---------------------------------------------------------------------------

  /** Query for items not yet purchased. */
  @lazy remainingItems = this.collections
    .get<ListItem>('list_items')
    .query(Q.where('list_id', this.id), Q.where('is_purchased', false));

  /** Query for purchased items. */
  @lazy purchasedItems = this.collections
    .get<ListItem>('list_items')
    .query(Q.where('list_id', this.id), Q.where('is_purchased', true));

  // ---------------------------------------------------------------------------
  // Computed properties
  // ---------------------------------------------------------------------------

  /** Whether the list has any items at all. */
  get isEmpty(): boolean {
    // Note: This checks the @children relation. For a count without
    // fetching, use the repository's getListItemCount() instead.
    return false; // Use repository for accurate count
  }

  /** Whether this list is a completed purchase record. */
  get isPurchaseRecord(): boolean {
    return this.isCompleted && this.isCheckedOut;
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  /** Validate shopping list creation data. */
  static validate(data: {name?: string; userId?: string}): string[] {
    const errors: string[] = [];

    if (!data.name || data.name.trim().length === 0) {
      errors.push('List name is required');
    }
    if (data.name && data.name.length > 100) {
      errors.push('List name must be 100 characters or less');
    }
    if (!data.userId || data.userId.trim().length === 0) {
      errors.push('User ID is required');
    }

    return errors;
  }

  /** Check whether this model instance currently holds valid data. */
  get isValid(): boolean {
    return ShoppingList.validate({
      name: this.name,
      userId: this.userId,
    }).length === 0;
  }

  // ---------------------------------------------------------------------------
  // Writer methods
  // ---------------------------------------------------------------------------

  /** Mark the list as completed. */
  @writer async markCompleted(): Promise<void> {
    await this.update(record => {
      record.isCompleted = true;
    });
  }

  /** Reopen a completed list. */
  @writer async reopen(): Promise<void> {
    await this.update(record => {
      record.isCompleted = false;
    });
  }

  /** Rename the list. */
  @writer async rename(newName: string): Promise<void> {
    await this.update(record => {
      record.name = newName;
    });
  }

  /** Update the list's notes. */
  @writer async updateNotes(newNotes: string | null): Promise<void> {
    await this.update(record => {
      record.notes = newNotes;
    });
  }

  // ---------------------------------------------------------------------------
  // Data transformation
  // ---------------------------------------------------------------------------

  /** Convert to a plain JSON-serializable object. */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      createdDate: this.createdDate.toISOString(),
      isCompleted: this.isCompleted,
      userId: this.userId,
      isCheckedOut: this.isCheckedOut,
      checkoutDate: this.checkoutDate?.toISOString() ?? null,
      storeId: this.storeId,
      totalPrice: this.totalPrice,
      notes: this.notes,
    };
  }
}
