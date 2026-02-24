import {Model} from '@nozbe/watermelondb';
import {text, field, readonly, date} from '@nozbe/watermelondb/decorators';

/**
 * Foodbank model — global food bank locations.
 * Synced down from Firestore (backend scrapes sources and populates).
 * Not per-user data — shared across all users.
 */
export default class Foodbank extends Model {
  static table = 'foodbanks';

  @text('name') name!: string;
  @text('description') description!: string | null;
  @text('country') country!: string;
  @text('state') state!: string | null;
  @text('location_name') locationName!: string | null;
  @text('location_address') locationAddress!: string | null;
  @text('location_link') locationLink!: string | null;
  @field('latitude') latitude!: number | null;
  @field('longitude') longitude!: number | null;
  @text('source_url') sourceUrl!: string | null;
  @text('source_name') sourceName!: string | null;
  @field('is_active') isActive!: boolean;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  // ---------------------------------------------------------------------------
  // Computed properties
  // ---------------------------------------------------------------------------

  get hasLocation(): boolean {
    return this.latitude !== null && this.longitude !== null;
  }

  get displayName(): string {
    if (this.locationName) {
      return `${this.name} — ${this.locationName}`;
    }
    return this.name;
  }

  // ---------------------------------------------------------------------------
  // Data transformation
  // ---------------------------------------------------------------------------

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      country: this.country,
      state: this.state,
      locationName: this.locationName,
      locationAddress: this.locationAddress,
      locationLink: this.locationLink,
      latitude: this.latitude,
      longitude: this.longitude,
      sourceUrl: this.sourceUrl,
      sourceName: this.sourceName,
      isActive: this.isActive,
    };
  }
}
