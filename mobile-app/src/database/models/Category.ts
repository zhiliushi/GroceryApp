import {Model} from '@nozbe/watermelondb';
import {
  text,
  field,
  readonly,
  date,
  writer,
  children,
} from '@nozbe/watermelondb/decorators';

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

/**
 * Normalized category lookup table.
 * Replaces the repeated raw category string that was previously stored
 * in inventory_items and list_items, with icon/color metadata that was
 * hardcoded in constants.ts.
 */
export default class Category extends Model {
  static table = 'categories';

  static associations = {
    inventory_items: {type: 'has_many' as const, foreignKey: 'category_id'},
    list_items: {type: 'has_many' as const, foreignKey: 'category_id'},
  };

  @text('name') name!: string;
  @text('icon') icon!: string;
  @text('color') color!: string;
  @field('sort_order') sortOrder!: number;
  @field('is_default') isDefault!: boolean;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  /** All inventory items in this category. */
  @children('inventory_items') inventoryItems!: any;

  /** All list items in this category. */
  @children('list_items') listItems!: any;

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  static validate(data: {
    name?: string;
    icon?: string;
    color?: string;
  }): string[] {
    const errors: string[] = [];

    if (!data.name || data.name.trim().length === 0) {
      errors.push('Name is required');
    }
    if (data.name && data.name.length > 50) {
      errors.push('Name must be 50 characters or less');
    }
    if (!data.icon || data.icon.trim().length === 0) {
      errors.push('Icon is required');
    }
    if (!data.color || !/^#[0-9A-Fa-f]{6}$/.test(data.color)) {
      errors.push('Color must be a valid hex color (e.g. #FF0000)');
    }

    return errors;
  }

  get isValid(): boolean {
    return Category.validate({
      name: this.name,
      icon: this.icon,
      color: this.color,
    }).length === 0;
  }

  // ---------------------------------------------------------------------------
  // Writer methods
  // ---------------------------------------------------------------------------

  @writer async updateDetails(data: {
    name?: string;
    icon?: string;
    color?: string;
    sortOrder?: number;
  }): Promise<void> {
    await this.update(record => {
      if (data.name !== undefined) record.name = data.name;
      if (data.icon !== undefined) record.icon = data.icon;
      if (data.color !== undefined) record.color = data.color;
      if (data.sortOrder !== undefined) record.sortOrder = data.sortOrder;
    });
  }

  // ---------------------------------------------------------------------------
  // Data transformation
  // ---------------------------------------------------------------------------

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      icon: this.icon,
      color: this.color,
      sortOrder: this.sortOrder,
      isDefault: this.isDefault,
    };
  }
}
