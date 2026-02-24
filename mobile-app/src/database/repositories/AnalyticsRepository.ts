import {Database, Q} from '@nozbe/watermelondb';
import AnalyticsEvent from '../models/AnalyticsEvent';
import type {AnalyticsEventType} from '../models/AnalyticsEvent';
import type {CreateAnalyticsEventInput} from '../../types/database';

export class AnalyticsRepository {
  private collection;

  constructor(private database: Database) {
    this.collection = database.get<AnalyticsEvent>('analytics_events');
  }

  // ---------------------------------------------------------------------------
  // Write operations
  // ---------------------------------------------------------------------------

  /** Log a new analytics event. */
  async logEvent(input: CreateAnalyticsEventInput): Promise<AnalyticsEvent> {
    const errors = AnalyticsEvent.validate({
      eventType: input.eventType,
      eventData: input.eventData,
      userId: input.userId,
    });
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    return this.database.write(async () => {
      return this.collection.create(record => {
        record.eventType = input.eventType;
        record.eventData = JSON.stringify(input.eventData);
        record.timestamp = new Date();
        record.synced = false;
        record.userId = input.userId;
      });
    });
  }

  /** Mark a batch of events as synced. */
  async markSynced(events: AnalyticsEvent[]): Promise<void> {
    if (events.length === 0) return;
    await this.database.write(async () => {
      const updates = events.map(e =>
        e.prepareUpdate(record => {
          record.synced = true;
        }),
      );
      await this.database.batch(...updates);
    });
  }

  /** Purge old synced events to save storage. */
  async purgeOlderThan(daysAgo: number): Promise<void> {
    const cutoff = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
    const old = await this.collection
      .query(
        Q.where('synced', true),
        Q.where('timestamp', Q.lt(cutoff)),
      )
      .fetch();

    if (old.length === 0) return;

    await this.database.write(async () => {
      const deletions = old.map(e => e.prepareDestroyPermanently());
      await this.database.batch(...deletions);
    });
  }

  // ---------------------------------------------------------------------------
  // Read operations
  // ---------------------------------------------------------------------------

  /** Get all events that haven't been synced yet. */
  async getUnsyncedEvents(): Promise<AnalyticsEvent[]> {
    return this.collection
      .query(Q.where('synced', false), Q.sortBy('timestamp', Q.asc))
      .fetch();
  }

  /** Get events by type. */
  async getByType(eventType: AnalyticsEventType): Promise<AnalyticsEvent[]> {
    return this.collection
      .query(
        Q.where('event_type', eventType),
        Q.sortBy('timestamp', Q.desc),
      )
      .fetch();
  }

  /** Get events for a specific user. */
  async getByUserId(userId: string): Promise<AnalyticsEvent[]> {
    return this.collection
      .query(
        Q.where('user_id', userId),
        Q.sortBy('timestamp', Q.desc),
      )
      .fetch();
  }

  /** Get events within a date range. */
  async getByDateRange(startMs: number, endMs: number): Promise<AnalyticsEvent[]> {
    return this.collection
      .query(
        Q.where('timestamp', Q.gte(startMs)),
        Q.where('timestamp', Q.lte(endMs)),
        Q.sortBy('timestamp', Q.asc),
      )
      .fetch();
  }

  /** Count of un-synced events. */
  async unsyncedCount(): Promise<number> {
    return this.collection
      .query(Q.where('synced', false))
      .fetchCount();
  }

  /** Total event count. */
  async totalCount(): Promise<number> {
    return this.collection.query().fetchCount();
  }

  /**
   * Get a batch of un-synced events (limited by count).
   * Useful for incremental sync without loading all events at once.
   */
  async getUnsyncedBatch(limit: number): Promise<AnalyticsEvent[]> {
    return this.collection
      .query(
        Q.where('synced', false),
        Q.sortBy('timestamp', Q.asc),
        Q.take(limit),
      )
      .fetch();
  }

  /** Count events by type (useful for analytics dashboard). */
  async countByType(eventType: AnalyticsEventType): Promise<number> {
    return this.collection
      .query(Q.where('event_type', eventType))
      .fetchCount();
  }

  /** Get events within the last N days. */
  async getRecentEvents(days: number): Promise<AnalyticsEvent[]> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return this.collection
      .query(
        Q.where('timestamp', Q.gte(cutoff)),
        Q.sortBy('timestamp', Q.desc),
      )
      .fetch();
  }

  /** Count synced events older than N days (candidates for purge). */
  async purgeCandidateCount(daysAgo: number): Promise<number> {
    const cutoff = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
    return this.collection
      .query(
        Q.where('synced', true),
        Q.where('timestamp', Q.lt(cutoff)),
      )
      .fetchCount();
  }
}
