import {Model} from '@nozbe/watermelondb';
import {
  field,
  text,
  date,
  readonly,
  relation,
  writer,
} from '@nozbe/watermelondb/decorators';
import type Category from './Category';
import type Unit from './Unit';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Storage location for an inventory item (dynamic — user-configurable). */
export type StorageLocation = string;

/** Default storage locations (seed values; runtime source is settingsStore). */
export const STORAGE_LOCATIONS: readonly string[] = [
  'fridge',
  'pantry',
  'freezer',
];

/**
 * Lifecycle status for inventory items.
 * 'active' = Stage 2 (current inventory).
 * Others = Stage 3 (consumed/used — same row, status changed).
 */
export type InventoryStatus = 'active' | 'consumed' | 'expired' | 'discarded';

/** All valid inventory statuses. */
export const INVENTORY_STATUSES: readonly InventoryStatus[] = [
  'active',
  'consumed',
  'expired',
  'discarded',
];

/** Reason why an item left active inventory. */
export type ConsumeReason = 'used_up' | 'expired' | 'discarded';

/** All valid consume reasons. */
export const CONSUME_REASONS: readonly ConsumeReason[] = [
  'used_up',
  'expired',
  'discarded',
];

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

/**
 * Unified Stage 2 + Stage 3 inventory item.
 *
 * Active items (status='active') are current inventory. Consumed, expired,
 * or discarded items are archived history in the same table, differentiated
 * by the status column.
 *
 * Items enter Stage 2 either by:
 * - Promotion from a ScannedItem (barcode scan → confirm bought)
 * - Manual add by the user (bypasses Stage 1)
 *
 * Barcode is NOT unique — multiple rows can share the same barcode
 * (e.g. same product bought on different dates).
 */
export default class InventoryItem extends Model {
  static table = 'inventory_items';

  static associations = {
    categories: {type: 'belongs_to' as const, key: 'category_id'},
    units: {type: 'belongs_to' as const, key: 'unit_id'},
  };

  // --- Core fields ---
  @text('barcode') barcode!: string | null;
  @text('name') name!: string;
  @text('brand') brand!: string | null;
  @text('category_id') categoryId!: string;
  @field('quantity') quantity!: number;
  @text('unit_id') unitId!: string;
  @date('expiry_date') expiryDate!: Date | null;
  @text('location') location!: StorageLocation;
  @text('image_url') imageUrl!: string | null;
  @date('added_date') addedDate!: Date;

  // --- Restored fields (were incorrectly removed) ---
  @field('price') price!: number | null;
  @date('purchase_date') purchaseDate!: Date | null;
  @text('notes') notes!: string | null;

  // --- Scan reference ---
  @text('source_scan_id') sourceScanId!: string | null;

  // --- Lifecycle status (Stage 2 + Stage 3) ---
  @text('status') status!: InventoryStatus;
  @date('consumed_date') consumedDate!: Date | null;
  @text('reason') reason!: ConsumeReason | null;
  @field('quantity_remaining') quantityRemaining!: number | null;

  // --- Restock tracking (v4) ---
  @field('is_important') isImportant!: boolean;
  @field('restock_threshold') restockThreshold!: number;

  // --- Expiry confirmation (v4) ---
  @field('expiry_confirmed') expiryConfirmed!: boolean;

  // --- Review flag (v6) ---
  @field('needs_review') needsReview!: boolean;

  // --- Sync & timestamps ---
  @text('user_id') userId!: string;
  @field('synced_to_cloud') syncedToCloud!: boolean;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  // --- Relations ---
  @relation('categories', 'category_id') category!: Category;
  @relation('units', 'unit_id') unit!: Unit;

  // ---------------------------------------------------------------------------
  // Computed properties — lifecycle
  // ---------------------------------------------------------------------------

  /** Whether the item is currently in active inventory (Stage 2). */
  get isActive(): boolean {
    return this.status === 'active';
  }

  /** Whether the item has been consumed/expired/discarded (Stage 3). */
  get isConsumed(): boolean {
    return this.status !== 'active';
  }

