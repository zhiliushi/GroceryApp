import analytics from '@react-native-firebase/analytics';

/**
 * Thin wrapper around Firebase Analytics for consistent event logging.
 */
class AnalyticsService {
  // -------------------------------------------------------------------------
  // Core methods
  // -------------------------------------------------------------------------

  /** Log a custom event. */
  async logEvent(
    name: string,
    params?: Record<string, string | number | boolean>,
  ): Promise<void> {
    await analytics().logEvent(name, params);
  }

  /** Log a screen view. */
  async logScreenView(screenName: string): Promise<void> {
    await analytics().logScreenView({
      screen_name: screenName,
      screen_class: screenName,
    });
  }

  /** Set the current user ID for analytics attribution. */
  async setUserId(userId: string | null): Promise<void> {
    await analytics().setUserId(userId);
  }

  /** Set a single user property. */
  async setUserProperty(
    name: string,
    value: string | null,
  ): Promise<void> {
    await analytics().setUserProperty(name, value);
  }

  /** Set multiple user properties at once. */
  async setUserProperties(
    properties: Record<string, string | null>,
  ): Promise<void> {
    const entries = Object.entries(properties);
    await Promise.all(
      entries.map(([name, value]) => analytics().setUserProperty(name, value)),
    );
  }

  // -------------------------------------------------------------------------
  // Convenience helpers — barcode & inventory
  // -------------------------------------------------------------------------

  async logItemScanned(barcode: string, found: boolean): Promise<void> {
    await this.logEvent('item_scanned', {barcode, found: found ? 1 : 0});
  }

  async logItemAdded(categoryId: string, source: 'manual' | 'barcode_scan'): Promise<void> {
    await this.logEvent('item_added', {category_id: categoryId, source});
  }

  async logPurchaseRecorded(amount: number): Promise<void> {
    await this.logEvent('purchase_recorded', {amount});
  }

  // -------------------------------------------------------------------------
  // Convenience helpers — lifecycle transitions
  // -------------------------------------------------------------------------

  /** Stage 1 → Stage 2: scan promoted to inventory. */
  async logScanPromoted(barcode: string, inventoryItemId: string): Promise<void> {
    await this.logEvent('scan_promoted', {barcode, inventory_item_id: inventoryItemId});
  }

  /** Stage 1: scan discarded by user or TTL. */
  async logScanDiscarded(barcode: string, reason: 'user' | 'ttl'): Promise<void> {
    await this.logEvent('scan_discarded', {barcode, reason});
  }

  /** Stage 2 → Stage 3: item consumed/expired/discarded. */
  async logItemConsumed(
    inventoryItemId: string,
    reason: 'used_up' | 'expired' | 'discarded',
  ): Promise<void> {
    await this.logEvent('item_consumed', {inventory_item_id: inventoryItemId, reason});
  }

  // -------------------------------------------------------------------------
  // Convenience helpers — shopping lists
  // -------------------------------------------------------------------------

  async logListCreated(listId: string, name: string): Promise<void> {
    await this.logEvent('list_created', {list_id: listId, list_name: name});
  }

  async logListCompleted(listId: string, totalItems: number, purchasedItems: number): Promise<void> {
    await this.logEvent('list_completed', {
      list_id: listId,
      total_items: totalItems,
      purchased_items: purchasedItems,
    });
  }

  // -------------------------------------------------------------------------
  // Convenience helpers — sync
  // -------------------------------------------------------------------------

  async logSyncCompleted(itemCount: number): Promise<void> {
    await this.logEvent('sync_completed', {item_count: itemCount});
  }

  // -------------------------------------------------------------------------
  // Convenience helpers — additional events
  // -------------------------------------------------------------------------

  /** Log when an item is permanently deleted. */
  async logItemDeleted(itemId: string, name: string): Promise<void> {
    await this.logEvent('item_deleted', {item_id: itemId, name});
  }

  /** Log when an expired item is wasted (expired + discarded). */
  async logItemExpiredWasted(itemId: string, name: string, daysExpired: number): Promise<void> {
    await this.logEvent('item_expired_wasted', {
      item_id: itemId,
      name,
      days_expired: daysExpired,
    });
  }

  /** Log a recipe view (paid feature). */
  async logRecipeViewed(recipeId: string, recipeName: string): Promise<void> {
    await this.logEvent('recipe_viewed', {recipe_id: recipeId, recipe_name: recipeName});
  }

  /** Log a screen view with a screen name. */
  async logScreen(screenName: string): Promise<void> {
    await this.logScreenView(screenName);
    await this.logEvent('screen_view', {screen_name: screenName});
  }

  /** Log generic feature usage. */
  async logFeatureUsed(featureName: string, details?: Record<string, string | number>): Promise<void> {
    await this.logEvent('feature_used', {feature: featureName, ...details});
  }
}

export default new AnalyticsService();
