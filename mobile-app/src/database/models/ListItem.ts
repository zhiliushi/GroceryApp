import {Model} from '@nozbe/watermelondb';
import {
  field,
  text,
  date,
  readonly,
  relation,
  writer,
} from '@nozbe/watermelondb/decorators';
import type ShoppingList from './ShoppingList';
import type Category from './Category';
import type Unit from './Unit';

export default class ListItem extends Model {
  static table = 'list_items';

  static associations = {
    shopping_lists: {type: 'belongs_to' as const, key: 'list_id'},
    categories: {type: 'belongs_to' as const, key: 'category_id'},
    units: {type: 'belongs_to' as const, key: 'unit_id'},
  };

  @text('list_id') listId!: string;
  @text('item_name') itemName!: string;
  @field('quantity') quantity!: number;
  // FK to units table (normalized from freeform string)
  @text('unit_id') unitId!: string;
  @field('is_purchased') isPurchased!: boolean;
  // FK to categories table (normalized from raw string)
  @text('category_id') categoryId!: string;

  // v5: Product fields (from cart merge)
  @text('barcode') barcode!: string | null;
  @text('brand') brand!: string | null;
  @field('price') price!: number | null;
  @field('weight') weight!: number | null;
  @text('weight_unit') weightUnit!: string | null;
  @text('image_url') imageUrl!: string | null;
  @text('notes') notes!: string | null;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  // --- Relations ---
  @relation('shopping_lists', 'list_id') shoppingList!: ShoppingList;
  @relation('categories', 'category_id') category!: Category;
  @relation('units', 'unit_id') unit!: Unit;

  // ---------------------------------------------------------------------------
  // Computed properties
  // ---------------------------------------------------------------------------

  /** Display string combining quantity and name (unit resolved by UI). */
  get displayText(): string {
    return `${this.quantity} ${this.itemName}`;
  }

  /** Total price for this line item (price * quantity), or null if no price. */
  get totalPrice(): number | null {
    if (this.price == null) return null;
    return this.price * this.quantity;
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  static validate(data: {
    listId?: string;
    itemName?: string;
    quantity?: number;
    unitId?: string;
    categoryId?: string;
  }): string[] {
    const errors: string[] = [];

    if (!data.listId || data.listId.trim().length === 0) {
      errors.push('List ID is required');
    }
    if (!data.itemName || data.itemName.trim().length === 0) {
      errors.push('Item name is required');
    }
    if (data.itemName && data.itemName.length > 200) {
      errors.push('Item name must be 200 characters or less');
    }
    if (data.quantity !== undefined && (data.quantity <= 0 || !Number.isFinite(data.quantity))) {
      errors.push('Quantity must be a positive number');
    }
    if (!data.unitId || data.unitId.trim().length === 0) {
      errors.push('Unit is required');
    }
    if (!data.categoryId || data.categoryId.trim().length === 0) {
      errors.push('Category is required');
    }

    return errors;
  }

  get isValid(): boolean {
    return ListItem.validate({
      listId: this.listId,
      itemName: this.itemName,
      quantity: this.quantity,
      unitId: this.unitId,
      categoryId: this.categoryId,
    }).length === 0;
  }

  // ---------------------------------------------------------------------------
  // Writer methods
  // ---------------------------------------------------------------------------

  @writer async togglePurchased(): Promise<void> {
    await this.update(record => {
      record.isPurchased = !record.isPurchased;
    });
  }

  @writer async markPurchased(): Promise<void> {
    await this.update(record => {
      record.isPurchased = true;
    });
  }

  @writer async updateQuantity(newQuantity: number): Promise<void> {
    await this.update(record => {
      record.quantity = newQuantity;
    });
  }

  // ---------------------------------------------------------------------------
  // Data transformation
  // ---------------------------------------------------------------------------

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      listId: this.listId,
      itemName: this.itemName,
      quantity: this.quantity,
      unitId: this.unitId,
      isPurchased: this.isPurchased,
      categoryId: this.categoryId,
      barcode: this.barcode,
      brand: this.brand,
      price: this.price,
      weight: this.weight,
      weightUnit: this.weightUnit,
      imageUrl: this.imageUrl,
      notes: this.notes,
    };
  }
}