  /** Days since the item was consumed, or null if still active. */
  get daysSinceConsumed(): number | null {
    if (!this.consumedDate) return null;
    const diffMs = Date.now() - this.consumedDate.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  // ---------------------------------------------------------------------------
  // Computed properties — expiry
  // ---------------------------------------------------------------------------

  /** Whether the item has expired. */
  get isExpired(): boolean {
    if (!this.expiryDate) return false;
    return this.expiryDate.getTime() < Date.now();
  }

  /** Whether the item expires within the next 3 days. */
  get isExpiringSoon(): boolean {
    return this.daysUntilExpiry !== null && this.daysUntilExpiry <= 3 && !this.isExpired;
  }

  /** Number of days until expiry, or null if no expiry date set. */
  get daysUntilExpiry(): number | null {
    if (!this.expiryDate) return null;
    const diffMs = this.expiryDate.getTime() - Date.now();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  /** Expiry status label for UI display. */
  get expiryStatus(): 'expired' | 'expiring_soon' | 'fresh' | 'no_expiry' {
    if (!this.expiryDate) return 'no_expiry';
    if (this.isExpired) return 'expired';
    if (this.isExpiringSoon) return 'expiring_soon';
    return 'fresh';
  }

  /** Whether the item is low on stock (quantity <= 1). */
  get isLowStock(): boolean {
    return this.quantity <= 1;
  }

  // ---------------------------------------------------------------------------
  // Computed properties — restock
  // ---------------------------------------------------------------------------

  /** Whether the item needs restocking (important + below threshold). */
  get needsRestock(): boolean {
    return this.isImportant && this.status === 'active' && this.quantity <= this.restockThreshold;
  }

  /** Whether the item needs expiry attention (no expiry set, not confirmed). */
  get needsExpiryAttention(): boolean {
    return this.status === 'active' && !this.expiryDate && !this.expiryConfirmed;
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  static validate(data: {
    name?: string;
    categoryId?: string;
    quantity?: number;
    unitId?: string;
    location?: string;
    userId?: string;
  }): string[] {
    const errors: string[] = [];

    if (!data.name || data.name.trim().length === 0) {
      errors.push('Name is required');
    }
    if (data.name && data.name.length > 200) {
      errors.push('Name must be 200 characters or less');
    }
    if (!data.categoryId || data.categoryId.trim().length === 0) {
      errors.push('Category is required');
    }
    if (data.quantity !== undefined && (data.quantity < 0 || !Number.isFinite(data.quantity))) {
      errors.push('Quantity must be a non-negative number');
    }
    if (!data.unitId || data.unitId.trim().length === 0) {
      errors.push('Unit is required');
    }
    if (data.location && typeof data.location === 'string' && data.location.trim().length === 0) {
      errors.push('Location must be a non-empty string');
    }
    if (!data.userId || data.userId.trim().length === 0) {
      errors.push('User ID is required');
    }

    return errors;
  }

  get isValid(): boolean {
    return InventoryItem.validate({
      name: this.name,
      categoryId: this.categoryId,
      quantity: this.quantity,
      unitId: this.unitId,
      location: this.location,
      userId: this.userId,
    }).length === 0;
  }

  // ---------------------------------------------------------------------------
  // Writer methods
  // ---------------------------------------------------------------------------

  /** Flag the item as synced to the cloud. */
  @writer async markSynced(): Promise<void> {
    await this.update(record => {
      record.syncedToCloud = true;
    });
  }

  /** Mark the item as not synced (dirty). */
  @writer async markDirty(): Promise<void> {
    await this.update(record => {
      record.syncedToCloud = false;
    });
  }

  /** Update quantity (e.g. after consuming or restocking). */
  @writer async adjustQuantity(delta: number): Promise<void> {
    await this.update(record => {
      record.quantity = Math.max(0, record.quantity + delta);
      record.syncedToCloud = false;
    });
  }

  /** Move the item to a different storage location. */
  @writer async moveToLocation(location: StorageLocation): Promise<void> {
    await this.update(record => {
      record.location = location;
      record.syncedToCloud = false;
    });
  }

  /** Confirm item has no expiry date (dismiss the flag). */
  @writer async confirmNoExpiry(): Promise<void> {
    await this.update(record => {
      record.expiryConfirmed = true;
      record.syncedToCloud = false;
    });
  }

  /** Set expiry date and mark as confirmed. */
  @writer async setExpiryDate(expiryDate: Date): Promise<void> {
    await this.update(record => {
      record.expiryDate = expiryDate;
      record.expiryConfirmed = true;
      record.syncedToCloud = false;
    });
  }

  /** Toggle whether this item is marked as important for restock tracking. */
  @writer async toggleImportant(isImportant: boolean): Promise<void> {
    await this.update(record => {
      record.isImportant = isImportant;
      record.syncedToCloud = false;
    });
  }

  /** Set the restock threshold quantity. */
  @writer async setRestockThreshold(threshold: number): Promise<void> {
    await this.update(record => {
      record.restockThreshold = Math.max(0, threshold);
      record.syncedToCloud = false;
    });
  }

  /** Restore a consumed/expired/discarded item back to active inventory. */
  @writer async restoreToActive(): Promise<void> {
    await this.update(record => {
      record.status = 'active';
      record.consumedDate = null;
      record.reason = null;
      record.quantityRemaining = null;
      record.syncedToCloud = false;
    });
  }

  /**
   * Transition from Stage 2 (active) to Stage 3 (consumed/expired/discarded).
   * Sets status, consumed_date, reason, and quantity_remaining.
   */
  @writer async markConsumed(
    reason: ConsumeReason,
    quantityRemaining?: number,
  ): Promise<void> {
    const statusMap: Record<ConsumeReason, InventoryStatus> = {
      used_up: 'consumed',
      expired: 'expired',
      discarded: 'discarded',
    };

    await this.update(record => {
      record.status = statusMap[reason];
      record.consumedDate = new Date();
      record.reason = reason;
      record.quantityRemaining = quantityRemaining ?? 0;
      record.syncedToCloud = false;
    });
  }

  // ---------------------------------------------------------------------------
  // Data transformation
  // ---------------------------------------------------------------------------

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      barcode: this.barcode,
      name: this.name,
      brand: this.brand,
      categoryId: this.categoryId,
      quantity: this.quantity,
      unitId: this.unitId,
      expiryDate: this.expiryDate?.toISOString() ?? null,
      location: this.location,
      imageUrl: this.imageUrl,
      addedDate: this.addedDate.toISOString(),
      price: this.price,
      purchaseDate: this.purchaseDate?.toISOString() ?? null,
      notes: this.notes,
      sourceScanId: this.sourceScanId,
      status: this.status,
      consumedDate: this.consumedDate?.toISOString() ?? null,
      reason: this.reason,
      quantityRemaining: this.quantityRemaining,
      userId: this.userId,
      syncedToCloud: this.syncedToCloud,
      isImportant: this.isImportant,
      restockThreshold: this.restockThreshold,
      expiryConfirmed: this.expiryConfirmed,
      needsReview: this.needsReview,
    };
  }
}
