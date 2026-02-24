import {
  schemaMigrations,
  createTable,
  addColumns,
} from '@nozbe/watermelondb/Schema/migrations';

/**
 * Database migrations for GroceryApp.
 *
 * WatermelonDB uses migrations to evolve the schema over time.
 * When bumping DB_VERSION in constants.ts, add a new migration
 * block here with `toVersion: <new version>`.
 *
 * Schema v1 — 7 tables:
 *   - categories, units, scanned_items, inventory_items,
 *     shopping_lists, list_items, analytics_events
 *
 * Schema v2 — 10 tables (+3 new):
 *   - stores: Store locations for price comparison
 *   - cart_items: Temporary shopping cart before checkout
 *   - price_history: Historical price records per store/date
 *
 * Schema v3 — TTL for cart items:
 *   - cart_items.expires_at: Auto-cleanup after 24 hours
 *
 * Schema v4 — Restock tracking + expiry confirmation:
 *   - inventory_items.is_important: Mark items for restock tracking
 *   - inventory_items.restock_threshold: Quantity threshold for restock alert
 *   - inventory_items.expiry_confirmed: Whether expiry status has been reviewed
 *
 * Schema v5 — Shopping merge (cart + lists):
 *   - list_items: barcode, brand, price, weight, weight_unit, image_url, notes
 *   - shopping_lists: is_checked_out, checkout_date, store_id, total_price
 *
 * Schema v6 — Review flag:
 *   - inventory_items.needs_review: Flag items needing manual review in Firebase
 *
 * Schema v7 — Foodbanks:
 *   - foodbanks: Global food bank locations synced from backend
 *
 * Schema v8 — Shopping list notes:
 *   - shopping_lists.notes: Per-list trip notes/instructions
 */
export default schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        // New table: stores
        createTable({
          name: 'stores',
          columns: [
            {name: 'name', type: 'string', isIndexed: true},
            {name: 'address', type: 'string', isOptional: true},
            {name: 'latitude', type: 'number', isOptional: true},
            {name: 'longitude', type: 'number', isOptional: true},
            {name: 'user_id', type: 'string', isIndexed: true},
            {name: 'created_at', type: 'number'},
            {name: 'updated_at', type: 'number'},
          ],
        }),
        // New table: cart_items
        createTable({
          name: 'cart_items',
          columns: [
            {name: 'barcode', type: 'string', isOptional: true, isIndexed: true},
            {name: 'name', type: 'string'},
            {name: 'brand', type: 'string', isOptional: true},
            {name: 'quantity', type: 'number'},
            {name: 'unit_id', type: 'string'},
            {name: 'price', type: 'number', isOptional: true},
            {name: 'weight', type: 'number', isOptional: true},
            {name: 'weight_unit', type: 'string', isOptional: true},
            {name: 'image_url', type: 'string', isOptional: true},
            {name: 'notes', type: 'string', isOptional: true},
            {name: 'user_id', type: 'string', isIndexed: true},
            {name: 'created_at', type: 'number'},
            {name: 'updated_at', type: 'number'},
          ],
        }),
        // New table: price_history
        createTable({
          name: 'price_history',
          columns: [
            {name: 'barcode', type: 'string', isIndexed: true},
            {name: 'name', type: 'string'},
            {name: 'store_id', type: 'string', isIndexed: true},
            {name: 'price', type: 'number'},
            {name: 'weight', type: 'number', isOptional: true},
            {name: 'weight_unit', type: 'string', isOptional: true},
            {name: 'price_per_unit', type: 'number', isOptional: true},
            {name: 'purchase_date', type: 'number', isIndexed: true},
            {name: 'notes', type: 'string', isOptional: true},
            {name: 'user_id', type: 'string', isIndexed: true},
            {name: 'created_at', type: 'number'},
            {name: 'updated_at', type: 'number'},
          ],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        // Add TTL column to cart_items for auto-cleanup
        addColumns({
          table: 'cart_items',
          columns: [{name: 'expires_at', type: 'number', isIndexed: true}],
        }),
      ],
    },
    {
      toVersion: 4,
      steps: [
        // Restock tracking + expiry confirmation flag
        addColumns({
          table: 'inventory_items',
          columns: [
            {name: 'is_important', type: 'boolean'},
            {name: 'restock_threshold', type: 'number'},
            {name: 'expiry_confirmed', type: 'boolean'},
          ],
        }),
      ],
    },
    {
      toVersion: 5,
      steps: [
        // Shopping merge: add product fields to list_items
        addColumns({
          table: 'list_items',
          columns: [
            {name: 'barcode', type: 'string', isOptional: true, isIndexed: true},
            {name: 'brand', type: 'string', isOptional: true},
            {name: 'price', type: 'number', isOptional: true},
            {name: 'weight', type: 'number', isOptional: true},
            {name: 'weight_unit', type: 'string', isOptional: true},
            {name: 'image_url', type: 'string', isOptional: true},
            {name: 'notes', type: 'string', isOptional: true},
          ],
        }),
        // Shopping merge: add checkout fields to shopping_lists
        addColumns({
          table: 'shopping_lists',
          columns: [
            {name: 'is_checked_out', type: 'boolean'},
            {name: 'checkout_date', type: 'number', isOptional: true},
            {name: 'store_id', type: 'string', isOptional: true},
            {name: 'total_price', type: 'number', isOptional: true},
          ],
        }),
      ],
    },
    {
      toVersion: 6,
      steps: [
        // Review flag for incomplete / user-entered items
        addColumns({
          table: 'inventory_items',
          columns: [{name: 'needs_review', type: 'boolean'}],
        }),
      ],
    },
    {
      toVersion: 7,
      steps: [
        // Global foodbank locations table
        createTable({
          name: 'foodbanks',
          columns: [
            {name: 'name', type: 'string'},
            {name: 'description', type: 'string', isOptional: true},
            {name: 'country', type: 'string', isIndexed: true},
            {name: 'state', type: 'string', isOptional: true, isIndexed: true},
            {name: 'location_name', type: 'string', isOptional: true},
            {name: 'location_address', type: 'string', isOptional: true},
            {name: 'location_link', type: 'string', isOptional: true},
            {name: 'latitude', type: 'number', isOptional: true},
            {name: 'longitude', type: 'number', isOptional: true},
            {name: 'source_url', type: 'string', isOptional: true},
            {name: 'source_name', type: 'string', isOptional: true},
            {name: 'is_active', type: 'boolean'},
            {name: 'created_at', type: 'number'},
            {name: 'updated_at', type: 'number'},
          ],
        }),
      ],
    },
    {
      toVersion: 8,
      steps: [
        // Per-list notes/instructions for shopping trips
        addColumns({
          table: 'shopping_lists',
          columns: [{name: 'notes', type: 'string', isOptional: true}],
        }),
      ],
    },
  ],
});
