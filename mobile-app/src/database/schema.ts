import {appSchema, tableSchema} from '@nozbe/watermelondb';
import {DB_VERSION} from '../config/constants';

export const grocerySchema = appSchema({
  version: DB_VERSION,
  tables: [
    // ---------------------------------------------------------------
    // Lookup: Categories
    // Normalized from repeated string in inventory_items/list_items.
    // Stores icon/color metadata previously hardcoded in constants.ts.
    // ---------------------------------------------------------------
    tableSchema({
      name: 'categories',
      columns: [
        {name: 'name', type: 'string', isIndexed: true},
        {name: 'icon', type: 'string'},
        {name: 'color', type: 'string'},
        {name: 'sort_order', type: 'number'},
        {name: 'is_default', type: 'boolean'},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),

    // ---------------------------------------------------------------
    // Lookup: Units
    // Normalized from freeform unit string. Enforces controlled
    // vocabulary and groups by measurement type.
    // ---------------------------------------------------------------
    tableSchema({
      name: 'units',
      columns: [
        {name: 'name', type: 'string'},              // e.g. "kilogram"
        {name: 'abbreviation', type: 'string', isIndexed: true}, // e.g. "kg"
        {name: 'unit_type', type: 'string'},          // 'weight' | 'volume' | 'count'
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),

    // ---------------------------------------------------------------
    // Stage 1: Scanned Items (temporary pre-purchase data)
    // Ephemeral barcode scan records. Separate table prevents
    // polluting inventory with uncommitted scans.
    // Only barcode scans create these — manual adds go directly
    // to inventory_items. Never synced to cloud.
    // ---------------------------------------------------------------
    tableSchema({
      name: 'scanned_items',
      columns: [
        {name: 'barcode', type: 'string', isIndexed: true},
        {name: 'name', type: 'string', isOptional: true},
        {name: 'brand', type: 'string', isOptional: true},
        {name: 'image_url', type: 'string', isOptional: true},
        {name: 'lookup_data', type: 'string', isOptional: true}, // JSON from OFF API
        {name: 'scanned_at', type: 'number'},
        {name: 'expires_at', type: 'number', isIndexed: true},   // TTL auto-delete
        {name: 'user_id', type: 'string', isIndexed: true},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),

    // ---------------------------------------------------------------
    // Stage 2 + Stage 3: Inventory Items (unified)
    // Renamed from grocery_items. Holds both active inventory
    // (status='active') and consumed/used items (status='consumed',
    // 'expired', 'discarded'), distinguished by the status column.
    // Barcode is NOT unique — multiple rows can share the same
    // barcode (e.g. same product bought on different dates).
    // ---------------------------------------------------------------
    tableSchema({
      name: 'inventory_items',
      columns: [
        {name: 'barcode', type: 'string', isOptional: true, isIndexed: true},
        {name: 'name', type: 'string'},
        {name: 'brand', type: 'string', isOptional: true},
        // FK to categories table (normalized from raw string)
        {name: 'category_id', type: 'string', isIndexed: true},
        {name: 'quantity', type: 'number'},
        // FK to units table (normalized from freeform string)
        {name: 'unit_id', type: 'string', isIndexed: true},
        {name: 'expiry_date', type: 'number', isOptional: true},
        // 'fridge' | 'pantry' | 'freezer' — only 3 fixed values, no lookup table needed
        {name: 'location', type: 'string', isIndexed: true},
        {name: 'image_url', type: 'string', isOptional: true},
        {name: 'added_date', type: 'number'},
        // Restored — were incorrectly removed but still referenced across UI and services
        {name: 'price', type: 'number', isOptional: true},
        {name: 'purchase_date', type: 'number', isOptional: true},
        {name: 'notes', type: 'string', isOptional: true},
        // Reference to scanned_item that created this (null for manual adds)
        {name: 'source_scan_id', type: 'string', isOptional: true},
        // Lifecycle status: unifies Stage 2 (active) and Stage 3 (consumed/expired/discarded)
        {name: 'status', type: 'string', isIndexed: true}, // 'active' | 'consumed' | 'expired' | 'discarded'
        // Stage 3 fields — populated when status changes from 'active'
        {name: 'consumed_date', type: 'number', isOptional: true},
        {name: 'reason', type: 'string', isOptional: true}, // 'used_up' | 'expired' | 'discarded'
        {name: 'quantity_remaining', type: 'number', isOptional: true},
        {name: 'user_id', type: 'string', isIndexed: true},
        {name: 'synced_to_cloud', type: 'boolean'},
        // Restock tracking (v4)
        {name: 'is_important', type: 'boolean'},
        {name: 'restock_threshold', type: 'number'},
        // Expiry confirmation (v4) — false until user sets expiry or confirms "no expiry"
        {name: 'expiry_confirmed', type: 'boolean'},
        // Review flag (v6) — true when item data needs manual review in Firebase
        {name: 'needs_review', type: 'boolean'},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),

    // ---------------------------------------------------------------
    // Shopping lists
    // v5: Added checkout fields for purchase record tracking
    // ---------------------------------------------------------------
    tableSchema({
      name: 'shopping_lists',
      columns: [
        {name: 'name', type: 'string'},
        {name: 'created_date', type: 'number'},
        {name: 'is_completed', type: 'boolean', isIndexed: true},
        {name: 'user_id', type: 'string', isIndexed: true},
        // v5: Checkout / purchase record fields
        {name: 'is_checked_out', type: 'boolean'},
        {name: 'checkout_date', type: 'number', isOptional: true},
        {name: 'store_id', type: 'string', isOptional: true},
        {name: 'total_price', type: 'number', isOptional: true},
        // v8: Per-list notes/instructions
        {name: 'notes', type: 'string', isOptional: true},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),

    // ---------------------------------------------------------------
    // Individual items inside a shopping list
    // v5: Added product fields (barcode, brand, price, etc.) for
    //     cart-merge functionality and checkout tracking.
    // ---------------------------------------------------------------
    tableSchema({
      name: 'list_items',
      columns: [
        {name: 'list_id', type: 'string', isIndexed: true},
        {name: 'item_name', type: 'string'},
        {name: 'quantity', type: 'number'},
        // FK to units table (normalized from freeform string)
        {name: 'unit_id', type: 'string', isIndexed: true},
        {name: 'is_purchased', type: 'boolean', isIndexed: true},
        // FK to categories table (normalized from raw string)
        {name: 'category_id', type: 'string', isIndexed: true},
        // v5: Product fields (from cart merge)
        {name: 'barcode', type: 'string', isOptional: true, isIndexed: true},
        {name: 'brand', type: 'string', isOptional: true},
        {name: 'price', type: 'number', isOptional: true},
        {name: 'weight', type: 'number', isOptional: true},
        {name: 'weight_unit', type: 'string', isOptional: true},
        {name: 'image_url', type: 'string', isOptional: true},
        {name: 'notes', type: 'string', isOptional: true},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),

    // ---------------------------------------------------------------
    // Analytics events queued for sync
    // Index on synced speeds up the frequent getUnsyncedEvents() query.
    // ---------------------------------------------------------------
    tableSchema({
      name: 'analytics_events',
      columns: [
        {name: 'event_type', type: 'string', isIndexed: true},
        {name: 'event_data', type: 'string'}, // JSON-stringified data
        {name: 'timestamp', type: 'number'},
        {name: 'synced', type: 'boolean', isIndexed: true},
        {name: 'user_id', type: 'string', isIndexed: true},
      ],
    }),

    // ---------------------------------------------------------------
    // Stores: Physical store locations for price tracking
    // Added in v2 for shopping cart feature.
    // ---------------------------------------------------------------
    tableSchema({
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

    // ---------------------------------------------------------------
    // Cart Items: Temporary shopping cart before purchase confirmation
    // Added in v2. Items here are "in cart" but not yet in inventory.
    // On checkout, items move to inventory_items + price_history.
    // expires_at added in v3 for TTL auto-cleanup.
    // ---------------------------------------------------------------
    tableSchema({
      name: 'cart_items',
      columns: [
        {name: 'barcode', type: 'string', isOptional: true, isIndexed: true},
        {name: 'name', type: 'string'},
        {name: 'brand', type: 'string', isOptional: true},
        {name: 'quantity', type: 'number'},
        {name: 'unit_id', type: 'string'},
        {name: 'price', type: 'number', isOptional: true},
        {name: 'weight', type: 'number', isOptional: true},
        {name: 'weight_unit', type: 'string', isOptional: true}, // 'g' | 'kg' | 'oz' | 'lb'
        {name: 'image_url', type: 'string', isOptional: true},
        {name: 'notes', type: 'string', isOptional: true},
        {name: 'expires_at', type: 'number', isIndexed: true}, // TTL auto-delete
        {name: 'user_id', type: 'string', isIndexed: true},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),

    // ---------------------------------------------------------------
    // Price History: Historical price records for comparison
    // Added in v2. Created on checkout for each cart item.
    // Enables price comparison across stores and dates.
    // ---------------------------------------------------------------
    tableSchema({
      name: 'price_history',
      columns: [
        {name: 'barcode', type: 'string', isIndexed: true},
        {name: 'name', type: 'string'}, // Denormalized for display
        {name: 'store_id', type: 'string', isIndexed: true}, // FK to stores
        {name: 'price', type: 'number'},
        {name: 'weight', type: 'number', isOptional: true},
        {name: 'weight_unit', type: 'string', isOptional: true}, // 'g' | 'kg' | 'oz' | 'lb'
        {name: 'price_per_unit', type: 'number', isOptional: true}, // Calculated
        {name: 'purchase_date', type: 'number', isIndexed: true},
        {name: 'notes', type: 'string', isOptional: true},
        {name: 'user_id', type: 'string', isIndexed: true},
        {name: 'created_at', type: 'number'},
        {name: 'updated_at', type: 'number'},
      ],
    }),

    // ---------------------------------------------------------------
    // Foodbanks: Global food bank locations (v7)
    // Synced from backend Firestore. Not per-user — shared globally.
    // Backend scrapes public directories and pushes to Firestore.
    // ---------------------------------------------------------------
    tableSchema({
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
});
