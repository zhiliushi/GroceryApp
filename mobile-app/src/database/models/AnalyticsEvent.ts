import {Model} from '@nozbe/watermelondb';
import {field, text, date, writer} from '@nozbe/watermelondb/decorators';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** All analytics event types tracked by the app. */
export type AnalyticsEventType =
  | 'barcode_scan'
  | 'item_added'
  | 'item_removed'
  | 'item_updated'
  | 'item_expired'
  | 'item_deleted'
  | 'list_created'
  | 'list_completed'
  | 'list_deleted'
  | 'purchase_recorded'
  | 'sync_completed'
  | 'search_performed'
  | 'category_viewed'
  // 3-stage lifecycle transitions
  | 'item_scanned'           // Stage 1: barcode scanned
  | 'scan_promoted'          // Stage 1 → 2: scan confirmed as bought
  | 'scan_discarded'         // Stage 1: scan discarded by user or TTL
  | 'item_consumed'          // Stage 2 → 3: item consumed/expired/discarded
  // Additional tracked events
  | 'item_expired_wasted'    // Item expired and was discarded (waste tracking)
  | 'recipe_viewed'          // User viewed a recipe (paid feature)
  | 'screen_view'            // Screen navigation tracking
  | 'feature_used';          // Generic feature usage tracking

/** All valid event type values. */
export const ANALYTICS_EVENT_TYPES: readonly AnalyticsEventType[] = [
  'barcode_scan',
  'item_added',
  'item_removed',
  'item_updated',
  'item_expired',
  'item_deleted',
  'list_created',
  'list_completed',
  'list_deleted',
  'purchase_recorded',
  'sync_completed',
  'search_performed',
  'category_viewed',
  'item_scanned',
  'scan_promoted',
  'scan_discarded',
  'item_consumed',
  'item_expired_wasted',
  'recipe_viewed',
  'screen_view',
  'feature_used',
];

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export default class AnalyticsEvent extends Model {
  static table = 'analytics_events';

  @text('event_type') eventType!: AnalyticsEventType;
  @text('event_data') eventData!: string; // JSON string
  @date('timestamp') timestamp!: Date;
  @field('synced') synced!: boolean;
  @text('user_id') userId!: string;

  // ---------------------------------------------------------------------------
  // Data access
  // ---------------------------------------------------------------------------

  /** Parse the JSON event_data into a typed object. */
  getParsedData<T = Record<string, unknown>>(): T {
    try {
      return JSON.parse(this.eventData) as T;
    } catch {
      return {} as T;
    }
  }

  /** Get a specific field from the parsed event data. */
  getDataField<T = unknown>(key: string): T | undefined {
    const data = this.getParsedData();
    return (data as Record<string, unknown>)[key] as T | undefined;
  }

  // ---------------------------------------------------------------------------
  // Computed properties
  // ---------------------------------------------------------------------------

  /** Formatted timestamp string for display. */
  get formattedTimestamp(): string {
    return this.timestamp.toLocaleString();
  }

  /** Age of the event in milliseconds. */
  get ageMs(): number {
    return Date.now() - this.timestamp.getTime();
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  static validate(data: {
    eventType?: string;
    eventData?: unknown;
    userId?: string;
  }): string[] {
    const errors: string[] = [];

    if (!data.eventType || !ANALYTICS_EVENT_TYPES.includes(data.eventType as AnalyticsEventType)) {
      errors.push(`Event type must be one of: ${ANALYTICS_EVENT_TYPES.join(', ')}`);
    }
    if (data.eventData === undefined || data.eventData === null) {
      errors.push('Event data is required');
    }
    if (typeof data.eventData === 'string') {
      try {
        JSON.parse(data.eventData);
      } catch {
        errors.push('Event data must be valid JSON');
      }
    }
    if (!data.userId || data.userId.trim().length === 0) {
      errors.push('User ID is required');
    }

    return errors;
  }

  get isValid(): boolean {
    return AnalyticsEvent.validate({
      eventType: this.eventType,
      eventData: this.eventData,
      userId: this.userId,
    }).length === 0;
  }

  // ---------------------------------------------------------------------------
  // Writer methods
  // ---------------------------------------------------------------------------

  /** Flag this event as synced to the backend. */
  @writer async markSynced(): Promise<void> {
    await this.update(record => {
      record.synced = true;
    });
  }

  // ---------------------------------------------------------------------------
  // Data transformation
  // ---------------------------------------------------------------------------

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      eventType: this.eventType,
      eventData: this.getParsedData(),
      timestamp: this.timestamp.toISOString(),
      synced: this.synced,
      userId: this.userId,
    };
  }
}
