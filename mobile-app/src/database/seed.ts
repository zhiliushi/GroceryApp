import {type Database, Model} from '@nozbe/watermelondb';
import type Category from './models/Category';
import type Unit from './models/Unit';

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const DEFAULT_CATEGORIES = [
  {name: 'Dairy', icon: 'cheese', color: '#D4A843'},
  {name: 'Produce', icon: 'food-apple', color: '#5A9E5E'},
  {name: 'Meat', icon: 'food-steak', color: '#C45454'},
  {name: 'Bakery', icon: 'bread-slice', color: '#C4873B'},
  {name: 'Beverages', icon: 'cup-water', color: '#4A80C4'},
  {name: 'Frozen', icon: 'snowflake', color: '#4A9EA8'},
  {name: 'Snacks', icon: 'cookie', color: '#8A5A96'},
  {name: 'Household', icon: 'home', color: '#6B7D87'},
  {name: 'Other', icon: 'dots-horizontal', color: '#8A8A8A'},
] as const;

const DEFAULT_UNITS: Array<{
  name: string;
  abbreviation: string;
  unitType: 'weight' | 'volume' | 'count';
}> = [
  {name: 'piece', abbreviation: 'pcs', unitType: 'count'},
  {name: 'kilogram', abbreviation: 'kg', unitType: 'weight'},
  {name: 'gram', abbreviation: 'g', unitType: 'weight'},
  {name: 'pound', abbreviation: 'lbs', unitType: 'weight'},
  {name: 'ounce', abbreviation: 'oz', unitType: 'weight'},
  {name: 'milliliter', abbreviation: 'ml', unitType: 'volume'},
  {name: 'liter', abbreviation: 'L', unitType: 'volume'},
  {name: 'gallon', abbreviation: 'gal', unitType: 'volume'},
  {name: 'dozen', abbreviation: 'doz', unitType: 'count'},
  {name: 'pack', abbreviation: 'pk', unitType: 'count'},
  {name: 'bottle', abbreviation: 'btl', unitType: 'count'},
  {name: 'can', abbreviation: 'can', unitType: 'count'},
  {name: 'bag', abbreviation: 'bag', unitType: 'count'},
  {name: 'box', abbreviation: 'box', unitType: 'count'},
];

// ---------------------------------------------------------------------------
// Seed function
// ---------------------------------------------------------------------------

/**
 * Seed the database with default categories and units.
 * Guarded by fetchCount() to avoid re-seeding on subsequent launches.
 */
export async function seedDatabase(database: Database): Promise<void> {
  const categoriesCol = database.get<Category>('categories');
  const unitsCol = database.get<Unit>('units');

  const categoryCount = await categoriesCol.query().fetchCount();
  const unitCount = await unitsCol.query().fetchCount();

  if (categoryCount > 0 && unitCount > 0) {
    return; // Already seeded
  }

  await database.write(async () => {
    const batch: Model[] = [];

    // Seed categories
    if (categoryCount === 0) {
      for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
        const cat = DEFAULT_CATEGORIES[i];
        batch.push(
          categoriesCol.prepareCreate(record => {
            record.name = cat.name;
            record.icon = cat.icon;
            record.color = cat.color;
            record.sortOrder = i;
            record.isDefault = true;
          }),
        );
      }
    }

    // Seed units
    if (unitCount === 0) {
      for (const u of DEFAULT_UNITS) {
        batch.push(
          unitsCol.prepareCreate(record => {
            record.name = u.name;
            record.abbreviation = u.abbreviation;
            record.unitType = u.unitType as any;
          }),
        );
      }
    }

    if (batch.length > 0) {
      await database.batch(...batch);
    }
  });
}

// Re-export for use in constants if needed
export {DEFAULT_CATEGORIES, DEFAULT_UNITS};
