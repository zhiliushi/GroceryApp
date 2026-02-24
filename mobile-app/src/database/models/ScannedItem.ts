import {Model} from '@nozbe/watermelondb';
import {
  text,
  date,
  readonly,
} from '@nozbe/watermelondb/decorators';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default TTL for scanned items: 24 hours in milliseconds. */
export const SCAN_TTL_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

/**
 * Stage 1: Temporary scan record.
 *
 * Created when the user scans a barcode. Not synced to cloud.
 * Auto-expires after TTL (24h). Only barcode scans create these —
 * manual adds go directly to inventory_items (Stage 2).
 *
 * Promoted to an InventoryItem when the user confirms
 * "bought / add to inventory".
 */
export default class ScannedItem extends Model {
  static table = 'scanned_items';

  @text('barcode') barcode!: string;
  @text('name') name!: string | null;
  @text('brand') brand!: string | null;
  @text('image_url') imageUrl!: string | null;
  @text('lookup_data') lookupData!: string | null; // JSON from Open Food Facts API
  @date('scanned_at') scannedAt!: Date;
  @date('expires_at') expiresAt!: Date;
  @text('user_id') userId!: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  // ---------------------------------------------------------------------------
  // Computed properties
  // ---------------------------------------------------------------------------

  /** Whether this scan has exceeded its TTL and should be cleaned up. */
  get isExpired(): boolean {
    return this.expiresAt.getTime() < Date.now();
  }

  /** Milliseconds remaining before this scan expires. */
  get timeRemainingMs(): number {
    return Math.max(0, this.expiresAt.getTime() - Date.now());
  }

  /** Parse the JSON lookup data from the Open Food Facts API. */
  get parsedLookupData(): Record<string, unknown> | null {
    if (!this.lookupData) return null;
    try {
      return JSON.parse(this.lookupData) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /**
   * Extract the data needed to create an InventoryItem from this scan.
   * The caller must supply additional fields (category_id, unit_id,
   * quantity, location, userId) to complete the promotion.
   */
  get promotionData(): {
    barcode: string;
    name: string | null;
    brand: string | null;
    imageUrl: string | null;
    sourceScanId: string;
  } {
    return {
      barcode: this.barcode,
      name: this.name,
      brand: this.brand,
      imageUrl: this.imageUrl,
      sourceScanId: this.id,
    };
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  static validate(data: {
    barcode?: string;
    userId?: string;
  }): string[] {
    const errors: string[] = [];

    if (!data.barcode || data.barcode.trim().length === 0) {
      errors.push('Barcode is required');
    }
    if (!data.userId || data.userId.trim().length === 0) {
      errors.push('User ID is required');
    }

    return errors;
  }

  get isValid(): boolean {
    return ScannedItem.validate({
      barcode: this.barcode,
      userId: this.userId,
    }).length === 0;
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
      imageUrl: this.imageUrl,
      lookupData: this.parsedLookupData,
      scannedAt: this.scannedAt.toISOString(),
      expiresAt: this.expiresAt.toISOString(),
      isExpired: this.isExpired,
      userId: this.userId,
    };
  }
}
