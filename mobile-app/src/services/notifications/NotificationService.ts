import notifee, {
  AndroidImportance,
  AndroidChannel,
  TimestampTrigger,
  TriggerType,
  EventType,
  Event,
  AuthorizationStatus,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationType =
  | 'EXPIRING_TODAY'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'LOW_STOCK'
  | 'SHOPPING_REMINDER';

export interface NotificationPreferences {
  enabled: boolean;
  expiringToday: boolean;
  expiringSoon: boolean;
  expired: boolean;
  lowStock: boolean;
  shoppingReminder: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: number; // 0-23 (hour)
  quietHoursEnd: number;   // 0-23 (hour)
  soundEnabled: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  enabled: true,
  expiringToday: true,
  expiringSoon: true,
  expired: true,
  lowStock: true,
  shoppingReminder: true,
  quietHoursEnabled: true,
  quietHoursStart: 22, // 10 PM
  quietHoursEnd: 8,    // 8 AM
  soundEnabled: true,
};

/** Data attached to every notification for tap handling. */
interface NotificationData {
  type: NotificationType;
  itemId?: string;
  listId?: string;
  listName?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PREFS_KEY = '@groceryapp_notification_prefs';

const CHANNEL_EXPIRY = 'expiry_alerts';
const CHANNEL_LOW_STOCK = 'low_stock_alerts';
const CHANNEL_SHOPPING = 'shopping_reminders';

// Notification ID prefixes to manage per-item notifications
const PREFIX_EXPIRY_3D = 'exp3d_';
const PREFIX_EXPIRY_1D = 'exp1d_';
const PREFIX_EXPIRY_DAY = 'exp0d_';
const PREFIX_LOW_STOCK = 'lowstock_';
const PREFIX_SHOPPING = 'shop_';

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class NotificationService {
  private prefs: NotificationPreferences = {...DEFAULT_NOTIFICATION_PREFS};
  private initialized = false;

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    await this.createChannels();
    await this.loadPreferences();
  }

  /** Create Android notification channels. */
  private async createChannels(): Promise<void> {
    const channels: AndroidChannel[] = [
      {
        id: CHANNEL_EXPIRY,
        name: 'Expiry Alerts',
        description: 'Notifications for items about to expire or already expired',
        importance: AndroidImportance.HIGH,
      },
      {
        id: CHANNEL_LOW_STOCK,
        name: 'Low Stock Alerts',
        description: 'Notifications when items are running low',
        importance: AndroidImportance.DEFAULT,
      },
      {
        id: CHANNEL_SHOPPING,
        name: 'Shopping Reminders',
        description: 'Reminders for scheduled shopping trips',
        importance: AndroidImportance.DEFAULT,
      },
    ];

    for (const channel of channels) {
      await notifee.createChannel(channel);
    }
  }

  // -------------------------------------------------------------------------
  // Permissions
  // -------------------------------------------------------------------------

  /** Request notification permissions. Returns true if granted. */
  async requestPermission(): Promise<boolean> {
    const settings = await notifee.requestPermission();
    return (
      settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
      settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
    );
  }

  /** Check if notifications are currently permitted. */
  async hasPermission(): Promise<boolean> {
    const settings = await notifee.getNotificationSettings();
    return (
      settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
      settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
    );
  }

  // -------------------------------------------------------------------------
  // Preferences
  // -------------------------------------------------------------------------

  async loadPreferences(): Promise<NotificationPreferences> {
    try {
      const raw = await AsyncStorage.getItem(PREFS_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<NotificationPreferences>;
        this.prefs = {...DEFAULT_NOTIFICATION_PREFS, ...saved};
      }
    } catch {
      // Keep defaults
    }
    return this.prefs;
  }

  async savePreferences(prefs: Partial<NotificationPreferences>): Promise<void> {
    this.prefs = {...this.prefs, ...prefs};
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));
  }

  getPreferences(): NotificationPreferences {
    return {...this.prefs};
  }

  /** Check if a given notification type is enabled. */
  private isTypeEnabled(type: NotificationType): boolean {
    if (!this.prefs.enabled) return false;
    switch (type) {
      case 'EXPIRING_TODAY': return this.prefs.expiringToday;
      case 'EXPIRING_SOON': return this.prefs.expiringSoon;
      case 'EXPIRED': return this.prefs.expired;
      case 'LOW_STOCK': return this.prefs.lowStock;
      case 'SHOPPING_REMINDER': return this.prefs.shoppingReminder;
    }
  }

  // -------------------------------------------------------------------------
  // Quiet hours
  // -------------------------------------------------------------------------

  /**
   * Adjust a timestamp to respect quiet hours.
   * If the timestamp falls within quiet hours, push it to the end of quiet hours.
   */
  private adjustForQuietHours(timestamp: number): number {
    if (!this.prefs.quietHoursEnabled) return timestamp;

    const date = new Date(timestamp);
    const hour = date.getHours();
    const {quietHoursStart, quietHoursEnd} = this.prefs;

    const isInQuietHours = quietHoursStart > quietHoursEnd
      ? hour >= quietHoursStart || hour < quietHoursEnd  // e.g. 22-8 wraps midnight
      : hour >= quietHoursStart && hour < quietHoursEnd;

    if (isInQuietHours) {
      // Move to quiet hours end on the same or next day
      const adjusted = new Date(date);
      adjusted.setMinutes(0, 0, 0);
      adjusted.setHours(quietHoursEnd);
      // If the end hour is earlier in the day (wrap case) and we're past midnight
      // the adjustment is already correct. If we're before midnight, move to next day.
      if (adjusted.getTime() <= timestamp) {
        adjusted.setDate(adjusted.getDate() + 1);
      }
      return adjusted.getTime();
    }

    return timestamp;
  }

  // -------------------------------------------------------------------------
  // Schedule expiry notifications
  // -------------------------------------------------------------------------

  /**
   * Schedule all expiry-related notifications for an inventory item.
   * Call this when an item is added or its expiry date is updated.
   */
  async scheduleExpiryNotifications(
    itemId: string,
    itemName: string,
    expiryDate: Date | null,
  ): Promise<void> {
    // Cancel any existing notifications for this item first
    await this.cancelItemNotifications(itemId);

    if (!expiryDate) return;

    const expiryMs = expiryDate.getTime();
    const now = Date.now();

    // Schedule 3 days before expiry
    if (this.isTypeEnabled('EXPIRING_SOON')) {
      const threeDaysBefore = expiryMs - 3 * 24 * 60 * 60 * 1000;
      if (threeDaysBefore > now) {
        await this.scheduleTriggerNotification({
          id: `${PREFIX_EXPIRY_3D}${itemId}`,
          title: 'Expiring Soon',
          body: `📅 ${itemName} expires in 3 days`,
          timestamp: this.adjustForQuietHours(threeDaysBefore),
          channelId: CHANNEL_EXPIRY,
          data: {type: 'EXPIRING_SOON', itemId},
        });
      }
    }

    // Schedule 1 day before expiry
    if (this.isTypeEnabled('EXPIRING_SOON')) {
      const oneDayBefore = expiryMs - 1 * 24 * 60 * 60 * 1000;
      if (oneDayBefore > now) {
        await this.scheduleTriggerNotification({
          id: `${PREFIX_EXPIRY_1D}${itemId}`,
          title: 'Expiring Tomorrow',
          body: `📅 ${itemName} expires tomorrow`,
          timestamp: this.adjustForQuietHours(oneDayBefore),
          channelId: CHANNEL_EXPIRY,
          data: {type: 'EXPIRING_SOON', itemId},
        });
      }
    }

    // Schedule on expiry day (morning)
    if (this.isTypeEnabled('EXPIRING_TODAY')) {
      const expiryDay = new Date(expiryDate);
      expiryDay.setHours(9, 0, 0, 0); // 9 AM on expiry day
      const expiryDayMs = expiryDay.getTime();
      if (expiryDayMs > now) {
        await this.scheduleTriggerNotification({
          id: `${PREFIX_EXPIRY_DAY}${itemId}`,
          title: 'Expires Today',
          body: `⚠️ ${itemName} expires today!`,
          timestamp: this.adjustForQuietHours(expiryDayMs),
          channelId: CHANNEL_EXPIRY,
          data: {type: 'EXPIRING_TODAY', itemId},
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Low stock notification (immediate)
  // -------------------------------------------------------------------------

  /** Show a low stock notification immediately. */
  async showLowStockNotification(
    itemId: string,
    itemName: string,
  ): Promise<void> {
    if (!this.isTypeEnabled('LOW_STOCK')) return;

    await notifee.displayNotification({
      id: `${PREFIX_LOW_STOCK}${itemId}`,
      title: 'Low Stock',
      body: `🛒 Running low on ${itemName}`,
      android: {
        channelId: CHANNEL_LOW_STOCK,
        smallIcon: 'ic_notification',
        pressAction: {id: 'default'},
      },
      data: {type: 'LOW_STOCK', itemId} as Record<string, string>,
    });
  }

  // -------------------------------------------------------------------------
  // Shopping reminder
  // -------------------------------------------------------------------------

  /** Schedule a shopping list reminder at a specific date/time. */
  async scheduleShoppingReminder(
    listId: string,
    listName: string,
    date: Date,
  ): Promise<void> {
    if (!this.isTypeEnabled('SHOPPING_REMINDER')) return;

    const timestamp = this.adjustForQuietHours(date.getTime());
    if (timestamp <= Date.now()) return;

    await this.scheduleTriggerNotification({
      id: `${PREFIX_SHOPPING}${listId}`,
      title: 'Shopping Reminder',
      body: `📝 Time to shop! (${listName})`,
      timestamp,
      channelId: CHANNEL_SHOPPING,
      data: {type: 'SHOPPING_REMINDER', listId, listName},
    });
  }

  /** Cancel a shopping reminder. */
  async cancelShoppingReminder(listId: string): Promise<void> {
    await notifee.cancelNotification(`${PREFIX_SHOPPING}${listId}`);
  }

  // -------------------------------------------------------------------------
  // Cancel notifications
  // -------------------------------------------------------------------------

  /** Cancel all notifications for a specific inventory item. */
  async cancelItemNotifications(itemId: string): Promise<void> {
    await Promise.all([
      notifee.cancelNotification(`${PREFIX_EXPIRY_3D}${itemId}`),
      notifee.cancelNotification(`${PREFIX_EXPIRY_1D}${itemId}`),
      notifee.cancelNotification(`${PREFIX_EXPIRY_DAY}${itemId}`),
      notifee.cancelNotification(`${PREFIX_LOW_STOCK}${itemId}`),
    ]);
  }

  /** Cancel a single notification by ID. */
  async cancelNotification(notificationId: string): Promise<void> {
    await notifee.cancelNotification(notificationId);
  }

  /** Cancel all pending notifications. */
  async cancelAll(): Promise<void> {
    await notifee.cancelAllNotifications();
  }

  // -------------------------------------------------------------------------
  // Daily expiry check
  // -------------------------------------------------------------------------

  /**
   * Check all active items for expired status and show notifications.
   * This should be called on app launch and periodically.
   */
  async checkExpiredItems(
    items: Array<{id: string; name: string; expiryDate: Date | null; status: string}>,
  ): Promise<void> {
    if (!this.isTypeEnabled('EXPIRED')) return;

    const now = Date.now();
    for (const item of items) {
      if (
        item.status === 'active' &&
        item.expiryDate &&
        item.expiryDate.getTime() < now
      ) {
        await notifee.displayNotification({
          id: `expired_${item.id}`,
          title: 'Item Expired',
          body: `🚫 ${item.name} has expired`,
          android: {
            channelId: CHANNEL_EXPIRY,
            smallIcon: 'ic_notification',
            pressAction: {id: 'default'},
          },
          data: {type: 'EXPIRED', itemId: item.id} as Record<string, string>,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Notification press handler
  // -------------------------------------------------------------------------

  /**
   * Handle a notification event. Returns navigation data for the app to use.
   * Call this from your foreground/background event handlers.
   */
  handleNotificationEvent(event: Event): {
    action: 'navigate_item' | 'navigate_list' | 'none';
    itemId?: string;
    listId?: string;
  } | null {
    if (
      event.type !== EventType.PRESS &&
      event.type !== EventType.ACTION_PRESS
    ) {
      return null;
    }

    const data = event.detail.notification?.data as
      | NotificationData
      | undefined;
    if (!data?.type) return null;

    switch (data.type) {
      case 'EXPIRING_TODAY':
      case 'EXPIRING_SOON':
      case 'EXPIRED':
      case 'LOW_STOCK':
        return data.itemId
          ? {action: 'navigate_item', itemId: data.itemId}
          : {action: 'none'};
      case 'SHOPPING_REMINDER':
        return data.listId
          ? {action: 'navigate_list', listId: data.listId}
          : {action: 'none'};
      default:
        return {action: 'none'};
    }
  }

  // -------------------------------------------------------------------------
  // Reschedule all
  // -------------------------------------------------------------------------

  /**
   * Reschedule all expiry notifications for all active items.
   * Useful after preference changes (e.g. quiet hours) or app reinstall.
   */
  async rescheduleAll(
    activeItems: Array<{id: string; name: string; expiryDate: Date | null}>,
  ): Promise<void> {
    // Cancel all existing trigger notifications
    const triggers = await notifee.getTriggerNotificationIds();
    for (const id of triggers) {
      if (
        id.startsWith(PREFIX_EXPIRY_3D) ||
        id.startsWith(PREFIX_EXPIRY_1D) ||
        id.startsWith(PREFIX_EXPIRY_DAY)
      ) {
        await notifee.cancelNotification(id);
      }
    }

    // Reschedule for each item
    for (const item of activeItems) {
      await this.scheduleExpiryNotifications(item.id, item.name, item.expiryDate);
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async scheduleTriggerNotification(opts: {
    id: string;
    title: string;
    body: string;
    timestamp: number;
    channelId: string;
    data: NotificationData;
  }): Promise<void> {
    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: opts.timestamp,
    };

    await notifee.createTriggerNotification(
      {
        id: opts.id,
        title: opts.title,
        body: opts.body,
        android: {
          channelId: opts.channelId,
          smallIcon: 'ic_notification',
          pressAction: {id: 'default'},
          sound: this.prefs.soundEnabled ? 'default' : undefined,
          importance: AndroidImportance.HIGH,
        },
        data: opts.data as Record<string, string>,
      },
      trigger,
    );
  }
}

export default new NotificationService();
