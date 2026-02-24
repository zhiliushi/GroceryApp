import {Model} from '@nozbe/watermelondb';
import {text, field, readonly, date, writer} from '@nozbe/watermelondb/decorators';

/**
 * Store model for tracking physical store locations.
 * Used for price comparison across different stores.
 */
export default class Store extends Model {
  static table = 'stores';

  @text('name') name!: string;
  @text('address') address!: string | null;
  @field('latitude') latitude!: number | null;
  @field('longitude') longitude!: number | null;
  @text('user_id') userId!: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  // ---------------------------------------------------------------------------
  // Computed properties
  // ---------------------------------------------------------------------------

  /** Whether the store has location coordinates. */
  get hasLocation(): boolean {
    return this.latitude !== null && this.longitude !== null;
  }

  /** Display name with address if available. */
  get displayName(): string {
    if (this.address) {
      return `${this.name} - ${this.address}`;
    }
    return this.name;
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  static validate(data: {name?: string; userId?: string}): string[] {
    const errors: string[] = [];

    if (!data.name || data.name.trim().length === 0) {
      errors.push('Store name is required');
    }
    if (data.name && data.name.length > 200) {
      errors.push('Store name must be 200 characters or less');
    }
    if (!data.userId || data.userId.trim().length === 0) {
      errors.push('User ID is required');
    }

    return errors;
  }

  // ---------------------------------------------------------------------------
  // Writer methods
  // ---------------------------------------------------------------------------

  /** Update store details. */
  @writer async updateDetails(data: {
    name?: string;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  }): Promise<void> {
    await this.update(record => {
      if (data.name !== undefined) record.name = data.name;
      if (data.address !== undefined) record.address = data.address;
      if (data.latitude !== undefined) record.latitude = data.latitude;
      if (data.longitude !== undefined) record.longitude = data.longitude;
    });
  }

  // ---------------------------------------------------------------------------
  // Data transformation
  // ---------------------------------------------------------------------------

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      address: this.address,
      latitude: this.latitude,
      longitude: this.longitude,
      userId: this.userId,
    };
  }
}
