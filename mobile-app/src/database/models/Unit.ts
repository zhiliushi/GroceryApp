import {Model} from '@nozbe/watermelondb';
import {
  text,
  readonly,
  date,
  children,
} from '@nozbe/watermelondb/decorators';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Measurement type grouping for units. */
export type UnitType = 'weight' | 'volume' | 'count';

/** All valid unit types. */
export const UNIT_TYPES: readonly UnitType[] = ['weight', 'volume', 'count'];

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

/**
 * Normalized unit lookup table.
 * Replaces the freeform unit string that was previously stored in
 * inventory_items and list_items. Enforces a controlled vocabulary
 * and groups units by measurement type.
 */
export default class Unit extends Model {
  static table = 'units';

  static associations = {
    inventory_items: {type: 'has_many' as const, foreignKey: 'unit_id'},
    list_items: {type: 'has_many' as const, foreignKey: 'unit_id'},
  };

  @text('name') name!: string;                // e.g. "kilogram"
  @text('abbreviation') abbreviation!: string; // e.g. "kg"
  @text('unit_type') unitType!: UnitType;      // 'weight' | 'volume' | 'count'
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  /** All inventory items using this unit. */
  @children('inventory_items') inventoryItems!: any;

  /** All list items using this unit. */
  @children('list_items') listItems!: any;

  // ---------------------------------------------------------------------------
  // Computed properties
  // ---------------------------------------------------------------------------

  /** Display label combining abbreviation and full name. */
  get displayLabel(): string {
    return `${this.abbreviation} (${this.name})`;
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  static validate(data: {
    name?: string;
    abbreviation?: string;
    unitType?: string;
  }): string[] {
    const errors: string[] = [];

    if (!data.name || data.name.trim().length === 0) {
      errors.push('Name is required');
    }
    if (!data.abbreviation || data.abbreviation.trim().length === 0) {
      errors.push('Abbreviation is required');
    }
    if (!data.unitType || !UNIT_TYPES.includes(data.unitType as UnitType)) {
      errors.push('Unit type must be one of: weight, volume, count');
    }

    return errors;
  }

  get isValid(): boolean {
    return Unit.validate({
      name: this.name,
      abbreviation: this.abbreviation,
      unitType: this.unitType,
    }).length === 0;
  }

  // ---------------------------------------------------------------------------
  // Data transformation
  // ---------------------------------------------------------------------------

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      abbreviation: this.abbreviation,
      unitType: this.unitType,
    };
  }
}
